import { sellIx } from "./utils/sell-bot-funder";
import dotenv from 'dotenv';
import { Connection, PublicKey } from "@solana/web3.js";
import { checkAndCloseTokenAccount } from "./tokenCloser";
dotenv.config();

const mintAddress = process.env.TOKEN_MINT;
const connection = new Connection(process.env.RPC_URL);
const tokenMintAddress = new PublicKey(process.env.TOKEN_MINT);
const wallet1 = new PublicKey(process.env.BOT_WALLET);
const wallet= new PublicKey(process.env.TOKEN_MINT);

const ANSI_COLORS = {
    CYAN: "\x1b[36m",
    RED: "\x1b[31m",
    GREEN: "\x1b[32m",
    YELLOW: "\x1b[33m",
    MAGENTA: "\x1b[35m",
    BLUE: "\x1b[34m",
    RESET: "\x1b[0m"
};

const executeSell = async (mintAddress) => {
    try {
        
         await sellIx(mintAddress);
        }
    catch (error) {
        console.error(`${ANSI_COLORS.RED}Error during buyIx: ${error.message}${ANSI_COLORS.RESET}`);
    };
};
executeSell(mintAddress);