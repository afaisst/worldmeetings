# worldmeetings
An app to schedule meetings easily across the globe.

**World Meetings** is a small static web app (plain HTML/CSS/JavaScript, no build step, no dependencies) for finding a meeting time that works across time zones.

## Features

- **Calendar** (top left): pick a day. The day is interpreted in your *home* time zone (marked with the house icon; your own zone by default).
- **Time zones** (left): add zones by searching a city, country or IANA zone name (`+ Add Time Zone`), remove them with `−`, and drag the `⠿` handle (or focus it and press ↑/↓) to reorder. The order is the row order of the time grid. Click the house icon to make another zone the home zone. Uncheck a zone's checkbox to exclude it from the grid, suggestions and email text without removing it (the home zone is always included).
- **Time grid** (right): one row per time zone, one column per hour of the selected day.
  - green: working hours (9am – 6pm)
  - medium green: late afternoon (6 – 8pm)
  - light green: morning / evening (7 – 9am, 8 – 11pm)
  - gray: night (before 7am, from 11pm)
- **Sort times**: *Chronological* or *Best first* (fewest people at night, then the best overall fit).
- **Suggested times** (below the grid): the top three times for everyone. If no single time falls in everyone's daytime (9am – 8pm), it splits the group into separate meetings (usually two, e.g. *Pacific + Tokyo + Hawaii* and *Pacific + Eastern + Europe*), each with its top three times. Your home zone is in every meeting. If one meeting would work with some people joining early or late (7 – 9am, 8 – 11pm), that is shown as an alternative. Clicking a suggestion opens the email text for just that meeting's time zones. When several meetings are needed, **Copy best suggestions** opens one text with the best time of each meeting ("No single time works well for every time zone, so let's have two meetings: …").
- **Click any time** to open a dialog with ready-to-paste email text ("Let's meet on: …") listing the time in every zone, with an optional duration and UTC offsets. Click **Copy**.
- 12h / 24h toggle; settings are remembered in your browser (localStorage).
- **Public holidays**: national public holidays of each time zone's country are marked in the grid (date struck through, red stripes when excluded) and with a red dot in the calendar; the header lists them. **Holidays: Exclude** (default) never suggests a time that falls on someone's holiday and ranks those times last; **Include** only marks them. Email text notes holidays. Data: `data/holidays/` (2025–2035, from the [date-holidays](https://github.com/commenthol/date-holidays) package; national holidays only, not state/canton ones). Regenerate with `cd tools && npm install date-holidays && node build-holidays.js`.
- **Weekends**: weekend days of each zone's country (Saturday–Sunday; Friday–Saturday in e.g. Israel, Saudi Arabia, Egypt) are shown as dark gray tiles. **Weekends: Exclude** (default) never suggests weekend times; **Include** keeps the normal colors with a dark bar under weekend tiles. Both switches sit in the top bar and are included in Share links.
- **Share**: copies a link with the selected date, the time zones (order, names, checked/unchecked), the home zone and the sort mode. Whoever opens it sees the same view; their own saved list is replaced, with an *Undo* button. The selected date is also kept in the address (`#2026-12-16`), so a refresh stays on that day.

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
js/suggest.js     suggested times / splitting into several meetings
js/holidays.js    loads holiday data per country on demand
js/zone-countries.js  time zone -> country code
data/holidays/    national public holidays per country (generated)
tools/            build-holidays.js (regenerates data/holidays)
js/app.js         UI: calendar, zone list, grid, sorting, suggestions, email dialog
tests/            correctness check against Python zoneinfo
```
