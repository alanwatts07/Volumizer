// Import necessary modules
import fs from 'fs';
import path from 'path';
import { randomInt } from 'crypto';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import bs58 from 'bs58';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  MessageCompiledInstruction,
  VersionedTransaction, // Added for versioned transactions
  MessageV0, // Added for versioned messages
  MessageHeader,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { Environment, FixedSide, Moonshot } from '@wen-moon-ser/moonshot-sdk';
import { parseUnits } from 'ethers';

// Ensure that the KEYCODE is a Uint8Array or Buffer
import { KEYCODE } from '../assets/bot-wallet'; // Adjust the path as necessary

dotenv.config();

// Configuration Constants
const KEYS_DIRECTORY = './utils/keys/keys1'; // Directory containing keypair JSON files
const TRANSACTIONS_FILE_PATH = './assets/transactions2.json'; // Output file for transactions
const JITO_TIP_ACCOUNTS = [
  // Replace with actual Jito tip account public keys
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT"
];
const JITO_API_URL = 'https://mainnet.block-engine.jito.wtf/api/v1/bundles'; // Jito API endpoint
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com'; // Solana RPC URL
const TOKEN_MINT = process.env.TOKEN_MINT; // Token mint address (ensure this is set in .env)
const MAX_BUNDLE_TRANSACTIONS = 5; // Maximum transactions per bundle

if (!TOKEN_MINT) {
  throw new Error('TOKEN_MINT environment variable is not set.');
}

/**
 * Helper function to compile TransactionInstructions to MessageCompiledInstructions.
 * @param instructions - Array of TransactionInstructions.
 * @param signers - Array of Keypairs that are signing the transaction.
 * @returns An object containing compiledInstructions and staticAccountKeys.
 */
function compileInstructions(
  instructions: TransactionInstruction[],
  signers: Keypair[]
): { compiledInstructions: MessageCompiledInstruction[]; staticAccountKeys: PublicKey[] } {
  const staticAccountKeys: PublicKey[] = [];

  // Add signers first to ensure they are at the beginning of staticAccountKeys
  for (const signer of signers) {
    if (!staticAccountKeys.some((key) => key.equals(signer.publicKey))) {
      staticAccountKeys.push(signer.publicKey);
    }
  }

  // Collect all unique program IDs and account keys from instructions
  for (const ix of instructions) {
    if (!staticAccountKeys.some((key) => key.equals(ix.programId))) {
      staticAccountKeys.push(ix.programId);
    }
    for (const acc of ix.keys) {
      if (!staticAccountKeys.some((key) => key.equals(acc.pubkey))) {
        staticAccountKeys.push(acc.pubkey);
      }
    }
  }

  // Create a map from PublicKey to index
  const keyToIndex = new Map<string, number>();
  staticAccountKeys.forEach((key, idx) => {
    keyToIndex.set(key.toBase58(), idx);
  });

  // Compile each instruction into MessageCompiledInstruction
  const compiledInstructions: MessageCompiledInstruction[] = [];

  for (const ix of instructions) {
    const programIdIndex = keyToIndex.get(ix.programId.toBase58())!;
    const accountKeyIndexes = ix.keys.map((k) =>
      keyToIndex.get(k.pubkey.toBase58())!
    );
    const data = Buffer.from(ix.data);

    const compiledIx: MessageCompiledInstruction = {
      programIdIndex,
      accountKeyIndexes,
      data: data,
    };

    compiledInstructions.push(compiledIx);
  }

  return { compiledInstructions, staticAccountKeys };
}


/**
 * Utility function to delay execution for a specified time.
 * @param {number} ms - Milliseconds to delay.
 * @returns {Promise<void>}
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Loads a specified number of keypairs from the given directory.
 * @param {number} limit - Number of keypairs to load.
 * @returns {Promise<Keypair[]>} - Array of Keypair objects.
 */
