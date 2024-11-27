import { Keypair, Connection, Transaction, SystemProgram } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { KEYCODE } from '../assets/bot-wallet';

dotenv.config();
const FUNDING_WALLET_SECRET = KEYCODE;
const rpc = process.env.RPC_URL;
const connection = new Connection(rpc, 'confirmed');

// Load funding wallet keypair
const fundingWallet = Keypair.fromSecretKey(new Uint8Array(FUNDING_WALLET_SECRET));

// Directory paths for key files
const keysDirectory = path.join(__dirname, 'keys');
const keysDirectory1 = path.join(keysDirectory, 'keys1');

// Ensure directories exist, and clear `keys1` directory if it exists
if (!fs.existsSync(keysDirectory)) {
    fs.mkdirSync(keysDirectory);
}
if (!fs.existsSync(keysDirectory1)) {
    fs.mkdirSync(keysDirectory1);
} else {
    // Empty `keys1` if it already exists
    fs.readdirSync(keysDirectory1).forEach((file) => {
        fs.unlinkSync(path.join(keysDirectory1, file));
    });
}

// File path to save raw transactions for the second script
const transactionsFilePath = './assets/transactions.json';

export async function generateKeypairsAndTransactions(count) {
    const rawTransactions = [];
    let fundingWalletBalance = await connection.getBalance(fundingWallet.publicKey);

    for (let i = 0; i < count; i++) {
        const keypair = Keypair.generate();
        const publicKey = keypair.publicKey.toBase58();
        const secretKey = keypair.secretKey;

        // Convert secret key to JSON array format
        const secretKeyJson = JSON.stringify(Array.from(secretKey));

        // Save each new keypair's secret key to both directories
        fs.writeFileSync(path.join(keysDirectory, `${publicKey}.json`), secretKeyJson);
        fs.writeFileSync(path.join(keysDirectory1, `${publicKey}.json`), secretKeyJson);

        const { rawtx: rawTransaction, lamportsToSend } = await createRawTransaction(keypair, fundingWalletBalance);
        if (rawTransaction && rawTransaction !== '') {
        rawTransactions.push({ tx: rawTransaction });
    }
        console.log(`Raw transaction for wallet ${publicKey}:`, rawTransaction);

        // Subtract the sent amount from the funding wallet balance
        const sentAmount = lamportsToSend;
        fundingWalletBalance -= sentAmount;
    }

    // Save all raw transactions to a JSON file
    fs.writeFileSync(transactionsFilePath, JSON.stringify(rawTransactions, null, 2));
    console.log(`Raw transactions saved to ${transactionsFilePath}`);
}

async function createRawTransaction(newWallet, fundingWalletBalance) {
    const randomPercentage = Math.random() * (8 - 5) + 5;
    
    const lamportsToSend = Math.floor((fundingWalletBalance * randomPercentage) / 100);

    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: fundingWallet.publicKey,
            toPubkey: newWallet.publicKey,
            lamports: lamportsToSend,
        })
    );

    // Set the fee payer
    transaction.feePayer = fundingWallet.publicKey;

    // Fetch the recent blockhash and set it on the transaction
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    // Partially sign the transaction with the funding wallet
    transaction.partialSign(fundingWallet);

    // Serialize and return as base64 for saving
    const rawtx = transaction.serialize().toString('base64');
    return { rawtx, lamportsToSend };
}


// Generate 5 new keypairs and output raw transactions
generateKeypairsAndTransactions(4);
