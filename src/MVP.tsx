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

  const q = query.trim().toLowerCase();
  const filtered = q ? out.filter((r) => r.name.toLowerCase().includes(q)) : out;

  filtered.sort((a, b) => {
    if (a.avgTeamPlacement !== b.avgTeamPlacement) return a.avgTeamPlacement - b.avgTeamPlacement;
    if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
    if (b.avgDmg !== a.avgDmg) return b.avgDmg - a.avgDmg;
    return a.name.localeCompare(b.name);
  });

  return filtered;
}

function Table({ rows }: { rows: PlayerMvpRow[] }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "56px 1.6fr 140px 120px 110px 90px 90px 90px",
          padding: "10px 12px",
          fontWeight: 800,
          fontSize: 13,
          background: "#fafafa",
          borderBottom: "1px solid #eee",
        }}
      >
        <div>#</div>
        <div>Player</div>
        <div style={{ textAlign: "right" }}>Avg Team Place</div>
        <div style={{ textAlign: "right" }}>Matches</div>
        <div style={{ textAlign: "right" }}>Avg DMG</div>
        <div style={{ textAlign: "right" }}>ADR</div>
        <div style={{ textAlign: "right" }}>KDR</div>
        <div style={{ textAlign: "right" }}>HSP%</div>
      </div>

      {rows.map((r, idx) => (
        <div
          key={r.accountId}
          style={{
            display: "grid",
            gridTemplateColumns: "56px 1.6fr 140px 120px 110px 90px 90px 90px",
            padding: "10px 12px",
            borderBottom: "1px solid #f1f1f1",
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 800 }}>{idx + 1}</div>
          <div style={{ fontWeight: 700 }}>{r.name}</div>
          <div style={{ textAlign: "right", fontWeight: 800 }}>{r.avgTeamPlacement}</div>
          <div style={{ textAlign: "right" }}>
            {r.matchesPlayed}{" "}
            <span style={{ opacity: 0.6, fontSize: 12 }}>
              (best {r.bestPlacement}, worst {r.worstPlacement})
            </span>
          </div>
          <div style={{ textAlign: "right" }}>{r.avgDmg}</div>
          <div style={{ textAlign: "right" }}>{r.avgAdr}</div>
          <div style={{ textAlign: "right" }}>{r.avgKdr}</div>
          <div style={{ textAlign: "right" }}>{r.avgHsp}%</div>
        </div>
      ))}
    </div>
  );
}

export default function MVP() {
  const matches = matchesRaw as Match[];
  const [q, setQ] = useState("");

  // Sort matches newest -> oldest and take last 10 (most recent 10)
  const last10Matches = useMemo(() => {
    return [...matches]
      .sort((a, b) => {
        const aT = toEpoch(a.endedAt) || toEpoch(a.startedAt);
        const bT = toEpoch(b.endedAt) || toEpoch(b.startedAt);
        if (aT !== bT) return bT - aT;
        return (b.id || "").localeCompare(a.id || "");
      })
      .slice(0, 10);
  }, [matches]);

  const allTimeRows = useMemo(() => buildMvpRows(matches, q), [matches, q]);
  const last10Rows = useMemo(() => buildMvpRows(last10Matches, q), [last10Matches, q]);

  return (
    <div>
      <h1 style={{ marginBottom: 6 }}>MVP</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Ranking = <b>lowest average placement inside your team</b> (1 is best).
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
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            Search player (applies to both tables)
          </label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. LionFr0mZion"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: "8px 0" }}>All Matches</h2>
        <div style={{ opacity: 0.7, marginBottom: 10 }}>
          Players: <b>{allTimeRows.length}</b>
        </div>
        <Table rows={allTimeRows} />
      </div>

      <div>
        <h2 style={{ margin: "8px 0" }}>Last 10 Matches</h2>
        <div style={{ opacity: 0.7, marginBottom: 10 }}>
          Matches used: <b>{last10Matches.length}</b> • Players: <b>{last10Rows.length}</b>
        </div>
        <Table rows={last10Rows} />
      </div>
    </div>
  );
}
