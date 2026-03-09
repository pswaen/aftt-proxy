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
  "Content-Type": "application/x-www-form-urlencoded",
  "Referer": "https://data.aftt.be/interclubs/rankings.php",
};

// ── Santé ──────────────────────────────────────────────────────
app.get("/", (_, res) => {
  res.json({
    name: "AFTT Proxy API", version: "3.1.0",
    club: "RCTT Heppignies (H136)", engine: "axios POST",
    routes: [
      "GET /api/club/:clubId/teams",
      "GET /api/club/:clubId/players",
      "GET /api/debug/raw",
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
        .map(c => c[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g,"&").trim());
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 1) tables.push(rows); // skip tables with only header
  }
  return tables;
}

// ── Équipes — POST avec indice + semaine ───────────────────────
app.get("/api/club/:clubId/teams", async (req, res) => {
  const { clubId } = req.params;
  const semaine = req.query.semaine || "17";
  try {
    const params = new URLSearchParams({ indice: clubId, semaine });
    const r = await axios.post(`${AFTT_BASE}/interclubs/rankings.php`, params.toString(), {
      headers: HEADERS,
      timeout: 15000,
    });

    const tables = parseTables(r.data);
    const teams = [];

    for (const table of tables) {
      for (const cells of table) {
        // Ligne de données : commence par un rang numérique ou contient un nom d'équipe
        if (cells.length >= 4) {
          const maybeRank = parseInt(cells[0]);
          const maybeName = cells[1] || cells[0];
          if (!isNaN(maybeRank) && maybeRank > 0 && maybeName && maybeName.length > 2) {
            teams.push({
              rank: maybeRank,
              name: maybeName.trim(),
              played: parseInt(cells[2]) || 0,
              won:    parseInt(cells[3]) || 0,
              drawn:  parseInt(cells[4]) || 0,
              lost:   parseInt(cells[5]) || 0,
              points: parseInt(cells[6]) || 0,
            });
          }
        }
      }
    }

    if (teams.length === 0) {
      return res.status(404).json({
        error: "Aucune équipe trouvée",
        clubId, semaine,
        tableCount: tables.length,
        tablesPreview: tables.slice(0, 2),
        htmlPreview: r.data.slice(0, 800),
      });
    }
    res.json({ clubId, semaine, teams, source: "axios-post" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Joueurs — POST club ────────────────────────────────────────
app.get("/api/club/:clubId/players", async (req, res) => {
  const { clubId } = req.params;
  try {
    const params = new URLSearchParams({ club: clubId });
    const r = await axios.post(`${AFTT_BASE}/ranking/clubs.php`, params.toString(), {
      headers: { ...HEADERS, Referer: "https://data.aftt.be/ranking/clubs.php" },
      timeout: 15000,
    });

    const tables = parseTables(r.data);
    const players = [];
    const seen = new Set();

    for (const table of tables) {
      for (const cells of table) {
        if (cells.length >= 3 && cells[1] && cells[1].length > 2 && !seen.has(cells[1])
            && !/^(pos|nom|clt|points|#|rang)/i.test(cells[1])) {
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
        tablesPreview: tables.slice(0, 2),
      });
    }
    res.json({ clubId, players, source: "axios-post" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Debug raw POST ─────────────────────────────────────────────
app.get("/api/debug/raw", async (req, res) => {
  const clubId = req.query.club || "H136";
  const semaine = req.query.semaine || "17";
  try {
    const params = new URLSearchParams({ indice: clubId, semaine });
    const r = await axios.post(`${AFTT_BASE}/interclubs/rankings.php`, params.toString(), {
      headers: HEADERS, timeout: 15000,
    });
    const tables = parseTables(r.data);
    res.json({
      clubId, semaine,
      status: r.status,
      tableCount: tables.length,
      tables: tables.slice(0, 3),
      htmlPreview: r.data.slice(0, 1500),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ AFTT Proxy v3.1 (axios POST) démarré sur le port ${PORT}`));
