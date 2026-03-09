const express = require("express");
const cors    = require("cors");
const axios   = require("axios");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const AFTT_BASE = "https://data.aftt.be";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-BE,fr;q=0.9,en;q=0.8",
  "Referer": "https://data.aftt.be/",
};

// ── Santé ──────────────────────────────────────────────────────
app.get("/", (_, res) => {
  res.json({
    name: "AFTT Proxy API", version: "3.0.0",
    club: "RCTT Heppignies (H136)", engine: "axios",
    routes: [
      "GET /api/club/:clubId/teams",
      "GET /api/club/:clubId/players",
      "GET /api/debug/raw?url=...",
    ],
  });
});

// ── Parse HTML tables ──────────────────────────────────────────
function parseTables(html) {
  const tables = [];
  const tableMatches = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)];
  for (const tableMatch of tableMatches) {
    const rows = [];
    const rowMatches = [...tableMatch[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const row of rowMatches) {
      const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map(c => c[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim());
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 0) tables.push(rows);
  }
  return tables;
}

// ── Équipes ────────────────────────────────────────────────────
app.get("/api/club/:clubId/teams", async (req, res) => {
  const { clubId } = req.params;
  try {
    const r = await axios.get(`${AFTT_BASE}/interclubs/rankings.php`, {
      params: { club: clubId },
      headers: HEADERS,
      timeout: 15000,
    });
    const tables = parseTables(r.data);
    const teams = [];
    for (const table of tables) {
      for (const cells of table) {
        if (cells.length >= 5 && cells[0] && /^\d+$/.test(cells[0])) {
          teams.push({
            rank: parseInt(cells[0]),
            name: cells[1] || "",
            played: parseInt(cells[2]) || 0,
            won: parseInt(cells[3]) || 0,
            drawn: parseInt(cells[4]) || 0,
            lost: parseInt(cells[5]) || 0,
            points: parseInt(cells[6]) || 0,
          });
        }
      }
    }
    if (teams.length === 0) {
      return res.status(404).json({
        error: "Aucune équipe trouvée — les données sont probablement chargées via JavaScript",
        clubId,
        tableCount: tables.length,
        preview: r.data.slice(0, 500),
      });
    }
    res.json({ clubId, teams, source: "axios" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Joueurs ────────────────────────────────────────────────────
app.get("/api/club/:clubId/players", async (req, res) => {
  const { clubId } = req.params;
  try {
    const r = await axios.get(`${AFTT_BASE}/ranking/clubs.php`, {
      params: { club: clubId },
      headers: HEADERS,
      timeout: 15000,
    });
    const tables = parseTables(r.data);
    const players = [];
    const seen = new Set();
    for (const table of tables) {
      for (const cells of table) {
        if (cells.length >= 3 && cells[1] && cells[1].length > 2 && !seen.has(cells[1])
            && !/^(pos|nom|clt|points|#)/i.test(cells[1])) {
          seen.add(cells[1]);
          players.push({ pos: cells[0], name: cells[1], ranking: cells[2], points: cells[3] || "0" });
        }
      }
    }
    if (players.length === 0) {
      return res.status(404).json({
        error: "Aucun joueur trouvé",
        clubId,
        tableCount: tables.length,
        preview: r.data.slice(0, 500),
      });
    }
    res.json({ clubId, players, source: "axios" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Debug raw ──────────────────────────────────────────────────
app.get("/api/debug/raw", async (req, res) => {
  const url = req.query.url || `${AFTT_BASE}/interclubs/rankings.php`;
  try {
    const r = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const tables = parseTables(r.data);
    res.json({ url, status: r.status, tableCount: tables.length, tables: tables.slice(0, 3), preview: r.data.slice(0, 1000) });
  } catch (err) {
    res.status(500).json({ error: err.message, url });
  }
});

app.listen(PORT, () => console.log(`✅ AFTT Proxy v3.0 (axios) démarré sur le port ${PORT}`));
