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

# Welcome message with scrolling text
scrolling_text("Welcome to Jito-Bot", delay=0.1, color='cyan')
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
    scrolling_text(f"{command} completed successfully!", delay=0.08, color='yellow')
    time.sleep(3)

# Fun effect with colors and spinners
for i in range(3):
    spinner_message("Jito-Bot Holders Increased...", spinner='bouncingBar', color='magenta', duration=4)

# Ending with a rainbow effect
colors = [Fore.RED, Fore.YELLOW, Fore.GREEN, Fore.CYAN, Fore.MAGENTA]
rainbow_message = "Jito-Bot is now complete! Enjoy :)"
for char in rainbow_message:
    sys.stdout.write(colors[i % len(colors)] + char)
    sys.stdout.flush()
    time.sleep(0.7)
sys.stdout.write('\n')


