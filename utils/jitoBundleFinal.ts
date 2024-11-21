import { Connection, SystemProgram, TransactionMessage, VersionedTransaction, PublicKey, Keypair } from '@solana/web3.js';
const fs = require('fs');
import fetch from 'node-fetch';
import bs58 from 'bs58';
import { KEYCODE } from '../assets/bot-wallet';
import { exec } from 'child_process';
const dotenv = require('dotenv');

dotenv.config()


const TIP_ACCOUNT = "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5";
const filePath = './assets/transactions2.json';
const url = "https://mainnet.block-engine.jito.wtf/api/v1/bundles"; // Jito API endpoint
const mainSigner = Keypair.fromSecretKey(new Uint8Array(KEYCODE));
const RPC_URL = process.env.RPC_URL;
// Utility function to delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isValidBase58 = (input: string): boolean => {
    try {
        bs58.decode(input);
        return true;
    } catch (error) {
        return false;
    }
};

// Load transaction data from JSON file, taking only the first 4 transactions
const readTransactions = (filePath: string): string[] => {
    const data = fs.readFileSync(filePath, 'utf8');
    const transactions = JSON.parse(data);
    return transactions.slice(0, 4).map((tx) => tx.rawTransaction); // Take the first 4 transactions
};


// Send the transaction bundle to Jito's Block Engine and retrieve bundle ID
const sendBundleToJito = async (transactions: string[]): Promise<string> => {
    if (transactions.length > 5) {
        throw new Error("Bundles cannot contain more than 5 transactions.");
    }

    const requestBody = {
        jsonrpc: "2.0",
        id: 11,
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorResponse = await response.text();
        throw new Error(`Failed to send bundle. Status code: ${response.status}, Response: ${errorResponse}`);
    }

    const responseData = await response.json();
    if (responseData.result) {
        const bundleId = responseData.result;
        console.log("Bundle ID:", bundleId); // Logs the bundle ID for reference
        return bundleId;
    } else {
        throw new Error("No bundle ID returned from the bundle submission.");
    }
};

// Check the status of the bundle
const checkBundleStatus = async (bundleId: string): Promise<any> => {
    const requestBody = {
        "jsonrpc": "2.0",
        "id": 11,
        "method": "getBundleStatuses",
        "params": [[bundleId]]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorResponse = await response.text();
        throw new Error(`Failed to get bundle status. Status code: ${response.status}, Response: ${errorResponse}`);
    }

    return response.json();
};

// Retry mechanism to check bundle status
const mainWithRetry = async (bundleId: string) => {
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
        const response = await checkBundleStatus(bundleId);
        if (response.result?.value.length) {
            console.log("Bundle Status Response:", response);
            return;
        }

        console.log(`Attempt ${attempts + 1}: No status information available, retrying...`);
        attempts++;
        await delay(5000); // Wait 10 seconds before retrying
    }

    console.log("Max attempts reached. The bundle status is still not available.");
    await main();
};

// Main function to process transactions and check bundle status
// Main function to process transactions and check bundle status
const main = async () => {
    const connection = new Connection(RPC_URL, 'confirmed');
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    console.log("Recent Blockhash:", recentBlockhash);

    // Read the first 5 transactions from the file
    const signedTransactions = readTransactions(filePath);

    if (signedTransactions.length === 0) {
        console.error("No valid transactions to bundle.");
        return;
    }

    // Output final transactions for bundling
    console.log("Final signed transactions for bundling:", signedTransactions);

    // Send the bundle to Jito's Block Engine and check the status
    try {
        console.log(signedTransactions[0]);
        const response = await sendBundleToJito(signedTransactions);
        const bundleId = response;
        console.log("Bundle submitted. Bundle ID:", response);
        await mainWithRetry(bundleId);
    } catch (error) {
        console.error("Error sending bundle:", error.message);
        exec('ts-node ./utils/buy-bot-holders.ts', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing script: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`Script error output: ${stderr}`);
                return;
            }
            console.log(`Script output: ${stdout}`);
        });
    }
};

main().catch((error) => console.error("Error:", error.message));
