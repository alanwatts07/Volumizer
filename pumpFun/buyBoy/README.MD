# Buy Boy Is Here

![the buyBoy in action!][image.png]
----------------------------

## Trading bot for Pump Fun

----------------------

### Key Features

------------------------

### 'Modes'

| Initial Mode|  Action       | 
|-------------|---------------|
|    buy      | #buys your amt|
|   sell      | #sells all    |
|  buySell    | #buys and then sells after interval |    

- Style
    - cool style!
    - WOW

## Setup and Settings

---------------------------------
- config.yaml
```yaml
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
```

**then run this**
```bash
pip install -r requirements.txt
```
**then this**

```bash
python3 main.py
```
**good luck fixing the errors haha**

[image.png]: image.png