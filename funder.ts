import { buyIx } from "./utils/buy-bot-funder";
import dotenv from 'dotenv';
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import fs from 'fs';
import path from 'path';

dotenv.config();

const mintAddress = process.env.TOKEN_MINT;
const connection = new Connection(process.env.RPC_URL);

const ANSI_COLORS = {
    CYAN: "\x1b[36m",
    RED: "\x1b[31m",
    GREEN: "\x1b[32m",
    YELLOW: "\x1b[33m",
    MAGENTA: "\x1b[35m",
    BLUE: "\x1b[34m",
    RESET: "\x1b[0m"
};

const getNonZeroWallets = async (keypairs) => {
    const nonZeroWallets = [];
    for (const keypair of keypairs) {
        const publicKey = keypair.publicKey;
        const balance = await connection.getBalance(publicKey);
        if (balance > 0) {
            nonZeroWallets.push(keypair);
        }
    }
    return nonZeroWallets;
};

const executeBuy = async (mintAddress, creatorKeypair) => {
        await buyIx(mintAddress, creatorKeypair);
    
};

// List of wallets to scan


const keysDirectory = path.join(__dirname, 'utils', 'keys');

// Load wallet public keys from the directory
const loadWalletsFromDir = () => {
    const keypairs = [];
    if (fs.existsSync(keysDirectory)) {
        const files = fs.readdirSync(keysDirectory);
        for (const file of files) {
            try {
                const keyData = fs.readFileSync(path.join(keysDirectory, file), 'utf-8');
                const keyArray = JSON.parse(keyData);
                const keypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
                keypairs.push(keypair);
            } catch (error) {
                console.error(`${ANSI_COLORS.RED}Error reading wallet file ${file}: ${error.message}${ANSI_COLORS.RESET}`);
            }
        }
    }
    return keypairs;
};

const keypairs = loadWalletsFromDir();

const startFunderMode = async () => {
    try {
        console.log(`${ANSI_COLORS.CYAN}Scanning wallets for non-zero balances...${ANSI_COLORS.RESET}`);
        const nonZeroWallets = await getNonZeroWallets(keypairs);
        for (const keypair of keypairs) {
            const publicKey = keypair.publicKey;
            const balance = await connection.getBalance(publicKey);
            console.log(`${ANSI_COLORS.YELLOW}Wallet: ${publicKey.toBase58()}, Balance: ${balance} lamports${ANSI_COLORS.RESET}`);
        }
        console.log(`${ANSI_COLORS.GREEN}Non-zero wallets found: ${nonZeroWallets.length}${ANSI_COLORS.RESET}`);

        for (const keypair of nonZeroWallets) {
    console.log(`${ANSI_COLORS.YELLOW}Executing buy for wallet: ${keypair.publicKey.toBase58()}${ANSI_COLORS.RESET}`);
    await executeBuy(mintAddress, keypair);
}
    } catch (error) {
        console.error(`${ANSI_COLORS.RED}Error during funder mode: ${error.message}${ANSI_COLORS.RESET}`);
    }
};

// Run the funder mode
startFunderMode();
