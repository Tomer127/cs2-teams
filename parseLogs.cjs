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
// OR: Game Over: competitive de_mirage de_nuke score 13:10 (two maps - use second)
const RE_GAME_OVER =
  /Game Over:\s*competitive\s+(?:\S+\s+)?(?<map>\S+)\s+score\s+(?<a>\d+):(?<b>\d+)\s+after\s+(?<mins>\d+)\s+min/i;

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

// Round end marker (we’ll use it to separate rounds)
const RE_ROUND_END = /World triggered\s+"Round_End"/i;

// Utility usage (thrown grenades)
const RE_THROW =
  /"(?<name>[^<"]+)<\d+><\[U:1:(?<id>\d+)\]><(?<team>CT|TERRORIST)>"\s+threw\s+(?<util>smokegrenade|flashbang|hegrenade|molotov|incgrenade|decoy)/i;

// Damage line (raw) — used to compute utility damage
// Example:
// "A<...><[U:1:123]><CT>" attacked "B<...><[U:1:456]><TERRORIST>" with "hegrenade" (damage "38") ...
const RE_DAMAGE =
  /"(?<aName>[^<"]+)<\d+><\[U:1:(?<aId>\d+)\]><(?<aTeam>CT|TERRORIST)>".*?attacked\s+"(?<vName>[^<"]+)<\d+><\[U:1:(?<vId>\d+)\]><(?<vTeam>CT|TERRORIST)>".*?with\s+"(?<weapon>[^"]+)".*?damage\s+"(?<dmg>\d+)"/i;

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

      // Enriched later from round_stats
      dmg: 0,
      adr: 0,
      fireDamage: 0,

      // From raw lines
      utilityThrows: 0,
      knifeKills: 0,
      firstKills: 0,
      lastAliveRounds: 0,

      // NEW: Utility damage from damage lines
      utilityDamage: 0,
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

  commitIfBest();
  return best;
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

    // Round tracking (best-effort using Round_End)
    let roundHadFirstKill = false;

    // Last death per team in current round (victim ids)
    let lastDeathCT = null;
    let lastDeathT = null;

    // Kill pairs for head-to-head table
    const killEvents = []; // { killerId, victimId }

    for (let k = startIdx; k <= endIdx; k++) {
      const p = stripPrefix(rawLines[k]);

      // Round boundary: award last-alive and reset flags
      if (RE_ROUND_END.test(p)) {
        if (lastDeathCT && players.get(String(lastDeathCT))) {
          players.get(String(lastDeathCT)).lastAliveRounds += 1;
        }
        if (lastDeathT && players.get(String(lastDeathT))) {
          players.get(String(lastDeathT)).lastAliveRounds += 1;
        }

        roundHadFirstKill = false;
        lastDeathCT = null;
        lastDeathT = null;
        continue;
      }

      // keep names/team fresh
      const tok = p.match(RE_PLAYER_TOKEN);
      if (tok?.groups?.accountId) {
        ensurePlayer(players, tok.groups.accountId, tok.groups.name, tok.groups.team);
      }

      // Utility throws
      const th = p.match(RE_THROW);
      if (th?.groups) {
        const id = th.groups.id;
        ensurePlayer(players, id, th.groups.name, th.groups.team);
        players.get(String(id)).utilityThrows += 1;
        continue;
      }

      // Utility damage (Molotov/Incendiary/HE)
      const dm = p.match(RE_DAMAGE);
      if (dm?.groups) {
        const aId = dm.groups.aId;
        const dmg = Number(dm.groups.dmg) || 0;
        const weapon = (dm.groups.weapon || "").toLowerCase();

        // Count only HE and fire utility
        const isHE = weapon.includes("hegrenade");
        const isDirectMolotov = weapon.includes("molotov");
        const isDirectInc = weapon.includes("incgrenade");
        const isFireTick = weapon.includes("inferno"); // burn damage ticks

        if (isHE || isDirectMolotov || isDirectInc || isFireTick) {
          ensurePlayer(players, aId, dm.groups.aName, dm.groups.aTeam);
          players.get(String(aId)).utilityDamage += dmg;
        }
        continue;
      }

      // Kills
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

        // Headshot
        const rest = km.groups.rest || "";
        if (/headshot/i.test(rest)) {
          players.get(String(aId)).headshotKills += 1;
        }

        // First kill in round
        if (!roundHadFirstKill) {
          players.get(String(aId)).firstKills += 1;
          roundHadFirstKill = true;
        }

        // Knife kills
        const weapon = (km.groups.weapon || "").toLowerCase();
        if (weapon.includes("knife")) {
          players.get(String(aId)).knifeKills += 1;
        }

        // Track last death per team in this round (victim)
        if (vTeam === "CT") lastDeathCT = vId;
        if (vTeam === "T") lastDeathT = vId;

        // Store kill pair for head-to-head table
        killEvents.push({ killerId: String(aId), victimId: String(vId) });

        continue;
      }

      // Assists
      const am = p.match(RE_ASSIST);
      if (am?.groups) {
        const aId = am.groups.aId;
        ensurePlayer(players, aId, am.groups.aName, am.groups.aTeam);
        players.get(String(aId)).assists += 1;
        continue;
      }

      // Suicides
      const sm = p.match(RE_SUICIDE);
      if (sm?.groups) {
        const id = sm.groups.id;
        ensurePlayer(players, id, sm.groups.name, sm.groups.team);
        players.get(String(id)).deaths += 1;

        const t = teamNorm(sm.groups.team);
        if (t === "CT") lastDeathCT = id;
        if (t === "T") lastDeathT = id;

        continue;
      }
    }

    // Enrich ONLY dmg/adr/fireDamage from the last round_stats block inside this match window
    const extras = extractLastRoundStatsExtras(rawLines, startIdx, endIdx);
    for (const [accountId, ex] of extras.entries()) {
      ensurePlayer(players, accountId, nameByAccount.get(accountId), ex.team);

      const pl = players.get(String(accountId));
      pl.dmg = safeNum(ex.dmg);
      pl.adr = safeNum(ex.adr);
      pl.fireDamage = safeNum(ex.fireDamage);

      if (!pl.team && ex.team) pl.team = ex.team;
    }

    // Build match players array for UI
    const matchPlayers = [...players.values()].map((pl) => {
      const kills = pl.kills || 0;
      const deaths = pl.deaths || 0;
      const assists = pl.assists || 0;
      const hs = pl.headshotKills || 0;
      const hsp = kills > 0 ? +(((hs / kills) * 100).toFixed(1)) : 0;

      return {
        accountId: pl.accountId,
        name: pl.name,
        team: pl.team || "Unassigned",
        kills,
        deaths,
        assists,

        dmg: safeNum(pl.dmg),
        adr: safeNum(pl.adr),
        fireDamage: safeNum(pl.fireDamage),

        hsp,
        kdr: +(kills / Math.max(1, deaths)).toFixed(2),

        utilityThrows: safeNum(pl.utilityThrows),
        knifeKills: safeNum(pl.knifeKills),
        firstKills: safeNum(pl.firstKills),
        lastAliveRounds: safeNum(pl.lastAliveRounds),

        // NEW
        utilityDamage: safeNum(pl.utilityDamage),
      };
    }).filter((pl) => {
      // Skip players with 0 kills, 0 deaths, 0 assists, and 0 dmg
      return !(pl.kills === 0 && pl.deaths === 0 && pl.assists === 0 && pl.dmg === 0);
    });

    // sanity: competitive should have 10 players; keep >= 8 like your original logic
    if (matchPlayers.length < 8) continue;

    // teams grouping
    const teams = { T: [], CT: [], Unassigned: [] };
    for (const pl of matchPlayers) {
      if (pl.team === "T") teams.T.push(pl);
      else if (pl.team === "CT") teams.CT.push(pl);
      else teams.Unassigned.push(pl);
    }

    // Assign unassigned to balance
    const unassigned = teams.Unassigned.splice(0);
    for (const pl of unassigned) {
      if (teams.T.length <= teams.CT.length) {
        pl.team = "T";
        teams.T.push(pl);
      } else {
        pl.team = "CT";
        teams.CT.push(pl);
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
      killEvents,
    });
  }
}

// Sort newest first (last match at top)
matches.sort((a, b) => {
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

      totalUtility: 0,
      totalKnifeKills: 0,
      totalFirstKills: 0,
      totalLastAliveRounds: 0,

      // NEW
      totalUtilityDamage: 0,
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

    t.totalUtility += safeNum(p.utilityThrows);
    t.totalKnifeKills += safeNum(p.knifeKills);
    t.totalFirstKills += safeNum(p.firstKills);
    t.totalLastAliveRounds += safeNum(p.lastAliveRounds);

    // NEW
    t.totalUtilityDamage += safeNum(p.utilityDamage);
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

      utilityThrows: t.totalUtility,
      knifeKills: t.totalKnifeKills,
      firstKills: t.totalFirstKills,
      lastAliveRounds: t.totalLastAliveRounds,

      // NEW
      utilityDamage: t.totalUtilityDamage,
    };
  })
  .sort((a, b) => b.kills - a.kills);

fs.writeFileSync(OUT_PLAYERS, JSON.stringify(playerStats, null, 2), "utf8");

console.log(`✅ matches.json: ${matches.length} full match(es)`);
console.log(`✅ playerStats.json: ${playerStats.length} player(s)`);
