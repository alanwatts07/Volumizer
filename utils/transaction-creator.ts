import { Environment, FixedSide, Moonshot } from '@wen-moon-ser/moonshot-sdk';
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import dotenv from 'dotenv';
import { KEYCODE } from '../assets/bot-wallet';
import { parseUnits } from 'ethers';
import fs from 'fs';

dotenv.config();

const mintAddress = process.env.TOKEN_MINT;

export const buyIx = async (mintAddress: string, percentage: number): Promise<string> => {
  console.log('--- Preparing token transaction ---');

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
  console.log('Current position of the curve: ', curvePos);

  // Make sure creator has funds
  const creator = Keypair.fromSecretKey(Uint8Array.from(KEYCODE));
  console.log('Creator: ', creator.publicKey.toBase58());

  // Get creator's wallet balance
  const balanceLamports = await connection.getBalance(creator.publicKey, 'confirmed');
  console.log('Creator wallet balance (lamports): ', balanceLamports);

  // Convert balance to SOL
  const balanceSOL = balanceLamports / 1_000_000_000;
  console.log('Creator wallet balance (SOL): ', balanceSOL);

  // Calculate the amount based on the provided percentage
  const solAmountNum = balanceSOL * percentage;

  // Convert SOL amount back to lamports and round to avoid fractions
  const solAmountLamports = Math.floor(solAmountNum * 1_000_000_000);

  if (solAmountLamports <= 0) {
    throw new Error('Calculated SOL amount is too small to proceed with the transaction.');
  }

  console.log(`Preparing transaction with ${percentage * 100}% of balance, SOL amount (lamports): `, solAmountLamports);

  const solAmount = parseUnits(solAmountLamports.toString(), 0);

  // Get the token amount to buy
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
    fixedSide: FixedSide.IN,
  });

  const priorityIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 10_000,
  });

  const blockhash = await connection.getLatestBlockhash('confirmed');
  const messageV0 = new TransactionMessage({
    payerKey: creator.publicKey,
    recentBlockhash: blockhash.blockhash,
    instructions: [...ixs],
  }).compileToV0Message();
  
  console.log(...ixs);

  const transaction = new VersionedTransaction(messageV0);
  console.log(transaction);

  // Serialize the transaction to base64 without signing
  const rawTx = Buffer.from(transaction.serialize()).toString('base64');
  console.log('Raw Transaction:', rawTx);
  return rawTx;
};

// Function to save transactions to a JSON file
const saveTransactionsToJson = async () => {
  const transactions = [];
  // Fixed percentages for 4 different transaction sizes
  const percentages = [0.05, 0.10, 0.15, 0.20];

  for (let i = 0; i < percentages.length; i++) {
    try {
      const tx = await buyIx(mintAddress, percentages[i]);
      transactions.push({ "tx": tx });
    } catch (error) {
      console.error('Failed to prepare transaction:', error);
    }
  }

  fs.writeFileSync('./assets/transactions.json', JSON.stringify(transactions, null, 2));
  console.log('Transactions saved to transactions.json');
};

// Execute the save function
saveTransactionsToJson();
