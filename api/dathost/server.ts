import type { VercelRequest, VercelResponse } from "@vercel/node";

type Action = "change_map" | "pause" | "unpause" | "restart";

function getAuthHeaders(): Record<string, string> {
  const apiKey = process.env.DATHOST_API_KEY || "";
  const email = process.env.DATHOST_EMAIL || "";
  const password = process.env.DATHOST_PASSWORD || "";

  // DatHost historically supported HTTP Basic (email/password) for many endpoints.
  // Some accounts also use API keys.
  if (apiKey) return { authorization: `Bearer ${apiKey}` };
  if (email && password) {
    const token = Buffer.from(`${email}:${password}`).toString("base64");
    return { authorization: `Basic ${token}` };
  }
  return {};
}

async function postJson(url: string, headers: Record<string, string>, body: any) {
  const r = await fetch(url, {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "application/json",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, text };
}

async function post(url: string, headers: Record<string, string>) {
  const r = await fetch(url, {
    method: "POST",
    headers,
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, text };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { action, serverId, payload } = (req.body || {}) as {
    action?: Action;
    serverId?: string;
    payload?: any;
  };

  const adminSecret = process.env.ADMIN_SECRET || "";
  if (adminSecret) {
    const got = (req.headers["x-admin-secret"] as string) || "";
    if (got !== adminSecret) return res.status(401).send("Unauthorized");
  }

  if (!action) return res.status(400).send("Missing action");
  if (!serverId) return res.status(400).send("Missing serverId");

  const base = (process.env.DATHOST_API_BASE || "https://dathost.net").replace(/\/$/, "");
  const authHeaders = getAuthHeaders();

  if (!authHeaders.authorization) {
    return res.status(500).send("Missing DatHost credentials (set DATHOST_API_KEY or DATHOST_EMAIL+DATHOST_PASSWORD)");
  }

  try {
    const id = encodeURIComponent(serverId);

    // NOTE: DatHost documents server start/stop endpoints under /api/0.1/game-servers/{server_id}/start|stop.
    const startUrl = `${base}/api/0.1/game-servers/${id}/start`;
    const stopUrl = `${base}/api/0.1/game-servers/${id}/stop`;

    // Console endpoint naming varies in examples across unofficial wrappers.
    // We allow overriding via env var if needed.
    const consolePath = process.env.DATHOST_CONSOLE_PATH || `/api/0.1/game-servers/${id}/console`;
    const consoleUrl = consolePath.startsWith("http") ? consolePath : `${base}${consolePath}`;

    if (action === "restart") {
      const s1 = await post(stopUrl, authHeaders);
      if (!s1.ok) return res.status(s1.status).send(s1.text || "Failed stopping server");
      const s2 = await post(startUrl, authHeaders);
      if (!s2.ok) return res.status(s2.status).send(s2.text || "Failed starting server");
      return res.status(200).send(s2.text || "Restarted");
    }

    if (action === "change_map") {
      const map = String(payload?.map || "").trim();
      if (!map) return res.status(400).send("Missing payload.map");
      // CS2: changelevel <map>
      const cmd = `changelevel ${map}`;
      const r = await postJson(consoleUrl, authHeaders, { line: cmd });
      if (!r.ok) return res.status(r.status).send(r.text || "Failed changing map");
      return res.status(200).send(r.text || "OK");
    }

    if (action === "pause" || action === "unpause") {
      // CS2/CS:GO server commands
      const cmd = action === "pause" ? "mp_pause_match" : "mp_unpause_match";
      const r = await postJson(consoleUrl, authHeaders, { line: cmd });
      if (!r.ok) return res.status(r.status).send(r.text || "Failed sending pause command");
      return res.status(200).send(r.text || "OK");
    }

    return res.status(400).send("Unknown action");
  } catch (err: any) {
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
}
