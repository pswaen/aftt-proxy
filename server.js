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
  "Referer": "https://data.aftt.be/",
};

// ── POST vers AFTT ─────────────────────────────────────────────
async function fetchAFTT(path, body) {
  const params = new URLSearchParams(body);
  return axios.post(`${AFTT_BASE}${path}`, params.toString(), {
    headers: HEADERS, timeout: 15000,
  });
}

// ── GET vers AFTT ──────────────────────────────────────────────
async function getAFTT(path) {
  return axios.get(`${AFTT_BASE}${path}`, {
    headers: { ...HEADERS, "Content-Type": "text/html" },
    timeout: 15000,
  });
}

// ── Parse toutes les tables HTML ───────────────────────────────
function parseTables(html) {
  const tables = [];
  const tableMatches = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)];
  for (const tableMatch of tableMatches) {
    const rows = [];
    const rowMatches = [...tableMatch[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const row of rowMatches) {
      const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map(c => c[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g,"&").replace(/&#\d+;/g,"").trim());
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 1) tables.push(rows);
  }
  return tables;
}

// ── Santé ──────────────────────────────────────────────────────
app.get("/", (_, res) => {
  res.json({
    name: "AFTT Proxy API", version: "3.3.0",
    club: "RCTT Heppignies (H136)", engine: "axios POST",
    routes: [
      "GET /api/club/:clubId/teams",
      "GET /api/club/:clubId/players",
      "GET /api/club/:clubId/matches",
      "GET /api/debug/raw?club=H136&semaine=17",
    ],
  });
});

// ── Équipes — classements interclubs ───────────────────────────
app.get("/api/club/:clubId/teams", async (req, res) => {
  const { clubId } = req.params;
  const semaine = req.query.semaine || "17";
  try {
    const r = await fetchAFTT("/interclubs/rankings.php", { indice: clubId, semaine });
    const tables = parseTables(r.data);
    const standings = [];

    for (const table of tables) {
      const header = table[0];
      // Tableau de classement : header contient "Équipe"
      if (!header || !header.some(h => h === "Équipe" || h === "Equipe")) continue;

      const rows = table.slice(1).filter(cells =>
        cells.length >= 7 && /^\d+$/.test(cells[0])
      );
      if (rows.length === 0) continue;

      const isClubDivision = rows.some(c =>
        c[1] && c[1].toLowerCase().includes("heppignies")
      );

      standings.push({
        division: "",
        isClubDivision,
        rows: rows.map(cells => ({
          rank:    parseInt(cells[0]),
          name:    cells[1].trim(),
          played:  parseInt(cells[2]) || 0,
          won:     parseInt(cells[3]) || 0,
          lost:    parseInt(cells[4]) || 0,
          drawn:   parseInt(cells[5]) || 0,
          ff:      parseInt(cells[6]) || 0,
          points:  parseInt(cells[7]) || 0,
          isOurTeam: cells[1].toLowerCase().includes("heppignies"),
        })),
      });
    }

    res.json({ clubId, semaine, standings, source: "axios-post" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Résultats des matchs ────────────────────────────────────────
app.get("/api/club/:clubId/matches", async (req, res) => {
  const { clubId } = req.params;
  const semaine = req.query.semaine || "17";
  try {
    const r = await fetchAFTT("/interclubs/rankings.php", { indice: clubId, semaine });
    const tables = parseTables(r.data);
    const matchGroups = [];

    for (const table of tables) {
      const header = table[0];
      if (!header || !header.some(h => h === "Domicile")) continue;

      const rows = table.slice(1).filter(cells => cells.length >= 3 && cells[1]);
      if (rows.length === 0) continue;

      // Filtrer uniquement les matchs de Heppignies
      const ourMatches = rows.filter(cells =>
        cells[0].toLowerCase().includes("heppignies") ||
        cells[2].toLowerCase().includes("heppignies")
      );

      // Aussi garder tous les matchs pour le calendrier complet
      matchGroups.push({
        matches: rows.map(cells => {
          const parts = cells[1].split(/[-–]/);
          const homeScore = parseInt(parts[0]) || 0;
          const awayScore = parseInt(parts[1]) || 0;
          const isOurMatch =
            cells[0].toLowerCase().includes("heppignies") ||
            cells[2].toLowerCase().includes("heppignies");
          return {
            home: cells[0].trim(),
            score: cells[1].trim(),
            away: cells[2].trim(),
            homeScore,
            awayScore,
            isOurMatch,
          };
        }),
      });
    }

    res.json({ clubId, semaine, matchGroups, source: "axios-post" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Joueurs ────────────────────────────────────────────────────
// Essaie plusieurs méthodes pour trouver les joueurs du club
app.get("/api/club/:clubId/players", async (req, res) => {
  const { clubId } = req.params;

  // Méthode 1 : POST avec paramètre "indice"
  const tryMethods = [
    () => fetchAFTT("/ranking/clubs.php", { indice: clubId }),
    () => fetchAFTT("/ranking/clubs.php", { club: clubId }),
    () => getAFTT(`/ranking/clubs.php?club=${clubId}`),
    () => getAFTT(`/ranking/clubs.php?indice=${clubId}`),
  ];

  for (const method of tryMethods) {
    try {
      const r = await method();
      const tables = parseTables(r.data);
      const players = [];
      const seen = new Set();

      for (const table of tables) {
        for (const cells of table) {
          if (
            cells.length >= 3 &&
            cells[1] && cells[1].length > 2 &&
            !seen.has(cells[1]) &&
            !/^(pos|nom|clt|points|#|rang|joueur|name)/i.test(cells[1]) &&
            /^\d+$/.test(String(cells[0]).trim())
          ) {
            seen.add(cells[1]);
            players.push({
              pos: parseInt(cells[0]),
              name: cells[1].trim(),
              ranking: cells[2].trim(),
              points: parseFloat(String(cells[3] || "0").replace(",", ".")) || 0,
            });
          }
        }
      }

      if (players.length > 0) {
        return res.json({ clubId, players, tableCount: tables.length, source: "axios" });
      }
    } catch (_) {
      // essayer méthode suivante
    }
  }

  // Aucune méthode n'a fonctionné
  res.status(404).json({
    error: "Aucun joueur trouvé — la page ranking/clubs.php nécessite peut-être une session",
    clubId,
    suggestion: "Les joueurs seront affichés en mode démo dans l'app",
  });
});

// ── Debug raw ──────────────────────────────────────────────────
app.get("/api/debug/raw", async (req, res) => {
  const clubId  = req.query.club    || "H136";
  const semaine = req.query.semaine || "17";
  try {
    const r = await fetchAFTT("/interclubs/rankings.php", { indice: clubId, semaine });
    const tables = parseTables(r.data);
    res.json({
      clubId, semaine, status: r.status,
      tableCount: tables.length,
      tables: tables.slice(0, 6),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ AFTT Proxy v3.3 (axios POST) démarré sur le port ${PORT}`));
