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
    <div>
      <h1 style={{ marginBottom: 6 }}>Match History</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Loaded from logs (only <b>full matches</b>).
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 10,
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          marginBottom: 14,
          alignItems: "end",
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            Search (map / server / file / player)
          </label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. inferno, SheepClan, tomer..."
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          />
        </div>
      </div>

      <div style={{ opacity: 0.7, marginBottom: 10 }}>
        Matches found: <b>{ordered.length}</b>
      </div>

      {ordered.length === 0 ? (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, opacity: 0.8 }}>
          No matches found. Make sure <code>matches.json</code> is in <code>src/data</code> and your logs contain full matches.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
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
              <div key={m.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
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
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 12, width: "100%" }}>
                    {/* CT */}
                    <div
                      style={{
                        flex: 1,
                        border: "1px solid #d7e9ff",
                        background: "#f4fbff",
                        borderRadius: 8,
                        padding: 8,
                        minWidth: 260,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontWeight: 800 }}>CT</div>
                        <div style={{ fontWeight: 800, fontSize: 18 }}>{m.scoreCT}</div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "6px 8px",
                          fontSize: 12,
                          opacity: 0.85,
                          borderBottom: "1px solid rgba(0,0,0,0.06)",
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>Player</div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <div style={{ minWidth: 48, textAlign: "right" }}>K</div>
                          <div style={{ minWidth: 48, textAlign: "right" }}>D</div>
                          <div style={{ minWidth: 48, textAlign: "right" }}>A</div>
                          <div style={{ minWidth: 64, textAlign: "right" }}>DMG</div>
                          <div style={{ minWidth: 60, textAlign: "right" }}>ADR</div>
                          <div style={{ minWidth: 56, textAlign: "right" }}>HSP%</div>
                        </div>
                      </div>

                      <div>
                        {[...ctMembers]
                          .sort((a, b) => (b.dmg || 0) - (a.dmg || 0))
                          .map((mem, idx) => (
                            <div
                              key={mem.accountId}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "6px 8px",
                                borderRadius: 6,
                                background: idx === 0 ? "rgba(20,80,160,0.04)" : "transparent",
                                marginBottom: 6,
                                alignItems: "center",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div
                                  style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 12,
                                    background: idx === 0 ? "#144fa0" : "#e6eefc",
                                    color: idx === 0 ? "#fff" : "#144fa0",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 12,
                                    fontWeight: 800,
                                  }}
                                >
                                  {idx + 1}
                                </div>
                                <div style={{ fontWeight: 700 }}>{mem.name}</div>
                              </div>
                              <div style={{ display: "flex", gap: 10, alignItems: "center", opacity: 0.9 }}>
                                <div style={{ minWidth: 48, textAlign: "right" }}>{mem.kills}</div>
                                <div style={{ minWidth: 48, textAlign: "right" }}>{mem.deaths}</div>
                                <div style={{ minWidth: 48, textAlign: "right" }}>{mem.assists}</div>
                                <div style={{ minWidth: 64, textAlign: "right" }}>{mem.dmg}</div>
                                <div style={{ minWidth: 60, textAlign: "right" }}>{mem.adr}</div>
                                <div style={{ minWidth: 56, textAlign: "right" }}>{mem.hsp}%</div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* T */}
                    <div
                      style={{
                        flex: 1,
                        border: "1px solid #ffe9d7",
                        background: "#fff8f2",
                        borderRadius: 8,
                        padding: 8,
                        minWidth: 260,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontWeight: 800 }}>T</div>
                        <div style={{ fontWeight: 800, fontSize: 18 }}>{m.scoreT}</div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "6px 8px",
                          fontSize: 12,
                          opacity: 0.85,
                          borderBottom: "1px solid rgba(0,0,0,0.06)",
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>Player</div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <div style={{ minWidth: 48, textAlign: "right" }}>K</div>
                          <div style={{ minWidth: 48, textAlign: "right" }}>D</div>
                          <div style={{ minWidth: 48, textAlign: "right" }}>A</div>
                          <div style={{ minWidth: 64, textAlign: "right" }}>DMG</div>
                          <div style={{ minWidth: 60, textAlign: "right" }}>ADR</div>
                          <div style={{ minWidth: 56, textAlign: "right" }}>HSP%</div>
                        </div>
                      </div>

                      <div>
                        {[...tMembers]
                          .sort((a, b) => (b.dmg || 0) - (a.dmg || 0))
                          .map((mem, idx) => (
                            <div
                              key={mem.accountId}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "6px 8px",
                                borderRadius: 6,
                                background: idx === 0 ? "rgba(160,60,0,0.04)" : "transparent",
                                marginBottom: 6,
                                alignItems: "center",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div
                                  style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 12,
                                    background: idx === 0 ? "#a03c00" : "#fff1e6",
                                    color: idx === 0 ? "#fff" : "#a03c00",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 12,
                                    fontWeight: 800,
                                  }}
                                >
                                  {idx + 1}
                                </div>
                                <div style={{ fontWeight: 700 }}>{mem.name}</div>
                              </div>
                              <div style={{ display: "flex", gap: 10, alignItems: "center", opacity: 0.9 }}>
                                <div style={{ minWidth: 48, textAlign: "right" }}>{mem.kills}</div>
                                <div style={{ minWidth: 48, textAlign: "right" }}>{mem.deaths}</div>
                                <div style={{ minWidth: 48, textAlign: "right" }}>{mem.assists}</div>
                                <div style={{ minWidth: 64, textAlign: "right" }}>{mem.dmg}</div>
                                <div style={{ minWidth: 60, textAlign: "right" }}>{mem.adr}</div>
                                <div style={{ minWidth: 56, textAlign: "right" }}>{mem.hsp}%</div>
                              </div>
                            </div>
                          ))}
                      </div>
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
