import { useMemo } from "react";
import statsRaw from "./data/playerStats.json";

type PlayerStat = {
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

function gradeFor(value: number, max: number) {
  const pct = (value / Math.max(1, max)) * 100;
  if (pct >= 90) return "S";
  if (pct >= 75) return "A";
  if (pct >= 50) return "B";
  if (pct >= 25) return "C";
  return "D";
}

export default function MVP() {
  const stats = statsRaw as PlayerStat[];

  const sorted = useMemo(() => {
    return [...stats].sort((a, b) => b.avgMatchDamage - a.avgMatchDamage);
  }, [stats]);

  const max = sorted[0]?.avgMatchDamage ?? 1;

  return (
    <div>
      <h1 style={{ marginBottom: 6 }}>MVP Rankings</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>Ranked by avgMatchDamage (higher is better).</p>

      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
              <th style={{ padding: "8px" }}>#</th>
              <th style={{ padding: "8px" }}>Player</th>
              <th style={{ padding: "8px" }}>Matches</th>
              <th style={{ padding: "8px" }}>Avg Dmg</th>
              <th style={{ padding: "8px" }}>Grade</th>
              <th style={{ padding: "8px" }}>Bar</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, idx) => (
              <tr key={p.accountId} style={{ borderBottom: "1px solid #f6f6f6" }}>
                <td style={{ padding: "8px", width: 40 }}>{idx + 1}</td>
                <td style={{ padding: "8px", fontWeight: 700 }}>{p.name}</td>
                <td style={{ padding: "8px", width: 80 }}>{p.matchesPlayed}</td>
                <td style={{ padding: "8px", width: 110 }}>{p.avgMatchDamage.toFixed(1)}</td>
                <td style={{ padding: "8px", width: 60 }}>{gradeFor(p.avgMatchDamage, max)}</td>
                <td style={{ padding: "8px" }}>
                  <div style={{ background: "#f0f0f0", borderRadius: 6, height: 12, width: "100%" }}>
                    <div
                      style={{
                        width: `${Math.round((p.avgMatchDamage / Math.max(1, max)) * 100)}%`,
                        height: "100%",
                        background: "linear-gradient(90deg,#6ee7b7,#3b82f6)",
                        borderRadius: 6,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
