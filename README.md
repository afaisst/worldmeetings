# worldmeetings
An app to schedule meetings easily across the globe.

**World Meetings** is a small static web app (plain HTML/CSS/JavaScript, no build step, no dependencies) for finding a meeting time that works across time zones.

## Features

- **Calendar** (top left): pick a day. The day is interpreted in your *home* time zone (marked with the house icon; your own zone by default).
- **Time zones** (left): add zones by searching a city, country or IANA zone name (`+ Add Time Zone`), remove them with `−`, and drag the `⠿` handle (or focus it and press ↑/↓) to reorder. The order is the row order of the time grid. Click the house icon to make another zone the home zone.
- **Time grid** (right): one row per time zone, one column per hour of the selected day.
  - green: working hours (9am – 8pm)
  - light green: morning / evening (7 – 9am, 8 – 11pm)
  - gray: night (before 7am, from 11pm)
- **Sort times**: *Chronological* or *Best first* (fewest people at night, then most people in working hours).
- **Click any time** to open a dialog with ready-to-paste email text ("Let's meet on: …") listing the time in every zone, with an optional duration and UTC offsets. Click **Copy**.
- 12h / 24h toggle; settings are remembered in your browser (localStorage).

## Correctness

All conversions use the browser's built-in `Intl` API, i.e. the IANA time-zone database that ships with the browser — no offsets are hard-coded. Daylight-saving changes are handled: on a day when clocks change in the home zone the grid shows 23 or 25 hours, and cells after a change show the new abbreviation (e.g. `PST`). Half- and quarter-hour zones (India, Nepal, Newfoundland, …) are supported.

The time math in `js/tz.js` was checked against Python's `zoneinfo` for every day of 2026–2027 across 22 zones, including all DST transition days (≈8.5 million comparisons, 0 differences). To rerun a lighter version:

```bash
node tests/gen.js /tmp/out.json && python3 tests/check.py /tmp/out.json
```

## Run locally

Open `index.html` in a browser — that's it (no server needed).

## Host on GitHub Pages

1. Push this repository to GitHub.
2. In the repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, choose `main` and `/ (root)`, save.
3. After a minute the app is live at `https://<your-user>.github.io/worldmeetings/`.

## Files

```
index.html        page layout
css/style.css     styles (light & dark mode)
js/tz.js          time-zone math (DST-safe conversions, colors, formatting)
js/cities.js      searchable city list + all IANA zones
js/app.js         UI: calendar, zone list, grid, sorting, email dialog
tests/            correctness check against Python zoneinfo
```
