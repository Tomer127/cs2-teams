import { useMemo, useState } from "react";
import matchesRaw from "./data/matches.json";
import { MAPS } from "./maps";

type MatchPlayer = {
  accountId: string;
  name: string;
  team?: string;
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
  startedAt: string | null; // "MM/DD/YYYY HH:MM:SS"
  endedAt: string | null;   // "MM/DD/YYYY HH:MM:SS"
  players: MatchPlayer[];
  teams?: Record<string, MatchPlayer[]>;
};

function toEpoch(s?: string | null): number {
  if (!s) return 0;

  // Expect: "MM/DD/YYYY HH:MM:SS"
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return 0;

  const mm = Number(m[1]);
  const dd = Number(m[2]);
  const yyyy = Number(m[3]);
  const HH = Number(m[4]);
  const MI = Number(m[5]);
  const SS = Number(m[6]);

  // Use local time (not UTC) so it matches what you see in logs
  const dt = new Date(yyyy, mm - 1, dd, HH, MI, SS);
  const t = dt.getTime();
  return Number.isFinite(t) ? t : 0;
}

export default function MatchHistory() {
  const matches = matchesRaw as Match[];
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    // kept from your file; harmless
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/\bii\b/g, "2")
        .replace(/\biii\b/g, "3")
        .replace(/\bi\b/g, "1")
        .replace(/[^a-z0-9]/g, "");
    void MAPS.map((m) => normalize(m));

    return matches.filter((m) => {
      if (!query) return true;

      const hitMeta =
        (m.map || "").toLowerCase().includes(query) ||
        (m.server || "").toLowerCase().includes(query) ||
        (m.file || "").toLowerCase().includes(query);

      const hitPlayer = m.players.some((p) => p.name.toLowerCase().includes(query));

      return hitMeta || hitPlayer;
    });
  }, [matches, q]);

  // ✅ Correct ordering: newest first using real timestamp
  const ordered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aTime = toEpoch(a.endedAt) || toEpoch(a.startedAt);
      const bTime = toEpoch(b.endedAt) || toEpoch(b.startedAt);

      if (aTime !== bTime) return bTime - aTime; // newest first

      // tie-breaker: file name (descending)
      return (b.file || "").localeCompare(a.file || "");
    });
  }, [filtered]);

  return (
    <div className="container" style={{ maxWidth: '100%', padding: '0' }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1>Match History</h1>
        <p>Loaded from logs (only <b>full matches</b>).</p>
      </header>

      <div className="panel" style={{ marginBottom: "2rem" }}>
        <label style={{ display: "block", fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
          Search (map / server / file / player)
        </label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. inferno, SheepClan, tomer..."
          style={{ width: "100%", maxWidth: "400px" }}
        />
      </div>

      <div style={{ opacity: 0.7, marginBottom: "1rem" }}>
        Matches found: <b style={{ color: "var(--primary)" }}>{ordered.length}</b>
      </div>

      {ordered.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", opacity: 0.8 }}>
          No matches found. Make sure <code>matches.json</code> is in <code>src/data</code> and your logs contain full matches.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {ordered.map((m) => {
            const teamsObj: Record<string, MatchPlayer[]> =
              m.teams ||
              m.players.reduce((acc: Record<string, MatchPlayer[]>, p) => {
                const k = p.team || "Unassigned";
                if (!acc[k]) acc[k] = [];
                acc[k].push(p);
                return acc;
              }, {});

            const ctMembers = teamsObj["CT"] || [];
            const tMembers = teamsObj["T"] || [];

            return (
              <div key={m.id} className="panel" style={{ padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline", flexWrap: "wrap", marginBottom: "1rem" }}>
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

                    <div style={{ opacity: 0.5, fontSize: "0.8rem", marginTop: "0.2rem" }}>
                      {m.server && <span style={{ marginRight: "1rem" }}>server: {m.server}</span>}
                      {m.startedAt && <span>{m.startedAt}</span>}
                    </div>
                  </div>
                </div>

                <div className="grid-stack" style={{ gap: "1rem" }}>
                  {/* CT */}
                  <div className="bg-ct" style={{ borderRadius: "var(--radius-md)", padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                      <h3 className="text-ct" style={{ margin: 0 }}>CT</h3>
                      <span className="text-ct" style={{ fontSize: "1.5rem" }}>{m.scoreCT}</span>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                        <thead>
                          <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                            <th style={{ textAlign: "left", padding: "8px" }}>Player</th>
                            <th style={{ textAlign: "right", padding: "8px" }}>K</th>
                            <th style={{ textAlign: "right", padding: "8px" }}>D</th>
                            <th style={{ textAlign: "right", padding: "8px" }}>A</th>
                            <th style={{ textAlign: "right", padding: "8px" }}>DMG</th>
                            <th style={{ textAlign: "right", padding: "8px" }}>ADR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...ctMembers]
                            .sort((a, b) => (b.dmg || 0) - (a.dmg || 0))
                            .map((mem, idx) => (
                              <tr key={mem.accountId} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <td style={{ padding: "8px", fontWeight: 600 }}>{mem.name}</td>
                                <td style={{ padding: "8px", textAlign: "right", color: idx === 0 ? "var(--primary)" : "inherit" }}>{mem.kills}</td>
                                <td style={{ padding: "8px", textAlign: "right", opacity: 0.7 }}>{mem.deaths}</td>
                                <td style={{ padding: "8px", textAlign: "right", opacity: 0.7 }}>{mem.assists}</td>
                                <td style={{ padding: "8px", textAlign: "right" }}>{mem.dmg}</td>
                                <td style={{ padding: "8px", textAlign: "right" }}>{mem.adr}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* T */}
                  <div className="bg-t" style={{ borderRadius: "var(--radius-md)", padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                      <h3 className="text-t" style={{ margin: 0 }}>TERROR</h3>
                      <span className="text-t" style={{ fontSize: "1.5rem" }}>{m.scoreT}</span>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                        <thead>
                          <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                            <th style={{ textAlign: "left", padding: "8px" }}>Player</th>
                            <th style={{ textAlign: "right", padding: "8px" }}>K</th>
                            <th style={{ textAlign: "right", padding: "8px" }}>D</th>
                            <th style={{ textAlign: "right", padding: "8px" }}>A</th>
                            <th style={{ textAlign: "right", padding: "8px" }}>DMG</th>
                            <th style={{ textAlign: "right", padding: "8px" }}>ADR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...tMembers]
                            .sort((a, b) => (b.dmg || 0) - (a.dmg || 0))
                            .map((mem, idx) => (
                              <tr key={mem.accountId} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <td style={{ padding: "8px", fontWeight: 600 }}>{mem.name}</td>
                                <td style={{ padding: "8px", textAlign: "right", color: idx === 0 ? "var(--secondary)" : "inherit" }}>{mem.kills}</td>
                                <td style={{ padding: "8px", textAlign: "right", opacity: 0.7 }}>{mem.deaths}</td>
                                <td style={{ padding: "8px", textAlign: "right", opacity: 0.7 }}>{mem.assists}</td>
                                <td style={{ padding: "8px", textAlign: "right" }}>{mem.dmg}</td>
                                <td style={{ padding: "8px", textAlign: "right" }}>{mem.adr}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
