import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  // Simple security (DatHost will send this header if you set authorization_header)
  const expected = process.env.DATHOST_WEBHOOK_SECRET || "";
  const got = (req.headers["authorization"] as string) || "";

  if (!expected || got !== expected) return res.status(401).send("Unauthorized");

  const payload = req.body;

  const matchId = payload?.match_id || payload?.id || payload?.match?.id;
  if (!matchId) return res.status(400).send("Missing match id");

  const row = {
    id: String(matchId),
    finished_at: payload?.finished_at ?? null,
    map: payload?.settings?.map ?? payload?.map ?? null,
    team1_name: payload?.team1?.name ?? null,
    team2_name: payload?.team2?.name ?? null,
    team1_score: payload?.team1_stats?.score ?? null,
    team2_score: payload?.team2_stats?.score ?? null,
    payload,
  };

  const { error } = await supabase.from("matches").upsert(row);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true });
}