async function getKeypairsFromDirectory(limit: number): Promise<Keypair[]> {
  const keypairs: Keypair[] = [];
  const files = fs.readdirSync(KEYS_DIRECTORY);

  for (const file of files.slice(0, limit)) {
    const secretKeyArray = JSON.parse(
      fs.readFileSync(path.join(KEYS_DIRECTORY, file), 'utf8')
    );
    const secretKey = new Uint8Array(secretKeyArray);
    const keypair = Keypair.fromSecretKey(secretKey);
    keypairs.push(keypair);
    console.log(`Loaded keypair from file: ${file}`);
  }

  if (keypairs.length < limit) {
    throw new Error(
      `Not enough key files in the directory. Found ${keypairs.length}, but need ${limit}.`
    );
  }

  return keypairs;
}

/**
 * Selects a random tip account from the predefined list.
 * @returns {PublicKey} - The selected tip account's PublicKey.
 */
function selectRandomTipAccount(): PublicKey {
  const randomIndex = randomInt(0, JITO_TIP_ACCOUNTS.length);
  const tipAccount = new PublicKey(JITO_TIP_ACCOUNTS[randomIndex]);
  console.log(`Selected Tip Account: ${tipAccount.toBase58()}`);
  return tipAccount;
}

/**
 * Prepares a buy transaction for a given mint address and creator using Versioned Transactions.
 * @param {string} mintAddress - The mint address of the token to buy.
 * @param {Keypair} creator - The Keypair of the creator.
 * @param {Keypair} mainSigner - The main signer Keypair.
 * @param {Connection} connection - The Solana connection object.
 * @param {string} blockhash - The shared blockhash for the bundle.
 * @returns {Promise<VersionedTransaction>} - The prepared Versioned Transaction object.
 */
