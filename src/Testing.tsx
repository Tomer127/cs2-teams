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
    <div>
      <h1 style={{ marginBottom: 6 }}>Testing — Latest Match</h1>
      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
        <div>
          <b>{m.map || "Unknown map"}</b>{" "}
          <span style={{ opacity: 0.75 }}>
            (CT {m.scoreCT} : {m.scoreT} T) • rounds: {m.roundsPlayed}
          </span>
          <div style={{ opacity: 0.7, fontSize: 13 }}>
            server: {m.server || "—"} • file: {m.file}
            {m.startedAt ? ` • start: ${m.startedAt}` : ""}
            {m.endedAt ? ` • end: ${m.endedAt}` : ""}
          </div>
        </div>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th style={{ padding: "10px 8px" }}>Player</th>
                <th style={{ padding: "10px 8px" }}>K</th>
                <th style={{ padding: "10px 8px" }}>D</th>
                <th style={{ padding: "10px 8px" }}>A</th>
                <th style={{ padding: "10px 8px" }}>DMG</th>
                <th style={{ padding: "10px 8px" }}>ADR</th>
                <th style={{ padding: "10px 8px" }}>KDR</th>
                <th style={{ padding: "10px 8px" }}>HSP%</th>
                <th style={{ padding: "10px 8px" }}>FireDmg</th>
              </tr>
            </thead>
            <tbody>
              {m.players.map((p) => (
                <tr key={p.accountId} style={{ borderBottom: "1px solid #f3f3f3" }}>
                  <td style={{ padding: "10px 8px", fontWeight: 700 }}>{p.name}</td>
                  <td style={{ padding: "10px 8px" }}>{p.kills}</td>
                  <td style={{ padding: "10px 8px" }}>{p.deaths}</td>
                  <td style={{ padding: "10px 8px" }}>{p.assists}</td>
                  <td style={{ padding: "10px 8px" }}>{p.dmg}</td>
                  <td style={{ padding: "10px 8px" }}>{p.adr}</td>
                  <td style={{ padding: "10px 8px" }}>{p.kdr}</td>
                  <td style={{ padding: "10px 8px" }}>{p.hsp}</td>
                  <td style={{ padding: "10px 8px" }}>{p.fireDamage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
