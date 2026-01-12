// api/dathost/server.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * This endpoint runs on Vercel (server-side) and proxies safe CS2 admin actions to DatHost.
 *
 * Env vars (set in Vercel Project Settings -> Environment Variables):
 *  - DATHOST_EMAIL
 *  - DATHOST_PASSWORD
 *    OR
 *  - DATHOST_API_KEY
 *
 * Optional:
 *  - ADMIN_SECRET  (if set, request must include x-admin-secret header OR adminSecret in JSON body)
 *  - DATHOST_API_BASE (default: https://dathost.net)
 *
 * Request body (JSON):
 *  {
 *    "action": "restart" | "change_map" | "pause" | "unpause",
 *    "serverId": "<dathost server id>",
 *    "map": "de_mirage",            // required for change_map
 *    "adminSecret": "..."           // optional (alternative to header)
 *  }
 */

// ---- helpers -------------------------------------------------------------

function getApiBase(): string {
  return (process.env.DATHOST_API_BASE || "https://dathost.net").replace(/\/+$/, "");
}

function getAuthHeaders(): Record<string, string> {
  const apiKey = process.env.DATHOST_API_KEY;
  if (apiKey) {
    return { Authorization: `Bearer ${apiKey}` };
  }

  const email = process.env.DATHOST_EMAIL;
  const password = process.env.DATHOST_PASSWORD;
  if (email && password) {
    const token = Buffer.from(`${email}:${password}`).toString("base64");
    return { Authorization: `Basic ${token}` };
  }

  return {};
}

async function fetchText(url: string, init: RequestInit) {
  const resp = await fetch(url, init);
  const text = await resp.text();
  return { ok: resp.ok, status: resp.status, text };
}

async function postJson(url: string, headers: Record<string, string>, body: any) {
  return fetchText(url, {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "application/json",
      accept: "application/json, text/plain, */*",
    },
    body: JSON.stringify(body),
  });
}

async function postForm(url: string, headers: Record<string, string>, form: Record<string, string>) {
  return fetchText(url, {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json, text/plain, */*",
    },
    body: new URLSearchParams(form).toString(),
  });
}

async function sendConsole(serverId: string, cmd: string, authHeaders: Record<string, string>) {
  const base = getApiBase();

  // DatHost console endpoint (commonly):
  // POST https://dathost.net/api/0.1/game-servers/{server_id}/console  (form: line=...)
  const consoleUrl = `${base}/api/0.1/game-servers/${encodeURIComponent(serverId)}/console`;

  // Use form-encoded for best compatibility
  const r = await postForm(consoleUrl, authHeaders, { line: cmd });

  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      error: `DatHost console call failed (${r.status})`,
      details: r.text,
      consoleUrl,
      cmd,
    };
  }

  return { ok: true, status: r.status, details: r.text, consoleUrl, cmd };
}

async function stopServer(serverId: string, authHeaders: Record<string, string>) {
  const base = getApiBase();
  const url = `${base}/api/0.1/game-servers/${encodeURIComponent(serverId)}/stop`;
  const r = await postJson(url, authHeaders, {});
  return { ...r, url };
}

async function startServer(serverId: string, authHeaders: Record<string, string>) {
  const base = getApiBase();
  const url = `${base}/api/0.1/game-servers/${encodeURIComponent(serverId)}/start`;
  const r = await postJson(url, authHeaders, {});
  return { ...r, url };
}

// ---- handler -------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Safe debug: does NOT expose secret values, only booleans + key names.
  if (req.query?.debug === "1") {
    return res.status(200).json({
      hasApiKey: Boolean(process.env.DATHOST_API_KEY),
      hasEmail: Boolean(process.env.DATHOST_EMAIL),
      hasPassword: Boolean(process.env.DATHOST_PASSWORD),
      hasAdminSecret: Boolean(process.env.ADMIN_SECRET),
      keys: Object.keys(process.env).filter((k) => k.startsWith("DATHOST_") || k === "ADMIN_SECRET"),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  // optional endpoint protection
  const requiredSecret = process.env.ADMIN_SECRET;
  const headerSecret = req.headers["x-admin-secret"];
  const body: any = req.body || {};
  const bodySecret = body.adminSecret;

  if (requiredSecret) {
    const provided = (typeof headerSecret === "string" ? headerSecret : "") || (typeof bodySecret === "string" ? bodySecret : "");
    if (!provided || provided !== requiredSecret) {
      return res.status(401).send("Unauthorized (missing/invalid admin secret)");
    }
  }

  const authHeaders = getAuthHeaders();
  if (!authHeaders.Authorization) {
    return res
      .status(500)
      .send("Missing DatHost credentials (set DATHOST_API_KEY or DATHOST_EMAIL+DATHOST_PASSWORD)");
  }

  const action = body.action as string | undefined;
  const serverId = body.serverId as string | undefined;
  const map = body.map as string | undefined;

  if (!action) return res.status(400).send("Missing 'action'");
  if (!serverId) return res.status(400).send("Missing 'serverId'");

  try {
    if (action === "restart") {
      const stop = await stopServer(serverId, authHeaders);
      // even if stop fails, try start; but report both
      const start = await startServer(serverId, authHeaders);

      return res.status(200).json({
        ok: stop.ok && start.ok,
        stop,
        start,
      });
    }

    if (action === "change_map") {
      if (!map) return res.status(400).send("Missing 'map' for change_map");
      const r = await sendConsole(serverId, `changelevel ${map}`, authHeaders);
      if (!r.ok) return res.status(502).json(r);
      return res.status(200).json(r);
    }

    if (action === "pause") {
      const r = await sendConsole(serverId, `mp_pause_match`, authHeaders);
      if (!r.ok) return res.status(502).json(r);
      return res.status(200).json(r);
    }

    if (action === "unpause") {
      const r = await sendConsole(serverId, `mp_unpause_match`, authHeaders);
      if (!r.ok) return res.status(502).json(r);
      return res.status(200).json(r);
    }

    return res.status(400).send(`Unknown action: ${action}`);
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      message: err?.message || String(err),
    });
  }
}
