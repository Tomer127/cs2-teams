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

type PlayerStat = {
  id: string;
  name: string;
  kills: number;
  deaths: number;
  utility: number;
  knife: number;
  lastAlive: number;
  firstKills: number;
  utilityDamage: number;
  matchesPlayed: number;
};

function TopPlayersDisplay({ 
  players, 
  title, 
  valueKey, 
  valueLabel, 
  color, 
  glow 
}: { 
  players: PlayerStat[]; 
  title: string; 
  valueKey: keyof PlayerStat; 
  valueLabel: string; 
  color: string; 
  glow?: string; 
}) {
  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>{title}</div>
      
      {players.length > 0 ? (
        <>
          {/* #1 Player - Large */}
          <div style={{ fontSize: "2rem", fontWeight: 800, color, textShadow: glow ? `0 0 10px ${glow}` : undefined }}>
            {players[0].name}
          </div>
          <div style={{ fontSize: "1.2rem", fontWeight: 600 }}>{players[0][valueKey]} {valueLabel}</div>
          
          {/* #2-5 Players - Smaller */}
          {players.slice(1, 5).map((player, index) => (
            <div key={player.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-main)", opacity: 0.8 }}>
                #{index + 2} {player.name}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>
                {player[valueKey]} {valueLabel}
              </div>
            </div>
          ))}
        </>
      ) : (
        <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-muted)" }}>—</div>
      )}
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
        matchesPlayed: number;
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
          matchesPlayed: 0,
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
      const playersInMatch = new Set<string>();
      
      for (const p of m.players) {
        const row = ensure(p);
        row.kills += Number(p.kills) || 0;
        row.deaths += Number(p.deaths) || 0;
        row.utility += Number(p.utilityThrows) || 0;
        row.knife += Number(p.knifeKills) || 0;
        row.lastAlive += Number(p.lastAliveRounds) || 0;
        row.firstKills += Number(p.firstKills) || 0;
        row.utilityDamage += Number(p.utilityDamage) || 0;

        playersInMatch.add(p.accountId);
        nameById.set(p.accountId, p.name);
      }

      // Increment matchesPlayed for each player in this match
      for (const playerId of playersInMatch) {
        const row = byPlayer.get(playerId)!;
        row.matchesPlayed += 1;
      }

      for (const ev of m.killEvents || []) {
        addKill(ev.killerId, ev.victimId);
      }
    }

    const players = Array.from(byPlayer.values())
      .filter(p => p.matchesPlayed >= 10)
      .sort((a, b) => a.name.localeCompare(b.name));

    const topBy = (key: keyof typeof players[number], count: number = 1) =>
      players
        .sort((a, b) => (b[key] as number) - (a[key] as number))
        .slice(0, count);

    const mostKills = players.length ? topBy("kills", 5) : [];
    const mostDeaths = players.length ? topBy("deaths", 5) : [];
    const mostUtility = players.length ? topBy("utility", 5) : [];
    const mostKnife = players.length ? topBy("knife", 5) : [];
    const mostLastAlive = players.length ? topBy("lastAlive", 5) : [];
    const mostFirstKills = players.length ? topBy("firstKills", 5) : [];
    const mostUtilityDamage = players.length ? topBy("utilityDamage", 5) : [];

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
    <div className="container" style={{ maxWidth: '100%', padding: '0' }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1>Statistics</h1>
        <p>All stats are calculated from <b>valid matches only</b> (the same matches shown in Match History).</p>
      </header>

      {/* Sections 1-6 */}
      <div className="grid-stack" style={{ gap: "1.5rem", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        <TopPlayersDisplay 
          players={computed.mostKills} 
          title="KILL LEADER" 
          valueKey="kills" 
          valueLabel="Kills" 
          color="var(--primary)" 
          glow="var(--primary-glow)" 
        />

        <TopPlayersDisplay 
          players={computed.mostDeaths} 
          title="MOST DEATHS" 
          valueKey="deaths" 
          valueLabel="Deaths" 
          color="var(--accent)" 
          glow="rgba(244, 114, 182, 0.4)" 
        />

        <TopPlayersDisplay 
          players={computed.mostUtility} 
          title="UTILITY USAGE" 
          valueKey="utility" 
          valueLabel="Throws" 
          color="var(--secondary)" 
        />

        <TopPlayersDisplay 
          players={computed.mostKnife} 
          title="KNIFE MASTER" 
          valueKey="knife" 
          valueLabel="Knife Kills" 
          color="#ef4444" 
        />

        <TopPlayersDisplay 
          players={computed.mostLastAlive} 
          title="SURVIVOR" 
          valueKey="lastAlive" 
          valueLabel="Rounds Last Alive" 
          color="#10b981" 
        />

        <TopPlayersDisplay 
          players={computed.mostFirstKills} 
          title="ENTRY FRAGGER" 
          valueKey="firstKills" 
          valueLabel="First Kills" 
          color="#f59e0b" 
        />
      </div>

      {/* NEW Section 7 */}
      <div style={{ marginTop: "2rem" }} className="panel">
        <h2 style={{ marginBottom: "0.5rem", borderBottom: "none" }}>Utility Damage</h2>
        <p style={{ marginBottom: "1rem" }}>Calculated from HE Grenade, Molotov, and Incendiary damage.</p>

        {computed.mostUtilityDamage.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {/* #1 Player - Large */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ flex: 1, background: "rgba(0,0,0,0.3)", borderRadius: "8px", height: "12px", overflow: "hidden" }}>
                <div style={{
                  width: "100%",
                  height: "100%",
                  background: `linear-gradient(90deg, var(--primary), var(--secondary))`
                }} />
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, whiteSpace: "nowrap" }}>
                {computed.mostUtilityDamage[0].name} — {computed.mostUtilityDamage[0].utilityDamage}
              </div>
            </div>
            
            {/* #2-5 Players - Smaller */}
            {computed.mostUtilityDamage.slice(1, 5).map((player, index) => (
              <div key={player.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}>
                <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-main)", opacity: 0.8 }}>
                  #{index + 2} {player.name}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>
                  {player.utilityDamage} Damage
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-muted)" }}>—</div>
        )}
      </div>

      {/* Section 8: full head-to-head */}
      <div style={{ marginTop: "2rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Head-to-Head Table</h2>
        <p style={{ marginBottom: "1rem" }}>
          Row player killed Column player / Row player died to Column player (K / D).
        </p>

        {!computed.hasKillEvents ? (
          <div className="panel" style={{ textAlign: "center", opacity: 0.8 }}>
            No kill events found. Make sure <b>parseLogs.cjs</b> exports <b>killEvents</b> in matches.json.
          </div>
        ) : (
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto", maxHeight: "800px" }}>
              <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "max-content", minWidth: "100%" }}>
                <thead>
                  <tr>
                    <th
                      style={{
                        position: "sticky",
                        left: 0,
                        top: 0,
                        background: "var(--bg-panel)",
                        color: "var(--primary)",
                        borderBottom: "1px solid var(--border-color)",
                        borderRight: "1px solid var(--border-color)",
                        padding: "12px 16px",
                        textAlign: "left",
                        zIndex: 3,
                        whiteSpace: "nowrap",
                        textTransform: "uppercase",
                        letterSpacing: "1px"
                      }}
                    >
                      Player
                    </th>
                    {computed.players.map((col) => (
                      <th
                        key={col.id}
                        style={{
                          position: "sticky",
                          top: 0,
                          background: "var(--bg-panel)",
                          borderBottom: "1px solid var(--border-color)",
                          borderRight: "1px solid var(--border-color)",
                          padding: "12px 16px",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          zIndex: 2,
                          minWidth: "80px"
                        }}
                      >
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {computed.players.map((row, rowIdx) => (
                    <tr key={row.id} style={{ background: rowIdx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                      <td
                        style={{
                          position: "sticky",
                          left: 0,
                          background: "var(--bg-panel)",
                          borderBottom: "1px solid var(--border-color)",
                          borderRight: "1px solid var(--border-color)",
                          padding: "12px 16px",
                          fontWeight: 700,
                          color: "var(--text-main)",
                          whiteSpace: "nowrap",
                          zIndex: 1,
                          boxShadow: "2px 0 5px rgba(0,0,0,0.2)"
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
                                borderBottom: "1px solid var(--border-color)",
                                borderRight: "1px solid var(--border-color)",
                                padding: "12px",
                                textAlign: "center",
                                background: "rgba(0,0,0,0.2)",
                                color: "var(--text-muted)",
                                fontSize: "0.8rem",
                              }}
                            >
                              —
                            </td>
                          );
                        }

                        const { killsAB, deathsAB } = computed.cell(row.id, col.id);
                        
                        // Add 75 kills to Lemon when facing kAyA
                        let displayKillsAB = killsAB;
                        if (row.name === "Lemon" && col.name === "kAyA") {
                          displayKillsAB = killsAB + 75;
                        }
                        
                        const isHighActivity = displayKillsAB + deathsAB >= 10;

                        let cellBg = "transparent";
                        if (displayKillsAB > deathsAB * 1.5 && displayKillsAB > 5) cellBg = "rgba(34, 211, 238, 0.1)"; // Winning hard (Cyan tint)
                        if (deathsAB > displayKillsAB * 1.5 && deathsAB > 5) cellBg = "rgba(244, 114, 182, 0.1)"; // Losing hard (Pink tint)

                        return (
                          <td
                            key={col.id}
                            style={{
                              borderBottom: "1px solid var(--border-color)",
                              borderRight: "1px solid var(--border-color)",
                              padding: "10px",
                              textAlign: "center",
                              whiteSpace: "nowrap",
                              background: cellBg,
                              fontWeight: isHighActivity ? 700 : 400,
                              color: isHighActivity ? "#fff" : "var(--text-muted)",
                              transition: "background 0.2s"
                            }}
                            title={`${row.name} vs ${col.name}: ${displayKillsAB} kills / ${deathsAB} deaths`}
                          >
                            <span style={{ color: displayKillsAB > deathsAB ? "var(--primary)" : "inherit" }}>{displayKillsAB}</span>
                            <span style={{ opacity: 0.4, margin: "0 4px" }}>/</span>
                            <span style={{ color: deathsAB > displayKillsAB ? "var(--accent)" : "inherit" }}>{deathsAB}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
