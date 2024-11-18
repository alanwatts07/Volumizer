import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import path from 'path';

// Generate a new wallet keypair
const wallet = Keypair.generate();
const publicKey = wallet.publicKey.toBase58();
const secretKey = wallet.secretKey;

// Directories and paths
const assetsDir = path.join(__dirname, 'assets');
const botWalletPath = path.join(assetsDir, 'bot-wallet.ts');
const secretKeyPath = path.join(assetsDir, 'generated-wallet.json');
const publicKeyFilePath = path.join(assetsDir, publicKey); // No .txt extension

// Create the assets directory if it doesn't exist
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir);
}

// Check if bot-wallet.ts exists and create a backup if it does
if (fs.existsSync(botWalletPath)) {
    const backupName = `bot-wallet.old_${new Date().toISOString().replace(/[:.]/g, '-')}.bk`;
    const backupPath = path.join(assetsDir, backupName);
    fs.copyFileSync(botWalletPath, backupPath);
    console.log(`Existing bot-wallet.ts backed up as: ${backupName}`);
}

// Save the secret key as a JSON file (kept for initial record)
fs.writeFileSync(secretKeyPath, JSON.stringify(Array.from(secretKey)));
console.log('Secret key saved to:', secretKeyPath);

// Write the new `bot-wallet.ts` file with the secret key
const botWalletContent = `export const KEYCODE = new Uint8Array(${JSON.stringify(Array.from(secretKey))});\n`;
fs.writeFileSync(botWalletPath, botWalletContent);
console.log('New bot-wallet.ts created.');

// Create a new file named after the public key containing the secret key, formatted as requested
const publicKeyFileContent = `Secret Key (Uint8Array):\n${JSON.stringify(Array.from(secretKey))}\n`;
fs.writeFileSync(publicKeyFilePath, publicKeyFileContent);
console.log(`Public key file created: ${publicKeyFilePath}`);

// Display the public and secret keys in the console
console.log('Public Key:', publicKey);
console.log('Secret Key (Uint8Array):', secretKey);