async function prepareBuyTransaction(
  mintAddress: string,
  creator: Keypair,
  mainSigner: Keypair,
  connection: Connection,
  blockhash: string
): Promise<VersionedTransaction> {
  console.log('--- Preparing Buy Transaction (Versioned) ---');

  const moonshot = new Moonshot({
    rpcUrl: RPC_URL,
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
  const rentExemptionAmount = await connection.getMinimumBalanceForRentExemption(165); // Adjust size if needed
const balanceLamports = await connection.getBalance(creator.publicKey, 'confirmed');

if (balanceLamports < rentExemptionAmount) {
  throw new Error(
    `Insufficient balance for rent exemption. Required: ${rentExemptionAmount}, Available: ${balanceLamports}`
  );
}

  if (!accountInfo) {
    console.log(
      'Adding instruction to create associated token account for the mint...'
    );
    const createAccountIx = createAssociatedTokenAccountInstruction(
      creator.publicKey,
      userTokenAccount,
      creator.publicKey,
      new PublicKey(mintAddress)
    );
    instructions.push(createAccountIx);
  }

  const curvePos = await token.getCurvePosition();
  console.log('Current position of the curve: ', curvePos.toString());

  const percentages = [0.15, 0.30, 0.45, 0.22, 0.40, 0.68];
  const percentage = percentages[randomInt(0, percentages.length)];
  const solAmountLamports = Math.floor(balanceLamports * percentage); // Use balance in lamports directly
  const mainSignerBalance = await connection.getBalance(mainSigner.publicKey);
  console.log(`Main signer balance: ${mainSignerBalance / LAMPORTS_PER_SOL} SOL`);

  if (solAmountLamports <= 10000) {
    throw new Error(
      'Calculated SOL amount is too small to proceed with the transaction.'
    );
  }

  console.log('Buying with SOL amount (lamports): ', solAmountLamports);

  const solAmount = parseUnits(solAmountLamports.toString(), 0);
  const tokenAmount = await token.getTokenAmountByCollateral({
    collateralAmount: solAmount,
    tradeDirection: 'BUY',
  });

  const { ixs } = await token.prepareIxs({
    slippageBps: 150,
    creatorPK: creator.publicKey.toBase58(),
    tokenAmount,
    collateralAmount: solAmount,
    tradeDirection: 'BUY',
    fixedSide: FixedSide.IN,
  });

  // Log Moonshot-generated instructions
  ixs.forEach((ix, idx) => {
    console.log(
      `Moonshot Instruction ${idx}: Program ID - ${ix.programId.toBase58()}`
    );
    console.log(
      `Moonshot Instruction ${idx}: Accounts - ${ix.keys
        .map((k) => k.pubkey.toBase58())
        .join(', ')}`
    );
    console.log(
      `Moonshot Instruction ${idx}: Signers - ${ix.keys
        .filter((k) => k.isSigner)
        .map((k) => k.pubkey.toBase58())
        .join(', ')}`
    );
  });

  const priorityIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 1_000,
  });

  instructions.push(...ixs);

  // Log detailed instruction information before constructing the message
  console.log(`Total Instructions in Buy Transaction: ${instructions.length}`);
  instructions.forEach((ix, idx) => {
    console.log(`Instruction ${idx}: Program ID - ${ix.programId.toBase58()}`);
    console.log(
      `Instruction ${idx}: Accounts - ${ix.keys
        .map((k) => k.pubkey.toBase58())
        .join(', ')}`
    );
    console.log(
      `Instruction ${idx}: Signers - ${ix.keys
        .filter((k) => k.isSigner)
        .map((k) => k.pubkey.toBase58())
        .join(', ')}`
    );
  });

  // Compile instructions
  const { compiledInstructions, staticAccountKeys } = compileInstructions(
    instructions,
    [creator, mainSigner]
  );

  // Define the header
  const header: MessageHeader = {
    numRequiredSignatures: 2, // creator and mainSigner
    numReadonlySignedAccounts: 0,
    numReadonlyUnsignedAccounts: 0, // Adjust if you have read-only accounts
  };

  // Create the MessageV0Args
  const messageV0Args = {
    header,
    staticAccountKeys,
    recentBlockhash: blockhash,
    compiledInstructions, // This is now of type MessageCompiledInstruction[]
    addressTableLookups: [], // Add if using address lookup tables
  };

  // Create the MessageV0
  const messageV0 = new MessageV0(messageV0Args);

  // Create the Versioned Transaction
  const versionedTransaction = new VersionedTransaction(messageV0);

  // Sign the transaction with both creator and mainSigner
  versionedTransaction.sign([creator, mainSigner]);

  return versionedTransaction;
}

/**
 * Prepares a tip transaction using Versioned Transactions.
 * @param {Keypair} mainSigner - The main signer Keypair.
 * @param {Connection} connection - The Solana connection object.
 * @param {string} blockhash - The shared blockhash for the bundle.
 * @param {PublicKey} tipAccount - The selected tip account.
 * @returns {Promise<VersionedTransaction>} - The prepared Versioned Transaction object.
 */
