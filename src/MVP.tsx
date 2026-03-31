import { useMemo, useState } from "react";
import matchesRaw from "./data/matches.json";

type MatchPlayer = {
  accountId: string;
  name: string;
  team?: string; // "CT" | "T"
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

type PlayerMvpRow = {
  accountId: string;
  name: string;
  matchesPlayed: number;
  avgTeamPlacement: number; // lower is better
  bestPlacement: number;
  worstPlacement: number;
  avgDmg: number;
  avgAdr: number;
  avgKdr: number;
  avgHsp: number;
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

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

  const dt = new Date(yyyy, mm - 1, dd, HH, MI, SS);
  const t = dt.getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Rank a list of players best->worst using your performance tuple,
 * then return placement (1..N) with tie handling:
 * - players with identical tuple get the same "average rank"
 *   Example: tie for 1st in a 5-stack => both get 1.5, next gets 3.
 */
function placementsWithinGroup(players: MatchPlayer[]) {
  const list = players
    .filter((p) => p && p.accountId && p.name)
    .map((p) => ({
      ...p,
      dmg: Number(p.dmg) || 0,
      kills: Number(p.kills) || 0,
      deaths: Number(p.deaths) || 0,
      assists: Number(p.assists) || 0,
      kdr: Number(p.kdr) || 0,
      adr: Number(p.adr) || 0,
      hsp: Number(p.hsp) || 0,
    }));

  // Sort best -> worst (team-only)
  const sorted = [...list].sort((a, b) => {
    if (b.dmg !== a.dmg) return b.dmg - a.dmg;
    if (b.kills !== a.kills) return b.kills - a.kills;
    if (b.kdr !== a.kdr) return b.kdr - a.kdr;
    if (b.adr !== a.adr) return b.adr - a.adr;
    if (b.assists !== a.assists) return b.assists - a.assists;
    return (a.name || "").localeCompare(b.name || "");
  });

  const key = (p: MatchPlayer) =>
    `${p.dmg}|${p.kills}|${p.kdr}|${p.adr}|${p.assists}`;

  const placementById = new Map<string, number>();

  let i = 0;
  while (i < sorted.length) {
    const start = i;
    const k = key(sorted[i]);

    while (i < sorted.length && key(sorted[i]) === k) i++;
    const endExclusive = i;

    // ranks are 1-based
    const firstRank = start + 1;
    const lastRank = endExclusive;
    const avgRank = (firstRank + lastRank) / 2;

    for (let j = start; j < endExclusive; j++) {
      placementById.set(sorted[j].accountId, avgRank);
    }
  }

  return placementById;
}

/**
 * For a match, compute placements *inside each team* separately and merge.
 */
function placementsForMatchTeamOnly(match: Match): Map<string, number> {
  const teamsObj: Record<string, MatchPlayer[]> =
    match.teams ||
    match.players.reduce((acc: Record<string, MatchPlayer[]>, p) => {
      const k = p.team || "Unassigned";
      if (!acc[k]) acc[k] = [];
      acc[k].push(p);
      return acc;
    }, {});

  const ct = teamsObj["CT"] || [];
  const t = teamsObj["T"] || [];

  const ctPlacements = placementsWithinGroup(ct);
  const tPlacements = placementsWithinGroup(t);

  const merged = new Map<string, number>();
  for (const [id, place] of ctPlacements.entries()) merged.set(id, place);
  for (const [id, place] of tPlacements.entries()) merged.set(id, place);

  return merged;
}

function buildMvpRows(matches: Match[], query: string): PlayerMvpRow[] {
  const byPlayer = new Map<
    string,
    {
      accountId: string;
      name: string;
      placements: number[];
      dmg: number[];
      adr: number[];
      kdr: number[];
      hsp: number[];
    }
  >();

  for (const match of matches) {
    const placementMap = placementsForMatchTeamOnly(match);

    for (const p of match.players) {
      if (!p?.accountId) continue;

      const place = placementMap.get(p.accountId);
      if (!place) continue;

      if (!byPlayer.has(p.accountId)) {
        byPlayer.set(p.accountId, {
          accountId: p.accountId,
          name: p.name,
          placements: [],
          dmg: [],
          adr: [],
          kdr: [],
          hsp: [],
        });
      }

      const agg = byPlayer.get(p.accountId)!;
      if (p.name && agg.name !== p.name) agg.name = p.name;

      agg.placements.push(place);
      agg.dmg.push(Number(p.dmg) || 0);
      agg.adr.push(Number(p.adr) || 0);
      agg.kdr.push(Number(p.kdr) || 0);
      agg.hsp.push(Number(p.hsp) || 0);
    }
  }

  const out: PlayerMvpRow[] = Array.from(byPlayer.values()).map((p) => {
    const matchesPlayed = p.placements.length;
    const avgPlacement =
      p.placements.reduce((a, b) => a + b, 0) / Math.max(1, matchesPlayed);

    const bestPlacement = Math.min(...p.placements);
    const worstPlacement = Math.max(...p.placements);

    const avgDmg = p.dmg.reduce((a, b) => a + b, 0) / Math.max(1, matchesPlayed);
    const avgAdr = p.adr.reduce((a, b) => a + b, 0) / Math.max(1, matchesPlayed);
    const avgKdr = p.kdr.reduce((a, b) => a + b, 0) / Math.max(1, matchesPlayed);
    const avgHsp = p.hsp.reduce((a, b) => a + b, 0) / Math.max(1, matchesPlayed);

    return {
      accountId: p.accountId,
      name: p.name,
      matchesPlayed,
      avgTeamPlacement: round2(avgPlacement),
      bestPlacement: round2(bestPlacement),
      worstPlacement: round2(worstPlacement),
      avgDmg: Math.round(avgDmg),
      avgAdr: Math.round(avgAdr),
      avgKdr: round2(avgKdr),
      avgHsp: round1(avgHsp),
    };
  });

  const filteredByMatches = out.filter(r => r.matchesPlayed >= 10);

  const q = query.trim().toLowerCase();
  const filtered = q ? filteredByMatches.filter((r) => r.name.toLowerCase().includes(q)) : filteredByMatches;

  filtered.sort((a, b) => {
    if (a.avgTeamPlacement !== b.avgTeamPlacement) return a.avgTeamPlacement - b.avgTeamPlacement;
    if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
    if (b.avgDmg !== a.avgDmg) return b.avgDmg - a.avgDmg;
    return a.name.localeCompare(b.name);
  });

  return filtered;
}


export default function MVP() {
  const matches = matchesRaw as Match[];
  const [q, setQ] = useState("");

  const allTimeRows = useMemo(() => buildMvpRows(matches, q), [matches, q]);

  return (
    <div className="container" style={{ maxWidth: '100%', padding: '0' }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1>MVP</h1>
        <p>Ranking = <b>lowest average placement inside your team</b> (1 is best).</p>
      </header>

      <div className="panel" style={{ marginBottom: "2rem" }}>
        <label style={{ display: "block", fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
          Search player (applies to both tables)
        </label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. LionFr0mZion"
          style={{ width: "100%", maxWidth: "400px" }}
        />
      </div>

      <div style={{ marginBottom: "3rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, borderBottom: "none" }}>All Matches</h2>
          <span style={{ color: "var(--primary)", fontWeight: 700 }}>{allTimeRows.length} Players</span>
        </div>

        <Table rows={allTimeRows} />
      </div>


    </div>
  );
}

function Table({ rows }: { rows: PlayerMvpRow[] }) {
  return (
    <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.2)", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", fontSize: "0.85rem", textTransform: "uppercase" }}>
              <th style={{ padding: "12px 16px", textAlign: "left", width: "60px" }}>#</th>
              <th style={{ padding: "12px 16px", textAlign: "left" }}>Player</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>Avg Place</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>Matches</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>Avg DMG</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>ADR</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>KDR</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>HSP%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              let rowBg = "transparent";
              if (idx === 0) rowBg = "linear-gradient(90deg, rgba(251, 191, 36, 0.1), transparent)"; // Gold
              else if (idx === 1) rowBg = "linear-gradient(90deg, rgba(148, 163, 184, 0.1), transparent)"; // Silver
              else if (idx === 2) rowBg = "linear-gradient(90deg, rgba(180, 83, 9, 0.1), transparent)"; // Bronze

              return (
                <tr key={r.accountId} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: rowBg }}>
                  <td style={{ padding: "12px 16px", fontWeight: 800, color: idx === 0 ? "#fbbf24" : "inherit" }}>{idx + 1}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: "1.1rem" }}>{r.name}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "var(--primary)" }}>{r.avgTeamPlacement}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    {r.matchesPlayed}{" "}
                    <span style={{ opacity: 0.5, fontSize: "0.8rem", display: "block" }}>
                      (best {r.bestPlacement})
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", opacity: 0.8 }}>{r.avgDmg}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", opacity: 0.8 }}>{r.avgAdr}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: r.avgKdr >= 1 ? "#10b981" : "inherit" }}>{r.avgKdr}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", opacity: 0.8 }}>{r.avgHsp}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
