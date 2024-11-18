Imports and Configuration
javascript
Copy code
import { buyIx } from "./utils/buy-bot-looper";
import dotenv from 'dotenv';
import { sellIx } from "./utils/sell-bot";
import { Connection, PublicKey } from "@solana/web3.js";

dotenv.config();
Imports: The code imports necessary modules:

buyIx from ./buy-bot-no-conf and sellIx from ./sell-bot, which are functions to execute buying and selling of tokens.
dotenv is used to load environment variables from a .env file.
The Solana Web3 library is used to interact with the Solana blockchain.
Environment Setup: dotenv.config() loads the environment variables, such as token mint addresses and connection details, from the .env file.

Key Constants
javascript
Copy code
const mintAddress = process.env.TOKEN_MINT;
const walletPublicKey = new PublicKey(process.env.BOT_WALLET);
const connection = new Connection(process.env.RPC_URL);
mintAddress: The address of the token to buy and sell.
walletPublicKey: The public key of the wallet being used to perform buy and sell transactions, derived from the environment variable.
connection: An instance of the Solana connection object, used to communicate with the Solana blockchain network.
ANSI Colors for Console Logging
javascript
Copy code
const ANSI_COLORS = {
    CYAN: "\x1b[36m",
    RED: "\x1b[31m",
    GREEN: "\x1b[32m",
    YELLOW: "\x1b[33m",
    MAGENTA: "\x1b[35m",
    BLUE: "\x1b[34m",
    RESET: "\x1b[0m"
};
This object contains ANSI escape codes used to colorize console output to make the logging more readable. For example, messages can be shown in blue, green, red, etc., for easier differentiation of information.
Balance Check Function
javascript
Copy code
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
checkBalance: This function fetches the wallet's balance using the Solana connection and wallet public key.
Converts the balance from lamports (the smallest unit in Solana) to SOL.
Prints the balance in cyan to the console.
Returns the balance value in SOL.
Buying Tokens with Interval Execution
javascript
Copy code
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
            }
        } catch (error) {
            console.error(`${ANSI_COLORS.RED}Error during buyIx: ${error.message}${ANSI_COLORS.RESET}`);
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
executeWithInterval: This function manages the buying logic by executing at a set interval.
If an existing interval is running, it clears it before starting a new one.
Interval Execution: Runs every interval milliseconds:
Calls checkBalance to determine the wallet balance.
If the balance is greater than 0.03 SOL, proceeds with a buy transaction (buyIx function).
If insufficient, logs a message indicating to wait for a sufficient balance.
Stopping the Interval: Stops the interval automatically after 20 minutes.
Meta Loop to Manage Buying and Selling
javascript
Copy code
const meta_loop = async () => {
    setInterval(async () => {
        try {
            await executeWithInterval(8000, mintAddress);
            console.log(`${ANSI_COLORS.BLUE}Executing sell transaction...${ANSI_COLORS.RESET}`);
            await sellIx(mintAddress);
        } catch (error) {
            console.error(`${ANSI_COLORS.RED}Error during meta_loop execution: ${error.message}${ANSI_COLORS.RESET}`);
        }
    }, 60000 * 5); // Every 5 minutes
};
meta_loop: Handles both buying and selling operations periodically.
Calls executeWithInterval every 5 minutes to execute the buying logic.
Attempts a selling operation (sellIx) after the buying logic is complete.
Uses colored messages to indicate different stages of the execution.
Main Execution Block
javascript
Copy code
try {
    executeWithInterval(5000, mintAddress);
    meta_loop();
} catch (error) {
    console.error(`${ANSI_COLORS.RED}Error during initial execution: ${error.message}${ANSI_COLORS.RESET}`);
}
Initial Execution: Starts the main functions:
Calls executeWithInterval with an interval of 5 seconds to kick off the buying process.
Starts the meta_loop function to handle periodic buy and sell operations.
Catches any errors during the initial execution and logs them.
Summary
The code runs an automated bot for buying and selling tokens on the Solana blockchain.
It checks the balance of a wallet and proceeds to buy tokens if the balance is greater than 0.03 SOL.
Transactions are executed in regular intervals, and the bot is set to automatically stop after 20 minutes.
The meta_loop handles periodic execution of both buy and sell operations, ensuring they are executed every 5 minutes.
The use of ANSI escape codes makes console output more readable by color-coding logs for different operations, errors, and statuses.
This setup is suitable for continuous monitoring of wallet balance, automated transactions, and basic error handling in an asynchronous environment using Solana blockchain.