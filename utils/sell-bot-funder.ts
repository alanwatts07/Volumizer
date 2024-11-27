import { Environment, FixedSide, Moonshot } from '@wen-moon-ser/moonshot-sdk';
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
  VersionedMessage
} from '@solana/web3.js';
import dotenv from 'dotenv';
import { parseUnits, formatUnits, version } from 'ethers';
import { KEYCODE } from '../assets/bot-wallet';
import path from 'path';
import fs from 'fs';
import { checkAndCloseTokenAccount } from '../tokenCloser';
const keysDirectory='./utils/keys' 

dotenv.config();

async function getKeypairFromFile(filePath: string): Promise<Keypair> {
  try {
    const secretKeyArray = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const secretKey = new Uint8Array(secretKeyArray);
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error(`Failed to load keypair from file ${filePath}:`, error);
    throw error;
  }
}

// Function to transfer SOL from creator to seller using versioned transaction
async function transferSolFromCreatorToSeller(
  connection:Connection,
  creator: Keypair,
  seller: PublicKey
): Promise<void> {
  try {
    // Get the balance of the creator
    const balanceLamports = await connection.getBalance(creator.publicKey, 'confirmed');

    // Reserve lamports for transaction fees (calculate by estimating the fee)
    console.log(`Calculating fees for transferring ${balanceLamports / LAMPORTS_PER_SOL} SOL from Creator to Seller...`);

    // Create a dummy transaction to estimate the fee
    const dummyTransferIx = SystemProgram.transfer({
      fromPubkey: creator.publicKey,
      toPubkey: seller,
      lamports: balanceLamports,
    });

    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    const messageV0 = new TransactionMessage({
      payerKey: creator.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [dummyTransferIx],
    }).compileToV0Message();

    const estimatedFee = await connection.getFeeForMessage(messageV0, 'confirmed');
    if (estimatedFee === null) {
      throw new Error('Failed to estimate transaction fee.');
    }

    console.log(`Estimated transaction fee: ${estimatedFee} lamports (${estimatedFee.value / LAMPORTS_PER_SOL} SOL)`);

    // Calculate amount to transfer by subtracting the estimated fee
    const amountToTransfer = balanceLamports - estimatedFee.value;

    if (amountToTransfer <= 0) {
      console.error('Not enough SOL to transfer after reserving transaction fees.');
      return;
    }

    console.log(`Transferring ${(amountToTransfer / LAMPORTS_PER_SOL).toFixed(9)} SOL from Creator to Seller...`);

    // Create the final transfer instruction with the adjusted amount
    const transferIx = SystemProgram.transfer({
      fromPubkey: creator.publicKey,
      toPubkey: seller,
      lamports: amountToTransfer,
    });

    // Create the transaction message for the actual transfer
    const finalMessageV0 = new TransactionMessage({
      payerKey: creator.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [transferIx],
    }).compileToV0Message();

    const finalTransaction = new VersionedTransaction(finalMessageV0);

    // Sign the transaction
    finalTransaction.sign([creator]);

    // Send the transaction
    const signature = await connection.sendTransaction(finalTransaction, {
      skipPreflight: false,
      maxRetries: 2,
      preflightCommitment: 'confirmed',
    });

    console.log('Transfer Transaction Hash:', signature);

    // Confirm the transaction
    const confirmationResult = await connection.confirmTransaction(
      {
        signature: signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      'finalized'
    );

    if (confirmationResult.value.err) {
      console.error('Transfer transaction failed:', confirmationResult.value.err);
      throw new Error(`Transfer transaction failed: ${confirmationResult.value.err}`);
    }

    console.log('Transfer confirmed successfully:', signature);
  } catch (error) {
    console.error('Error transferring SOL:', error);
  }
}

// Function to get all keypairs with non-zero SOL balance
async function getNonZeroBalanceKeypairs(connection: Connection): Promise<Keypair[]> {
  const nonZeroBalanceKeypairs: Keypair[] = [];
  try {
    const files = fs.readdirSync(keysDirectory).filter(file => {
      const filePath = path.join(keysDirectory, file);
      return fs.statSync(filePath).isFile();
    });

    for (const file of files) {
      const filePath = path.join(keysDirectory, file);
      try {
        const keypair = await getKeypairFromFile(filePath);
        
        // Get the balance of the wallet
        const balanceLamports = await connection.getBalance(keypair.publicKey, 'confirmed');
        if (balanceLamports > 0) {
          console.log(`Wallet ${keypair.publicKey.toBase58()} has non-zero balance: ${balanceLamports / LAMPORTS_PER_SOL} SOL`);
          nonZeroBalanceKeypairs.push(keypair);
        } 
      } catch (error) {
        console.error(`Failed to load keypair from file ${filePath}:`, error);
      }
    }
  } catch (error) {
    console.error('Failed to scan keys directory for wallets:', error);
  }

  return nonZeroBalanceKeypairs;

}
export const sellIx = async (mintAddress): Promise<void> => {
  console.log('--- Selling token example ---');

  const rpcUrl = process.env.RPC_URL || 'defaultRpcUrl';

  const connection = new Connection(rpcUrl);

  const moonshot = new Moonshot({
    rpcUrl,
    environment: Environment.MAINNET,
    chainOptions: {
      solana: { confirmOptions: { commitment: 'confirmed' } },
    },
  });

  const token = moonshot.Token({
    mintAddress: mintAddress,
  });

  const curvePos = await token.getCurvePosition();
  console.log('Current position of the curve: ', curvePos);

  // Make sure seller has funds (tokens)
  const seller = Keypair.fromSecretKey(Uint8Array.from(KEYCODE));
  console.log('Seller: ', seller.publicKey.toBase58());
  // Get the list of all non-zero balance keypairs
const creators = await getNonZeroBalanceKeypairs(connection);

// Iterate through each keypair in the creators list
for (const creator of creators) {
  // Run the operations for each creator
    const tokenAccountsByOwner = await connection.getParsedTokenAccountsByOwner(creator.publicKey, { mint: mintAddress });

    const tokenAccount = tokenAccountsByOwner.value[0]?.pubkey;

  try {
    

    // Get creator's wallet balance
    const balanceLamports = await connection.getBalance(creator.publicKey, 'confirmed');
    console.log('Creator wallet balance (lamports):', balanceLamports);

    // Convert balance to SOL
    const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;
    console.log('Creator wallet balance (SOL):', balanceSOL);

    if (balanceSOL === 0) {
      console.log('Creator wallet has zero SOL. Skipping operations for this wallet.');
      continue;
    }

    // Query the balance of TOKEN_MINT for the creator
    const tokenMintAddress = new PublicKey(process.env.TOKEN_MINT);
    const tokenAccountsByOwner = await connection.getParsedTokenAccountsByOwner(creator.publicKey, { mint: tokenMintAddress });
    console.log('Token account:', tokenAccount ? tokenAccount : 'None found');

   
    const tokenBalance = tokenAccountsByOwner.value[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0;

    if (tokenBalance === 0) {
      console.log('Token balance is zero. Proceeding to transfer SOL from Creator to Seller.');
      const response = await checkAndCloseTokenAccount(
        connection,
        seller,
        tokenAccount,
        seller.publicKey,
        creator
      );
        let response1=response
      if (!response1) {
        console.error('Error closing token account');
        continue;
      } else if (response1.includes('does not exist.')) {
        console.error('Token account does not exist for creator:', creator.publicKey.toBase58());
        continue;
      } else if (response1.includes('successfully closed')) {
        console.log('Token account successfully closed for creator:', creator.publicKey.toBase58());
      }
      await transferSolFromCreatorToSeller(connection, creator, seller.publicKey);
    } else {
      console.log('Token balance is not zero, skipping SOL transfer for creator:', creator.publicKey.toBase58());
    }

    const tokenAmount = parseUnits(tokenBalance.toString(), 9);

    // Calculate the collateral amount for the tokens to be sold
    const solAmount = await token.getCollateralAmountByTokens({
      tokenAmount,
      tradeDirection: 'SELL',
    });

    const { ixs } = await token.prepareIxs({
      slippageBps: 200,
      creatorPK: creator.publicKey.toBase58(),
      tokenAmount,
      collateralAmount: solAmount,
      tradeDirection: 'SELL',
      fixedSide: FixedSide.IN,
    });

    const priorityIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 150_000,
    });

    // Obtain a new blockhash before signing and sending the transaction
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    const messageV0 = new TransactionMessage({
      payerKey: creator.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [priorityIx, ...ixs],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([creator]);

    try {
      const txHash = await connection.sendTransaction(transaction, {
        skipPreflight: false,
        maxRetries: 0,
        preflightCommitment: 'processed',
      });

      console.log('Sell Transaction Hash:', txHash);
      console.log('Confirming transaction...');

      const confirmationResult = await connection.confirmTransaction(
        {
          signature: txHash,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        }, 
        'processed'
      );

      if (confirmationResult.value.err) {
        console.error('Transaction failed for creator:', creator.publicKey.toBase58(), confirmationResult.value.err);
        throw new Error(`Transaction failed: ${confirmationResult.value.err}`);
      }

      console.log('Transaction confirmed successfully for creator:', creator.publicKey.toBase58(), txHash);

    } catch (error) {
      if (error.message.includes('custom program error: 0xbc4')) {
        console.error('Error: AccountNotInitialized. The account expected by the program is not initialized for creator:', creator.publicKey);
        console.error('Error Logs: ', error.logs);
      } else if (error.message.includes('blockhash not found')) {
        console.error('Error: Blockhash expired. Retrying transaction for creator:', creator.publicKey);
        // Retry logic for blockhash expiration
        const newBlockhash = await connection.getLatestBlockhash('confirmed');
        const newMessageV0 = new TransactionMessage({
          payerKey: creator.publicKey,
          recentBlockhash: newBlockhash.blockhash,
          instructions: [priorityIx, ...ixs],
        }).compileToV0Message();

        const newTransaction = new VersionedTransaction(newMessageV0);
        newTransaction.sign([creator]);

        try {
          const retryTxHash = await connection.sendTransaction(newTransaction, {
            skipPreflight: false,
            maxRetries: 0,
            preflightCommitment: 'confirmed',
          });

          console.log('Retry Sell Transaction Hash:', retryTxHash);
          console.log('Confirming retried transaction...');

          const retryConfirmationResult = await connection.confirmTransaction(
            {
              signature: retryTxHash,
              blockhash: newBlockhash.blockhash,
              lastValidBlockHeight: newBlockhash.lastValidBlockHeight,
            },
            'finalized'
          );

          if (retryConfirmationResult.value.err) {
            console.error('Retry transaction failed for creator:', creator.publicKey, retryConfirmationResult.value.err);
            throw new Error(`Retry transaction failed: ${retryConfirmationResult.value.err}`);
          }

          console.log('Retry transaction confirmed successfully for creator:', creator.publicKey, retryTxHash);

        } catch (retryError) {
          console.error('An unexpected error occurred during the retry transaction for creator:', creator.publicKey, retryError.message);
        }
      } else {
        console.error('An unexpected error occurred during the transaction for creator:', creator.publicKey.toBase58(), error.message);
      }
    }

  } catch (error) {
    console.error(`Error processing creator ${creator.publicKey}:`, error);
  }
}
};