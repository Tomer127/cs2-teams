import { useMemo, useState, useRef, useEffect } from "react";
import MatchHistory from "./MatchHistory";
import { MAPS } from "./maps";
import MVP from "./MVP";
import Statistics from "./Statistics";
import Testing from "./Testing";
import ServerControl from "./ServerControl";

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
  "Tampon",
  "Xrang",
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

type NavProps = {
  page: string;
  setPage: (p: any) => void;
};

function NavButtons({ page, setPage }: NavProps) {
  return (
    <>
      <button
        onClick={() => setPage("teams")}
        className={page === "teams" ? "btn-gaming" : "btn-secondary"}
      >
        Teams
      </button>

      <button
        onClick={() => setPage("history")}
        className={page === "history" ? "btn-gaming" : "btn-secondary"}
      >
        Match History
      </button>

      <button
        onClick={() => setPage("mvp")}
        className={page === "mvp" ? "btn-gaming" : "btn-secondary"}
      >
        MVP
      </button>

      <button
        onClick={() => setPage("stats")}
        className={page === "stats" ? "btn-gaming" : "btn-secondary"}
      >
        Statistics
      </button>

      <button
        onClick={() => setPage("testing")}
        className={page === "testing" ? "btn-gaming" : "btn-secondary"}
      >
        Testing
      </button>

      <button
        onClick={() => setPage("server")}
        className={page === "server" ? "btn-gaming" : "btn-secondary"}
      >
        Server
      </button>
    </>
  );
}

