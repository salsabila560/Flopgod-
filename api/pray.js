import { configured, pipeline, KEYS, cleanId, clientIp, readBody, allow } from "./_redis.js";

// POST /api/pray  { id, count }  -> { prayers, faithful }
// prayers are sent in small batches from the page (max 50 per request).
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!configured) return res.status(503).json({ error: "database not connected" });
  try {
    const body = await readBody(req);
    const id = cleanId(body.id);
    const count = Math.floor(Number(body.count));
    if (!id || !Number.isFinite(count) || count < 1 || count > 50) {
      return res.status(400).json({ error: "send an id and a count between 1 and 50" });
    }
    // a human can't really tap more than ~15 times a second
    if (!(await allow("pray:" + clientIp(req), count, 150, 10))) {
      return res.status(429).json({ error: "slow down, the god is overheating" });
    }
    const [prayers, , faithful] = await pipeline([
      ["INCRBY", KEYS.prayers, String(count)],
      ["SADD", KEYS.faithful, id],
      ["SCARD", KEYS.faithful]
    ]);
    return res.status(200).json({ prayers: Number(prayers), faithful: Number(faithful) });
  } catch (e) {
    return res.status(500).json({ error: "temple unreachable" });
  }
}
