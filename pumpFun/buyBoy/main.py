import yaml
import subprocess
import time 
from colorama import Fore, init
import sys
import os

config_path = "config.yaml"
default_config = """
addresses:
  bot_wallet: #publickey of bot
  mint_address: #mint address
  private_key: #base58 private key 
  rpc_url: 
bs:
  amtBorPctSell: 0.0001  #for buySell this will just be your buys
                 #*to do: varied buys*
loop:
  initialMode: buySell ### here is your mode entry this effects the lower one so no worries
  mode: buy ##YOU CAN LEAVE THIS usually
  mins: 1
"""
# Check if the file exists
if not os.path.exists(config_path):
    # Create the file if it doesn't exist
    with open(config_path, "w") as file:
        file.write(default_config)  # Write an empty string or initial content
    print(f"yo I made you a config file go fill it out so we can actually get to work bro")
else:
    print(f"File '{config_path}' already exists. You must be smart buddy.")

#colorama
init(autoreset=True)

with open("config.yaml", "r") as file:
    config = yaml.safe_load(file)
mins=config['loop']['mins']

def loading_animation():
    animation = ["[■□□□□□□□□□]","[■■□□□□□□□□]", "[■■■□□□□□□□]", "[■■■■□□□□□□]", "[■■■■■□□□□□]", "[■■■■■■□□□□]", "[■■■■■■■□□□]", "[■■■■■■■■□□]", "[■■■■■■■■■□]", "[■■■■■■■■■■]"]
    for i in range(len(animation)):
        time.sleep(0.2)
        sys.stdout.write("\r" + Fore.GREEN + animation[i % len(animation)])
        sys.stdout.flush()


def updateYam (
        input,
        section, 
        setting,   
        ):
    with open("config.yaml", "r") as file:
        config = yaml.safe_load(file)
        config[section][setting] = input

    with open("config.yaml", "w") as file:
        yaml.dump(config, file)
    print(config['loop']['mode'])

def updateYam2 (
        input1,
        input2, 
        section, 
        setting1, 
        setting2
        ):

    with open("config.yaml", "r") as file:
        config = yaml.safe_load(file)
        config[section][setting1] = input1
        config[section][setting2] = input2

    with open("config.yaml", "w") as file:
        yaml.dump(config, file)
    print(config['loop']['mode'])

initialMode=config['loop']['initialMode']
print('initialMode:'+ initialMode)
while True:
    if initialMode == 'sell':
        updateYam('sell', 'loop', 'mode')
        updateYam('100%', 'bs', 'buyAmtSellPct')
    else:
        updateYam('buy','loop','mode')

    subprocess.run(["python3", "run.py"])
    if initialMode == 'buySell':
        updateYam2(1,'sell','loop','mins', 'mode' , )
        subprocess.run(["python3", "run.py"])

    loading_animation()
    time.sleep(int(mins) * 60)