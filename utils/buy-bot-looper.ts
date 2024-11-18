import { Environment, FixedSide, Moonshot } from '@wen-moon-ser/moonshot-sdk';
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  SendTransactionError,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import dotenv from 'dotenv';
import { KEYCODE } from '../assets/bot-wallet';
import { parseUnits } from 'ethers';
import { randomInt } from 'crypto';

dotenv.config();

export const buyIx = async (mintAddress): Promise<string> => {
  console.log('--- Buying token  ---');

  const rpcUrl = process.env.RPC_URL || 'idiot';

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
  console.log('Current position of the curve: ', curvePos); // Prints the current curve position

  // make sure creator has funds
  const creator = Keypair.fromSecretKey(Uint8Array.from(KEYCODE));
  console.log('Creator: ', creator.publicKey.toBase58());

  // Get creator's wallet balance
  const balanceLamports = await connection.getBalance(creator.publicKey, 'confirmed');
  console.log('Creator wallet balance (lamports): ', balanceLamports);

  // Convert balance to SOL
  const balanceSOL = balanceLamports / 1_000_000_000;
  console.log('Creator wallet balance (SOL): ', balanceSOL);

  // Randomly pick between 5%, 10%, or 15% of wallet balance
  const percentages = [0.05, 0.10, 0.15, 0.12, 0.20, 0.08];
  const randomIndex = randomInt(0, percentages.length);
  const percentage = percentages[randomIndex];
  const solAmountNum = balanceSOL * percentage;

  // Convert SOL amount back to lamports and round to avoid fractions
  const solAmountLamports = Math.floor(solAmountNum * 1_000_000_000);

  if (solAmountLamports <= 0) {
    throw new Error('Calculated SOL amount is too small to proceed with the transaction.');
  }

  console.log('Buying with SOL amount (lamports): ', solAmountLamports);

  const solAmount = parseUnits(solAmountLamports.toString(), 0);

  // Buy example
  const tokenAmount = await token.getTokenAmountByCollateral({
    collateralAmount: solAmount,
    tradeDirection: 'BUY',
  });

  const { ixs } = await token.prepareIxs({
    slippageBps: 100,
    creatorPK: creator.publicKey.toBase58(),
    tokenAmount,
    collateralAmount: solAmount,
    tradeDirection: 'BUY',
    fixedSide: FixedSide.IN, // This means you will get exactly the token amount and slippage is applied to collateral amount
  });

  const priorityIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 10_000,
  });

  const blockhash = await connection.getLatestBlockhash('confirmed');
  const messageV0 = new TransactionMessage({
    payerKey: creator.publicKey,
    recentBlockhash: blockhash.blockhash,
    instructions: [priorityIx, ...ixs],
  }).compileToV0Message();

  const transaction = new VersionedTransaction(messageV0);

  transaction.sign([creator]);
  try {
    const txHash = await connection.sendTransaction(transaction, {
      skipPreflight: false,
      maxRetries: 1,
      preflightCommitment: 'confirmed',
    });
    console.log('Buy Transaction Hash:', txHash);
    return txHash;
  } catch (error) {
    console.error('Error during buyIx:', error);
    throw error;
  }
};



  /* console.log('confirming transaction...');
  const confirmationResult = await connection.confirmTransaction(
    {
      signature: txHash,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight: blockhash.lastValidBlockHeight,
    },
    'finalized' // Wait until the transaction is finalized
  );

  if (confirmationResult.value.err) {
    console.error('Transaction failed:', confirmationResult.value.err);
    throw new Error(`Transaction failed: ${confirmationResult.value.err}`);
  }

  console.log('Transaction confirmed successfully:', txHash);
  return txHash;
}; */