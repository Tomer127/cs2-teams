/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const LOG_DIR = path.join(__dirname, "logs");

// Output files
const OUT_PLAYERS = path.join(__dirname, "src", "data", "playerStats.json");
const OUT_MATCHES = path.join(__dirname, "src", "data", "matches.json");

// Maps we want to completely ignore everywhere (match history, MVP, stats, etc.)
const EXCLUDED_MAPS = new Set([
  "aim_deagle",
]);

// ---------------- Helpers ----------------

function stripPrefix(line) {
  // Removes: L 01/09/2026 - 21:20:02:
  return line.replace(
    /^L\s+\d{2}\/\d{2}\/\d{4}\s+-\s+\d{2}:\d{2}:\d{2}:\s*/i,
    ""
  );
}

function extractTimestamp(line) {
  const m = line.match(
    /^L\s+(\d{2}\/\d{2}\/\d{4})\s+-\s+(\d{2}:\d{2}:\d{2}):/i
  );
  if (!m) return null;
  return `${m[1]} ${m[2]}`; // keep simple (UI-friendly)
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function shaId(str) {
  return crypto.createHash("sha1").update(str, "utf8").digest("hex").slice(0, 12);
}

function teamNorm(t) {
  if (t === "TERRORIST") return "T";
  if (t === "CT") return "CT";
  if (t === "2") return "T";
  if (t === "3") return "CT";
  return t || "Unassigned";
}

// ---------------- Regex ----------------

// Game Over: competitive  de_inferno score 13:11 after 39 min
const RE_GAME_OVER =
  /Game Over:\s*competitive\s+(?<map>\S+)\s+score\s+(?<a>\d+):(?<b>\d+)\s+after\s+(?<mins>\d+)\s+min/i;

// MatchStatus: Score: 0:0 on map "de_inferno" RoundsPlayed: 0
const RE_MATCHSTATUS_ZERO =
  /MatchStatus:\s+Score:\s+0:0\s+on\s+map\s+"(?<map>[^"]+)"\s+RoundsPlayed:\s+(?<rp>-?\d+)/i;

// World triggered "Match_Start" on "de_inferno"
const RE_MATCH_START =
  /World triggered\s+"Match_Start"\s+on\s+"(?<map>[^"]+)"/i;

// kill line (raw)
const RE_KILL =
  /"(?<aName>[^<"]+)<\d+><\[U:1:(?<aId>\d+)\]><(?<aTeam>CT|TERRORIST)>".*?\skilled\s+(?<other>other\s+)?"(?<vName>[^<"]+)<\d+><\[U:1:(?<vId>\d+)\]><(?<vTeam>CT|TERRORIST)>".*?\swith\s+"(?<weapon>[^"]+)"(?<rest>.*)$/i;

// assist line (raw)
const RE_ASSIST =
  /"(?<aName>[^<"]+)<\d+><\[U:1:(?<aId>\d+)\]><(?<aTeam>CT|TERRORIST)>"\s+(?<flash>flash-)?assisted\s+killing\s+"(?<vName>[^<"]+)<\d+><\[U:1:(?<vId>\d+)\]><(?<vTeam>CT|TERRORIST)>"/i;

// suicide line (raw)
const RE_SUICIDE =
  /"(?<name>[^<"]+)<\d+><\[U:1:(?<id>\d+)\]><(?<team>CT|TERRORIST)>".*\scommitted\s+suicide\s+with\s+"(?<why>[^"]+)"/i;

// player token (for name capture)
const RE_PLAYER_TOKEN =
  /"(?<name>[^<"]+)<\d+><\[U:1:(?<accountId>\d+)\]><(?<team>CT|TERRORIST)>"/i;

// ---------------- Stores ----------------

const nameByAccount = new Map(); // accountId -> last seen name

function ensurePlayer(store, accountId, name, team) {
  const id = String(accountId);
  if (!store.has(id)) {
    store.set(id, {
      accountId: id,
      name: name || nameByAccount.get(id) || `account_${id}`,
      team: team ? teamNorm(team) : undefined,
      kills: 0,
      deaths: 0,
      assists: 0,
      headshotKills: 0,
      dmg: 0,
      adr: 0,
      fireDamage: 0,
    });
  } else {
    const p = store.get(id);
    if (name && p.name !== name) p.name = name;
    if (team && !p.team) p.team = teamNorm(team);
  }
  if (name) nameByAccount.set(id, name);
}

function isFullMatch(scoreA, scoreB) {
  // "13:0 is minimum rounds to be counted as a full match"
  return Math.max(Number(scoreA), Number(scoreB)) >= 13;
}

