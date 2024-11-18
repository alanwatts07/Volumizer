import { buyIx } from "./utils/buy-bot-looper";
import dotenv from 'dotenv';
import { sellIx } from "./utils/sell-bot";
import { Connection, PublicKey } from "@solana/web3.js";

dotenv.config();

const mintAddress = process.env.TOKEN_MINT;
const walletPublicKey = new PublicKey(process.env.BOT_WALLET);
const connection = new Connection(process.env.RPC_URL);

let activeInterval = null;  // To keep track of the active interval

const ANSI_COLORS = {
    CYAN: "\x1b[36m",
    RED: "\x1b[31m",
    GREEN: "\x1b[32m",
    YELLOW: "\x1b[33m",
    MAGENTA: "\x1b[35m",
    BLUE: "\x1b[34m",
    RESET: "\x1b[0m"
};

const checkBalance = async () => {
    try {
        const balance = await connection.getBalance(walletPublicKey);
        const solBalance = balance / 1e9; // Convert lamports to SOL
        console.log(`${ANSI_COLORS.CYAN}Current balance: ${solBalance.toFixed(4)} SOL${ANSI_COLORS.RESET}`);
        return solBalance;
    } catch (error) {
        console.error(`${ANSI_COLORS.RED}Error while checking balance: ${error.message}${ANSI_COLORS.RESET}`);
        return 0;
    }
};

const executeWithInterval = async (interval, mintAddress) => {
    if (activeInterval) {
        clearInterval(activeInterval);
    }

    activeInterval = setInterval(async () => {
        try {
            const balance = await checkBalance();
            if (balance > 0.03) {
                console.log(`${ANSI_COLORS.GREEN}Sufficient balance. Proceeding with buy transaction...${ANSI_COLORS.RESET}`);
                await buyIx(mintAddress);
            } else {
                console.log(`${ANSI_COLORS.YELLOW}Insufficient balance. Waiting for balance to increase above 0.03 SOL.${ANSI_COLORS.RESET}`);
                await sellIx(mintAddress);
            }
        } catch (error) {
            console.error(`${ANSI_COLORS.RED}Error during buyIx: ${error.message}${ANSI_COLORS.RESET}`);
            // Retry mechanism or further handling could be implemented here if needed
        }
    }, interval);

    // Stop the interval after 20 minutes
    setTimeout(() => {
        try {
            clearInterval(activeInterval);
            activeInterval = null;
            console.log(`${ANSI_COLORS.MAGENTA}Stopped interval after 20 minutes${ANSI_COLORS.RESET}`);
        } catch (error) {
            console.error(`${ANSI_COLORS.RED}Error while stopping the interval: ${error.message}${ANSI_COLORS.RESET}`);
        }
    }, 20 * 60 * 1000); // 20 minutes in milliseconds
};

const meta_loop = async () => {
    setInterval(async () => {
        try {
            await executeWithInterval(8000, mintAddress);
            console.log(`${ANSI_COLORS.BLUE}Executing sell transaction...${ANSI_COLORS.RESET}`);
            await sellIx(mintAddress);
        } catch (error) {
            console.error(`${ANSI_COLORS.RED}Error during meta_loop execution: ${error.message}${ANSI_COLORS.RESET}`);
            // Handle sell failure (e.g., retry, log)
        }
    }, 60000 * 5); // Every 5 minutes
};

// Run both functions
try {
    executeWithInterval(5000, mintAddress);
    meta_loop();
} catch (error) {
    console.error(`${ANSI_COLORS.RED}Error during initial execution: ${error.message}${ANSI_COLORS.RESET}`);
}
