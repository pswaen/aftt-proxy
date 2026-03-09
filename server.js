const express = require("express");
const axios   = require("axios");
const cheerio = require("cheerio");
const cors    = require("cors");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const AFTT_BASE = "https://data.aftt.be";

const HEADERS = {
  "User-Agent"     : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept-Language": "fr-FR,fr;q=0.9",
  "Accept"         : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Content-Type"   : "application/x-www-form-urlencoded",
  "Referer"        : AFTT_BASE,
};

async function postAFTT(path, bodyParams) {
  const body = new URLSearchParams(bodyParams).toString();
  const res  = await axios.post(AFTT_BASE + path, body, {
    headers: HEADERS, timeout: 15000, maxRedirects: 5,
  });
  return res.data;
}

async function getAFTT(path) {
  const res = await axios.get(AFTT_BASE + path, {
    headers: { ...HEADERS, "Content-Type": "text/html" }, timeout: 15000,
  });
  return res.data;
}

function parseTeams(html) {
  const $ = cheerio.load(html);
  const teams = [];
  $("table").each((_, table) => {
    $(table).find("tr").each((i, row) => {
      if (i === 0) return;
      const cells = $(row).find("td").map((_, c) => $(c).text().trim()).get();
      if (cells.length >= 5) {
        let name, division, rank, played, won, drawn, lost, points;
        if (cells.length >= 8) {
          [name, division, rank, played, won, drawn, lost, points] = cells;
        } else if (cells.length >= 7) {
          [rank, name, division, played, won, drawn, lost, points] = cells;
        } else {
          [rank, name, played, won, drawn, lost, points] = cells;
          division = "";
        }
        const w = parseInt(won) || 0, d = parseInt(drawn) || 0;
        const l = parseInt(lost) || 0, p = parseInt(played) || 0;
        const pts = parseInt(points) || (w * 2 + d);
        if (name && name.length > 1 && p > 0) {
          teams.push({ name: name.trim(), division: (division||"").trim(),
            rank: parseInt(rank)||(teams.length+1), played:p, won:w, drawn:d, lost:l, points:pts });
        }
      }
    });
  });
  return teams;
}

function parsePlayers(html) {
  const $ = cheerio.load(html);
  const players = [], seen = new Set();
  $("table").each((_, table) => {
    $(table).find("tr").each((i, row) => {
      if (i === 0) return;
      const cells = $(row).find("td").map((_, c) => $(c).text().trim()).get();
      if (cells.length >= 3) {
        const [pos, name, ranking] = cells;
        const points = parseFloat((cells[3]||"0").replace(",",".")) || 0;
        if (name && name.length > 2 && !seen.has(name) && !/^(pos|nom|clt|points)/i.test(name)) {
          seen.add(name);
          players.push({ pos, name, ranking, points });
        }
      }
    });
  });
  return players;
}

// ── Équipes ──────────────────────────────────────────────────
app.get("/api/club/:clubId/teams", async (req, res) => {
  const { clubId } = req.params;
  try {
    const html  = await postAFTT("/interclubs/rankings.php", { club: clubId });
    const teams = parseTeams(html);
    if (teams.length === 0) {
      const html2  = await getAFTT(`/interclubs/rankings.php?club=${clubId}`);
      const teams2 = parseTeams(html2);
      if (teams2.length === 0) {
        const $ = cheerio.load(html);
        return res.status(404).json({ error:"Aucune équipe parsée", clubId,
          debug:{ tableCount:$("table").length, body:$("body").text().replace(/\s+/g," ").slice(0,600) } });
      }
      return res.json({ clubId, teams: teams2, source:"GET" });
    }
    res.json({ clubId, teams, source:"POST" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Joueurs ──────────────────────────────────────────────────
app.get("/api/club/:clubId/players", async (req, res) => {
  const { clubId } = req.params;
  try {
    const html    = await postAFTT("/ranking/clubs.php", { club: clubId });
    const players = parsePlayers(html);
    if (players.length === 0) {
      const html2    = await getAFTT(`/ranking/clubs.php?club=${clubId}`);
      const players2 = parsePlayers(html2);
      if (players2.length === 0) {
        const $ = cheerio.load(html);
        return res.status(404).json({ error:"Aucun joueur parsé", clubId,
          debug:{ tableCount:$("table").length, body:$("body").text().replace(/\s+/g," ").slice(0,600) } });
      }
      return res.json({ clubId, players: players2, source:"GET" });
    }
    res.json({ clubId, players, source:"POST" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Debug : voir la structure brute des tableaux ─────────────
app.get("/api/debug/:clubId/teams", async (req, res) => {
  const { clubId } = req.params;
  try {
    const html = await postAFTT("/interclubs/rankings.php", { club: clubId });
    const $    = cheerio.load(html);
    const tables = [];
    $("table").each((i, table) => {
      const rows = [];
      $(table).find("tr").each((_, row) => {
        rows.push($(row).find("td,th").map((_,c)=>$(c).text().trim()).get());
      });
      tables.push({ tableIndex:i, rows: rows.slice(0,6) });
    });
    res.json({ clubId, tableCount:$("table").length, tables });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/debug/:clubId/players", async (req, res) => {
  const { clubId } = req.params;
  try {
    const html = await postAFTT("/ranking/clubs.php", { club: clubId });
    const $    = cheerio.load(html);
    const tables = [];
    $("table").each((i, table) => {
      const rows = [];
      $(table).find("tr").each((_, row) => {
        rows.push($(row).find("td,th").map((_,c)=>$(c).text().trim()).get());
      });
      tables.push({ tableIndex:i, rows: rows.slice(0,8) });
    });
    res.json({ clubId, tableCount:$("table").length, tables });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Recherche joueur ─────────────────────────────────────────
app.get("/api/player/search", async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error:"Paramètre name requis" });
  try {
    const html = await postAFTT("/ranking/search.php", { name });
    const $    = cheerio.load(html);
    const results = [];
    $("table tr").each((i, row) => {
      if (i === 0) return;
      const cells = $(row).find("td").map((_,c)=>$(c).text().trim()).get();
      if (cells.length >= 3 && cells[1]?.length > 2)
        results.push({ pos:cells[0], name:cells[1], club:cells[2], ranking:cells[3], points:cells[4] });
    });
    res.json({ query:name, results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Santé ────────────────────────────────────────────────────
app.get("/", (_, res) => {
  res.json({ name:"AFTT Proxy API", version:"1.1.0", club:"RCTT Heppignies (H136)",
    routes:["GET /api/club/:clubId/teams","GET /api/club/:clubId/players",
      "GET /api/player/search?name=...","GET /api/debug/:clubId/teams","GET /api/debug/:clubId/players"],
    example:"/api/club/H136/teams" });
});

app.listen(PORT, () => console.log(`✅ AFTT Proxy v1.1 démarré sur le port ${PORT}`));