// ---------------- Match boundary detection ----------------
//
// From a Game Over line index, we go backwards until we find a true start boundary.
// Best anchor is: MatchStatus Score 0:0 RoundsPlayed 0 on same map.
// Then hop slightly back to the nearest Match_Start for same map (if present).
//
function findMatchStartIndex(lines, gameOverIdx, mapName) {
  let zeroIdx = -1;

  for (let i = gameOverIdx; i >= 0; i--) {
    const payload = stripPrefix(lines[i]);
    const m = payload.match(RE_MATCHSTATUS_ZERO);
    if (m?.groups && m.groups.map === mapName && Number(m.groups.rp) === 0) {
      zeroIdx = i;
      break;
    }
  }

  if (zeroIdx !== -1) {
    // Look slightly backwards for Match_Start (avoid drifting to older matches)
    for (let i = zeroIdx; i >= Math.max(0, zeroIdx - 400); i--) {
      const payload = stripPrefix(lines[i]);
      const ms = payload.match(RE_MATCH_START);
      if (ms?.groups?.map === mapName) return i;
    }
    return zeroIdx;
  }

  // Fallback: last Match_Start on same map
  for (let i = gameOverIdx; i >= 0; i--) {
    const payload = stripPrefix(lines[i]);
    const ms = payload.match(RE_MATCH_START);
    if (ms?.groups?.map === mapName) return i;
  }

  return 0;
}

// ---------------- round_stats enrichment (DMG/ADR/FireDamage only) ----------------

function extractLastRoundStatsExtras(lines, startIdx, endIdx) {
  // Parse the LAST round_stats JSON block inside match window.
  // We DO NOT JSON.parse because log output can wrap lines and break valid JSON.
  //
  // We ONLY use this for: dmg / adr / firedmg
  //
  // row format inside round_stats block:
  // "player_0": "accountid,team,money,kills,deaths,assists,dmg,hsp,kdr,adr,...,firedmg,..."
  //
  // Indices used:
  // 0 accountid
  // 1 team (2=T, 3=CT)
  // 6 dmg
  // 9 adr
  // 22 firedmg
  const IDX = { accountId: 0, team: 1, dmg: 6, adr: 9, firedmg: 22 };

  let inJson = false;
  let isRoundStats = false;
  let currentRound = -1;
  let bestRound = -1;

  /** @type {Map<string, {team?: string, dmg:number, adr:number, fireDamage:number}>} */
  let current = new Map();
  /** @type {Map<string, {team?: string, dmg:number, adr:number, fireDamage:number}>} */
  let best = new Map();

  function commitIfBest() {
    if (!isRoundStats || currentRound < 0) return;
    if (currentRound >= bestRound && current.size > 0) {
      bestRound = currentRound;
      best = new Map(current);
    }
  }

  for (let i = startIdx; i <= endIdx; i++) {
    const payload = stripPrefix(lines[i]).trim();

    if (payload === "JSON_BEGIN{") {
      inJson = true;
      isRoundStats = false;
      currentRound = -1;
      current = new Map();
      continue;
    }

    if (!inJson) continue;

    if (payload.includes("JSON_END")) {
      commitIfBest();
      inJson = false;
      continue;
    }

    if (payload.includes('"name"') && payload.includes('"round_stats"')) {
      isRoundStats = true;
      continue;
    }

    if (!isRoundStats) continue;

    if (payload.includes('"round_number"')) {
      const m = payload.match(/"round_number"\s*:\s*"(?<n>\d+)"/);
      if (m?.groups?.n) currentRound = Number(m.groups.n);
      continue;
    }

    if (payload.includes('"player_')) {
      const m = payload.match(/"player_\d+"\s*:\s*"(?<row>.*)"\s*$/);
      if (!m?.groups?.row) continue;

      const cols = m.groups.row.split(",").map((x) => x.trim());
      if (cols.length <= IDX.adr) continue;

      const accountId = cols[IDX.accountId];
      if (!accountId) continue;

      const teamNum = cols[IDX.team];
      const team = teamNum === "3" ? "CT" : teamNum === "2" ? "T" : undefined;

      const dmg = safeNum(cols[IDX.dmg]);
      const adr = safeNum(cols[IDX.adr]);
      const fireDamage = safeNum(cols[IDX.firedmg]);

      current.set(String(accountId), { team, dmg, adr, fireDamage });
    }
  }

  // In case file ended while still inJson (rare)
  commitIfBest();

  return best; // accountId -> extras
}

// ---------------- Main parsing ----------------

