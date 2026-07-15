import { debounce, buildCacheKey, formatRelativeTime } from "./utils.js";

const PAGE_SIZE = 9;
const SEARCH_DEBOUNCE_MS = 350;

const state = {
    query: "",
    category: "",
    page: 1,
    totalResults: 0,
};

// Cache fetched pages so re-visiting a query/category/page combo is instant
// and doesn't burn against NewsAPI's daily request quota.
const cache = new Map();
let activeController = null;

const newsContainer = document.getElementById("news-container");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const chipRow = document.getElementById("category-chips");
const resultsMeta = document.getElementById("results-meta");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const pageIndicator = document.getElementById("page-indicator");

function renderSkeleton(count = PAGE_SIZE) {
    newsContainer.innerHTML = Array.from({ length: count })
        .map(
            () => `
                <div class="skeleton-card">
                    <div class="skeleton-block skeleton-image"></div>
                    <div class="skeleton-body">
                        <div class="skeleton-block skeleton-line w-80"></div>
                        <div class="skeleton-block skeleton-line w-100"></div>
                        <div class="skeleton-block skeleton-line w-60"></div>
                    </div>
                </div>
            `
        )
        .join("");
}

function renderState(message, isError = false) {
    newsContainer.innerHTML = `
        <div class="state-panel ${isError ? "is-error" : ""}">${message}</div>
    `;
}

function renderMeta() {
    if (!state.totalResults) {
        resultsMeta.textContent = "";
        return;
    }

    const start = (state.page - 1) * PAGE_SIZE + 1;
    const end = Math.min(state.page * PAGE_SIZE, state.totalResults);
    resultsMeta.innerHTML = `showing <span class="accent">${start}&ndash;${end}</span> of <span class="accent">${state.totalResults.toLocaleString()}</span> results`;
}

function renderPagination() {
    pageIndicator.textContent = `Page ${state.page}`;
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page * PAGE_SIZE >= state.totalResults;
}

function displayNews(articles) {
    if (!articles.length) {
        renderState("no results found for this query.");
        return;
    }

    newsContainer.innerHTML = articles
        .map((article) => {
            const image = article.urlToImage
                ? `<img src="${article.urlToImage}" alt="" loading="lazy" onerror="this.closest('.card-image-wrap').innerHTML='<div class=\\'card-image-fallback\\'>NO IMAGE</div>'">`
                : `<div class="card-image-fallback">NO IMAGE</div>`;

            const source = article.source?.name || "unknown source";
            const time = formatRelativeTime(article.publishedAt);

            return `
                <article class="card">
                    <div class="card-image-wrap">
                        ${image}
                        <span class="card-source">${source}</span>
                    </div>
                    <div class="card-body">
                        <h2 class="card-title">${article.title}</h2>
                        <p class="card-text">${article.description || ""}</p>
                        <p class="card-meta">${time}</p>
                        <a class="card-link" href="${article.url}" target="_blank" rel="noopener noreferrer">
                            read full story &rarr;
                        </a>
                    </div>
                </article>
            `;
        })
        .join("");
}

async function fetchNews() {
    const { query, category, page } = state;
    const key = buildCacheKey(query, category, page);

    if (activeController) {
        activeController.abort();
    }

    if (cache.has(key)) {
        const cached = cache.get(key);
        state.totalResults = cached.totalResults;
        displayNews(cached.articles);
        renderMeta();
        renderPagination();
        return;
    }

    renderSkeleton();
    resultsMeta.textContent = "";

    activeController = new AbortController();

    let url = `/api/news?pageSize=${PAGE_SIZE}&page=${page}`;
    if (query) url += `&q=${encodeURIComponent(query)}`;
    if (category) url += `&category=${category}`;

    try {
        const response = await fetch(url, { signal: activeController.signal });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "unable to reach the news feed.");
        }

        cache.set(key, { articles: data.articles, totalResults: data.totalResults });
        state.totalResults = data.totalResults;

        displayNews(data.articles);
        renderMeta();
        renderPagination();
    } catch (error) {
        if (error.name === "AbortError") return;
        renderState(`error: ${error.message}`, true);
        resultsMeta.textContent = "";
    }
}

function runSearch() {
    state.query = searchInput.value.trim();
    state.page = 1;
    fetchNews();
}

const debouncedSearch = debounce(runSearch, SEARCH_DEBOUNCE_MS);

searchInput.addEventListener("input", debouncedSearch);
searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        runSearch();
    }
});
searchBtn.addEventListener("click", runSearch);

chipRow.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;

    chipRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");

    state.category = chip.dataset.category;
    state.page = 1;
    fetchNews();
});

prevBtn.addEventListener("click", () => {
    if (state.page > 1) {
        state.page--;
        fetchNews();
    }
});

nextBtn.addEventListener("click", () => {
    if (state.page * PAGE_SIZE < state.totalResults) {
        state.page++;
        fetchNews();
    }
});

fetchNews();
