import { Environment, FixedSide, Moonshot } from '@wen-moon-ser/moonshot-sdk';
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import dotenv from 'dotenv';
import { parseUnits, formatUnits } from 'ethers';
import { KEYCODE } from '../assets/bot-wallet';
dotenv.config();

export const sellIx = async (mintAddress): Promise<string> => {
  console.log('--- Selling token example ---');

  const rpcUrl = process.env.RPC_URL || 'defaultRpcUrl';  // Change the default RPC URL fallback if needed

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
 console.log(token);
  const curvePos = await token.getCurvePosition();
  console.log('Current position of the curve: ', curvePos); // Prints the current curve position

  // make sure seller has funds (tokens)
  const seller = Keypair.fromSecretKey(Uint8Array.from(KEYCODE));
  console.log('Seller: ', seller.publicKey.toBase58());

  // Query the balance of TOKEN_MINT for the seller
  const tokenMintAddress = new PublicKey(process.env.TOKEN_MINT);
  const tokenAccountsByOwner = await connection.getParsedTokenAccountsByOwner(seller.publicKey, { mint: tokenMintAddress });

  // Assuming the seller has one account for this mint
  const tokenBalance = tokenAccountsByOwner.value[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0;
  console.log('Token balance:', tokenBalance);

  if (tokenBalance <= 0) {
    throw new Error("Insufficient tokens to sell.");
  }

  const tokenAmount = parseUnits(tokenBalance.toString(), 9); // Adjust the decimal according to your token's specification

  // Calculate the collateral amount for the tokens to be sold
  const solAmount = await token.getCollateralAmountByTokens({
    tokenAmount,
    tradeDirection: 'SELL',
  });

  const { ixs } = await token.prepareIxs({
    slippageBps: 600,
    creatorPK: seller.publicKey.toBase58(),
    tokenAmount,
    collateralAmount: solAmount,
    tradeDirection: 'SELL',
    fixedSide: FixedSide.IN, // This means you will get exactly the SOL amount and slippage is applied to token amount
  });

  const priorityIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 400_000,
  });

  const blockhash = await connection.getLatestBlockhash('confirmed');
  const messageV0 = new TransactionMessage({
    payerKey: seller.publicKey,
    recentBlockhash: blockhash.blockhash,
    instructions: [priorityIx, ...ixs],
  }).compileToV0Message();

  const transaction = new VersionedTransaction(messageV0);

  transaction.sign([seller]);
  const txHash = await connection.sendTransaction(transaction, {
    skipPreflight: false,
    maxRetries: 0,
    preflightCommitment: 'confirmed',
  });

  console.log('Sell Transaction Hash:', txHash);
  console.log('confirming transaction...');
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
};