const matches = [];

if (!fs.existsSync(LOG_DIR)) {
  console.error(`❌ Missing logs directory: ${LOG_DIR}`);
  process.exit(1);
}

const files = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith(".log"));

for (const file of files) {
  const fullPath = path.join(LOG_DIR, file);
  const rawLines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/).filter(Boolean);

  // Pass 1: capture names from any player tokens
  for (const line of rawLines) {
    const token = stripPrefix(line).match(RE_PLAYER_TOKEN);
    if (token?.groups?.accountId) {
      nameByAccount.set(token.groups.accountId, token.groups.name);
    }
    const mName = line.match(/^L .*?: "([^"<]+)<\d+><\[U:1:(\d+)\]>/);
    if (mName) {
      nameByAccount.set(mName[2], mName[1]);
    }
  }

  // Find all Game Over markers (can be multiple per file)
  for (let i = 0; i < rawLines.length; i++) {
    const payload = stripPrefix(rawLines[i]);
    const go = payload.match(RE_GAME_OVER);
    if (!go?.groups) continue;

    const map = go.groups.map;

    // 🚫 Skip excluded maps entirely
    if (EXCLUDED_MAPS.has(map)) continue;

    const scoreA = Number(go.groups.a);
    const scoreB = Number(go.groups.b);

    if (!isFullMatch(scoreA, scoreB)) continue;

    const startIdx = findMatchStartIndex(rawLines, i, map);
    const endIdx = i;

    const startedAt = extractTimestamp(rawLines[startIdx]) || null;
    const endedAt = extractTimestamp(rawLines[endIdx]) || null;

    // Derive rounds played (prefer MatchStatus close to end, otherwise score sum)
    let roundsPlayed = null;
    for (let j = endIdx; j >= Math.max(0, endIdx - 80); j--) {
      const ms = stripPrefix(rawLines[j]).match(
        /MatchStatus:\s+Score:\s+(?<ct>\d+):(?<t>\d+)\s+on\s+map\s+"(?<map>[^"]+)"\s+RoundsPlayed:\s+(?<rp>-?\d+)/i
      );
      if (ms?.groups?.map === map) {
        roundsPlayed = Number(ms.groups.rp);
        break;
      }
    }
    if (!Number.isFinite(roundsPlayed)) roundsPlayed = scoreA + scoreB;

    // Parse raw events inside [startIdx..endIdx]
    const players = new Map();

    for (let k = startIdx; k <= endIdx; k++) {
      const p = stripPrefix(rawLines[k]);

      // keep names/team fresh
      const tok = p.match(RE_PLAYER_TOKEN);
      if (tok?.groups?.accountId) {
        ensurePlayer(players, tok.groups.accountId, tok.groups.name, tok.groups.team);
      }

      const km = p.match(RE_KILL);
      if (km?.groups) {
        const aId = km.groups.aId;
        const vId = km.groups.vId;
        const aTeam = teamNorm(km.groups.aTeam);
        const vTeam = teamNorm(km.groups.vTeam);

        ensurePlayer(players, aId, km.groups.aName, aTeam);
        ensurePlayer(players, vId, km.groups.vName, vTeam);

        players.get(String(aId)).kills += 1;
        players.get(String(vId)).deaths += 1;

        const rest = km.groups.rest || "";
        if (/headshot/i.test(rest)) {
          players.get(String(aId)).headshotKills += 1;
        }
        continue;
      }

      const am = p.match(RE_ASSIST);
      if (am?.groups) {
        const aId = am.groups.aId;
        ensurePlayer(players, aId, am.groups.aName, am.groups.aTeam);
        players.get(String(aId)).assists += 1;
        continue;
      }

      const sm = p.match(RE_SUICIDE);
      if (sm?.groups) {
        const id = sm.groups.id;
        ensurePlayer(players, id, sm.groups.name, sm.groups.team);
        players.get(String(id)).deaths += 1;
        continue;
      }
    }

    // Enrich ONLY dmg/adr/fireDamage from the last round_stats block inside this match window
    const extras = extractLastRoundStatsExtras(rawLines, startIdx, endIdx);
    for (const [accountId, ex] of extras.entries()) {
      ensurePlayer(players, accountId, nameByAccount.get(accountId), ex.team);

      const p = players.get(String(accountId));
      p.dmg = safeNum(ex.dmg);
      p.adr = safeNum(ex.adr);
      p.fireDamage = safeNum(ex.fireDamage);

      if (!p.team && ex.team) p.team = ex.team;
    }

    // Build match players array for UI
    const matchPlayers = [...players.values()].map((p) => {
      const kills = p.kills || 0;
      const deaths = p.deaths || 0;
      const assists = p.assists || 0;
      const hs = p.headshotKills || 0;
      const hsp = kills > 0 ? +(((hs / kills) * 100).toFixed(1)) : 0;

      return {
        accountId: p.accountId,
        name: p.name,
        team: p.team || "Unassigned",
        kills,
        deaths,
        assists,
        dmg: safeNum(p.dmg),
        hsp,
        fireDamage: safeNum(p.fireDamage),
        kdr: +(kills / Math.max(1, deaths)).toFixed(2),
        adr: safeNum(p.adr),
      };
    });

    // sanity: competitive should have 10 players; keep >= 8 like your original logic
    if (matchPlayers.length < 8) continue;

    // teams grouping
    const teams = { T: [], CT: [], Unassigned: [] };
    for (const p of matchPlayers) {
      if (p.team === "T") teams.T.push(p);
      else if (p.team === "CT") teams.CT.push(p);
      else teams.Unassigned.push(p);
    }

    // Assign unassigned to balance
    const unassigned = teams.Unassigned.splice(0);
    for (const p of unassigned) {
      if (teams.T.length <= teams.CT.length) {
        p.team = "T";
        teams.T.push(p);
      } else {
        p.team = "CT";
        teams.CT.push(p);
      }
    }

    const id = `${file}-${map}-${scoreA}-${scoreB}-${shaId(`${startIdx}-${endIdx}`)}`;

    console.log(`Including ${file}: map=${map}, rounds=${roundsPlayed}, players=${matchPlayers.length}`);

    matches.push({
      id,
      file,
      map,
      server: null,
      roundsPlayed,
      scoreT: scoreA,
      scoreCT: scoreB,
      startedAt,
      endedAt,
      players: matchPlayers,
      teams,
    });
  }
}

