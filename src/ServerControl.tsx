import { useMemo, useState, type ReactNode } from "react";

import { MAPS } from "./maps";

type BusyAction = "map" | "pause" | "unpause" | "restart" | null;

const Button = ({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={danger ? "btn-gaming" : "btn-secondary"}
      style={{
        padding: "0.6rem 1rem",
        opacity: disabled ? 0.5 : 1,
        borderColor: danger ? "var(--accent)" : undefined,
        color: danger ? "var(--accent)" : undefined,
        textShadow: danger ? "0 0 10px rgba(244, 114, 182, 0.4)" : undefined,
        cursor: disabled ? "not-allowed" : "pointer",
        minWidth: "140px"
      }}
    >
      {children}
    </button>
  );
};

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
    <div className="container" style={{ maxWidth: '100%', padding: '0' }}>
      <div className="panel">
        <h2 style={{ marginBottom: "1.5rem" }}>DatHost Server Controls</h2>

        <div style={{ display: "grid", gap: "1rem", maxWidth: "600px" }}>
          <label style={{ display: "grid", gap: "0.5rem" }}>
            <span style={{ fontWeight: 600, color: "var(--primary)" }}>Server ID</span>
            <input
              value={serverId}
              onChange={(e) => setServerId(e.target.value)}
              placeholder="e.g. 54f55784ced9b10646653aa9"
              style={{ width: "100%" }}
            />
            <span style={{ opacity: 0.6, fontSize: "0.8rem" }}>
              Tip: you can usually grab this from the DatHost control panel URL.
            </span>
          </label>

          <label style={{ display: "grid", gap: "0.5rem" }}>
            <span style={{ fontWeight: 600, color: "var(--secondary)" }}>Admin secret (optional)</span>
            <input
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="Only needed if you set ADMIN_SECRET on Vercel"
              style={{ width: "100%" }}
            />
          </label>

          <div style={{ display: "grid", gap: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={selectedMap}
                onChange={(e) => setSelectedMap(e.target.value)}
                style={{
                  padding: "0.8rem 1rem",
                  borderRadius: "4px",
                  border: "1px solid var(--border-color)",
                  background: "rgba(15, 23, 42, 0.6)",
                  color: "#fff",
                  fontFamily: "var(--font-main)",
                  minWidth: "220px",
                  cursor: "pointer"
                }}
              >
                {maps.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <div style={{ width: "150px" }}>
                <Button onClick={onChangeMap} disabled={busy !== null || !serverId.trim()}>
                  {busy === "map" ? "Changing…" : "Change map"}
                </Button>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
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
                margin: "1rem 0 0",
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-color)",
                background: "rgba(0,0,0,0.3)",
                color: "#10b981",
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                maxHeight: "260px",
                overflow: "auto",
                fontSize: "0.85rem"
              }}
            >
              {log}
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}