async function prepareTipTransaction(
  mainSigner: Keypair,
  connection: Connection,
  blockhash: string,
  tipAccount: PublicKey
): Promise<VersionedTransaction> {
  console.log('--- Preparing Tip Transaction (Versioned) ---');

  // Define the tip amount in lamports (e.g., 0.00156 SOL)
  const tipAmountLamports = 0.000206 * LAMPORTS_PER_SOL; // Adjust as needed

  // Ensure the main signer has sufficient balance
  const mainSignerBalance = await connection.getBalance(
    mainSigner.publicKey,
    'confirmed'
  );
  if (mainSignerBalance < tipAmountLamports + 5000) {
    throw new Error('Main signer has insufficient balance to add a tip.');
  }

  // Create the transfer instruction for the tip
  const tipInstruction = SystemProgram.transfer({
    fromPubkey: mainSigner.publicKey,
    toPubkey: tipAccount,
    lamports: tipAmountLamports,
  });

  // Log instruction details
  console.log(
    `Tip Instruction: Program ID - ${tipInstruction.programId.toBase58()}`
  );
  console.log(
    `Tip Instruction: Accounts - ${tipInstruction.keys
      .map((k) => k.pubkey.toBase58())
      .join(', ')}`
  );
  console.log(
    `Tip Instruction: Signers - ${tipInstruction.keys
      .filter((k) => k.isSigner)
      .map((k) => k.pubkey.toBase58())
      .join(', ')}`
  );

  const instructions: TransactionInstruction[] = [tipInstruction];

  // Compile instructions
  const { compiledInstructions, staticAccountKeys } = compileInstructions(
    instructions,
    [mainSigner]
  );

  // Define the header
  const header: MessageHeader = {
    numRequiredSignatures: 1, // Only mainSigner
    numReadonlySignedAccounts: 0,
    numReadonlyUnsignedAccounts: 0, // Adjust if you have read-only accounts
  };

  // Create the MessageV0Args
  const messageV0Args = {
    header,
    staticAccountKeys,
    recentBlockhash: blockhash,
    compiledInstructions, // This is now of type MessageCompiledInstruction[]
    addressTableLookups: [], // Add if using address lookup tables
  };

  // Create the MessageV0
  const messageV0 = new MessageV0(messageV0Args);

  // Create the Versioned Transaction
  const versionedTransaction = new VersionedTransaction(messageV0);

  // Sign the transaction with mainSigner
  versionedTransaction.sign([mainSigner]);

  return versionedTransaction;
}

/**
 * Simulates a Versioned transaction to check for potential errors before sending.
 * @param {VersionedTransaction} transaction - The Versioned Transaction object to simulate.
 * @param {Connection} connection - The Solana connection object.
 * @returns {Promise<void>}
 */
async function simulateTransaction(
  transaction: VersionedTransaction,
  connection: Connection
): Promise<void> {
  console.log('--- Simulating Versioned Transaction ---');
  try {
    const simulationResult = await connection.simulateTransaction(transaction, {
      commitment: 'confirmed',
    });

    if (simulationResult.value.err) {
      console.error('Simulation Error:', simulationResult.value.err);
      console.error('Logs:', simulationResult.value.logs);
      throw new Error('Transaction simulation failed.');
    } else {
      console.log('Simulation successful.');
    }
  } catch (error) {
    console.error('Simulation failed:', error);
    throw error;
  }
}

/**
 * Logs the balances of all keypairs and the main signer.
 * @param {Connection} connection - The Solana connection object.
 * @param {Keypair[]} keypairs - Array of Keypair objects.
 * @param {Keypair} mainSigner - The main signer Keypair.
 * @returns {Promise<void>}
 */
async function logBalances(
  connection: Connection,
  keypairs: Keypair[],
  mainSigner: Keypair
): Promise<void> {
  console.log('--- Logging Account Balances ---');
  for (const keypair of keypairs) {
    const balance = await connection.getBalance(keypair.publicKey);
    console.log(
      `Balance for ${keypair.publicKey.toBase58()}: ${
        balance / LAMPORTS_PER_SOL
      } SOL`
    );
  }
  const mainBalance = await connection.getBalance(mainSigner.publicKey);
  console.log(`Main signer balance: ${mainBalance / LAMPORTS_PER_SOL} SOL`);
}

/**
 * Serializes a Versioned transaction to a Base58-encoded string.
 * @param {VersionedTransaction} transaction - The Versioned Transaction object to serialize.
 * @returns {string} - The Base58-encoded serialized transaction.
 */
function serializeTransaction(transaction: VersionedTransaction): string {
  const serialized = transaction.serialize();
  const base58Transaction = bs58.encode(serialized);
  return base58Transaction;
}

/**
 * Checks if a string is a valid Base58-encoded string.
 * @param {string} input - The string to validate.
 * @returns {boolean} - True if valid, else false.
 */