// Sort newest first (last match at top)
matches.sort((a, b) => {
  // Use endedAt first; fallback to startedAt; fallback to file
  const aKey = a.endedAt || a.startedAt || "";
  const bKey = b.endedAt || b.startedAt || "";
  if (aKey !== bKey) return aKey < bKey ? 1 : -1;
  return a.file < b.file ? 1 : -1;
});

fs.writeFileSync(OUT_MATCHES, JSON.stringify(matches, null, 2), "utf8");

// Build playerStats from match players
const totals = new Map();
function getTotal(accountId) {
  const id = String(accountId);
  if (!totals.has(id)) {
    totals.set(id, {
      accountId: id,
      matchesPlayed: 0,
      totalKills: 0,
      totalDeaths: 0,
      totalAssists: 0,
      totalDamage: 0,
      totalAdrSum: 0,
      totalHspSum: 0,
      totalFireDamage: 0,
    });
  }
  return totals.get(id);
}

for (const m of matches) {
  for (const p of m.players) {
    const t = getTotal(p.accountId);
    t.matchesPlayed += 1;
    t.totalKills += p.kills;
    t.totalDeaths += p.deaths;
    t.totalAssists += p.assists;
    t.totalDamage += safeNum(p.dmg);
    t.totalAdrSum += safeNum(p.adr);
    t.totalHspSum += safeNum(p.hsp);
    t.totalFireDamage += safeNum(p.fireDamage);
  }
}

const playerStats = Array.from(totals.values())
  .map((t) => {
    const name = nameByAccount.get(t.accountId) || `account_${t.accountId}`;
    return {
      accountId: t.accountId,
      name,
      matchesPlayed: t.matchesPlayed,
      avgMatchDamage: t.matchesPlayed ? Math.round(t.totalDamage / t.matchesPlayed) : 0,
      adr: t.matchesPlayed ? Math.round(t.totalAdrSum / t.matchesPlayed) : 0,
      kdr: +(t.totalKills / Math.max(1, t.totalDeaths)).toFixed(2),
      avgHsp: t.matchesPlayed ? +(t.totalHspSum / t.matchesPlayed).toFixed(1) : 0,
      kills: t.totalKills,
      deaths: t.totalDeaths,
      assists: t.totalAssists,
      totalDamage: t.totalDamage,
      fireDamage: t.totalFireDamage,
    };
  })
  .sort((a, b) => b.kills - a.kills);

fs.writeFileSync(OUT_PLAYERS, JSON.stringify(playerStats, null, 2), "utf8");

console.log(`✅ matches.json: ${matches.length} full match(es)`);
console.log(`✅ playerStats.json: ${playerStats.length} player(s)`);
