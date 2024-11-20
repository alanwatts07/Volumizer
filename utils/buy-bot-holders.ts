import { Environment, FixedSide, Moonshot } from '@wen-moon-ser/moonshot-sdk';
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  TransactionInstruction,
  Transaction,
  PublicKey,
  SystemProgram,
  Signer,
} from '@solana/web3.js';
import dotenv from 'dotenv';
import { parseUnits } from 'ethers';
import fs from 'fs';
import path from 'path';
import { randomInt } from 'crypto';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { KEYCODE } from '../assets/bot-wallet'; // Ensure this exports a Uint8Array or Buffer

dotenv.config();

const keysDirectory = './utils/keys/keys1';
const transactionsFilePath = './assets/transactions2.json';
const TIP_ACCOUNT = "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY";

/**
 * Loads a specified number of keypairs from the given directory.
 * @param limit Number of keypairs to load.
 * @returns Array of Keypair objects.
 */
async function getKeypairsFromDirectory(limit: number): Promise<Keypair[]> {
  const keypairs: Keypair[] = [];
  const files = fs.readdirSync(keysDirectory);

  for (const file of files.slice(0, limit)) {
    const secretKeyArray = JSON.parse(fs.readFileSync(path.join(keysDirectory, file), 'utf8'));
    const secretKey = new Uint8Array(secretKeyArray);
    const keypair = Keypair.fromSecretKey(secretKey);
    keypairs.push(keypair);
    console.log(`Loaded keypair from file: ${file}`);
  }

  if (keypairs.length < limit) {
    throw new Error(`Not enough key files in the directory. Found ${keypairs.length}, but need ${limit}.`);
  }

  return keypairs;
}

/**
 * Prepares a buy transaction for a given mint address and creator.
 * @param mintAddress The mint address of the token to buy.
 * @param creator The Keypair of the creator.
 * @param connection The Solana connection object.
 * @returns Base58-encoded serialized transaction string.
 */
export const prepareBuyTransaction = async (
  mintAddress: string,
  creator: Keypair,
  connection: Connection
): Promise<string> => {
  console.log('--- Preparing Buy Transaction ---');

  const moonshot = new Moonshot({
    rpcUrl: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com', // Use a valid RPC URL
    environment: Environment.MAINNET,
    chainOptions: {
      solana: { confirmOptions: { commitment: 'confirmed' } },
    },
  });

  const token = moonshot.Token({ mintAddress });

  const userTokenAccount = await getAssociatedTokenAddress(
    new PublicKey(mintAddress),
    creator.publicKey
  );

  const instructions: TransactionInstruction[] = [];

  // Check if the token account already exists
  const accountInfo = await connection.getAccountInfo(userTokenAccount);
  if (!accountInfo) {
    console.log('Adding instruction to create associated token account for the mint...');
    const createAccountIx = createAssociatedTokenAccountInstruction(
      creator.publicKey,
      userTokenAccount,
      creator.publicKey,
      new PublicKey(mintAddress)
    );
    instructions.push(createAccountIx);
  }

  const curvePos = await token.getCurvePosition();
  console.log('Current position of the curve: ', curvePos);

  const balanceLamports = await connection.getBalance(creator.publicKey, 'confirmed');
  const percentages = [0.15, 0.30, 0.45, 0.22, 0.40, 0.68];
  const percentage = percentages[randomInt(0, percentages.length)];
  const solAmountLamports = Math.floor(balanceLamports * percentage); // Use balance in lamports directly

  if (solAmountLamports <= 0) {
    throw new Error('Calculated SOL amount is too small to proceed with the transaction.');
  }

  console.log('Buying with SOL amount (lamports): ', solAmountLamports);

  const solAmount = parseUnits(solAmountLamports.toString(), 0);
  const tokenAmount = await token.getTokenAmountByCollateral({
    collateralAmount: solAmount,
    tradeDirection: 'BUY',
  });

  const { ixs } = await token.prepareIxs({
    slippageBps: 300,
    creatorPK: creator.publicKey.toBase58(),
    tokenAmount,
    collateralAmount: solAmount,
    tradeDirection: 'BUY',
    fixedSide: FixedSide.IN,
  });

  const priorityIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 150_000,
  });

  // Fetch a fresh blockhash
  const { blockhash } = await connection.getLatestBlockhash('confirmed');

  // Create a legacy transaction
  const transaction = new Transaction({
    feePayer: creator.publicKey,
    recentBlockhash: blockhash,
  });

  // Add all instructions
  transaction.add(priorityIx, ...instructions, ...ixs);

  // Sign the transaction
  transaction.sign(creator);

  // Serialize and encode the transaction as Base58
  const serializedTransaction = transaction.serialize();
  const base58Transaction = bs58.encode(serializedTransaction);

  return base58Transaction;
};

