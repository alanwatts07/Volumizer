# Utility Scripts for JitoBundle Bot and Looper Volumizer

This folder contains utility files and scripts designed to facilitate the use of the **JitoBundle Bot** and the **Looper Volumizer**. These tools work together to create new wallets, fund them, and execute transactions in bundles using Jito.

The main script to initiate the bot is **`main.py`**, which orchestrates the entire workflow, interacting with multiple scripts to complete the bundling and buying process.

## Workflow Overview

The JitoBundle bot workflow proceeds through several key stages:

1. **Create Wallets and Transactions (`createHolders.ts`)**
   - This step creates **four new wallets**.
   - Transactions are generated to fund these wallets, but they are **not sent** immediately.

2. **Fund Wallets (`jitoBundleHolders.ts`)**
   - The four wallets are funded with **SOL**.
   - The amount of SOL sent to each wallet is determined based on the total balance of the funding wallet (referred to as the **bot wallet**).
   - These transactions are bundled together and **sent as a Jito bundle**.

3. **Prepare Buy Transactions (`buy-bot-holders.ts`)**
   - After funding, a **buy transaction** is created for each of the four wallets.
   - These transactions are saved to a file named **`transactions2.json`** for later use.

4. **Send Final Bundle with Jito Tip (`jitoBundleFinal.ts`)**
   - The final step involves sending the buy transactions from the four wallets.
   - Additionally, a **Jito tip** is included, bundling all four transactions into a single Jito bundle.
   - The goal is to buy the token specified in the **`.env`** file.
   - Note: Currently, Jito appears to be experiencing some issues, and this final bundle **rarely succeeds**.

## Script Descriptions

- **`main.py`**: Main orchestrator script that runs the entire sequence, interacting with other utility scripts.
- **`createHolders.ts`**: Creates four new wallets and prepares transactions to fund them without sending the transactions. Puts wallets in the keys/ directory as well as the keys/keys1 directory so that no keys are lost or overwritten ever.
- **`jitoBundleHolders.ts`**: Sends SOL to the wallets in a Jito bundle, determining amounts based on the bot wallet's balance.
- **`buy-bot-holders.ts`**: Creates buy transactions for each wallet and saves them to `transactions2.json`.
- **`jitoBundleFinal.ts`**: Sends the final bundle, which includes the buy transactions along with a Jito tip.

## Current Limitations

- The final Jito bundle (`jitoBundleFinal.ts`) has shown inconsistency in executing successfully. Jito services may be facing issues, which means that the final buy transactions are often not confirmed.

## Getting Started

To get started, ensure that you have all the required dependencies installed and that the **`.env`** file is properly configured with the correct token information.

Run the workflow using:

```sh
python main.py
```

This command will initiate the entire process, including wallet creation, funding, and executing bundled transactions.

## Environment Setup

- **`.env` file**: Ensure that the **token details** and other relevant configuration variables are properly set in the `.env` file to facilitate smooth operation of the scripts.

## Prerequisites

- **Node.js**: The TypeScript scripts (`.ts`) require Node.js to run. Make sure you have Node.js installed along with `ts-node`.
- **Python**: The main orchestrator script (`main.py`) requires Python.
- **Jito Setup**: Ensure that Jito is properly configured and connected to the Solana network for bundling transactions.

## Troubleshooting

- If the **final bundle fails** often, consider verifying the Jito network status and ensure that your SOL balance is sufficient for tips and transaction fees.
- **Logging**: Check logs for each script to identify any issues during wallet creation, funding, or transaction bundling.

## Future Improvements

- Investigate the **Jito reliability issues** to improve the success rate of the final transaction bundle.
- Implement **error handling** and **retry logic** to increase the robustness of the entire workflow.

## Contributing

Feel free to contribute to the project by submitting **pull requests** or **issue reports**. Collaboration is welcome to help improve the stability and performance of the JitoBundle bot and the Looper Volumizer.

## License

This project is open-source and available under the [MIT License](LICENSE).

