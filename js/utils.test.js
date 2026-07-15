import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { debounce, buildCacheKey, formatRelativeTime } from "./utils.js";

describe("buildCacheKey", () => {
    test("combines query, category, and page into a stable key", () => {
        assert.equal(buildCacheKey("bitcoin", "business", 2), "bitcoin::business::2");
    });

    test("produces different keys for different inputs", () => {
        const a = buildCacheKey("bitcoin", "business", 1);
        const b = buildCacheKey("bitcoin", "sports", 1);
        assert.notEqual(a, b);
    });
});

describe("formatRelativeTime", () => {
    const now = new Date("2026-07-15T12:00:00Z").getTime();

    test("returns an empty string when no date is given", () => {
        assert.equal(formatRelativeTime(undefined, now), "");
        assert.equal(formatRelativeTime("", now), "");
    });

    test("formats minutes for recent timestamps", () => {
        const tenMinutesAgo = new Date(now - 10 * 60000).toISOString();
        assert.equal(formatRelativeTime(tenMinutesAgo, now), "10 minutes ago");
    });

    test("formats hours once past 60 minutes", () => {
        const threeHoursAgo = new Date(now - 3 * 60 * 60000).toISOString();
        assert.equal(formatRelativeTime(threeHoursAgo, now), "3 hours ago");
    });

    test("formats days once past 24 hours", () => {
        const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60000).toISOString();
        assert.equal(formatRelativeTime(twoDaysAgo, now), "2 days ago");
    });
});

describe("debounce", () => {
    test("only invokes the wrapped function once after rapid calls", (t) => {
        t.mock.timers.enable({ apis: ["setTimeout"] });

        let callCount = 0;
        let lastArg;
        const debounced = debounce((value) => {
            callCount++;
            lastArg = value;
        }, 300);

        debounced("first");
        debounced("second");
        debounced("third");

        assert.equal(callCount, 0);

        t.mock.timers.tick(300);

        assert.equal(callCount, 1);
        assert.equal(lastArg, "third");
    });
});