/**
 * Adds a tip instruction to the last transaction.
 * @param transactionData Base58-encoded serialized transaction string.
 * @param recentBlockhash The recent blockhash for the transaction.
 * @param mainSigner The main signer Keypair.
 * @param originalCreator The original creator Keypair (required to sign the updated transaction).
 * @returns Updated Base58-encoded serialized transaction string with the tip.
 */
const addTipToLastTransaction = (
  transactionData: string,
  recentBlockhash: string,
  mainSigner: Keypair,
  originalCreator: Keypair
): string => {
  // Decode the Base58-encoded transaction
  const transactionBuffer = bs58.decode(transactionData);
  const lastTransaction = Transaction.from(transactionBuffer);

  // Create the tip instruction
  const tipInstruction = SystemProgram.transfer({
    fromPubkey: mainSigner.publicKey,
    toPubkey: new PublicKey(TIP_ACCOUNT),
    lamports: 300_000, // Adjust the lamports as needed
  });

  // Add the tip instruction to the transaction
  lastTransaction.add(tipInstruction);

  // Update the recent blockhash
  lastTransaction.recentBlockhash = recentBlockhash;

  // Set the fee payer if not already set
  if (!lastTransaction.feePayer) {
    lastTransaction.feePayer = mainSigner.publicKey;
  }

  // Sign the transaction with both the original creator and the mainSigner
  lastTransaction.sign(originalCreator, mainSigner);

  // Serialize and encode the updated transaction as Base58
  const updatedSerializedTransaction = lastTransaction.serialize();
  const updatedBase58Transaction = bs58.encode(updatedSerializedTransaction);

  return updatedBase58Transaction;
};

/**
 * The main function orchestrates loading keypairs, preparing transactions, adding tips, and saving them.
 */
async function main() {
  try {
    const connection = new Connection(process.env.RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
    const keypairs = await getKeypairsFromDirectory(4);
    const mintAddress = process.env.TOKEN_MINT;

    if (!mintAddress) {
      throw new Error('TOKEN_MINT environment variable is not set.');
    }

    const transactions: { publicKey: string; rawTransaction: string }[] = [];

    for (const keypair of keypairs) {
      const rawTransaction = await prepareBuyTransaction(mintAddress, keypair, connection);
      transactions.push({ publicKey: keypair.publicKey.toBase58(), rawTransaction });
    }

    // Add tip instruction to the last transaction
    if (transactions.length > 0) {
      // Fetch a fresh blockhash
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      const recentBlockhash = blockhash;

      // Create the main signer Keypair from KEYCODE
      const mainSigner = Keypair.fromSecretKey(new Uint8Array(KEYCODE)); // Ensure KEYCODE is a Uint8Array

      const lastTxIndex = transactions.length - 1;
      const lastTransaction = transactions[lastTxIndex].rawTransaction;
      const originalCreatorPublicKey = new PublicKey(transactions[lastTxIndex].publicKey);

      // Find the original creator's Keypair
      const originalCreator = keypairs.find(kp => kp.publicKey.equals(originalCreatorPublicKey));
      if (!originalCreator) {
        throw new Error('Original creator Keypair not found for the last transaction.');
      }

      const updatedRawTransaction = addTipToLastTransaction(lastTransaction, recentBlockhash, mainSigner, originalCreator);
      transactions[lastTxIndex].rawTransaction = updatedRawTransaction;
    }

    // Save all transactions as Base58-encoded strings
    fs.writeFileSync(transactionsFilePath, JSON.stringify(transactions, null, 2));
    console.log(`Transactions saved to ${transactionsFilePath}`);
  } catch (error) {
    console.error('Error in main:', error);
  }
}

main();
