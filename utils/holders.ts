import { generateKeypairAndTransaction } from "./createHolders";


(async () => {
    const tx = await generateKeypairAndTransaction();
    console.log(tx);
})();

