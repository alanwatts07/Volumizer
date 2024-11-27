import fs from 'fs';
import { Connection, Transaction, PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import fetch from 'node-fetch';
import { VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

const TIP_ACCOUNT = "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5"; // Example tip account for mainnet

// Load the keypair
const keypair = Keypair.fromSecretKey(Uint8Array.from([234, 40, 5, 198, 83, 62, 0, 17, 56, 32, 244, 235, 22, 203, 177, 209, 131, 238, 5, 177, 201, 235, 1, 90, 253, 181, 224, 112, 113, 196, 128, 85, 83, 15, 139, 189, 134, 231, 162, 15, 173, 250, 67, 48, 10, 169, 216, 131, 179, 106, 247, 44, 111, 133, 74, 252, 127, 170, 42, 46, 56, 68, 100, 149]));

// Utility function to check if a string is valid base58
const isValidBase58 = (input: string): boolean => {
    try {
        bs58.decode(input);
        return true;
    } catch (error) {
        return false;
    }
};

// File path for transaction signatures
const filePath = './assets/transactions.json';

// Function to read transaction data from a JSON file
const readTransactions = (filePath: string): string[] => {
    const data = fs.readFileSync(filePath, 'utf8');
    const parsedData = JSON.parse(data);
    return parsedData.map((tx: { tx: string }) => tx.tx);
};

// Function to sign transaction
const signTransaction = async (transactionData: string, keypair: Keypair, recentBlockhash: string) => {
    // Deserialize the base64 transaction data to a VersionedTransaction
    const tx = VersionedTransaction.deserialize(Buffer.from(transactionData, 'base64'));
    console.log(tx);
    // Set the recent blockhash
    tx.message.recentBlockhash = recentBlockhash;

    // Sign the transaction
    tx.sign([keypair]);

    // Serialize the signed transaction back and encode it as base58
    return bs58.encode(tx.serialize());
};

// Function to send the bundle to Jito's Block Engine
const sendBundleToJito = async (transactions: string[]) => {
    if (transactions.length > 5) {
        throw new Error("Bundles cannot contain more than 5 transactions.");
    }

    const url = "https://mainnet.block-engine.jito.wtf/api/v1/bundles"; // Jito API endpoint

    // Prepare the JSON-RPC request body
    const requestBody = {
        jsonrpc: "2.0",
        id: 1,
        method: "sendBundle",
        params: [transactions]
    };

    // Validate each transaction before sending
    transactions.forEach((tx, index) => {
        if (!isValidBase58(tx)) {
            throw new Error(`Transaction at index ${index} is not a valid base58-encoded string.`);
        }
    });

    // Make the request
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    // Handle response errors
    if (!response.ok) {
        const errorResponse = await response.text();
        throw new Error(`Failed to send bundle. Status code: ${response.status}, Response: ${errorResponse}`);
    }

    // Parse and return the JSON response
    return response.json();
};

// Function to include a tip transaction at the end of the bundle
const addTipTransaction = (transactions: string[], recentBlockhash: string): string[] => {
    // Add a transaction to transfer the tip amount to the tip account
    const tipTransaction = createTipTransaction(recentBlockhash);
    return [...transactions, tipTransaction];
};

// Main function
const main = async () => {
    try {
        // Initialize the connection to the Solana cluster
        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

        // Read transactions from the JSON file
        const transactions = readTransactions(filePath);
        const signedTransactions = transactions

         // Get a recent blockhash for signing transactions
        const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
/*
        // Sign transactions
        const signedTransactions = [];
        for (const serializedTx of transactions) {
            const signedTx = await signTransaction(serializedTx, keypair, recentBlockhash);
            signedTransactions.push(signedTx);
        }
        console.log('Signed Transactions:', signedTransactions); */

        // Add the tip transaction as the last transaction in the bundle
        const finalTransactions = addTipTransaction(signedTransactions, recentBlockhash);

        // Send the bundle to Jito
        const response = await sendBundleToJito(finalTransactions);
        console.log('Bundle Submission Response:', response);
    } catch (error: any) {
        console.error('Error:', error.message);
        if (error.stack) {
            console.error('Stack Trace:', error.stack);
        }
    }
};

// Utility function to create a tip transaction
const createTipTransaction = (recentBlockhash: string): string => {
    // Create a tip transaction to pay one of the mainnet tip accounts
    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: new PublicKey(TIP_ACCOUNT),
            lamports: 300000 // Minimum tip of 1,000 lamports
        })
    );

    // Set the recent blockhash for the transaction
    transaction.recentBlockhash = recentBlockhash;

    // Sign the transaction
    transaction.sign(keypair);

    // Serialize the transaction and encode it as base58
    return bs58.encode(transaction.serialize());
};

// Execute the main function
main();
