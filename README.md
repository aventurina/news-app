# News // Terminal

A real-time news dashboard built with vanilla JavaScript, a small Express API proxy, and the [NewsAPI](https://newsapi.org/) top-headlines endpoint. Live search, category filtering, and paginated results with a custom dark UI — no frontend framework, no component library.

## Features

- Live headlines pulled from NewsAPI on load
- Debounced live search (fires as you type, no submit required)
- Category filtering (Business, Entertainment, Health, Science, Sports, Technology)
- In-flight request cancellation via `AbortController` — typing quickly never lets a stale response overwrite a newer one
- Response caching on both the client (per query/category/page) and the server, to stay well under NewsAPI's rate limit
- Result count and page indicator driven off the API's real `totalResults`, so pagination controls disable correctly at the start/end
- Skeleton loading states, and distinct empty/error states for the fetch cycle
- Graceful fallback for articles with no image
- Fully custom responsive UI (CSS Grid/Flexbox, no component framework)

## Tech stack

**Frontend**
- JavaScript (ES2017+, async/await, Fetch API, `AbortController`, `Intl.RelativeTimeFormat`)
- Hand-written CSS (custom properties, CSS Grid, no framework)
- [Parcel](https://parceljs.org/) for bundling and the dev server, proxying `/api` to the backend in development

**Backend**
- Node.js + Express — proxies `/api/news` to NewsAPI server-side, so the API key never ships to the browser and requests to NewsAPI always originate from the server (NewsAPI's free tier blocks direct browser calls from anywhere but localhost)
- In-memory response caching to reduce upstream calls

## Getting started

**Prerequisites:** Node.js and a free API key from [newsapi.org](https://newsapi.org/register).

```bash
git clone https://github.com/aventurina/news-app.git
cd news-app
npm install
```

Create a `.env` file in the project root:

```
NEWS_API_KEY=your_newsapi_key_here
```

Then run both the API server and the frontend dev server together:

```bash
npm start
```

This opens the app at `http://localhost:1234`, with `/api/*` requests proxied to the Express server on port `4002`.

## Deployment

In production, run `npm run build` to generate `dist/`, then start the server with `npm run server` (or `node server/index.js`) — Express serves the built frontend and the `/api/news` proxy from the same origin and the same port, so there's no CORS configuration and no separate frontend host to stand up. Set `NEWS_API_KEY` and (optionally) `PORT` as environment variables on whatever platform hosts it.

## Project structure

```
index.html         Markup and layout
css/style.css       Custom dark theme (variables, grid background, cards, skeletons)
js/scripts.js       Fetch logic, caching, cancellation, search/filter/pagination, rendering
server/index.js     Express proxy: calls NewsAPI server-side, caches responses, serves the build
package.json        Scripts and dependencies for both frontend and backend
```
