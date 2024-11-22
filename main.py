import subprocess
import time
import sys
from colorama import Fore, Style, init
from termcolor import colored
from halo import Halo
import itertools

init(autoreset=True)

# Function to print scrolling text
def scrolling_text(text, delay=0.08, color='cyan'):
    for char in text:
        if color:
            sys.stdout.write(colored(char, color))
        else:
            sys.stdout.write(char)
        sys.stdout.flush()
        time.sleep(delay)
    sys.stdout.write('\n')

# Function to show spinner with a message
def spinner_message(message, spinner='dots', color='yellow', duration=7):
    spinner = Halo(text=message, spinner=spinner, color=color)
    spinner.start()
    time.sleep(duration)
    spinner.succeed()
scrolling_text("Welcome to Jito-Bot v1.0.0", delay=0.1, color='green')

# Asking if the user wants Holder Mode
scrolling_text("Do you want to enable Holder Mode? (y/n(enter recovery mode))", delay=0.1, color='cyan')
response = input().strip().lower()

if response == 'y':
    # Asking if the user wants to fund new
    scrolling_text("Do you want to fund new holders? (y/n) 'y' will spend approx 20 percent of your bot wallet to fund 4 new wallets at default", delay=0.1, color='yellow')
    fund_response = input().strip().lower()

    if fund_response == 'y':
        # Welcome message with scrolling text
        scrolling_text("Welcome to Jito-Bot Holder mode", delay=0.1, color='green')
        time.sleep(1)

        # Sequence of subprocesses with colorful loading effects
        commands = [
            "utils/createHolders.ts",
            "utils/jitoBundleHolders.ts",
            "utils/jito_holders.ts"
        ]

        for idx, command in enumerate(commands):
            spinner_message(f"Processing: {command}", spinner='dots', color='green', duration=6)
            # Simulate running the command (commented out)
            subprocess.run(["ts-node", command])
            scrolling_text(f"{command} completed!", delay=0.08, color='yellow')
            time.sleep(3)

        # Fun effect with colors and spinners
        for i in range(3):
            spinner_message("Jito-Bot Holders Increased...", spinner='bouncingBar', color='magenta', duration=4)

        # Ending with a rainbow effect
        colors = [Fore.RED, Fore.YELLOW, Fore.GREEN, Fore.CYAN, Fore.MAGENTA]
        rainbow_message = "Jito-Bot is now complete! Enjoy :)"
        for i, char in enumerate(rainbow_message):
            sys.stdout.write(colors[i % len(colors)] + char)
            sys.stdout.flush()
            time.sleep(0.1)
        sys.stdout.write('\n')

    elif fund_response == 'n':
        # Sequence of subprocesses for non-funding mode
        alternative_commands = [
            "utils/jito_holders.ts"
        ]

        for idx, command in enumerate(alternative_commands):
            spinner_message(f"Processing: {command}", spinner='dots', color='green', duration=6)
            # Simulate running the command (commented out)
            subprocess.run(["ts-node", command])
            scrolling_text(f"{command} completed successfully!", delay=0.08, color='yellow')
            time.sleep(3)

    else:
        scrolling_text("Invalid response. Please run the script again and enter 'y' or 'n'.", delay=0.1, color='red')

elif response == 'n':
    # Run another script if Holder Mode is not enabled
    spinner_message("Running Sol Recovery process...", spinner='dots', color='blue', duration=3)
    subprocess.run(["ts-node", "de-funder.ts"])
    scrolling_text("recovery  script executed!", delay=0.08, color='yellow')

else:
    scrolling_text("Invalid response. Please run the script again and enter 'y' or 'n'.", delay=0.1, color='red')
