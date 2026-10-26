/*
 * holidays.js — national public holidays for World Meetings.
 *
 * Each country's data lives in data/holidays/<CC>.js and is loaded on demand
 * with a <script> tag (works on GitHub Pages and when index.html is opened
 * straight from disk). The data files call WMHolidays.add(cc, {date: name}).
 */
(function (root) {
  'use strict';

  // Countries that have a data file (keep in sync with data/holidays/; written by tools/build-holidays.js).
  const AVAILABLE = new Set('AD AE AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU IC ID IE IL IM IN IR IS IT JE JM JP KE KM KN KR KY KZ LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MK ML MQ MR MS MT MU MW MX MY MZ NA NC NE NF NG NI NL NO NZ PA PE PF PH PK PL PM PR PT PY RE RO RS RU RW SA SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SZ TC TD TG TH TN TO TR TT TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF XK YT ZA ZM ZW'.split(' '));
  const data = {};      // cc -> { 'YYYY-MM-DD': name }
  const state = {};     // cc -> 'loading' | 'ready' | 'missing'
  const listeners = [];

  function add(cc, days) {
    data[cc] = days;
    state[cc] = 'ready';
  }

  /** Make sure a country's data is (being) loaded; calls onChange when it arrives. */
  function ensure(cc) {
    if (!cc || state[cc]) return;
    if (!AVAILABLE.has(cc)) { state[cc] = 'missing'; return; }
    if (typeof document === 'undefined') { state[cc] = 'missing'; return; }
    state[cc] = 'loading';
    const s = document.createElement('script');
    s.src = 'data/holidays/' + cc + '.js';
    s.async = true;
    s.onload = () => { if (state[cc] !== 'ready') state[cc] = 'missing'; notify(); };
    s.onerror = () => { state[cc] = 'missing'; notify(); };
    document.head.appendChild(s);
  }

  function notify() { listeners.forEach((fn) => fn()); }
  function onChange(fn) { listeners.push(fn); }

  /** Holiday name for a country on a date ('YYYY-MM-DD'), or ''. */
  function get(cc, ymd) {
    const d = cc && data[cc];
    return (d && d[ymd]) || '';
  }
  function status(cc) { return state[cc] || 'unknown'; }

  const api = { add, ensure, get, status, onChange };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WMHolidays = api;
})(typeof window !== 'undefined' ? window : globalThis);
