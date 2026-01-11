import { useMemo, useState } from "react";
import raw from "./data/playerStats.json";

type PlayerStats = {
  accountId: string;
  name: string;
  matchesPlayed: number;

  avgMatchDamage: number;
  adr: number;
  kdr: number;
  avgHsp: number;

  kills: number;
  deaths: number;
  assists: number;

  totalDamage: number;
  fireDamage: number;
};

type SortKey =
  | "avgMatchDamage"
  | "adr"
  | "kdr"
  | "avgHsp"
  | "matchesPlayed"
  | "kills"
  | "deaths"
  | "assists"
  | "totalDamage"
  | "fireDamage"
  | "name";

type SortDir = "desc" | "asc";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function sortCompare(a: PlayerStats, b: PlayerStats, key: SortKey, dir: SortDir) {
  const mul = dir === "desc" ? -1 : 1;

  if (key === "name") {
    return a.name.localeCompare(b.name) * mul;
  }

  const av = (a as any)[key] as number;
  const bv = (b as any)[key] as number;

  // number sort
  return (av - bv) * mul;
}

function medal(idx: number) {
  if (idx === 0) return "🥇";
  if (idx === 1) return "🥈";
  if (idx === 2) return "🥉";
  return "•";
}

export default function PlayerPerformance() {
  const data = raw as PlayerStats[];

  const [query, setQuery] = useState("");
  const [minMatches, setMinMatches] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("avgMatchDamage");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showTop, setShowTop] = useState(10);

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = data.filter((p) => {
      if (p.matchesPlayed < minMatches) return false;
      if (!q) return true;

      return (
        p.name.toLowerCase().includes(q) ||
        String(p.accountId).includes(q)
      );
    });

    const sorted = [...filtered].sort((a, b) => {
      // Primary sort
      const c = sortCompare(a, b, sortKey, sortDir);
      if (c !== 0) return c;

      // Tie-breakers (helpful + stable)
      // Rank by avgMatchDamage, then matches, then KDR
      const t1 = (b.avgMatchDamage - a.avgMatchDamage);
      if (t1 !== 0) return t1;
      const t2 = (b.matchesPlayed - a.matchesPlayed);
      if (t2 !== 0) return t2;
      const t3 = (b.kdr - a.kdr);
      if (t3 !== 0) return t3;

      return a.name.localeCompare(b.name);
    });

    return sorted;
  }, [data, query, minMatches, sortKey, sortDir]);

  const top = filteredSorted.slice(0, clamp(showTop, 1, 50));

  return (
    <div>
      <h1 style={{ marginBottom: 6 }}>Player Performance</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Stats are calculated from <b>full matches only</b> (13+ rounds). Leaderboard is ordered by <b>Avg Match Damage</b>.
      </p>

      {/* Controls */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.6fr 1fr 0.8fr 0.6fr",
          gap: 10,
          alignItems: "end",
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            Search (name / accountId)
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. ehey / 36898525"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            Min matches
          </label>
          <input
            type="number"
            min={1}
            value={minMatches}
            onChange={(e) => setMinMatches(Math.max(1, Number(e.target.value) || 1))}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            Sort by
          </label>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          >
            <option value="avgMatchDamage">Avg Match Damage (Rank)</option>
            <option value="adr">ADR</option>
            <option value="kdr">KDR</option>
            <option value="avgHsp">Avg HSP %</option>
            <option value="matchesPlayed">Matches Played</option>
            <option value="kills">Kills</option>
            <option value="deaths">Deaths</option>
            <option value="assists">Assists</option>
            <option value="totalDamage">Total Damage</option>
            <option value="fireDamage">Fire/Utility Damage (firedmg)</option>
            <option value="name">Name</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            Direction
          </label>
          <select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value as SortDir)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            Top N
          </label>
          <input
            type="number"
            min={1}
            max={50}
            value={showTop}
            onChange={(e) => setShowTop(clamp(Number(e.target.value) || 10, 1, 50))}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          />
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <h2 style={{ marginTop: 0 }}>🏆 Leaderboard</h2>

        {top.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No players matched your filters.</div>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {top.map((p, i) => (
              <li key={p.accountId} style={{ marginBottom: 8 }}>
                <span style={{ marginRight: 8 }}>{medal(i)}</span>
                <b>{p.name}</b>{" "}
                <span style={{ opacity: 0.75 }}>
                  (matches: {p.matchesPlayed}) — avg match dmg: <b>{p.avgMatchDamage}</b>, ADR: {p.adr}, KDR: {p.kdr}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Full stats table */}
      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <h2 style={{ marginTop: 0 }}>All Players</h2>
          <div style={{ opacity: 0.7 }}>
            Showing <b>{filteredSorted.length}</b> player(s)
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th style={{ padding: "10px 8px" }}>#</th>
                <th style={{ padding: "10px 8px" }}>Name</th>
                <th style={{ padding: "10px 8px" }}>AccountId</th>
                <th style={{ padding: "10px 8px" }}>Matches</th>
                <th style={{ padding: "10px 8px" }}>Avg Match Dmg</th>
                <th style={{ padding: "10px 8px" }}>ADR</th>
                <th style={{ padding: "10px 8px" }}>KDR</th>
                <th style={{ padding: "10px 8px" }}>Avg HSP%</th>
                <th style={{ padding: "10px 8px" }}>K</th>
                <th style={{ padding: "10px 8px" }}>D</th>
                <th style={{ padding: "10px 8px" }}>A</th>
                <th style={{ padding: "10px 8px" }}>Total Dmg</th>
                <th style={{ padding: "10px 8px" }}>FireDmg</th>
              </tr>
            </thead>
            <tbody>
              {filteredSorted.map((p, idx) => (
                <tr key={p.accountId} style={{ borderBottom: "1px solid #f3f3f3" }}>
                  <td style={{ padding: "10px 8px", opacity: 0.7 }}>{idx + 1}</td>
                  <td style={{ padding: "10px 8px", fontWeight: 700 }}>{p.name}</td>
                  <td style={{ padding: "10px 8px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {p.accountId}
                  </td>
                  <td style={{ padding: "10px 8px" }}>{p.matchesPlayed}</td>
                  <td style={{ padding: "10px 8px" }}>{p.avgMatchDamage}</td>
                  <td style={{ padding: "10px 8px" }}>{p.adr}</td>
                  <td style={{ padding: "10px 8px" }}>{p.kdr}</td>
                  <td style={{ padding: "10px 8px" }}>{p.avgHsp}</td>
                  <td style={{ padding: "10px 8px" }}>{p.kills}</td>
                  <td style={{ padding: "10px 8px" }}>{p.deaths}</td>
                  <td style={{ padding: "10px 8px" }}>{p.assists}</td>
                  <td style={{ padding: "10px 8px" }}>{p.totalDamage}</td>
                  <td style={{ padding: "10px 8px" }}>{p.fireDamage}</td>
                </tr>
              ))}
              {filteredSorted.length === 0 && (
                <tr>
                  <td colSpan={13} style={{ padding: 12, opacity: 0.7 }}>
                    No players matched your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
          Notes:
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            <li><b>Avg Match Damage</b> = total damage / matches played (your ranking metric).</li>
            <li><b>FireDmg</b> is from the <code>firedmg</code> column in your log (best proxy for fire/utility damage).</li>
            <li>All stats come only from matches with <b>13+ rounds</b> (filtered in the parser).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
