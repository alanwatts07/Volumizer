import requests
from solders.transaction import VersionedTransaction
from solders.keypair import Keypair
from solders.commitment_config import CommitmentLevel
from solders.rpc.requests import SendVersionedTransaction
from solders.rpc.config import RpcSendTransactionConfig
import yaml
import colorama
from colorama import Fore, Back, Style
import time
import sys

def print_fast(Fore, str):
    for char in str:
        print(Fore + char,end='')
        sys.stdout.flush()
        time.sleep(0.007)

def print_slow(Fore, str):
    for char in str:
        print(Fore + char,end='')
        sys.stdout.flush()
        time.sleep(0.03)

def print_title():
    print(Fore.CYAN + """
╔══════════════════════════════════════════════════════════╗
║ ██████╗ ██╗   ██╗██╗   ██╗██████╗  ██████╗ ██╗   ██╗   ║=================================
║ ██╔══██╗██║   ██║╚██╗ ██╔╝██╔══██╗██╔═══██╗╚██╗ ██╔╝   ║=================================
║ ██████╔╝██║   ██║ ╚████╔╝ ██████╔╝██║   ██║ ╚████╔╝    ║==========================
║ ██╔══██╗██║   ██║  ╚██╔╝  ██╔══██╗██║   ██║  ╚██╔╝     ║=====================
║ ██████╔╝╚██████╔╝   ██║   ██████╔╝╚██████╔╝   ██║      ║=====================
║ ╚═════╝  ╚═════╝    ╚═╝   ╚═════╝  ╚═════╝    ╚═╝      ║=====================
╚══════════════════════════════════════════════════════════╝
    """ + Style.RESET_ALL)

def loading_animation():
    animation = ["[■□□□□□□□□□]","[■■□□□□□□□□]", "[■■■□□□□□□□]", "[■■■■□□□□□□]", "[■■■■■□□□□□]", "[■■■■■■□□□□]", "[■■■■■■■□□□]", "[■■■■■■■■□□]", "[■■■■■■■■■□]", "[■■■■■■■■■■]"]
    for i in range(len(animation)):
        time.sleep(0.2)
        sys.stdout.write("\r" + Fore.GREEN + animation[i % len(animation)])
        sys.stdout.flush()

print_title()
print_slow(Fore.YELLOW, "Loading your cash money maker...\n")
loading_animation()
print("\n")
colorama.init(autoreset=True)
with open("config.yaml", "r") as file:
    config = yaml.safe_load(file)

BOT_WALLET = config["addresses"]["bot_wallet"]
MINT_ADDRESS = config["addresses"]["mint_address"]
PRIVATE_KEY = config["addresses"]["private_key"]
RPC_URL = config["addresses"]["rpc_url"]
trade_direction = config["loop"]["mode"]
amountorPercent= config["bs"]["amtBorPctSell"]
if trade_direction == 'buy':
    torF = 'true'
else:
    torF = 'false'

print(Fore.GREEN + "═" * 50)
print(Fore.MAGENTA + f"🔥 WALLET: {Fore.CYAN}{BOT_WALLET[:6]}...{BOT_WALLET[-4:]}")
print(Fore.MAGENTA + f"🎯 TOKEN: {Fore.CYAN}{MINT_ADDRESS[:6]}...{MINT_ADDRESS[-4:]}")
print(Fore.GREEN + "═" * 50 + "\n")
print_fast(Fore.LIGHTBLACK_EX, '''Yo dawg, making that trade request...\nthis guy is slow as shit\nbut I got my peice wit me \nso watch this shit...\n(a scream is heard from inside)\nwhat kind of a person are you\n really dealing with here?\nYou don't even have time to think because...\n
           '''
           )
loading_animation()
bullorShit=trade_direction
try:
    response = requests.post(url="https://pumpportal.fun/api/trade-local", data={
        "publicKey": BOT_WALLET,
        "action": bullorShit,             
        "mint": MINT_ADDRESS,
        "amount": amountorPercent,            
        "denominatedInSol": torF, 
        "slippage": 10,              
        "priorityFee": 0.00002,        
        "pool": "pump"               
    })
    
    print(Fore.GREEN + "\n✓ Trade request successful!")
    
    keypair = Keypair.from_base58_string(PRIVATE_KEY)
    tx = VersionedTransaction(VersionedTransaction.from_bytes(response.content).message, [keypair])

    commitment = CommitmentLevel.Confirmed
    config = RpcSendTransactionConfig(preflight_commitment=commitment)
    txPayload = SendVersionedTransaction(tx, config)
    
    print_slow(Fore.YELLOW, "Sending that sweet transaction...\n")
    loading_animation()
    
    response = requests.post(
        url=RPC_URL,
        headers={"Content-Type": "application/json"},
        data=SendVersionedTransaction(tx, config).to_json()
    )
    txSignature = response.json()['result']
    print(Fore.GREEN + "\n💰 BOOM! Transaction successful!")
    print(Fore.CYAN + f'🔍 Check it: https://solscan.io/tx/{txSignature}')
    
except Exception as e:
    print(Fore.RED + "\n╔════ ERROR ════╗")
    print(Fore.RED + f"\n║ Yo homie, something ain't right! ║")
    print(Fore.RED + "\n╚═════════════════╝")
    print(Fore.YELLOW + f"The streets say: {str(e)}")
