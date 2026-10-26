/*
 * tz.js — time-zone math for World Meetings.
 *
 * All conversions use the browser's built-in Intl API (the IANA time-zone
 * database that ships with the browser), so daylight-saving rules are always
 * those of the user's up-to-date browser. No offsets are hard-coded.
 *
 * Works both in the browser (window.WMTime) and in Node (module.exports),
 * which is how the test script checks it against an independent source.
 */
(function (root) {
  'use strict';

  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  /* ---------- low level ---------- */

  const partsFmtCache = new Map();
  function partsFormatter(tz) {
    let f = partsFmtCache.get(tz);
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hourCycle: 'h23',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
      });
      partsFmtCache.set(tz, f);
    }
    return f;
  }

  /** Wall-clock fields of instant `ms` (epoch milliseconds) in zone `tz`. */
  function getParts(tz, ms) {
    const out = {};
    for (const p of partsFormatter(tz).formatToParts(new Date(ms))) {
      if (p.type !== 'literal') out[p.type] = parseInt(p.value, 10);
    }
    if (out.hour === 24) out.hour = 0; // very old engines
    out.weekday = new Date(Date.UTC(out.year, out.month - 1, out.day)).getUTCDay();
    return out;
  }

  /** UTC offset of zone `tz` at instant `ms`, in minutes (e.g. -420 for PDT). */
  function offsetMinutes(tz, ms) {
    const s = Math.floor(ms / 1000) * 1000;
    const p = getParts(tz, s);
    const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((asUTC - s) / MIN);
  }

  /**
   * Instant (epoch ms) at which the wall clock in `tz` reads y-m-d h:mi.
   * - Ambiguous times (clocks set back): the earlier instant is returned.
   * - Non-existent times (clocks set forward): shifted forward by the gap,
   *   e.g. 2:30 on a US spring-forward day becomes 3:30.
   */
  function zonedToUtc(tz, y, m, d, h, mi) {
    h = h || 0; mi = mi || 0;
    const wall = Date.UTC(y, m - 1, d, h, mi);
    const offsets = new Set([
      offsetMinutes(tz, wall - DAY),
      offsetMinutes(tz, wall),
      offsetMinutes(tz, wall + DAY),
    ]);
    const valid = [];
    for (const off of offsets) {
      const t = wall - off * MIN;
      const p = getParts(tz, t);
      if (p.year === y && p.month === m && p.day === d && p.hour === h && p.minute === mi) valid.push(t);
    }
    if (valid.length) return Math.min(...valid);
    // Gap: use the offset in effect *before* the transition -> lands after it.
    return wall - offsetMinutes(tz, wall - DAY) * MIN;
  }

  function addDays(y, m, d, n) {
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }

  /** Today's calendar date in zone `tz`. */
  function todayIn(tz, nowMs) {
    const p = getParts(tz, nowMs == null ? Date.now() : nowMs);
    return { y: p.year, m: p.month, d: p.day };
  }

  /**
   * The time slots that make up calendar day y-m-d in the reference zone.
   * Returns epoch-ms instants from local midnight (inclusive) to the next
   * local midnight (exclusive). A DST day therefore has 23 or 25 hourly slots.
   */
  function daySlots(refTz, y, m, d, stepMin) {
    const step = (stepMin || 60) * MIN;
    const start = zonedToUtc(refTz, y, m, d, 0, 0);
    const n = addDays(y, m, d, 1);
    const end = zonedToUtc(refTz, n.y, n.m, n.d, 0, 0);
    const out = [];
    for (let t = start; t < end; t += step) out.push(t);
    return out;
  }

  /* ---------- classification ---------- */

  /**
   * night    : before 7:00 or from 23:00
   * shoulder : 7:00–8:59 and 20:00–22:59 (morning / evening)
   * good     : 9:00–19:59
   */
  function category(tz, ms) {
    const p = getParts(tz, ms);
    const h = p.hour + p.minute / 60;
    if (h < 7 || h >= 23) return 'night';
    if (h < 9 || h >= 20) return 'shoulder';
    return 'good';
  }
  const SCORE = { night: 0, shoulder: 1, good: 2 };

  /* ---------- formatting ---------- */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /** Compact time for the grid: "9am", "9:30pm" or "09:00", "21:30". */
  function shortTime(tz, ms, use24) {
    const p = getParts(tz, ms);
    if (use24) return pad2(p.hour) + ':' + pad2(p.minute);
    const h12 = p.hour % 12 || 12;
    return h12 + (p.minute ? ':' + pad2(p.minute) : '') + (p.hour < 12 ? 'am' : 'pm');
  }

  /** "9:00 AM" or "09:00". */
  function clockTime(tz, ms, use24) {
    const p = getParts(tz, ms);
    if (use24) return pad2(p.hour) + ':' + pad2(p.minute);
    return (p.hour % 12 || 12) + ':' + pad2(p.minute) + (p.hour < 12 ? ' AM' : ' PM');
  }

  /** "UTC+5:30", "UTC-7", "UTC+0". */
  function offsetLabel(tz, ms) {
    const off = offsetMinutes(tz, ms);
    const sign = off < 0 ? '-' : '+';
    const a = Math.abs(off);
    return 'UTC' + sign + Math.floor(a / 60) + (a % 60 ? ':' + pad2(a % 60) : '');
  }

  const ABBR_LOCALES = ['en-US', 'en-GB', 'en-AU', 'en-IN', 'en-NZ'];
  const abbrFmtCache = new Map();
  /** Common abbreviation like "PDT", "CEST", "AEDT" — or "" if none is well known. */
  function abbreviation(tz, ms) {
    if (tz === 'UTC' || tz === 'Etc/UTC') return 'UTC';
    for (const loc of ABBR_LOCALES) {
      const key = loc + '|' + tz;
      let f = abbrFmtCache.get(key);
      if (!f) {
        try { f = new Intl.DateTimeFormat(loc, { timeZone: tz, timeZoneName: 'short' }); }
        catch (e) { f = null; }
        abbrFmtCache.set(key, f);
      }
      if (!f) continue;
      const part = f.formatToParts(new Date(ms)).find((x) => x.type === 'timeZoneName');
      const v = part && part.value;
      if (v && /^[A-Z]{2,5}$/.test(v) && !/^(GMT|UTC)$/.test(v)) return v;
      if (v === 'GMT' && offsetMinutes(tz, ms) === 0) return 'GMT';
    }
    return '';
  }

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /** "Monday, October 26, 2026" for the wall-clock date of `ms` in `tz`. */
  function longDate(tz, ms) {
    const p = getParts(tz, ms);
    return WEEKDAYS[p.weekday] + ', ' + MONTHS[p.month - 1] + ' ' + p.day + ', ' + p.year;
  }
  function longDateYMD(y, m, d) {
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return WEEKDAYS[wd] + ', ' + MONTHS[m - 1] + ' ' + d + ', ' + y;
  }
  /** "Tue 27" */
  function shortDay(tz, ms) {
    const p = getParts(tz, ms);
    return WEEKDAYS[p.weekday].slice(0, 3) + ' ' + p.day;
  }
  /** Difference in calendar days between the date of `ms` in `tz` and y-m-d. */
  function dayDiff(tz, ms, y, m, d) {
    const p = getParts(tz, ms);
    return Math.round((Date.UTC(p.year, p.month - 1, p.day) - Date.UTC(y, m - 1, d)) / DAY);
  }

  function isValidZone(tz) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; }
    catch (e) { return false; }
  }

  function localZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
    catch (e) { return 'UTC'; }
  }

  const api = {
    MIN, HOUR, DAY, MONTHS, WEEKDAYS, SCORE,
    getParts, offsetMinutes, zonedToUtc, addDays, todayIn, daySlots,
    category, shortTime, clockTime, offsetLabel, abbreviation,
    longDate, longDateYMD, shortDay, dayDiff, isValidZone, localZone,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WMTime = api;
})(typeof window !== 'undefined' ? window : globalThis);
