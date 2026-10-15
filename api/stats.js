import { configured, pipeline, KEYS, cleanId } from "./_redis.js";

// GET /api/stats?me=<id>
// -> { prayers, faithful, leaderboard: [{ name, score, id? }] }
// ids are never exposed; only your own row is marked (id === your id).
export default async function handler(req, res) {
  if (!configured) return res.status(503).json({ error: "database not connected" });
  try {
    const me = cleanId(req.query && req.query.me);
    const [prayers, faithful, board] = await pipeline([
      ["GET", KEYS.prayers],
      ["SCARD", KEYS.faithful],
      ["ZRANGE", KEYS.board, "0", "9", "REV", "WITHSCORES"]
    ]);

    const rows = [];
    for (let i = 0; i < (board || []).length; i += 2) rows.push({ id: board[i], score: Number(board[i + 1]) });

    let names = [];
    if (rows.length) [names] = await pipeline([["HMGET", KEYS.names, ...rows.map((r) => r.id)]]);

    const leaderboard = rows.map((r, i) => {
      const row = { name: (names && names[i]) || "anon", score: r.score };
      if (me && r.id === me) row.id = me;
      return row;
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ prayers: Number(prayers) || 0, faithful: Number(faithful) || 0, leaderboard });
  } catch (e) {
    return res.status(500).json({ error: "temple unreachable" });
  }
}
