# HAR File Analyzer

A web-based tool for inspecting and analyzing HTTP Archive (HAR) files. Load a HAR file and instantly explore network activity through multiple views — waterfall charts, performance metrics, security analysis, and more.

Built with **Angular 21** and **Angular Material**.

---

## Features

### Summary
Stat cards showing total requests, transfer size, total time, failed requests, and page count. Two donut charts break down requests and transfer size by content type (HTML, JS, CSS, Images, Fonts, XHR, Other).

### Waterfall
Timeline chart of all requests with phase-level color coding (Blocked, DNS, Connect, SSL, Send, Wait, Receive). Each row shows the domain and path with a full-URL tooltip. Sticky time axis with tick marks.

### Performance
Configurable slow-request threshold with a list of requests that exceed it. Duplicate request detection grouped by method + URL (query strings stripped).

### Security
Automated checks across all responses:
- Missing security headers (CSP, HSTS, X-Frame-Options, etc.)
- Insecure cookies (missing Secure / HttpOnly / SameSite flags)
- Mixed content (HTTP resources on HTTPS pages)
- Sensitive data in URLs (tokens, passwords, session IDs)
- Deprecated headers

Findings are severity-ranked (High / Medium / Low / Info) with recommendations.

### Requests
Filterable, sortable, paginated table of all requests. Filter by keyword, HTTP method, status code range, and content type. Click any row to open the inspector panel.

### Request Inspector
Side panel showing full details for the selected request:
- Overview (URL, method, status, timing)
- Request & response headers
- Request & response cookies
- Request body (POST data)
- Response body (pretty-printed for JSON)
- Timing breakdown

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Install & run

```bash
npm install
npx ng serve
```

Open `http://localhost:4200` in your browser.

### Build

```bash
npx ng build
```

Output goes to `dist/har-analyzer/`.

---

## How to get a HAR file

**Chrome / Edge:**
1. Open DevTools → Network tab
2. Reproduce the requests you want to capture
3. Right-click anywhere in the request list → **Save all as HAR with content**

**Firefox:**
1. Open DevTools → Network tab
2. Click the gear icon → **Save All as HAR**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Angular 21 (standalone components, signals) |
| UI | Angular Material v21 (M3 theme) |
| Charts | Pure SVG (no external charting library) |
| Styling | SCSS |
| Build | Angular CLI / Vite |
| Tests | Vitest |

---

## License

MIT