function isValidBase58(input: string): boolean {
  try {
    bs58.decode(input);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Sends the transaction bundle to Jito's Block Engine and retrieves the bundle ID.
 * @param {string[]} transactions - Array of Base58-encoded serialized Versioned transactions.
 * @returns {Promise<string>} - The bundle ID returned by Jito.
 */
async function sendBundleToJito(transactions: string[]): Promise<string> {
  if (transactions.length > MAX_BUNDLE_TRANSACTIONS) {
    throw new Error(
      `Bundles cannot contain more than ${MAX_BUNDLE_TRANSACTIONS} transactions.`
    );
  }

  const requestBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'sendBundle',
    params: [transactions],
  };

  // Validate each transaction before sending
  transactions.forEach((tx, index) => {
    if (!isValidBase58(tx)) {
      throw new Error(
        `Transaction at index ${index} is not a valid base58-encoded string.`
      );
    }
  });

  // Make the request
  const response = await fetch(JITO_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorResponse = await response.text();
    throw new Error(
      `Failed to send bundle. Status code: ${response.status}, Response: ${errorResponse}`
    );
  }

  const responseData = await response.json();
  if (responseData.result) {
    console.log('Bundle ID:', responseData.result);
    return responseData.result;
  } else {
    throw new Error('No bundle ID returned from the bundle submission.');
  }
}

/**
 * Retrieves the inflight bundle statuses from Jito's Block Engine.
 * @param {string[]} bundleIds - Array of bundle IDs to check.
 * @returns {Promise<any>} - The status response from Jito.
 */
async function getInflightBundleStatuses(bundleIds: string[]): Promise<any> {
  const requestBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getInflightBundleStatuses',
    params: [bundleIds],
  };
  await delay(3000); // Wait before making the request
  const response = await fetch(JITO_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorResponse = await response.text();
    throw new Error(
      `Failed to get inflight bundle statuses. Status code: ${response.status}, Response: ${errorResponse}`
    );
  }

  const responseData = await response.json();
  if (responseData.result) {
    return responseData.result;
  } else {
    throw new Error(
      'No result returned from the inflight bundle statuses request.'
    );
  }
}

/**
 * Checks the status of the submitted bundle.
 * @param {string} bundleId - The ID of the bundle to check.
 * @returns {Promise<any>} - The status response from Jito.
 */
async function checkBundleStatus(bundleId: string): Promise<any> {
  const requestBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getBundleStatuses',
    params: [[bundleId]],
  };

  const response = await fetch(JITO_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorResponse = await response.text();
    throw new Error(
      `Failed to get bundle status. Status code: ${response.status}, Response: ${errorResponse}`
    );
  }

  return response.json();
}

/**
 * Orchestrates the entire process: loading keypairs, preparing transactions, adding tips, sending the bundle, and checking status.
 */
