// feed him. a tiny canvas game drawn to look like marker on paper.
(function () {
  const $ = (id) => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const frame = $("gameFrame");
  const S = window.FlopState;

  const INK = "#141210", GREEN = "#3ee06a", YELLOW = "#ffd23f", RED = "#ff4b3e", PAPER = "#fffdf3";
  const BOWL_W = 84, BOWL_H = 22;
  let W = 0, H = 0;

  const G = { on: false, score: 0, lives: 3, items: [], x: 0, tx: 0, spawn: 0, t: 0, last: 0, keys: { l: false, r: false }, pops: [], shake: 0 };

  $("nameInput").value = S.me.name || "";

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!G.x) G.x = G.tx = W / 2;
    G.x = clamp(G.x, BOWL_W / 2, W - BOWL_W / 2);
    if (!G.on) draw();
  }
  new ResizeObserver(resize).observe(canvas);

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const px = (e) => e.clientX - canvas.getBoundingClientRect().left;
  frame.addEventListener("pointermove", (e) => { G.tx = px(e); });
  frame.addEventListener("pointerdown", (e) => { if (G.on) G.tx = px(e); });
  addEventListener("keydown", (e) => {
    if (!G.on) return;
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { G.keys.l = true; e.preventDefault(); }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { G.keys.r = true; e.preventDefault(); }
  });
  addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") G.keys.l = false;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") G.keys.r = false;
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && G.on) end(true); });

  $("startBtn").addEventListener("click", () => {
    const name = $("nameInput").value.trim().replace(/[^\p{L}\p{N} _.\-]/gu, "").slice(0, 16);
    S.setName(name);
    start();
  });
  $("nameInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("startBtn").click(); });

  function start() {
    Object.assign(G, { on: true, score: 0, lives: 3, items: [], spawn: 0, t: 0, pops: [], shake: 0, last: performance.now() });
    G.x = G.tx = W / 2;
    $("overlay").hidden = true;
    hud();
    requestAnimationFrame(loop);
  }

  function end(paused) {
    G.on = false;
    const best = G.score > S.me.best;
    if (best) S.newBest(G.score);
    const lines = ["he's still hungry", "rip. he's hangry now", "the flops got you", "skill issue (affectionate)"];
    $("ovTitle").textContent = paused ? "paused" : best && G.score > 0 ? "NEW BEST. he's proud" : lines[Math.floor(Math.random() * lines.length)];
    $("ovText").textContent = "you fed him " + G.score + " points. best: " + S.me.best;
    $("startBtn").textContent = "again";
    $("overlay").hidden = false;
    draw();
  }

  function hud() {
    $("hudScore").textContent = G.score;
    $("hudLives").textContent = "♥".repeat(Math.max(G.lives, 0)) + "♡".repeat(3 - Math.max(G.lives, 0));
  }

  function spawn() {
    const lvl = Math.min(G.t / 60, 1);
    const r = Math.random();
    const flop = 0.18 + lvl * 0.17;
    const type = r < flop ? "flop" : r < flop + 0.22 ? "gpu" : "chip";
    const s = type === "gpu" ? 34 : type === "flop" ? 28 : 24;
    G.items.push({ type, s, x: s + Math.random() * (W - s * 2), y: -s, vy: (120 + lvl * 190) * (0.85 + Math.random() * 0.3), rot: Math.random() * 6, seed: Math.random() * 100 });
  }

  function loop(now) {
    if (!G.on) return;
    const dt = Math.min((now - G.last) / 1000, 0.05);
    G.last = now; G.t += dt;
    if (G.keys.l) G.tx -= 540 * dt;
    if (G.keys.r) G.tx += 540 * dt;
    G.tx = clamp(G.tx, BOWL_W / 2, W - BOWL_W / 2);
    G.x += (G.tx - G.x) * Math.min(1, dt * 14);

    G.spawn -= dt;
    if (G.spawn <= 0) { spawn(); G.spawn = Math.max(0.3, 0.9 - G.t * 0.01); }

    const by = H - 40;
    for (let i = G.items.length - 1; i >= 0; i--) {
      const it = G.items[i];
      it.y += it.vy * dt; it.rot += dt * 2.4;
      const hit = it.y + it.s / 2 >= by && it.y - it.s / 2 <= by + BOWL_H && Math.abs(it.x - G.x) < BOWL_W / 2 + it.s / 3;
      if (hit) {
        G.items.splice(i, 1);
        if (it.type === "flop") { G.lives--; G.shake = 0.3; G.pops.push({ x: it.x, y: by - 12, txt: "OUCH", c: RED, t: 0 }); }
        else { const p = it.type === "gpu" ? 25 : 10; G.score += p; G.pops.push({ x: it.x, y: by - 12, txt: "+" + p, c: INK, t: 0 }); }
        hud();
        if (G.lives <= 0) { end(false); return; }
      } else if (it.y - it.s > H) G.items.splice(i, 1);
    }
    G.pops.forEach((p) => { p.t += dt; p.y -= 50 * dt; });
    G.pops = G.pops.filter((p) => p.t < 0.8);
    G.shake = Math.max(0, G.shake - dt);
    draw();
    requestAnimationFrame(loop);
  }

  // marker-ish line: draws a path twice with a tiny offset
  function sketch(fn, color, width) {
    ctx.strokeStyle = color || INK; ctx.lineWidth = width || 3; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath(); fn(0); ctx.stroke();
    ctx.globalAlpha = 0.5; ctx.lineWidth = (width || 3) * 0.6;
    ctx.beginPath(); fn(1.2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function draw() {
    if (!W) return;
    ctx.save();
    if (G.shake > 0) ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6);
    ctx.fillStyle = PAPER; ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.strokeStyle = "rgba(20,18,16,.07)"; ctx.lineWidth = 1;
    for (let y = 30; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    G.items.forEach(item);

    // bowl
    const bx = G.x - BOWL_W / 2, by = H - 40;
    ctx.fillStyle = YELLOW;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + BOWL_W, by); ctx.lineTo(bx + BOWL_W - 12, by + BOWL_H); ctx.lineTo(bx + 12, by + BOWL_H); ctx.closePath(); ctx.fill();
    sketch((o) => { ctx.moveTo(bx - 2 + o, by + o); ctx.lineTo(bx + BOWL_W + 2, by - o); ctx.lineTo(bx + BOWL_W - 12 + o, by + BOWL_H); ctx.lineTo(bx + 12 - o, by + BOWL_H + o); ctx.closePath(); });
    ctx.font = "16px 'Permanent Marker', cursive"; ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("FEED", G.x, by + BOWL_H / 2 + 1);

    ctx.font = "24px 'Permanent Marker', cursive";
    G.pops.forEach((p) => { ctx.globalAlpha = 1 - p.t / 0.8; ctx.fillStyle = p.c; ctx.fillText(p.txt, p.x, p.y); });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function item(it) {
    ctx.save(); ctx.translate(it.x, it.y);
    const s = it.s;
    if (it.type === "chip") {
      ctx.rotate(Math.sin(it.rot) * 0.4);
      ctx.fillStyle = GREEN; ctx.fillRect(-s / 2, -s / 2, s, s);
      sketch((o) => {
        ctx.rect(-s / 2 + o, -s / 2, s, s - o);
        for (let k = -1; k <= 1; k++) {
          ctx.moveTo(-s / 2, k * 7); ctx.lineTo(-s / 2 - 6, k * 7 + o);
          ctx.moveTo(s / 2, k * 7); ctx.lineTo(s / 2 + 6, k * 7 - o);
        }
      });
    } else if (it.type === "gpu") {
      ctx.rotate(Math.sin(it.rot * 0.7) * 0.15);
      const w = s * 1.6, h = s * 0.85;
      ctx.fillStyle = YELLOW; ctx.fillRect(-w / 2, -h / 2, w, h);
      sketch((o) => {
        ctx.rect(-w / 2 + o, -h / 2 - o, w, h);
        [-w / 4, w / 4].forEach((cx) => { ctx.moveTo(cx + h * 0.32, 0); ctx.arc(cx + o, 0, h * 0.32, 0, Math.PI * 2); });
      });
      [-w / 4, w / 4].forEach((cx) => {
        sketch(() => { for (let b = 0; b < 3; b++) { const a = it.rot * 4 + b * 2.09; ctx.moveTo(cx, 0); ctx.lineTo(cx + Math.cos(a) * h * 0.28, Math.sin(a) * h * 0.28); } }, INK, 2);
      });
    } else {
      ctx.rotate(it.rot * 0.5);
      ctx.fillStyle = RED;
      ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2); ctx.fill();
      sketch((o) => { ctx.arc(o, -o, s / 2, 0, Math.PI * 2); });
      // fuse
      sketch(() => { ctx.moveTo(s / 3, -s / 3); ctx.quadraticCurveTo(s / 2 + 6, -s / 2 - 8, s / 2 + 2, -s / 2 - 14); }, INK, 2);
      ctx.rotate(-it.rot * 0.5);
      ctx.fillStyle = "#fff"; ctx.font = "10px 'Space Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("FLOP", 0, 1);
    }
    ctx.restore();
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!G.on) draw(); });
})();
