// read-only wallet connect.
// - finds wallets with EIP-6963 (falls back to window.ethereum)
// - asks ONLY for eth_requestAccounts (see your address)
// - reads the $FLOPGOD balance straight from the public Robinhood Chain RPC,
//   so the wallet doesn't even need to be on that network
// - never calls eth_sendTransaction, eth_sign, personal_sign, approve, permit...
(function () {
  const CFG = window.FLOPGOD_CONFIG || {};
  const CHAIN = CFG.chain;
  const $ = (id) => document.getElementById(id);
  const toast = (m) => window.FlopUI && window.FlopUI.toast(m);

  const btn = $("walletBtn"), panel = $("walletPanel");
  const wallets = new Map(); // rdns -> { info, provider }
  let active = null;         // { provider, name }
  let address = null;

  // ---------- discover wallets ----------
  window.addEventListener("eip6963:announceProvider", (e) => {
    const d = e.detail;
    if (d && d.info && d.provider) wallets.set(d.info.rdns || d.info.uuid, d);
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  function walletList() {
    const list = [...wallets.values()];
    if (!list.length && window.ethereum) {
      list.push({ info: { name: "browser wallet", rdns: "injected", icon: "" }, provider: window.ethereum });
    }
    return list;
  }

  // ---------- panel ----------
  function open() { panel.hidden = false; render(); }
  function close() { panel.hidden = true; }
  btn.addEventListener("click", () => (panel.hidden ? open() : close()));
  $("walletClose").addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  function render() {
    const connected = !!address;
    $("wpPick").hidden = connected;
    $("wpConnected").hidden = !connected;
    if (connected) return;

    const list = walletList();
    const box = $("wpList");
    box.textContent = "";
    $("wpEmpty").hidden = list.length > 0;
    $("mmDeepLink").href = "https://metamask.app.link/dapp/" + location.host + location.pathname;
    list.forEach((w) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "wp-wallet";
      if (w.info.icon && /^data:image\//.test(w.info.icon)) {
        const img = document.createElement("img"); img.src = w.info.icon; img.alt = ""; img.width = 28; img.height = 28;
        b.appendChild(img);
      }
      const s = document.createElement("span"); s.textContent = w.info.name; b.appendChild(s);
      b.addEventListener("click", () => connect(w));
      box.appendChild(b);
    });
  }

  // ---------- connect ----------
  async function connect(w) {
    try {
      const accounts = await w.provider.request({ method: "eth_requestAccounts" });
      if (!accounts || !accounts[0]) throw new Error("no account");
      active = { provider: w.provider, name: w.info.name, rdns: w.info.rdns };
      setAddress(accounts[0]);
      try { localStorage.setItem("flopgod.wallet", w.info.rdns || "injected"); } catch (e) {}
      w.provider.on && w.provider.on("accountsChanged", (a) => (a && a[0] ? setAddress(a[0]) : disconnect()));
    } catch (e) {
      toast(e && e.code === 4001 ? "you said no. respect." : "couldn't connect, try again");
    }
  }

  function setAddress(a) {
    address = a;
    const short = a.slice(0, 6) + "…" + a.slice(-4);
    btn.textContent = short;
    btn.classList.add("on");
    $("wpAddr").textContent = a;
    $("wpExplorer").href = CHAIN.explorer + "/address/" + a;
    render();
    loadBalance();
  }

  function disconnect() {
    address = null; active = null;
    btn.textContent = "connect wallet"; btn.classList.remove("on");
    try { localStorage.removeItem("flopgod.wallet"); } catch (e) {}
    render();
  }
  $("walletDisconnect").addEventListener("click", () => { disconnect(); toast("disconnected"); });

  // silent reconnect if the wallet still trusts this site (no popup)
  setTimeout(async () => {
    let saved; try { saved = localStorage.getItem("flopgod.wallet"); } catch (e) {}
    if (!saved) return;
    const w = walletList().find((x) => (x.info.rdns || "injected") === saved);
    if (!w) return;
    try {
      const a = await w.provider.request({ method: "eth_accounts" });
      if (a && a[0]) { active = { provider: w.provider, name: w.info.name, rdns: saved }; setAddress(a[0]); }
    } catch (e) {}
  }, 400);

  // ---------- add network (just adds it to the wallet list, no funds involved) ----------
  $("addChainBtn").addEventListener("click", async () => {
    if (!active) return;
    try {
      await active.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN.chainIdHex }] });
      toast("you're on Robinhood Chain");
    } catch (e) {
      if (e && (e.code === 4902 || e.code === -32603)) {
        try {
          await active.provider.request({
            method: "wallet_addEthereumChain",
            params: [{ chainId: CHAIN.chainIdHex, chainName: CHAIN.name, rpcUrls: [CHAIN.rpcUrl], blockExplorerUrls: [CHAIN.explorer], nativeCurrency: CHAIN.currency }]
          });
          toast("Robinhood Chain added");
        } catch (e2) { toast(e2 && e2.code === 4001 ? "maybe later then" : "your wallet refused, add it manually"); }
      } else if (e && e.code === 4001) toast("maybe later then");
      else toast("couldn't switch network");
    }
  });

  // ---------- balance via public RPC ----------
  async function rpc(method, params) {
    const res = await fetch(CHAIN.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
    });
    const j = await res.json();
    if (j.error) throw new Error(j.error.message);
    return j.result;
  }

  let decimalsCache = null;
  async function loadBalance() {
    const bal = $("hcBal"), rank = $("hcRank");
    const token = (CFG.contractAddress || "").trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(token)) {
      bal.textContent = "soon™";
      rank.textContent = "your balance shows up here once $FLOPGOD launches";
      return;
    }
    bal.textContent = "…"; rank.textContent = "checking the scriptures…";
    try {
      const who = address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
      if (decimalsCache === null) {
        const d = await rpc("eth_call", [{ to: token, data: "0x313ce567" }, "latest"]); // decimals()
        decimalsCache = parseInt(d, 16) || 18;
      }
      const raw = await rpc("eth_call", [{ to: token, data: "0x70a08231" + who }, "latest"]); // balanceOf(address)
      const units = BigInt(raw && raw !== "0x" ? raw : "0x0");
      const base = 10n ** BigInt(decimalsCache);
      const whole = units / base;
      const frac = Number(units % base) / Number(base);
      const amount = Number(whole) + frac;

      bal.textContent = amount >= 1000
        ? Math.floor(amount).toLocaleString("en-US")
        : amount.toLocaleString("en-US", { maximumFractionDigits: 4 });

      const r = (CFG.ranks || []).find((x) => amount >= x.min);
      rank.textContent = r ? "rank: " + r.name : "";
      document.body.dataset.holder = amount > 0 ? "yes" : "no";
    } catch (e) {
      bal.textContent = "?";
      rank.textContent = "the temple RPC is busy. try again in a bit.";
    }
  }
})();
