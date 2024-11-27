import os
import json
import time
import sys
from solana.rpc.types import TokenAccountOpts 
from solana.rpc.api import Client
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.rpc.responses import GetBalanceResp, GetTokenAccountsByOwnerResp
from solana.transaction import Transaction
from spl.token.client import Token 
from spl.token.constants import TOKEN_PROGRAM_ID
from colorama import Fore, init
from termcolor import colored
from halo import Halo
import itertools
from dotenv import load_dotenv

load_dotenv()

init(autoreset=True)

# Initialize Solana client
RPC_URL = os.getenv("RPC_URL")
client = Client(RPC_URL)

# Function to print scrolling text
def scrolling_text(text, delay=0.15, color=None):
    for char in text:
        if color:
            sys.stdout.write(colored(char, color))
        else:
            sys.stdout.write(char)
        sys.stdout.flush()
        time.sleep(delay)
    sys.stdout.write('\n')

# Function to show spinner with a message
def spinner_message(message, spinner='dots', color='cyan', duration=3):
    spinner = Halo(text=message, spinner=spinner, color=color)
    spinner.start()
    time.sleep(duration)
    spinner.succeed()

# Function to get all JSON key files in a directory
def get_key_files(directory):
    return [f for f in os.listdir(directory) if f.endswith('.json')]

# Function to load a wallet from a key file
def load_wallet(file_path):
    with open(file_path, 'r') as f:
        secret_key = json.load(f)
        keypair = Keypair.from_bytes(secret_key)
    return keypair

# Function to get the SOL balance of a wallet
def get_sol_balance(wallet):
    balance:GetBalanceResp = client.get_balance(wallet.pubkey())
    return balance.value / 10**9  # Convert lamports to SOL

# Function to get all SPL tokens in a wallet
def get_spl_tokens(wallet):
    token_accounts:GetTokenAccountsByOwnerResp = client.get_token_accounts_by_owner(
        wallet,
        TokenAccountOpts(TOKEN_PROGRAM_ID, encoding='base58')
    ).to_json()
    if token_accounts:
        token_accounts.value = [token_accounts]
        for account in token_accounts:
            print(account) 
    return [token_accounts]

# Function to close SPL token accounts
def close_token_account(wallet, token_pubkey):
    transaction = Transaction()
    transaction.add(
        (
            wallet.public_key(),
            wallet.public_key(),
            wallet.public_key(),
        )
    )
    client.send_transaction(transaction, wallet)

# Welcome message with scrolling text
scrolling_text("Welcome to KeyScraper: Wallet Manager", delay=0.011, color='cyan')

# Get user input for the directory
directory = input(colored("Please enter the directory path containing JSON wallet keys: ", 'cyan'))
key_files = get_key_files(directory)

# Load wallets and display balances
wallets = []
spinner_message("Loading wallets from the selected directory...", spinner='dots', color='green')
for key_file in key_files:
    file_path = os.path.join(directory, key_file)
    wallet = load_wallet(file_path)
    print(wallet)
    wallets.append(wallet)

# Report SOL balance for each wallet
scrolling_text("Checking balances for all wallets...", delay=0.005, color='yellow')
for wallet in wallets:
    balance = get_sol_balance(wallet)
    scrolling_text(f"Wallet {wallet} has {balance:.4f} SOL", delay=0.003, color='cyan')

# Scan SPL tokens and sell them
scrolling_text("Scanning SPL tokens for each wallet...", delay=0.002, color='yellow')
for wallet in wallets:
    spl_tokens = get_spl_tokens(wallet.pubkey())
    if not spl_tokens:
        scrolling_text(f"Wallet {wallet} has no SPL tokens.", delay=0.03, color='cyan')
        continue

    for token_account in spl_tokens:
        token_pubkey = token_account['pubkey']
        token_info = client.get_account_info(Pubkey(token_pubkey))['result']['value']

        token_balance = int(token_info['data']['parsed']['info']['tokenAmount']['amount'])
        scrolling_text(f"Wallet {wallet} has {token_balance} tokens in account {token_pubkey}.", delay=0.03, color='magenta')

        # Close the SPL token account (reclaim rent)
        spinner_message(f"Closing token account {token_pubkey} for wallet {wallet}...", spinner='dots', color='red', duration=2)
        close_token_account(wallet, token_pubkey)

# Final message
scrolling_text("All wallets have been processed! You can reclaim your rent and SOL balances now.", delay=0.2, color='green')
scrolling_text("Jito-Bot is now ready! Enjoy :) ", delay=0.1, color='cyan')
