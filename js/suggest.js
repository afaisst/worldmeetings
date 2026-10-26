/*
 * suggest.js — picks suggested meeting times for World Meetings.
 *
 * Input: the day's slots, each with `cats` (one category per time zone:
 * 'good' | 'ok' | 'shoulder' | 'night') and the index of the home zone.
 * The home zone (the user) is part of every meeting.
 *
 * When does a time "work" for a zone?
 *   - strict mode (default): daytime only, 9am–8pm (dark or medium green).
 *     A zone that never overlaps the home zone's daytime (e.g. California
 *     and India) falls back to "not night" (any green) for its meeting,
 *     for both itself and the home zone.
 *   - relaxed mode: any time that is not night (7am–11pm).
 *
 * Algorithm
 * 1. Greedy cover: pick the time that works for the most zones not yet
 *    covered (ties: best overall fit). Those zones form meeting 1. Repeat
 *    for the zones that are left until everyone is covered.
 * 2. Refine: move single zones between meetings while that improves the
 *    overall fit of each meeting's top options. (So e.g. Hawaii joins the
 *    Tokyo meeting when that lets the New York/London meeting use better
 *    times.) Meetings are never added, only merged.
 * 3. For each meeting, list the top options that work for all its members.
 */
(function (root) {
  'use strict';

  const SCORE = { night: 0, shoulder: 1, ok: 2, good: 3 };
  const DAYTIME = 2;   // ok or good
  const AWAKE = 1;     // anything but night
  const MAX_MEETINGS = 4;

  const score = (slot, i) => SCORE[slot.cats[i]];

  function fit(slot, members) {
    let sum = 0, min = Infinity;
    for (const i of members) { const v = score(slot, i); sum += v; if (v < min) min = v; }
    return { sum, min };
  }

  /**
   * @param slots  [{ms, cats: [...]}]
   * @param nZones number of zones
   * @param home   index of the home zone
   * @param opts   { relaxed: bool, perMeeting: number }
   * @returns { meetings: [{ members, relaxed, options: [{slot,sum,min}] }], uncovered: [zoneIdx] }
   */
  function plan(slots, nZones, home, opts) {
    opts = opts || {};
    const perMeeting = opts.perMeeting || 3;
    const others = [];
    for (let i = 0; i < nZones; i++) if (i !== home) others.push(i);

    // Per-zone threshold.
    const thr = new Array(nZones).fill(opts.relaxed ? AWAKE : DAYTIME);
    if (!opts.relaxed) {
      for (const i of others) {
        const canDaytime = slots.some((s) => score(s, home) >= DAYTIME && score(s, i) >= DAYTIME);
        if (!canDaytime) thr[i] = AWAKE;
      }
    }
    const homeThr = (members) =>
      (opts.relaxed || members.some((i) => i !== home && thr[i] === AWAKE)) ? AWAKE : DAYTIME;

    function feasible(slot, members) {
      const h = homeThr(members);
      return members.every((i) => score(slot, i) >= (i === home ? h : thr[i]));
    }
    function rank(members) {
      return slots
        .filter((s) => feasible(s, members))
        .map((s) => Object.assign({ slot: s }, fit(s, members)))
        .sort((a, b) => b.sum - a.sum || b.min - a.min || a.slot.ms - b.slot.ms);
    }

    // 1. Greedy cover.
    let remaining = others.slice();
    let groups = [];
    while (remaining.length && groups.length < MAX_MEETINGS) {
      let best = null;
      for (const s of slots) {
        const hs = score(s, home);
        if (hs < AWAKE) continue;
        let cov = remaining.filter((i) => score(s, i) >= thr[i]);
        // Home outside daytime only for meetings that need a relaxed zone.
        if (!opts.relaxed && hs < DAYTIME && !cov.some((i) => thr[i] === AWAKE)) continue;
        if (!cov.length) continue;
        const f = fit(s, [home].concat(cov));
        if (!best || cov.length > best.cov.length ||
            (cov.length === best.cov.length && (f.sum > best.sum || (f.sum === best.sum && f.min > best.min)))) {
          best = { cov, sum: f.sum, min: f.min };
        }
      }
      if (!best) break;
      groups.push(best.cov);
      remaining = remaining.filter((i) => best.cov.indexOf(i) < 0);
    }
    const uncovered = remaining;

    // 2. Refine by local search: move single zones between meetings while that
    //    improves the overall fit (the top options of every meeting, counting
    //    only the other zones; the home zone is in every meeting anyway).
    //    Moves never add meetings; emptying one is welcome if fit doesn't drop.
    function value(g) {
      const members = [home].concat(g);
      const opts3 = rank(members).slice(0, perMeeting);
      if (!opts3.length) return null;
      let v = 0;
      for (const o of opts3) for (const i of g) v += score(o.slot, i);
      return v;
    }
    let vals = groups.map(value);
    for (let round = 0; round < 20 && groups.length > 1; round++) {
      let bestMove = null;
      groups.forEach((g, k) => {
        for (const i of g) {
          const src = g.filter((x) => x !== i);
          const vSrc = src.length ? value(src) : 0;
          if (vSrc === null) continue;
          groups.forEach((h, j) => {
            if (j === k) return;
            const vDst = value(h.concat(i));
            if (vDst === null) return;
            const gain = vSrc + vDst - vals[k] - vals[j];
            const merges = src.length === 0;
            if (gain > 0 || (gain === 0 && merges)) {
              if (!bestMove || gain > bestMove.gain || (gain === bestMove.gain && merges && !bestMove.merges)) {
                bestMove = { i, k, j, gain, merges, vSrc, vDst };
              }
            }
          });
        }
      });
      if (!bestMove) break;
      const { i, k, j } = bestMove;
      groups[k] = groups[k].filter((x) => x !== i);
      groups[j] = groups[j].concat(i);
      vals[k] = bestMove.vSrc; vals[j] = bestMove.vDst;
      const keep = groups.map((g) => g.length > 0);
      groups = groups.filter((_, x) => keep[x]);
      vals = vals.filter((_, x) => keep[x]);
    }

    if (!groups.length) groups = [[]]; // only the home zone
    groups.sort((a, b) => b.length - a.length);

    const meetings = groups.map((g) => {
      const members = [home].concat(g).sort((a, b) => a - b);
      return { members, relaxed: homeThr(members) === AWAKE, options: rank(members).slice(0, perMeeting) };
    });
    return { meetings, uncovered };
  }

  const api = { plan, SCORE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WMSuggest = api;
})(typeof window !== 'undefined' ? window : globalThis);
