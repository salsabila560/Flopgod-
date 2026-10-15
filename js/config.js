// fill these in when the token goes live. leave empty to show "soon".
window.FLOPGOD_CONFIG = {
  contractAddress: "",   // "0x..."  (also turns on the wallet balance + holder rank)
  buyUrl: "",            // swap link on your launchpad / dex
  xUrl: "",              // https://x.com/yourhandle
  telegramUrl: "",       // https://t.me/yourgroup

  // Robinhood Chain mainnet (from docs.robinhood.com/chain/connecting)
  chain: {
    chainId: 4663,
    chainIdHex: "0x1237",
    name: "Robinhood Chain",
    rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
    explorer: "https://robinhoodchain.blockscout.com",
    currency: { name: "Ether", symbol: "ETH", decimals: 18 }
  },

  // holder ranks, checked from the top. amounts are whole tokens.
  ranks: [
    { min: 10000000, name: "high priest" },
    { min: 1000000,  name: "true believer" },
    { min: 100000,   name: "acolyte" },
    { min: 1,        name: "pilgrim" },
    { min: 0,        name: "non-believer (for now)" }
  ]
};