async function main() {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const keypairs = await getKeypairsFromDirectory(4); // Load 4 keypairs

    // Prepare the main signer (for tip)
    const mainSigner = Keypair.fromSecretKey(new Uint8Array(KEYCODE)); // Ensure KEYCODE is a Uint8Array or Buffer
    console.log(`Main Signer Public Key: ${mainSigner.publicKey.toBase58()}`);
   

    // Log balances before proceeding
    await logBalances(connection, keypairs, mainSigner);

    const mintAddress = TOKEN_MINT;

    // Fetch a single recent blockhash for all transactions
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    console.log('Fetched Blockhash:', blockhash);

    const transactions: string[] = [];

    // Prepare buy transactions
    for (const keypair of keypairs) {
      const buyTransaction = await prepareBuyTransaction(
        mintAddress,
        keypair,
        mainSigner,
        connection,
        blockhash
      );

      // Simulate the transaction
      try {
        await simulateTransaction(buyTransaction, connection);
      } catch (simError) {
        console.error(
          `Simulation failed for buy transaction of ${keypair.publicKey.toBase58()}:`,
          simError
        );
        continue; // Skip this transaction and proceed with others
      }

      const serializedBuy = serializeTransaction(buyTransaction);
      console.log(
        `Serialized Buy Transaction for ${keypair.publicKey.toBase58()}: ${serializedBuy}`
      );
      transactions.push(serializedBuy);
      console.log(
        `Prepared and simulated buy transaction for wallet: ${keypair.publicKey.toBase58()}`
      );
    }

    // Select a random tip account
    const tipAccount = selectRandomTipAccount();

    // Prepare the tip transaction
    const tipTransaction = await prepareTipTransaction(
      mainSigner,
      connection,
      blockhash,
      tipAccount
    );

    // Simulate the tip transaction
    try {
      await simulateTransaction(tipTransaction, connection);
    } catch (simError) {
      console.error(`Simulation failed for tip transaction:`, simError);
      throw new Error('Tip transaction simulation failed.');
    }

    const serializedTip = serializeTransaction(tipTransaction);
    console.log(`Serialized Tip Transaction: ${serializedTip}`);
    transactions.push(serializedTip);
    console.log('Prepared and simulated tip transaction.');

    // Ensure the bundle does not exceed the maximum allowed transactions
    if (transactions.length > MAX_BUNDLE_TRANSACTIONS) {
      throw new Error(
        `Total transactions (${transactions.length}) exceed the maximum allowed (${MAX_BUNDLE_TRANSACTIONS}).`
      );
    }

    // Optionally, save transactions to a file for record-keeping
    fs.writeFileSync(
      TRANSACTIONS_FILE_PATH,
      JSON.stringify(
        transactions.map((tx) => ({ rawTransaction: tx })),
        null,
        2
      )
    );
    console.log(`Transactions saved to ${TRANSACTIONS_FILE_PATH}`);

    // Send the bundle to Jito's Block Engine
    const bundleId = await sendBundleToJito(transactions);
    console.log('Bundle Submission Response:', bundleId);

    // Initial status checking after submission
    let attempts1 = 0;
    const maxAttempts1 = 1;
    while (attempts1 < maxAttempts1) {
      // Check the status of the submitted bundle
      console.log('--- Checking Submitted Bundle Status (Inflight) ---');
      await delay(3000);
      try {
        const inflightStatuses = await getInflightBundleStatuses([bundleId]);
        if (inflightStatuses.result?.[0]?.status) {
          console.log('Inflight Bundle Status:', inflightStatuses.result[0].status);
          break;
        }
        console.log(
          `Attempt ${attempts1 + 1}: No inflight status information available, retrying...`
        );
      } catch (error) {
        console.error(
          `Error fetching inflight bundle statuses on attempt ${attempts1 + 1}:`,
          error
        );
      }
      attempts1++;
      await delay(5000); // Wait 5 seconds before retrying
    }
    if (attempts1 === maxAttempts1) {
      console.error(
        'Max attempts reached. Bundle inflight status is still not available.'
      );
    }

    // Check bundle status with retry mechanism
    let attempts = 0;
    const maxAttempts = 1;
    while (attempts < maxAttempts) {
      console.log('--- Checking Bundle Status ---');
      try {
        const statusResponse = await checkBundleStatus(bundleId);
        if (statusResponse.result?.[0]?.status) {
          console.log('Bundle Status:', statusResponse.result[0].status);
          break;
        }
        console.log(
          `Attempt ${attempts + 1}: No status information available, retrying...`
        );
      } catch (error) {
        console.error(
          `Error fetching bundle status on attempt ${attempts + 1}:`,
          error
        );
      }
      attempts++;
      await delay(5000); // Wait 5 seconds before retrying
    }

    if (attempts === maxAttempts) {
      console.error('Max attempts reached. Bundle status is still not available.');
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    console.error('Stack Trace:', error.stack);
    // Optional: Handle specific errors or perform fallback actions here
  }
}

// Execute the main function
main().catch((error) => {
  console.error('Unhandled Error:', error);
});
