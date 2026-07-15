import { test, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./index.js";

function fakeNewsApiResponse({ articles = [{ title: "Test Article" }], totalResults = 1 } = {}) {
    return {
        ok: true,
        status: 200,
        json: async () => ({ status: "ok", totalResults, articles }),
    };
}

describe("GET /api/health", () => {
    test("responds ok without needing an API key", async () => {
        const app = createApp({ apiKey: null });
        const res = await request(app).get("/api/health");

        assert.equal(res.status, 200);
        assert.deepEqual(res.body, { status: "ok" });
    });
});

describe("GET /api/news", () => {
    test("returns 500 if the server has no API key configured", async () => {
        const app = createApp({ apiKey: null, fetchImpl: async () => fakeNewsApiResponse() });
        const res = await request(app).get("/api/news");

        assert.equal(res.status, 500);
        assert.match(res.body.error, /NEWS_API_KEY/);
    });

    test("forwards query, category, and pagination params to NewsAPI", async () => {
        let capturedUrl;
        const fetchImpl = async (url) => {
            capturedUrl = url;
            return fakeNewsApiResponse();
        };
        const app = createApp({ apiKey: "test-key", fetchImpl });

        const res = await request(app).get("/api/news").query({
            q: "bitcoin",
            category: "business",
            page: "2",
            pageSize: "5",
        });

        assert.equal(res.status, 200);
        const forwarded = new URL(capturedUrl.toString());
        assert.equal(forwarded.searchParams.get("q"), "bitcoin");
        assert.equal(forwarded.searchParams.get("category"), "business");
        assert.equal(forwarded.searchParams.get("page"), "2");
        assert.equal(forwarded.searchParams.get("pageSize"), "5");
        assert.equal(forwarded.searchParams.get("apiKey"), "test-key");
    });

    test("returns the articles and totalResults from NewsAPI on success", async () => {
        const articles = [{ title: "Headline One" }, { title: "Headline Two" }];
        const app = createApp({
            apiKey: "test-key",
            fetchImpl: async () => fakeNewsApiResponse({ articles, totalResults: 42 }),
        });

        const res = await request(app).get("/api/news");

        assert.equal(res.status, 200);
        assert.equal(res.body.totalResults, 42);
        assert.deepEqual(res.body.articles, articles);
    });

    test("propagates an error when NewsAPI itself reports failure", async () => {
        const app = createApp({
            apiKey: "bad-key",
            fetchImpl: async () => ({
                ok: false,
                status: 401,
                json: async () => ({ status: "error", message: "Invalid API key." }),
            }),
        });

        const res = await request(app).get("/api/news");

        assert.equal(res.status, 401);
        assert.equal(res.body.error, "Invalid API key.");
    });

    test("returns 502 when the upstream request fails outright", async () => {
        const app = createApp({
            apiKey: "test-key",
            fetchImpl: async () => {
                throw new Error("network down");
            },
        });

        const res = await request(app).get("/api/news");

        assert.equal(res.status, 502);
        assert.match(res.body.error, /Failed to reach NewsAPI/);
    });

    test("caches identical requests instead of hitting NewsAPI twice", async () => {
        let callCount = 0;
        const fetchImpl = async () => {
            callCount++;
            return fakeNewsApiResponse();
        };
        const app = createApp({ apiKey: "test-key", fetchImpl });

        await request(app).get("/api/news").query({ category: "technology" });
        await request(app).get("/api/news").query({ category: "technology" });

        assert.equal(callCount, 1);
    });

    test("treats different query params as separate cache entries", async () => {
        let callCount = 0;
        const fetchImpl = async () => {
            callCount++;
            return fakeNewsApiResponse();
        };
        const app = createApp({ apiKey: "test-key", fetchImpl });

        await request(app).get("/api/news").query({ category: "technology" });
        await request(app).get("/api/news").query({ category: "sports" });

        assert.equal(callCount, 2);
    });
});
