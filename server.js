const express    = require("express");
const puppeteer  = require("puppeteer");
const cors       = require("cors");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const AFTT = "https://data.aftt.be";

// ── Lance un navigateur headless, sélectionne le club et récupère le HTML ──
async function scrapeClub(page, clubId) {
  await page.goto(`${AFTT}/interclubs/rankings.php`, {
    waitUntil: "networkidle2", timeout: 30000,
  });

  // Sélectionner le club dans le <select>
  await page.select("select[name='club']", clubId);

  // Attendre que le tableau se charge (ou 5 s max)
  try {
    await page.waitForSelector("table tbody tr", { timeout: 8000 });
  } catch (_) { /* pas de tableau, on retournera un tableau vide */ }

  return page.content();
}

async function scrapePlayersClub(page, clubId) {
  await page.goto(`${AFTT}/ranking/clubs.php`, {
    waitUntil: "networkidle2", timeout: 30000,
  });
  await page.select("select[name='club']", clubId);
  try {
    await page.waitForSelector("table tbody tr", { timeout: 8000 });
  } catch (_) {}
  return page.content();
}

// ── Parsers (Cheerio-like en pur JS DOM dans Puppeteer) ───────
function parseTeamsFromPage(rows) {
  const teams = [];
  for (const row of rows) {
    const cells = row.map(c => c.trim()).filter(Boolean);
    if (cells.length < 5) continue;
    let name, division, rank, played, won, drawn, lost, points;
    if (cells.length >= 8) {
      [name, division, rank, played, won, drawn, lost, points] = cells;
    } else if (cells.length >= 7) {
      [rank, name, division, played, won, drawn, lost, points] = cells;
    } else {
      [rank, name, played, won, drawn, lost, points] = cells;
      division = "";
    }
    const p = parseInt(played) || 0;
    const w = parseInt(won)    || 0;
    const d = parseInt(drawn)  || 0;
    const l = parseInt(lost)   || 0;
    const pts = parseInt(points) || (w * 2 + d);
    if (name && name.length > 1 && p > 0) {
      teams.push({ name: name.trim(), division: (division||"").trim(),
        rank: parseInt(rank)||(teams.length+1), played:p, won:w, drawn:d, lost:l, points:pts });
    }
  }
  return teams;
}

// ── Extrait les lignes de tous les tableaux via evaluate ──────
async function getTableRows(page) {
  return page.evaluate(() => {
    const result = [];
    document.querySelectorAll("table").forEach(table => {
      const tableRows = [];
      table.querySelectorAll("tr").forEach((row, i) => {
        if (i === 0) return; // skip header
        const cells = [...row.querySelectorAll("td")].map(c => c.innerText.trim());
        if (cells.length > 0) tableRows.push(cells);
      });
      if (tableRows.length > 0) result.push(tableRows);
    });
    return result;
  });
}

// ── Instance Puppeteer partagée ───────────────────────────────
let browserInstance = null;

const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }
  return browserInstance;
}

// ── Route : équipes ───────────────────────────────────────────
app.get("/api/club/:clubId/teams", async (req, res) => {
  const { clubId } = req.params;
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

    await scrapeClub(page, clubId);
    const allRows = await getTableRows(page);
    const teams = parseTeamsFromPage(allRows.flat());

    if (teams.length === 0) {
      // Retourner le texte de la page pour debug
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 600));
      return res.status(404).json({ error: "Aucune équipe trouvée", clubId, debug: bodyText });
    }
    res.json({ clubId, teams, source: "puppeteer" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

// ── Route : joueurs ───────────────────────────────────────────
app.get("/api/club/:clubId/players", async (req, res) => {
  const { clubId } = req.params;
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

    await scrapePlayersClub(page, clubId);
    const allRows = await getTableRows(page);
    const players = [];
    const seen    = new Set();

    for (const tableRows of allRows) {
      for (const cells of tableRows) {
        if (cells.length < 3) continue;
        const [pos, name, ranking] = cells;
        const points = parseFloat((cells[3]||"0").replace(",",".")) || 0;
        if (name && name.length > 2 && !seen.has(name)
            && !/^(pos|nom|clt|points)/i.test(name)) {
          seen.add(name);
          players.push({ pos, name, ranking, points });
        }
      }
    }

    if (players.length === 0) {
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 600));
      return res.status(404).json({ error: "Aucun joueur trouvé", clubId, debug: bodyText });
    }
    res.json({ clubId, players, source: "puppeteer" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

// ── Route debug : screenshot ──────────────────────────────────
app.get("/api/debug/:clubId/screenshot", async (req, res) => {
  const { clubId } = req.params;
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await scrapeClub(page, clubId);
    const screenshot = await page.screenshot({ encoding: "base64" });
    res.json({ clubId, screenshot: `data:image/png;base64,${screenshot}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

// ── Route debug : texte brut ──────────────────────────────────
app.get("/api/debug/:clubId/text", async (req, res) => {
  const { clubId } = req.params;
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await scrapeClub(page, clubId);
    const text  = await page.evaluate(() => document.body.innerText);
    const tables = await getTableRows(page);
    res.json({ clubId, textPreview: text.slice(0, 1000), tableCount: tables.length, tables });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

// ── Recherche joueur ──────────────────────────────────────────
app.get("/api/player/search", async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "Paramètre name requis" });
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.goto(`${AFTT}/ranking/search.php`, { waitUntil:"networkidle2", timeout:30000 });
    await page.type("input[name='name']", name);
    await page.keyboard.press("Enter");
    try { await page.waitForSelector("table tr", { timeout: 6000 }); } catch (_) {}
    const rows = await getTableRows(page);
    const results = rows.flat().filter(r => r.length >= 3 && r[1]?.length > 2)
      .map(cells => ({ pos:cells[0], name:cells[1], club:cells[2], ranking:cells[3], points:cells[4] }));
    res.json({ query: name, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

// ── Santé ─────────────────────────────────────────────────────
app.get("/", (_, res) => {
  res.json({
    name: "AFTT Proxy API", version: "2.0.0",
    club: "RCTT Heppignies (H136)", engine: "Puppeteer",
    routes: [
      "GET /api/club/:clubId/teams",
      "GET /api/club/:clubId/players",
      "GET /api/player/search?name=...",
      "GET /api/debug/:clubId/text",
    ],
    example: "/api/club/H136/teams",
  });
});

app.listen(PORT, () => console.log(`✅ AFTT Proxy v2.0 (Puppeteer) démarré sur le port ${PORT}`));
