import { configured, pipeline, KEYS, cleanId, clientIp, readBody, allow } from "./_redis.js";

const MAX_SCORE = 50000; // anything above this is almost certainly fake

// POST /api/score  { id, name, score }  -> { ok: true }
// keeps each player's best score only.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!configured) return res.status(503).json({ error: "database not connected" });
  try {
    const body = await readBody(req);
    const id = cleanId(body.id);
    const score = Math.floor(Number(body.score));
    const name = String(body.name || "anon").replace(/[^\p{L}\p{N} _.\-]/gu, "").trim().slice(0, 16) || "anon";
    if (!id || !Number.isFinite(score) || score < 1 || score > MAX_SCORE) {
      return res.status(400).json({ error: "invalid score" });
    }
    if (!(await allow("score:" + clientIp(req), 1, 20, 60))) {
      return res.status(429).json({ error: "too many scores, take a breath" });
    }
    await pipeline([
      ["ZADD", KEYS.board, "GT", String(score), id],
      ["HSET", KEYS.names, id, name],
      ["SADD", KEYS.faithful, id]
    ]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "temple unreachable" });
  }
}
