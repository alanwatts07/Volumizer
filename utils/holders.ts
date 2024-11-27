import { generateKeypairsAndTransactions} from "./createHolders";


(async () => {
    const tx = await generateKeypairsAndTransactions(5);
    console.log(tx);
})();

