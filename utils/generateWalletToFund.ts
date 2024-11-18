import { Keypair, Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path'
import dotenv from 'dotenv'
import { KEYCODE } from '../assets/bot-wallet'

dotenv.config()
const FUNDING_WALLET_SECRET = KEYCODE
const rpc = process.env.RPC_URL
const AMOUNT_TO_SEND = 253000; // Amount to send in lamports (1 SOL = 1,000,000,000 lamports)

const connection = new Connection(rpc, 'confirmed');

// Load funding wallet keypair
const fundingWallet = Keypair.fromSecretKey(new Uint8Array(FUNDING_WALLET_SECRET));

// Create 'keys' directory if it doesn't exist
const keysDirectory = path.join(__dirname, 'keys');
if (!fs.existsSync(keysDirectory)) {
    fs.mkdirSync(keysDirectory);
}

async function generateKeypair() {
    // Generate new keypair
    const keypair = Keypair.generate();

    // Extract relevant information
    const publicKey = keypair.publicKey.toBase58();
    const secretKey = keypair.secretKey;

    // Write secret key to a file in the 'keys' directory, using public key as filename
    fs.writeFileSync(path.join(keysDirectory, `${publicKey}.json`), JSON.stringify(Array.from(secretKey)));

    // Display information in a pretty format
    console.log(`
        ===========================
        = New Solana Keypair Info =
        ===========================
        Secret Key: ${secretKey}
        Secret Key;
        Secret Key saved to file: ${publicKey}.key

        Please keep your Secret Key stored securely and do not share it publicly.
        ===========================
    `);

    // Fund the new wallet
    await fundNewWallet(keypair);
}

async function fundNewWallet(newWallet) {
    try {
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: fundingWallet.publicKey,
                toPubkey: newWallet.publicKey,
                lamports: AMOUNT_TO_SEND,
            })
        );

        const signature = await sendAndConfirmTransaction(connection, transaction, [fundingWallet]);
        console.log(`Successfully funded wallet ${newWallet.publicKey.toBase58()} with ${AMOUNT_TO_SEND} lamports. Transaction signature: ${signature}`);
    } catch (error) {
        console.error(`Failed to fund wallet ${newWallet.publicKey.toBase58()}:`, error);
    }
}

// Call the function to generate a keypair and display info
generateKeypair();
