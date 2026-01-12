import { useMemo, useState, type ReactNode } from "react";

import { MAPS } from "./maps";

type BusyAction = "map" | "pause" | "unpause" | "restart" | null;

function Button({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #ccc",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontWeight: 600,
        background: danger ? "#ffecec" : undefined,
      }}
    >
      {children}
    </button>
  );
}

export default function ServerControl() {
  const [serverId, setServerId] = useState<string>(import.meta.env.VITE_DATHOST_SERVER_ID ?? "");
  const [adminSecret, setAdminSecret] = useState<string>(import.meta.env.VITE_ADMIN_SECRET ?? "");

  const maps = useMemo(() => MAPS.slice().sort(), []);
  const [selectedMap, setSelectedMap] = useState<string>(maps[0] ?? "de_dust2");

  const [busy, setBusy] = useState<BusyAction>(null);
  const [paused, setPaused] = useState<boolean>(false);
  const [log, setLog] = useState<string>("");

  async function call(action: "change_map" | "pause" | "unpause" | "restart", payload?: any) {
    if (!serverId.trim()) {
      alert("Missing server id");
      return;
    }

    const headers: Record<string, string> = { "content-type": "application/json" };
    if (adminSecret) headers["x-admin-secret"] = adminSecret;

    const r = await fetch("/api/dathost/server", {
      method: "POST",
      headers,
      body: JSON.stringify({ action, serverId: serverId.trim(), payload }),
    });

    const text = await r.text();
    setLog(text || `HTTP ${r.status}`);

    if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
    return text;
  }

  async function onChangeMap() {
    setBusy("map");
    try {
      await call("change_map", { map: selectedMap });
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onPauseToggle() {
    setBusy(paused ? "unpause" : "pause");
    try {
      if (paused) {
        await call("unpause");
        setPaused(false);
      } else {
        await call("pause");
        setPaused(true);
      }
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onRestart() {
    const ok = confirm("Restart the server? Everyone will get kicked.");
    if (!ok) return;
    setBusy("restart");
    try {
      await call("restart");
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>DatHost Server Controls</h2>

      <div style={{ display: "grid", gap: 10, maxWidth: 620 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Server ID</span>
          <input
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            placeholder="e.g. 54f55784ced9b10646653aa9"
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          />
          <span style={{ opacity: 0.75, fontSize: 12 }}>
            Tip: you can usually grab this from the DatHost control panel URL.
          </span>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Admin secret (optional)</span>
          <input
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="Only needed if you set ADMIN_SECRET on Vercel"
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          />
        </label>

        <div style={{ display: "grid", gap: 8, paddingTop: 8 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={selectedMap}
              onChange={(e) => setSelectedMap(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", minWidth: 220 }}
            >
              {maps.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <Button onClick={onChangeMap} disabled={busy !== null || !serverId.trim()}>
              {busy === "map" ? "Changing…" : "Change map"}
            </Button>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Button onClick={onPauseToggle} disabled={busy !== null || !serverId.trim()}>
              {busy === "pause" || busy === "unpause" ? "Working…" : paused ? "Unpause game" : "Pause game"}
            </Button>
            <Button onClick={onRestart} disabled={busy !== null || !serverId.trim()} danger>
              {busy === "restart" ? "Restarting…" : "Restart server"}
            </Button>
          </div>
        </div>

        {log ? (
          <pre
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #eee",
              background: "#fafafa",
              whiteSpace: "pre-wrap",
              maxHeight: 260,
              overflow: "auto",
            }}
          >
            {log}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
