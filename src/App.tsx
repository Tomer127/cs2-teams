import { useMemo, useState } from "react";


const DEFAULT_PLAYERS = [
  "LionFr0mZion",
  "mokoloti",
  "Xeponz",
  "Vish3r",
  "captkeen",
  "dolche_karas",
  "ColdFear7",
  "BachduT",
  "alonraz9",
  "AzureBat",
  "Q-wade",
];

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function chunkRoundRobin<T>(items: T[], teamCount: number) {
  const teams: T[][] = Array.from({ length: teamCount }, () => []);
  items.forEach((p, idx) => teams[idx % teamCount].push(p));
  return teams;
}

export default function App() {
  const [players, setPlayers] = useState<string[]>(DEFAULT_PLAYERS);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(DEFAULT_PLAYERS));
  const [teamCount, setTeamCount] = useState<number>(2);
  const [teams, setTeams] = useState<string[][]>([[], []]);
  const [newPlayer, setNewPlayer] = useState<string>("");

  const selectedPlayers = useMemo(
    () => players.filter((p) => selected.has(p)),
    [players, selected]
  );

  function togglePlayer(name: string) {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(name)) s.delete(name);
      else s.add(name);
      return s;
    });
  }

  function addPlayer() {
    const name = newPlayer.trim();
    if (!name) return;
    if (players.includes(name)) return;
    setPlayers((p) => [...p, name]);
    setSelected((prev) => new Set(prev).add(name));
    setNewPlayer("");
  }

  function removePlayer(name: string) {
    setPlayers((p) => p.filter((x) => x !== name));
    setSelected((prev) => {
      const s = new Set(prev);
      s.delete(name);
      return s;
    });
  }

  function generateTeams() {
    const tc = Math.max(2, Math.min(10, Number(teamCount) || 2));
    setTeamCount(tc);
    const shuffled = shuffle(selectedPlayers);
    const nextTeams = chunkRoundRobin(shuffled, tc);
    setTeams(nextTeams);
  }

  function movePlayer(player: string, fromIdx: number, toIdx: number) {
    setTeams((prev) => {
      const next = prev.map((t) => [...t]);
      next[fromIdx] = next[fromIdx].filter((p) => p !== player);
      next[toIdx].push(player);
      return next;
    });
  }

  async function copyTeams() {
    const text = teams.map((t, i) => `Team ${i + 1}: ${t.join(", ")}`).join("\n");
    await navigator.clipboard.writeText(text);
    alert("Copied!");
  }

  return (
    <div style={{ maxWidth: 900, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 6 }}>CS2 Team Divider</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>Select players → divide into teams → adjust if needed.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Players</h2>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              value={newPlayer}
              onChange={(e) => setNewPlayer(e.target.value)}
              placeholder="Add player…"
              style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
              onKeyDown={(e) => e.key === "Enter" && addPlayer()}
            />
            <button
              onClick={addPlayer}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc", cursor: "pointer" }}
            >
              Add
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => setSelected(new Set(players))}
              style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ccc", cursor: "pointer" }}
            >
              Select all
            </button>
            <button
              onClick={() => setSelected(new Set())}
              style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ccc", cursor: "pointer" }}
            >
              Clear
            </button>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {players.map((p) => (
              <label
                key={p}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #eee",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={selected.has(p)} onChange={() => togglePlayer(p)} />
                  {p}
                </span>
                <button
                  onClick={() => removePlayer(p)}
                  title="Remove"
                  style={{
                    border: "1px solid #ccc",
                    borderRadius: 10,
                    padding: "6px 10px",
                    cursor: "pointer",
                    opacity: 0.8,
                  }}
                >
                  ✕
                </button>
              </label>
            ))}
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Teams</h2>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span>Teams:</span>
            <input
              type="number"
              min={2}
              max={10}
              value={teamCount}
              onChange={(e) => setTeamCount(Number(e.target.value))}
              style={{ width: 80, padding: 8, borderRadius: 10, border: "1px solid #ccc" }}
            />
            <button
              onClick={generateTeams}
              disabled={selectedPlayers.length < 2}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc", cursor: "pointer" }}
            >
              Divide 🎲
            </button>
            <button
              onClick={() => setTeams(Array.from({ length: teamCount }, () => []))}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc", cursor: "pointer" }}
            >
              Reset
            </button>
          </div>

          <div style={{ marginBottom: 10, opacity: 0.75 }}>
            Selected: <b>{selectedPlayers.length}</b>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {teams.map((team, teamIdx) => (
              <div key={teamIdx} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <b>Team {teamIdx + 1}</b>
                  <span style={{ opacity: 0.7 }}>{team.length} players</span>
                </div>

                {team.length === 0 ? (
                  <div style={{ paddingTop: 8, opacity: 0.6 }}>Empty</div>
                ) : (
                  <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
                    {team.map((p) => (
                      <li key={p} style={{ marginBottom: 6 }}>
                        {p}{" "}
                        <span style={{ display: "inline-flex", gap: 6, marginLeft: 8 }}>
                          {teams.map((_, toIdx) =>
                            toIdx === teamIdx ? null : (
                              <button
                                key={toIdx}
                                onClick={() => movePlayer(p, teamIdx, toIdx)}
                                style={{
                                  border: "1px solid #ccc",
                                  borderRadius: 10,
                                  padding: "2px 8px",
                                  cursor: "pointer",
                                  fontSize: 12,
                                }}
                              >
                                → Team {toIdx + 1}
                              </button>
                            )
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={copyTeams}
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              cursor: "pointer",
              width: "100%",
            }}
          >
            Copy teams to clipboard
          </button>
        </div>
      </div>
    </div>
  );
}
