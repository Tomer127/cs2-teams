import { useEffect, useState } from "react";

type MatchRow = {
  id: string;
  created_at: string;
  finished_at: string | null;
  map: string | null;
  team1_name: string | null;
  team2_name: string | null;
  team1_score: number | null;
  team2_score: number | null;
};

export default function MatchHistory() {
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/matches")
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 16 }}>Loading match history…</div>;

  return (
    <div style={{ maxWidth: 900, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>Match History</h1>

      {rows.length === 0 ? (
        <p>No matches yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((m) => (
            <div key={m.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <b>{m.map ?? "Unknown map"}</b>
                <span style={{ opacity: 0.7, fontSize: 12 }}>
                  {new Date(m.created_at).toLocaleString()}
                </span>
              </div>

              <div style={{ marginTop: 8 }}>
                <div>
                  {m.team1_name ?? "Team 1"}: <b>{m.team1_score ?? "-"}</b>
                </div>
                <div>
                  {m.team2_name ?? "Team 2"}: <b>{m.team2_score ?? "-"}</b>
                </div>
              </div>

              <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>Match ID: {m.id}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
