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
 * 1. Fewest meetings: every time of the day "covers" the zones it works for.
 *    An exact search finds the smallest number of times that together cover
 *    every zone (so two meetings that could be one are never suggested).
 *    Each zone joins the chosen time that suits it best; among equally small
 *    plans, the one whose meetings have the best top options wins.
 * 2. Polish: move single zones between meetings while that improves the
 *    overall fit of each meeting's top options.
 * 3. Safety net: merge any two meetings that could share a time.
 * 4. For each meeting, list the top options that work for all its members.
 */
(function (root) {
  'use strict';

  const SCORE = { night: 0, shoulder: 1, ok: 2, good: 3 };
  const DAYTIME = 2;   // ok or good
  const AWAKE = 1;     // anything but night
  const MAX_MEETINGS = 6;

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

    function value(g) {
      const members = [home].concat(g);
      const opts3 = rank(members).slice(0, perMeeting);
      if (!opts3.length) return null;
      let v = 0;
      for (const o of opts3) for (const i of g) v += score(o.slot, i);
      return v;
    }

    // 1. Fewest meetings: exact set cover. Each candidate time covers the set
    //    of zones it works for; find the smallest number of times that covers
    //    every zone (few zones and <= 25 times, so brute force is instant).
    //    Among the smallest covers, keep the one whose meetings fit best.
    const pos = new Map(others.map((z, b) => [z, b]));
    const full = others.length ? (2 ** others.length) - 1 : 0;
    const candByMask = new Map(); // mask -> best slot for that set
    for (const s of slots) {
      const hs = score(s, home);
      if (hs < AWAKE) continue;
      const cov = others.filter((i) => score(s, i) >= thr[i]);
      // Home outside daytime only for meetings that need a relaxed zone.
      if (!opts.relaxed && hs < DAYTIME && !cov.some((i) => thr[i] === AWAKE)) continue;
      if (!cov.length) continue;
      let mask = 0;
      for (const i of cov) mask += 2 ** pos.get(i);
      const f = fit(s, [home].concat(cov)).sum;
      const prev = candByMask.get(mask);
      if (!prev || f > prev.f) candByMask.set(mask, { slot: s, f });
    }
    // Drop sets contained in another set (they can never be needed).
    let cands = [...candByMask.entries()].map(([mask, c]) => ({ mask, slot: c.slot }));
    cands = cands.filter((a) => !cands.some((b) => b !== a && (a.mask | b.mask) === b.mask && a.mask !== b.mask));
    const reachable = cands.reduce((m, c) => m | c.mask, 0);
    const coverable = others.filter((i) => reachable & (2 ** pos.get(i)));
    const uncovered = others.filter((i) => !(reachable & (2 ** pos.get(i))));
    const target = coverable.reduce((m, i) => m | (2 ** pos.get(i)), 0);

    function groupsFor(combo) {
      // Each zone joins the chosen time that suits it best.
      const gs = combo.map(() => []);
      for (const i of coverable) {
        let bk = -1, bv = -1;
        combo.forEach((c, k) => {
          if (c.mask & (2 ** pos.get(i)) && score(c.slot, i) > bv) { bv = score(c.slot, i); bk = k; }
        });
        gs[bk].push(i);
      }
      return gs.filter((g) => g.length);
    }

    let groups = [];
    if (target) {
      let bestCombo = null, bestVal = -1;
      const combo = [];
      const search = (start, k, acc) => {
        if (combo.length === k) {
          if (acc !== target) return;
          const gs = groupsFor(combo);
          const vs = gs.map(value);
          if (vs.some((v) => v === null)) return;
          const v = vs.reduce((a, b) => a + b, 0);
          if (v > bestVal) { bestVal = v; bestCombo = gs; }
          return;
        }
        for (let c = start; c < cands.length; c++) {
          combo.push(cands[c]); search(c + 1, k, acc | cands[c].mask); combo.pop();
        }
      };
      for (let k = 1; k <= Math.min(cands.length, MAX_MEETINGS) && !bestCombo; k++) search(0, k, 0);
      groups = bestCombo || coverable.map((i) => [i]);
    }

    // 2. Refine by local search: move single zones between meetings while that
    //    improves the overall fit (the top options of every meeting, counting
    //    only the other zones; the home zone is in every meeting anyway).
    //    Moves never add meetings; emptying one is welcome if fit doesn't drop.
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

    // 3. Safety net: if any two meetings could share a time, merge them.
    for (let merged = true; merged && groups.length > 1;) {
      merged = false;
      outer: for (let a = 0; a < groups.length; a++) {
        for (let b = a + 1; b < groups.length; b++) {
          const union = groups[a].concat(groups[b]);
          if (rank([home].concat(union)).length) {
            groups[a] = union; groups.splice(b, 1); merged = true; break outer;
          }
        }
      }
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
