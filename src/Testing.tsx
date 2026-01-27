import { useMemo } from "react";
import matchesRaw from "./data/matches.json";

type MatchPlayer = {
  accountId: string;
  name: string;
  kills: number;
  deaths: number;
  assists: number;
  dmg: number;
  hsp: number;
  fireDamage: number;
  kdr: number;
  adr: number;
};

type Match = {
  id: string;
  file: string;
  map: string | null;
  server: string | null;
  roundsPlayed: number;
  scoreT: number;
  scoreCT: number;
  startedAt: string | null;
  endedAt: string | null;
  players: MatchPlayer[];
};

function parseTs(s: string | null) {
  if (!s) return 0;
  // format: MM/DD/YYYY HH:MM:SS
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    const [, mm, dd, yyyy, hh, min, sec] = m;
    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}`).getTime();
  }
  const t = Date.parse(s);
  return isNaN(t) ? 0 : t;
}

export default function Testing() {
  const matches = matchesRaw as Match[];

  const latest = useMemo(() => {
    if (!matches || matches.length === 0) return null;
    return matches.reduce<Match | null>((best, m) => {
      if (!best) return m;
      const tA = parseTs(m.endedAt ?? m.startedAt ?? null);
      const tB = parseTs(best.endedAt ?? best.startedAt ?? null);
      return tA > tB ? m : best;
    }, null);
  }, [matches]);

  if (!latest) {
    return <div>No matches available.</div>;
  }

  const m = latest;

  return (
    <div className="container" style={{ maxWidth: '100%', padding: '0' }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1>Testing — Latest Match</h1>
      </header>

      <div className="panel" style={{ padding: 0 }}>
        <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <span style={{ fontSize: "1.5rem", fontWeight: 800, textTransform: "uppercase", color: "var(--text-main)" }}>
                {m.map || "Unknown map"}
              </span>
              <span style={{ marginLeft: "1rem", fontSize: "1.2rem", color: "var(--primary)" }}>
                <span className="text-ct">CT {m.scoreCT}</span> : <span className="text-t">{m.scoreT} T</span>
              </span>
              <span style={{ marginLeft: "1rem", opacity: 0.6, fontSize: "0.9rem" }}>
                ({m.roundsPlayed} rounds)
              </span>
            </div>
            <div style={{ opacity: 0.5, fontSize: "0.8rem", textAlign: "right" }}>
              {m.server && <div style={{ marginBottom: "4px" }}>server: {m.server}</div>}
              {m.startedAt && <div>start: {m.startedAt}</div>}
            </div>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "820px" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", fontSize: "0.85rem", textTransform: "uppercase", background: "rgba(0,0,0,0.2)" }}>
                <th style={{ padding: "12px 16px" }}>Player</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>K</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>D</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>A</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>DMG</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>ADR</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>KDR</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>HSP%</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>FireDmg</th>
              </tr>
            </thead>
            <tbody>
              {m.players.map((p, idx) => (
                <tr key={p.accountId} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: idx % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: "1.1rem" }}>{p.name}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--primary)", fontWeight: 700 }}>{p.kills}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", opacity: 0.7 }}>{p.deaths}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", opacity: 0.7 }}>{p.assists}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>{p.dmg}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>{p.adr}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: p.kdr >= 1 ? "#10b981" : "inherit" }}>{p.kdr}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", opacity: 0.8 }}>{p.hsp}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: p.fireDamage > 0 ? "#f97316" : "inherit" }}>{p.fireDamage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
