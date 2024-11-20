import subprocess
import time

subprocess.run(["ts-node","utils/createHolders.ts"])
time.sleep(3)
#subprocess.run(["ts-node","utils/jitoBundleHolders.ts"])
#time.sleep(3)
subprocess.run(["ts-node","utils/buy-bot-holders.ts"])
time.sleep(3)
#subprocess.run(["ts-node","utils/jitoBundleFinal.ts"])

#uncomment the above to allow the payable transaction
