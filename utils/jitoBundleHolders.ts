import fs from 'fs';
import { Connection, Transaction, PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fetch from 'node-fetch';
import bs58 from 'bs58';
import { KEYCODE } from '../assets/bot-wallet';
import dotenv from 'dotenv';

dotenv.config();

const TIP_ACCOUNT = "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5";
const keypair = Keypair.fromSecretKey(KEYCODE);
const filePath = './assets/transactions.json';

// Function to read transaction data from the JSON file
const readTransactions = (filePath) => {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data).map((tx) => tx.tx);
};

// Function to sign transaction
const signTransaction = async (transactionData, keypair, recentBlockhash) => {
    const tx = Transaction.from(Buffer.from(transactionData, 'base64'));
    tx.recentBlockhash = recentBlockhash;
    tx.feePayer = keypair.publicKey;
    tx.sign(keypair);
    return bs58.encode(tx.serialize());
};

// Send the bundle to Jito's Block Engine
const sendBundleToJito = async (transactions) => {
    const url = "https://mainnet.block-engine.jito.wtf/api/v1/bundles";
    const requestBody = {
        jsonrpc: "2.0",
        id: 1,
        method: "sendBundle",
        params: [transactions]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorResponse = await response.text();
        throw new Error(`Failed to send bundle. Status: ${response.status}, Response: ${errorResponse}`);
    }

    const responseData = await response.json();
    return responseData.result;
};

// Check the status of the bundle
const checkBundleStatus = async (bundleId) => {
    const url = "https://mainnet.block-engine.jito.wtf/api/v1/bundles";
    const requestBody = {
        jsonrpc: "2.0",
        id: 1,
        method: "getBundleStatuses",
        params: [[bundleId]]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorResponse = await response.text();
        throw new Error(`Failed to get bundle status. Status code: ${response.status}, Response: ${errorResponse}`);
    }

    return response.json();
};

// Add a tip instruction to the last transaction in the bundle
const addTipToLastTransaction = async (transactions, recentBlockhash) => {
    const lastTransactionBase58 = transactions.pop();
    const lastTransaction = Transaction.from(Buffer.from(bs58.decode(lastTransactionBase58)));

    lastTransaction.add(
        SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: new PublicKey(TIP_ACCOUNT),
            lamports: 0.0001 * LAMPORTS_PER_SOL// Set the desired tip amount
        })
    );

    lastTransaction.recentBlockhash = recentBlockhash;
    lastTransaction.feePayer = keypair.publicKey;
    lastTransaction.sign(keypair);

    transactions.push(bs58.encode(lastTransaction.serialize()));
    return transactions;
};

// Main function to bundle, send, and check status
const main = async () => {
    try {
        const connection = new Connection(process.env.RPC_URL, 'confirmed');
        const transactions = readTransactions(filePath);
        const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        const signedTransactions = [];
        for (const serializedTx of transactions) {
            signedTransactions.push(await signTransaction(serializedTx, keypair, recentBlockhash));
        }

        const finalTransactions = await addTipToLastTransaction(signedTransactions, recentBlockhash);
        const bundleId = await sendBundleToJito(finalTransactions);
        console.log('Bundle Submission Response:', bundleId);

        // Check bundle status with retry mechanism
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
            const statusResponse = await checkBundleStatus(bundleId);
            if (statusResponse.result?.[0]?.status) {
                console.log("Bundle Status:", statusResponse.result[0].status);
                break;
            }
            console.log(`Attempt ${attempts + 1}: No status information available, retrying...`);
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 5000)); // Delay before retrying
        }

        if (attempts === maxAttempts) {
            console.error("Max attempts reached. Bundle status is still not available.");
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
};

main();
