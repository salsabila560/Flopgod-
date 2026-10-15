(function () {
  const CFG = window.FLOPGOD_CONFIG || {};
  const API = window.FlopAPI;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Number(n || 0).toLocaleString("en-US");

  const local = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  // ---------- toast ----------
  let toastT;
  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 1800);
  }

  // ---------- launch config ----------
  ["buyBtn", "buyBtn2"].forEach((id) => {
    const b = $(id);
    if (CFG.buyUrl) { b.href = CFG.buyUrl; b.target = "_blank"; b.rel = "noopener"; }
    else { b.textContent = "launching soon"; b.setAttribute("aria-disabled", "true"); }
  });
  if (CFG.contractAddress) {
    $("caValue").textContent = CFG.contractAddress;
    const c = $("copyCa");
    c.hidden = false;
    c.addEventListener("click", () => {
      navigator.clipboard.writeText(CFG.contractAddress).then(
        () => toast("copied. now go buy"),
        () => {
          const r = document.createRange(); r.selectNodeContents($("caValue"));
          const s = getSelection(); s.removeAllRanges(); s.addRange(r);
          toast("selected. hit copy");
        }
      );
    });
  }
  const socials = [["X", CFG.xUrl], ["Telegram", CFG.telegramUrl]].filter((s) => s[1]);
  socials.forEach(([name, url]) => {
    const a = document.createElement("a");
    a.className = "btn btn-pink"; a.href = url; a.target = "_blank"; a.rel = "noopener"; a.textContent = name;
    $("socials").appendChild(a);
  });

  // ---------- shared state ----------
  const me = local.get("flopgod.me", { prayers: 0, best: 0, name: "" });
  let server = null;      // last /api/stats response
  let online = false;
  let unsent = 0;         // prayers not yet sent to the server

  window.FlopState = {
    me,
    save: () => local.set("flopgod.me", me),
    newBest(score) {
      me.best = score; local.set("flopgod.me", me);
      renderBoard();
      if (online) API.score(me.name || "anon", score).then(refresh).catch(() => {});
    },
    setName(name) { me.name = name; local.set("flopgod.me", me); }
  };

  // ---------- prayers ----------
  const BLESSINGS = [
    "your gpu will never overheat",
    "green candles incoming. maybe",
    "your bags have been blessed",
    "thy vram overflows",
    "the fans spin in your favor today",
    "you are forgiven for buying the top",
    "low gas. high vibes",
    "he saw your offering. it was ok",
    "your weights are aligned",
    "go forth and compute",
    "brrrrrrrrr",
    "a thousand teraflops watch over you",
    "he blinked. that means yes"
  ];
  const POPS = ["+1", "brrr", "amen", "+1 flop", "🙏", "+1"];
  let lastB = -1;

  $("prayBtn").addEventListener("click", (e) => {
    me.prayers += 1; unsent += 1;
    local.set("flopgod.me", me);

    let i; do { i = Math.floor(Math.random() * BLESSINGS.length); } while (i === lastB);
    lastB = i;
    const b = $("blessing");
    b.textContent = BLESSINGS[i];
    b.classList.remove("fresh"); void b.offsetWidth; b.classList.add("fresh");

    const pop = document.createElement("span");
    pop.className = "pop";
    pop.textContent = POPS[Math.floor(Math.random() * POPS.length)];
    pop.style.setProperty("--dx", (Math.random() * 120 - 60) + "px");
    pop.style.setProperty("--rot", (Math.random() * 40 - 20) + "deg");
    e.currentTarget.appendChild(pop);
    setTimeout(() => pop.remove(), 950);

    renderStats();
    queueSend();
  });

  let sendT, sending = false;
  function queueSend() {
    if (!online) return;
    clearTimeout(sendT);
    sendT = setTimeout(flush, 1200);
  }
  async function flush() {
    if (sending || unsent <= 0) return;
    sending = true;
    const n = Math.min(unsent, 50);
    try {
      const r = await API.pray(n);
      unsent -= n;
      if (server) { server.prayers = r.prayers; server.faithful = r.faithful; }
      renderStats();
    } catch (e) { /* keep unsent, try again on next tap / refresh */ }
    sending = false;
    if (unsent > 0) queueSend();
  }

  function renderStats() {
    const global = server ? server.prayers + unsent : me.prayers;
    $("statGlobal").textContent = fmt(global);
    $("statMine").textContent = fmt(me.prayers);
    $("statFaithful").textContent = fmt(server ? server.faithful : (me.prayers > 0 ? 1 : 0));
  }

  // ---------- leaderboard ----------
  function renderBoard() {
    let rows = server ? server.leaderboard.slice() : [];
    if (me.best > 0) {
      const mine = rows.find((r) => r.me);
      if (mine) { mine.score = Math.max(mine.score, me.best); mine.name = me.name || mine.name; }
      else rows.push({ name: me.name || "anon", score: me.best, me: true });
    }
    rows.sort((a, b) => b.score - a.score);
    rows = rows.slice(0, 10);

    const list = $("boardList");
    list.textContent = "";
    if (!rows.length) {
      const li = document.createElement("li"); li.className = "empty";
      li.textContent = "nobody yet. be the first.";
      list.appendChild(li); return;
    }
    rows.forEach((r) => {
      const li = document.createElement("li");
      if (r.me) li.className = "me";
      const nm = document.createElement("span"); nm.className = "nm";
      nm.textContent = r.me ? (r.name || "anon") + " (you)" : (r.name || "anon");
      const sc = document.createElement("span"); sc.className = "sc"; sc.textContent = fmt(r.score);
      li.append(nm, sc);
      list.appendChild(li);
    });
  }

  // ---------- server sync ----------
  async function refresh() {
    try {
      const s = await API.stats();
      s.leaderboard = (s.leaderboard || []).map((r) => ({ name: r.name, score: r.score, me: r.id === API.id }));
      server = s;
      if (!online) {
        online = true;
        $("syncNote").textContent = "connected. your prayers count worldwide.";
        // first time online: push anything done offline
        const mine = s.leaderboard.find((r) => r.me);
        if (me.best > 0 && (!mine || mine.score < me.best)) API.score(me.name || "anon", me.best).catch(() => {});
      }
    } catch (e) {
      if (!online) $("syncNote").textContent = "temple is offline. your prayers are saved on this device.";
    }
    renderStats();
    renderBoard();
  }

  // a returning visitor's unsent count starts at 0: their old prayers were already sent
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 10000);
  window.addEventListener("pagehide", () => {
    if (online && unsent > 0 && navigator.sendBeacon) {
      navigator.sendBeacon("/api/pray", new Blob([JSON.stringify({ id: API.id, count: Math.min(unsent, 50) })], { type: "application/json" }));
    }
  });

  renderStats();
  renderBoard();
  window.FlopUI = { toast };
})();
