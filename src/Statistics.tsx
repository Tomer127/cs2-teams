import { useMemo } from "react";
import matchesRaw from "./data/matches.json";

type MatchPlayer = {
  accountId: string;
  name: string;
  team?: string;

  kills: number;
  deaths: number;
  assists: number;

  utilityThrows?: number;
  knifeKills?: number;
  lastAliveRounds?: number;
  firstKills?: number;

  utilityDamage?: number;
};

type KillEvent = { killerId: string; victimId: string };

type Match = {
  id: string;
  map: string | null;
  startedAt: string | null;
  endedAt: string | null;
  players: MatchPlayer[];
  killEvents?: KillEvent[];
};

function LeaderCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{title}</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{value}</div>
      {sub ? <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>{sub}</div> : null}
    </div>
  );
}

export default function Statistics() {
  const matches = matchesRaw as Match[];

  const computed = useMemo(() => {
    const byPlayer = new Map<
      string,
      {
        id: string;
        name: string;
        kills: number;
        deaths: number;
        utility: number;
        knife: number;
        lastAlive: number;
        firstKills: number;
        utilityDamage: number;
      }
    >();

    const nameById = new Map<string, string>();

    const ensure = (p: MatchPlayer) => {
      if (!byPlayer.has(p.accountId)) {
        byPlayer.set(p.accountId, {
          id: p.accountId,
          name: p.name,
          kills: 0,
          deaths: 0,
          utility: 0,
          knife: 0,
          lastAlive: 0,
          firstKills: 0,
          utilityDamage: 0,
        });
      } else {
        const cur = byPlayer.get(p.accountId)!;
        if (p.name && cur.name !== p.name) cur.name = p.name;
      }
      return byPlayer.get(p.accountId)!;
    };

    // killer -> victim -> count
    const killMatrix = new Map<string, Map<string, number>>();
    const addKill = (killerId: string, victimId: string) => {
      if (!killMatrix.has(killerId)) killMatrix.set(killerId, new Map());
      const inner = killMatrix.get(killerId)!;
      inner.set(victimId, (inner.get(victimId) || 0) + 1);
    };

    for (const m of matches) {
      for (const p of m.players) {
        const row = ensure(p);
        row.kills += Number(p.kills) || 0;
        row.deaths += Number(p.deaths) || 0;
        row.utility += Number(p.utilityThrows) || 0;
        row.knife += Number(p.knifeKills) || 0;
        row.lastAlive += Number(p.lastAliveRounds) || 0;
        row.firstKills += Number(p.firstKills) || 0;
        row.utilityDamage += Number(p.utilityDamage) || 0;

        nameById.set(p.accountId, p.name);
      }

      for (const ev of m.killEvents || []) {
        addKill(ev.killerId, ev.victimId);
      }
    }

    const players = Array.from(byPlayer.values()).sort((a, b) => a.name.localeCompare(b.name));

    const topBy = (key: keyof typeof players[number]) =>
      players.reduce((best, cur) => (cur[key] > best[key] ? cur : best), players[0]);

    const mostKills = players.length ? topBy("kills") : null;
    const mostDeaths = players.length ? topBy("deaths") : null;
    const mostUtility = players.length ? topBy("utility") : null;
    const mostKnife = players.length ? topBy("knife") : null;
    const mostLastAlive = players.length ? topBy("lastAlive") : null;
    const mostFirstKills = players.length ? topBy("firstKills") : null;
    const mostUtilityDamage = players.length ? topBy("utilityDamage") : null;

    // Build full head-to-head grid: for each row player A, each col player B:
    // killsAB = A killed B
    // deathsAB = B killed A
    const ids = players.map((p) => p.id);

    const cell = (aId: string, bId: string) => {
      const killsAB = killMatrix.get(aId)?.get(bId) || 0;
      const deathsAB = killMatrix.get(bId)?.get(aId) || 0;
      return { killsAB, deathsAB };
    };

    return {
      players,
      ids,
      nameById,
      cell,
      mostKills,
      mostDeaths,
      mostUtility,
      mostKnife,
      mostLastAlive,
      mostFirstKills,
      mostUtilityDamage,
      hasKillEvents: [...killMatrix.keys()].length > 0,
    };
  }, [matches]);

  return (
    <div>
      <h1 style={{ marginBottom: 6 }}>Statistics</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        All stats are calculated from <b>valid matches only</b> (the same matches shown in Match History).
      </p>

      {/* Sections 1-6 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14 }}>
        <LeaderCard
          title="1) The player who kills the most"
          value={computed.mostKills ? `${computed.mostKills.name} — ${computed.mostKills.kills}` : "—"}
        />
        <LeaderCard
          title="2) The player who dies the most"
          value={computed.mostDeaths ? `${computed.mostDeaths.name} — ${computed.mostDeaths.deaths}` : "—"}
        />
        <LeaderCard
          title="3) The player who uses most utility (throws)"
          value={computed.mostUtility ? `${computed.mostUtility.name} — ${computed.mostUtility.utility}` : "—"}
          sub="Counts: smoke/flash/HE/molotov/incendiary/decoy (from 'threw ...' lines)"
        />
        <LeaderCard
          title="4) The player who kills with knife the most"
          value={computed.mostKnife ? `${computed.mostKnife.name} — ${computed.mostKnife.knife}` : "—"}
        />
        <LeaderCard
          title="5) The player who stays alive last the most"
          value={computed.mostLastAlive ? `${computed.mostLastAlive.name} — ${computed.mostLastAlive.lastAlive}` : "—"}
          sub="Best-effort: last death on each team per round (requires Round_End markers)"
        />
        <LeaderCard
          title="6) The player who makes the most first kills in a round"
          value={computed.mostFirstKills ? `${computed.mostFirstKills.name} — ${computed.mostFirstKills.firstKills}` : "—"}
          sub="First kill after previous Round_End"
        />
      </div>

      {/* NEW Section 7 */}
      <div style={{ marginTop: 18 }}>
        <h2 style={{ margin: "8px 0" }}>7) Most utility damage (Molotov / Incendiary / HE)</h2>
        <div style={{ opacity: 0.7, marginBottom: 10 }}>
          Calculated from <b>attacked ... damage</b> lines where weapon is: <b>hegrenade</b>, <b>inferno</b> (burn ticks),
          and sometimes <b>molotov/incgrenade</b>.
        </div>
        <LeaderCard
          title="Top utility damage"
          value={computed.mostUtilityDamage ? `${computed.mostUtilityDamage.name} — ${computed.mostUtilityDamage.utilityDamage}` : "—"}
        />
      </div>

      {/* Section 8: full head-to-head */}
      <div style={{ marginTop: 18 }}>
        <h2 style={{ margin: "8px 0" }}>8) Head-to-head table (kills / deaths vs each player)</h2>
        <div style={{ opacity: 0.7, marginBottom: 10 }}>
          Each cell shows: <b>K / D</b> meaning: <b>row player killed column player / row player died to column player</b>.
        </div>

        {!computed.hasKillEvents ? (
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12, opacity: 0.75 }}>
            No kill events found. Make sure <b>parseLogs.cjs</b> exports <b>killEvents</b> in matches.json.
          </div>
        ) : (
          <div style={{ border: "1px solid #ddd", borderRadius: 12, overflow: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
              <thead>
                <tr>
                  <th
                    style={{
                      position: "sticky",
                      left: 0,
                      background: "#fafafa",
                      borderBottom: "1px solid #eee",
                      borderRight: "1px solid #eee",
                      padding: "10px 12px",
                      textAlign: "left",
                      zIndex: 2,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Player
                  </th>
                  {computed.players.map((col) => (
                    <th
                      key={col.id}
                      style={{
                        background: "#fafafa",
                        borderBottom: "1px solid #eee",
                        borderRight: "1px solid #eee",
                        padding: "10px 12px",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        fontWeight: 800,
                        fontSize: 12,
                      }}
                    >
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {computed.players.map((row) => (
                  <tr key={row.id}>
                    <td
                      style={{
                        position: "sticky",
                        left: 0,
                        background: "white",
                        borderBottom: "1px solid #f1f1f1",
                        borderRight: "1px solid #eee",
                        padding: "10px 12px",
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                        zIndex: 1,
                      }}
                    >
                      {row.name}
                    </td>

                    {computed.players.map((col) => {
                      if (row.id === col.id) {
                        return (
                          <td
                            key={col.id}
                            style={{
                              borderBottom: "1px solid #f1f1f1",
                              borderRight: "1px solid #f1f1f1",
                              padding: "10px 12px",
                              textAlign: "center",
                              opacity: 0.35,
                            }}
                          >
                            —
                          </td>
                        );
                      }

                      const { killsAB, deathsAB } = computed.cell(row.id, col.id);

                      const emphasized =
                        killsAB + deathsAB >= 5 ? { fontWeight: 800 } : undefined;

                      return (
                        <td
                          key={col.id}
                          style={{
                            borderBottom: "1px solid #f1f1f1",
                            borderRight: "1px solid #f1f1f1",
                            padding: "10px 12px",
                            textAlign: "center",
                            whiteSpace: "nowrap",
                            ...emphasized,
                          }}
                          title={`${row.name} vs ${col.name}: ${killsAB} kills / ${deathsAB} deaths`}
                        >
                          {killsAB} / {deathsAB}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
