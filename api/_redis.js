// minimal Upstash Redis REST client. no dependencies.
// works with the Upstash integration from the Vercel Marketplace,
// which sets either UPSTASH_REDIS_REST_* or KV_REST_API_* env vars.
const URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export const configured = Boolean(URL && TOKEN);

export async function pipeline(commands) {
  const res = await fetch(URL + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(commands)
  });
  if (!res.ok) throw new Error("redis " + res.status);
  const out = await res.json();
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

export const KEYS = {
  prayers: "flopgod:prayers",
  faithful: "flopgod:faithful",
  board: "flopgod:board",
  names: "flopgod:names",
  limit: (who) => "flopgod:rl:" + who
};

export function cleanId(id) {
  return typeof id === "string" ? id.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64) : "";
}

export function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : (fwd || "")).split(",")[0].trim() || "unknown";
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

// allow `max` units per `windowSec` for a given key. returns true if allowed.
export async function allow(who, units, max, windowSec) {
  const [count] = await pipeline([
    ["INCRBY", KEYS.limit(who), String(units)],
    ["EXPIRE", KEYS.limit(who), String(windowSec), "NX"]
  ]);
  return Number(count) <= max;
}
