import { buyIx } from "./utils/buy-bot-funder";
import dotenv from 'dotenv';
import { Connection, PublicKey } from "@solana/web3.js";

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

const executeBuy = async (mintAddress) => {
    try {
         await buyIx(mintAddress);
        }
     catch (error) {
        console.error(`${ANSI_COLORS.RED}Error during buyIx: ${error.message}${ANSI_COLORS.RESET}`);
    }
};
// Run the buy function once
setInterval(async () => {
    try {
            executeBuy(mintAddress);
            console.log(`${ANSI_COLORS.YELLOW}placing buy.${ANSI_COLORS.RESET}`);
    } catch (error) {
        console.error(`${ANSI_COLORS.RED}Error during buyIx: ${error.message}${ANSI_COLORS.RESET}`);
        // Retry mechanism or further handling could be implemented here if needed
    }
}, 5000);