export default function App() {
  const [page, setPage] = useState<
    "teams" | "history" | "mvp" | "stats" | "testing" | "server"
  >("teams");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // --- Teams state
  const [players, setPlayers] = useState<string[]>(DEFAULT_PLAYERS);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(DEFAULT_PLAYERS)
  );
  const [teamCount, setTeamCount] = useState<number>(2);
  const [teams, setTeams] = useState<string[][]>([[], []]);
  const [newPlayer, setNewPlayer] = useState<string>("");
  const [randomMap, setRandomMap] = useState<string | null>(null);
  const mapTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (mapTimerRef.current) {
        clearInterval(mapTimerRef.current);
        mapTimerRef.current = null;
      }
    };
  }, []);

  function rollMap() {
    if (MAPS.length === 0) return;
    if (mapTimerRef.current) {
      clearInterval(mapTimerRef.current);
      mapTimerRef.current = null;
    }

    const duration = 1500;
    const intervalMs = 80;
    let elapsed = 0;

    const id = window.setInterval(() => {
      setRandomMap(MAPS[Math.floor(Math.random() * MAPS.length)]);
      elapsed += intervalMs;
      if (elapsed >= duration) {
        clearInterval(id);
        mapTimerRef.current = null;
        const final = MAPS[Math.floor(Math.random() * MAPS.length)];
        setRandomMap(final);
      }
    }, intervalMs);

    mapTimerRef.current = id;
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
    <div className="container">
      {/* Top nav */}
      {/* Navigation */}
      <nav className="nav-container">
        {/* Desktop Nav */}
        <div className="nav-desktop">
          <NavButtons page={page} setPage={setPage} />
        </div>

        {/* Mobile Nav Header */}
        <div className="nav-mobile-header">
          <div className="mobile-logo">CS2 TEAMS</div>
          <button
            className="nav-hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile Nav Overlay */}
        {mobileMenuOpen && (
          <div className="nav-mobile-menu">
            <NavButtons
              page={page}
              setPage={(p) => {
                setPage(p);
                setMobileMenuOpen(false);
              }}
            />
          </div>
        )}
      </nav>

      {/* Pages */}
      {page === "history" ? (
        <MatchHistory />
      ) : page === "mvp" ? (
        <MVP />
      ) : page === "stats" ? (
        <Statistics />
      ) : page === "testing" ? (
        <Testing />
      ) : page === "server" ? (
        <ServerControl />
      ) : (
        <>
          <header style={{ marginBottom: "2rem", textAlign: "center" }}>
            <h1>CS2 Team Divider</h1>
            <p>Select players → divide into teams → adjust if needed.</p>
          </header>

          <div className="grid-stack">
            {/* Players panel */}
            <div className="panel">
              <h2>Players</h2>

              <div className="flex-gap" style={{ marginBottom: "1rem" }}>
                <input
                  value={newPlayer}
                  onChange={(e) => setNewPlayer(e.target.value)}
                  placeholder="Add player..."
                  style={{ flex: 1 }}
                  onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                />
                <button onClick={addPlayer} className="btn-gaming">
                  Add
                </button>
              </div>

              <div className="flex-gap" style={{ marginBottom: "1rem" }}>
                <button
                  onClick={() => setSelected(new Set(players))}
                  className="btn-secondary"
                  style={{ fontSize: "0.9rem", padding: "0.4rem 0.8rem" }}
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="btn-secondary"
                  style={{ fontSize: "0.9rem", padding: "0.4rem 0.8rem" }}
                >
                  Clear
                </button>
              </div>

              <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
                {players.map((p) => (
                  <label
                    key={p}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.8rem",
                      borderRadius: "var(--radius-md)",
                      background: selected.has(p)
                        ? "rgba(0, 255, 157, 0.1)"
                        : "rgba(255, 255, 255, 0.03)",
                      border: selected.has(p)
                        ? "1px solid var(--primary)"
                        : "1px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <input
                        type="checkbox"
                        checked={selected.has(p)}
                        onChange={() => togglePlayer(p)}
                      />
                      {p}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        removePlayer(p);
                      }}
                      title="Remove"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--text-muted)",
                        padding: "0 4px",
                        fontSize: "1.2rem",
                      }}
                    >
                      &times;
                    </button>
                  </label>
                ))}
              </div>
            </div>

            {/* Teams panel */}
            <div className="panel">
              <h2>Teams</h2>

              <div className="flex-gap" style={{ marginBottom: "1rem" }}>
                <span>Count:</span>
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={teamCount}
                  onChange={(e) => setTeamCount(Number(e.target.value))}
                  style={{ width: "60px", padding: "0.5rem" }}
                />
                <button
                  onClick={generateTeams}
                  disabled={selectedPlayers.length < 2}
                  className="btn-gaming"
                >
                  Divide &#127922;
                </button>
                <button
                  onClick={() => setTeams(Array.from({ length: teamCount }, () => []))}
                  className="btn-secondary"
                >
                  Reset
                </button>
                <button
                  onClick={rollMap}
                  className="btn-gaming"
                  style={{ marginLeft: "auto", borderColor: "var(--accent)", color: "var(--accent)" }}
                >
                  Map &#127920;
                </button>
              </div>

              <div style={{ marginBottom: "1rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                Selected: <b style={{ color: "var(--primary)" }}>{selectedPlayers.length}</b>
              </div>

              <div style={{ display: "grid", gap: "1rem" }}>
                {teams.map((team, teamIdx) => (
                  <div
                    key={teamIdx}
                    style={{
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-md)",
                      padding: "1rem",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
                      <b style={{ color: "var(--accent)" }}>Team {teamIdx + 1}</b>
                      <span style={{ opacity: 0.7, fontSize: "0.8rem" }}>{team.length} players</span>
                    </div>

                    {team.length === 0 ? (
                      <div style={{ opacity: 0.4, fontStyle: "italic" }}>Empty</div>
                    ) : (
                      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                        {team.map((p) => (
                          <li
                            key={p}
                            style={{
                              marginBottom: "0.5rem",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              background: "rgba(0,0,0,0.2)",
                              padding: "0.4rem 0.8rem",
                              borderRadius: "4px",
                            }}
                          >
                            <span>{p}</span>
                            <span style={{ display: "inline-flex", gap: "0.3rem" }}>
                              {teams.map((_, toIdx) =>
                                toIdx === teamIdx ? null : (
                                  <button
                                    key={toIdx}
                                    onClick={() => movePlayer(p, teamIdx, toIdx)}
                                    className="btn-secondary"
                                    style={{
                                      padding: "2px 6px",
                                      fontSize: "0.7rem",
                                      border: "1px solid var(--border-color)",
                                    }}
                                  >
                                    &rarr; T{toIdx + 1}
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
                className="btn-gaming"
                style={{ width: "100%", marginTop: "1.5rem" }}
              >
                Copy Teams To Clipboard
              </button>

              {randomMap ? (
                <div
                  className="animate-pulse-fast"
                  style={{
                    marginTop: "1.5rem",
                    padding: "1.5rem",
                    border: "2px solid var(--accent)",
                    borderRadius: "var(--radius-md)",
                    textAlign: "center",
                    background: "rgba(0, 217, 255, 0.1)",
                  }}
                >
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--accent)", textTransform: "uppercase" }}>
                    {randomMap}
                  </div>
                  <div style={{ marginTop: "1rem" }}>
                    <button
                      onClick={() => setRandomMap(null)}
                      className="btn-secondary"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );

}
