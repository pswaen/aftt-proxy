const express = require("express");
const axios   = require("axios");
const cheerio = require("cheerio");
const cors    = require("cors");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const AFTT_BASE = "https://data.aftt.be";

// ── Helpers ──────────────────────────────────────────────────
function resultLabel(homeScore, awayScore, clubTeamIsHome) {
  if (homeScore === awayScore) return "N";
  const homeWon = homeScore > awayScore;
  return (clubTeamIsHome ? homeWon : !homeWon) ? "V" : "D";
}

async function fetchAFTT(path) {
  const res = await axios.get(AFTT_BASE + path, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; RCTT-App/1.0)",
      "Accept-Language": "fr-FR,fr;q=0.9",
    },
    timeout: 10000,
  });
  return res.data;
}

// ── Route : infos club + équipes interclubs ───────────────────
// GET /api/club/:clubId/teams
app.get("/api/club/:clubId/teams", async (req, res) => {
  const { clubId } = req.params;
  try {
    const html = await fetchAFTT(`/interclubs/rankings.php?club=${clubId}`);
    const $    = cheerio.load(html);
    const teams = [];

    $("table").each((_, table) => {
      $(table).find("tr").each((i, row) => {
        if (i === 0) return; // header
        const cells = $(row).find("td").map((_, c) => $(c).text().trim()).get();
        if (cells.length >= 7) {
          const [name, division, rankStr, playedStr, wonStr, drawnStr, lostStr, ptsStr] = cells;
          const played = parseInt(playedStr) || 0;
          const won    = parseInt(wonStr)    || 0;
          const drawn  = parseInt(drawnStr)  || 0;
          const lost   = parseInt(lostStr)   || 0;
          const points = parseInt(ptsStr)    || 0;
          const rank   = parseInt(rankStr)   || (teams.length + 1);
          if (name && name.length > 1) {
            teams.push({ name, division, rank, played, won, drawn, lost, points });
          }
        }
      });
    });

    if (teams.length === 0) {
      return res.status(404).json({ error: "Aucune équipe trouvée pour ce club", clubId });
    }
    res.json({ clubId, teams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Route : joueurs du club (classement numérique) ────────────
// GET /api/club/:clubId/players
app.get("/api/club/:clubId/players", async (req, res) => {
  const { clubId } = req.params;
  try {
    const html = await fetchAFTT(`/ranking/clubs.php?club=${clubId}`);
    const $    = cheerio.load(html);
    const players = [];

    $("table").each((_, table) => {
      $(table).find("tr").each((i, row) => {
        if (i === 0) return;
        const cells = $(row).find("td").map((_, c) => $(c).text().trim()).get();
        if (cells.length >= 3) {
          const pos     = cells[0];
          const name    = cells[1];
          const ranking = cells[2];
          const points  = parseFloat(cells[3]?.replace(",", ".")) || 0;
          const posN    = cells[4] || pos;
          if (name && name.length > 2 && !/^pos/i.test(name)) {
            players.push({ pos, name, ranking, points, posN });
          }
        }
      });
    });

    res.json({ clubId, players });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Route : résultats interclubs par division ─────────────────
// GET /api/division/:divisionId/results
app.get("/api/division/:divisionId/results", async (req, res) => {
  const { divisionId } = req.params;
  try {
    const html = await fetchAFTT(`/interclubs/rankings_division.php?division=${divisionId}`);
    const $    = cheerio.load(html);
    const matches = [];

    $("table").each((_, table) => {
      $(table).find("tr").each((i, row) => {
        if (i === 0) return;
        const cells = $(row).find("td").map((_, c) => $(c).text().trim()).get();
        if (cells.length >= 5) {
          const [week, date, home, score, away] = cells;
          const parts = score?.split("-").map(s => parseInt(s.trim()));
          if (parts?.length === 2 && !isNaN(parts[0])) {
            matches.push({
              week, date, home, away,
              homeScore: parts[0], awayScore: parts[1],
            });
          }
        }
      });
    });

    res.json({ divisionId, matches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Route : recherche joueur par nom ─────────────────────────
// GET /api/player/search?name=dupont
app.get("/api/player/search", async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "Paramètre name requis" });
  try {
    const html = await fetchAFTT(`/ranking/search.php?name=${encodeURIComponent(name)}`);
    const $    = cheerio.load(html);
    const results = [];

    $("table tr").each((i, row) => {
      if (i === 0) return;
      const cells = $(row).find("td").map((_, c) => $(c).text().trim()).get();
      if (cells.length >= 4) {
        const [pos, playerName, club, ranking, points] = cells;
        if (playerName && playerName.length > 2) {
          results.push({ pos, name: playerName, club, ranking, points });
        }
      }
    });

    res.json({ query: name, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Route : classement complet d'une division ────────────────
// GET /api/division/:divisionId/standings
app.get("/api/division/:divisionId/standings", async (req, res) => {
  const { divisionId } = req.params;
  try {
    const html = await fetchAFTT(`/interclubs/rankings_division.php?division=${divisionId}`);
    const $    = cheerio.load(html);
    const standings = [];

    $("table").first().find("tr").each((i, row) => {
      if (i === 0) return;
      const cells = $(row).find("td").map((_, c) => $(c).text().trim()).get();
      if (cells.length >= 6) {
        const [rank, team, played, won, drawn, lost, points] = cells;
        if (team && team.length > 1) {
          standings.push({
            rank:   parseInt(rank)   || i,
            team,
            played: parseInt(played) || 0,
            won:    parseInt(won)    || 0,
            drawn:  parseInt(drawn)  || 0,
            lost:   parseInt(lost)   || 0,
            points: parseInt(points) || 0,
          });
        }
      }
    });

    res.json({ divisionId, standings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Route santé ───────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    name:    "AFTT Proxy API",
    version: "1.0.0",
    club:    "RCTT Heppignies (H136)",
    routes: [
      "GET /api/club/:clubId/teams",
      "GET /api/club/:clubId/players",
      "GET /api/player/search?name=...",
      "GET /api/division/:divisionId/results",
      "GET /api/division/:divisionId/standings",
    ],
    example: "/api/club/H136/teams",
  });
});

app.listen(PORT, () => {
  console.log(`✅ AFTT Proxy démarré sur le port ${PORT}`);
});
