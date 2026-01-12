import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { action, matchId, payload } = req.body || {};

  const controlUrl = process.env.DATHOST_CONTROL_URL || "";
  const apiKey = process.env.DATHOST_API_KEY || "";
  const adminSecret = process.env.ADMIN_SECRET || "";

  // Optional admin secret protection: if ADMIN_SECRET is set server-side,
  // require the same value be present in the `x-admin-secret` request header.
  if (adminSecret) {
    const got = (req.headers["x-admin-secret"] as string) || "";
    if (got !== adminSecret) return res.status(401).send("Unauthorized");
  }

  if (!controlUrl) return res.status(500).send("DATHOST_CONTROL_URL not configured");
  if (!action) return res.status(400).send("Missing action");
  if (!matchId) return res.status(400).send("Missing matchId");

  // controlUrl can include placeholders {action} and {matchId}
  const url = controlUrl.replace(/{action}/g, encodeURIComponent(action)).replace(/{matchId}/g, encodeURIComponent(String(matchId)));

  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (apiKey) headers["authorization"] = `Bearer ${apiKey}`;

    const r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload ?? {}),
    });

    const text = await r.text();
    res.status(r.status).send(text);
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}
