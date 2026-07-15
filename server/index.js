require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_URL = "https://newsapi.org/v2/top-headlines";
const CACHE_TTL_MS = 5 * 60 * 1000;

const app = express();
app.use(cors());

// Cache upstream responses server-side too, so multiple visitors querying the
// same headlines don't each burn a separate call against NewsAPI's rate limit.
const cache = new Map();

app.get("/api/news", async (req, res) => {
    if (!NEWS_API_KEY) {
        return res.status(500).json({ error: "Server is missing NEWS_API_KEY." });
    }

    const q = (req.query.q || "").toString();
    const category = (req.query.category || "").toString();
    const page = (req.query.page || "1").toString();
    const pageSize = (req.query.pageSize || "9").toString();

    const key = `${q}::${category}::${page}::${pageSize}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return res.json(cached.data);
    }

    const url = new URL(NEWS_API_URL);
    url.searchParams.set("country", "us");
    url.searchParams.set("pageSize", pageSize);
    url.searchParams.set("page", page);
    if (q) url.searchParams.set("q", q);
    if (category) url.searchParams.set("category", category);
    url.searchParams.set("apiKey", NEWS_API_KEY);

    try {
        const upstream = await fetch(url);
        const data = await upstream.json();

        if (data.status !== "ok") {
            return res.status(upstream.status).json({ error: data.message || "Upstream error from NewsAPI." });
        }

        cache.set(key, { data, timestamp: Date.now() });
        res.json(data);
    } catch (error) {
        res.status(502).json({ error: "Failed to reach NewsAPI." });
    }
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// In production, serve the Parcel build output from this same server so the
// frontend and /api/news share one origin (no CORS, no separate host to deploy).
const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
}

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
    console.log(`News API proxy running on http://localhost:${PORT}`);
});
