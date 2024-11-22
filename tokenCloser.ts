import { Connection, PublicKey, Keypair, Signer } from "@solana/web3.js";
import { closeAccount } from "@solana/spl-token";

/**
 * Function to check and close a token account.
 * @param connection - Solana Web3.js connection instance
 * @param payer - Signer who will pay the transaction fees
 * @param tokenAccount - PublicKey of the token account to check and close
 * @param destination - PublicKey of the account to receive remaining balance (rent-exempt SOL)
 * @param authority - Signer or PublicKey authorized to close the account
 * @returns Promise<string> - Status of the operation
 */
export async function checkAndCloseTokenAccount(
    connection: Connection,
    payer: Signer,
    tokenAccount: PublicKey,
    destination: PublicKey,
    authority: Signer | PublicKey
): Promise<string> {
    try {
        // Fetch token account info
        const tokenAccountInfo = await connection.getParsedAccountInfo(tokenAccount);
        if (!tokenAccountInfo.value) {
            return `Token account ${tokenAccount.toBase58()} does not exist.`;
        }

        // Check if the balance is zero
        const accountData: any = tokenAccountInfo.value.data;
        const tokenAmount = accountData.parsed.info.tokenAmount.uiAmount;

        if (tokenAmount !== 0) {
            return `Token account ${tokenAccount.toBase58()} has a non-zero balance of ${tokenAmount}. Cannot close.`;
        }

        // Close the token account
        const signature = await closeAccount(
            connection,
            payer,
            tokenAccount,
            destination,
            authority
        );

        return `Token account ${tokenAccount.toBase58()} successfully closed. Transaction: ${signature}`;
    } catch (error) {
        return `Error closing token account: ${error.message}`;
    }
}
