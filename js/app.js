/* World Meetings — UI */
(function () {
  'use strict';

  const T = window.WMTime;
  const C = window.WMCities;
  const $ = (id) => document.getElementById(id);
  const STORE_KEY = 'worldmeetings:v1';
  const SLOT_MIN = 60;
  const WEEK_START = 0; // 0 = Sunday

  const places = C.buildPlaces(T.isValidZone);

  /* ---------------- state ---------------- */

  let uid = 0;
  const newId = () => 'z' + Date.now().toString(36) + (uid++).toString(36);

  function defaultUse24() {
    try {
      const hc = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle;
      return hc === 'h23' || hc === 'h24';
    } catch (e) { return false; }
  }

  function zoneFromPlace(p) { return { id: newId(), tz: p.tz, city: p.city, country: p.country }; }

  function loadState() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { saved = null; }
    const local = T.localZone();
    let zones = (saved && Array.isArray(saved.zones) ? saved.zones : [])
      .filter((z) => z && typeof z.tz === 'string' && T.isValidZone(z.tz))
      .map((z) => ({ id: z.id || newId(), tz: z.tz, city: String(z.city || z.tz), country: String(z.country || '') }));
    if (!zones.length) zones = [zoneFromPlace(C.placeForZone(places, local))];
    let homeId = saved && saved.homeId;
    if (!zones.some((z) => z.id === homeId)) homeId = zones[0].id;
    const home = zones.find((z) => z.id === homeId);
    const today = T.todayIn(home.tz);
    return {
      zones,
      homeId,
      date: today,
      view: { y: today.y, m: today.m },
      sort: saved && saved.sort === 'best' ? 'best' : 'chrono',
      use24: saved && typeof saved.use24 === 'boolean' ? saved.use24 : defaultUse24(),
    };
  }

  const state = loadState();

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        zones: state.zones, homeId: state.homeId, sort: state.sort, use24: state.use24,
      }));
    } catch (e) { /* private mode etc. — app still works */ }
  }

  const homeZone = () => state.zones.find((z) => z.id === state.homeId) || state.zones[0];

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    if (children) for (const c of children) if (c) n.append(c);
    return n;
  }

  function zoneDesc(tz, ms) {
    const abbr = T.abbreviation(tz, ms);
    const off = T.offsetLabel(tz, ms);
    return abbr ? abbr + ' · ' + off : off;
  }

  /* ---------------- calendar ---------------- */

  function renderCalendar() {
    const { y, m } = state.view;
    $('calTitle').textContent = T.MONTHS[m - 1] + ' ' + y;
    const grid = $('calGrid');
    grid.textContent = '';
    for (let i = 0; i < 7; i++) {
      grid.append(el('div', { class: 'cal-dow', text: T.WEEKDAYS[(i + WEEK_START) % 7].slice(0, 2), 'aria-hidden': 'true' }));
    }
    const firstWd = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const lead = (firstWd - WEEK_START + 7) % 7;
    const today = T.todayIn(homeZone().tz);
    const sel = state.date;
    for (let i = 0; i < 42; i++) {
      const d = T.addDays(y, m, 1, i - lead);
      const b = el('button', { type: 'button', class: 'cal-day', text: String(d.d) });
      if (d.m !== m) b.classList.add('other');
      if (d.y === today.y && d.m === today.m && d.d === today.d) b.classList.add('today');
      const isSel = d.y === sel.y && d.m === sel.m && d.d === sel.d;
      if (isSel) b.classList.add('selected');
      b.setAttribute('aria-pressed', String(isSel));
      b.setAttribute('aria-label', T.longDateYMD(d.y, d.m, d.d));
      b.addEventListener('click', () => selectDate(d));
      grid.append(b);
    }
  }

  function selectDate(d, keepView) {
    state.date = { y: d.y, m: d.m, d: d.d };
    if (!keepView) state.view = { y: d.y, m: d.m };
    renderCalendar();
    renderGrid(true);
  }

  $('calPrev').addEventListener('click', () => {
    const v = state.view; state.view = v.m === 1 ? { y: v.y - 1, m: 12 } : { y: v.y, m: v.m - 1 }; renderCalendar();
  });
  $('calNext').addEventListener('click', () => {
    const v = state.view; state.view = v.m === 12 ? { y: v.y + 1, m: 1 } : { y: v.y, m: v.m + 1 }; renderCalendar();
  });
  $('calToday').addEventListener('click', () => selectDate(T.todayIn(homeZone().tz)));
  $('dayPrev').addEventListener('click', () => selectDate(T.addDays(state.date.y, state.date.m, state.date.d, -1)));
  $('dayNext').addEventListener('click', () => selectDate(T.addDays(state.date.y, state.date.m, state.date.d, 1)));

  /* ---------------- zone list ---------------- */

  const HOME_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>';

  function renderZones(focusId, focusSel) {
    const list = $('zoneList');
    list.textContent = '';
    const now = Date.now();
    for (const z of state.zones) {
      const isHome = z.id === state.homeId;
      const handle = el('button', {
        type: 'button', class: 'handle', text: '⠿',
        'aria-label': 'Reorder ' + z.city + ' (drag, or use arrow keys)',
      });
      const homeBtn = el('button', {
        type: 'button', class: 'home-btn', html: HOME_SVG, 'aria-pressed': String(isHome),
        title: isHome ? 'Home time zone: the calendar date refers to this zone' : 'Make this the home time zone',
        'aria-label': (isHome ? 'Home time zone: ' : 'Make home time zone: ') + z.city,
      });
      const removeBtn = el('button', {
        type: 'button', class: 'remove-btn', text: '−', title: 'Remove time zone',
        'aria-label': 'Remove ' + z.city,
      });
      if (state.zones.length === 1) removeBtn.disabled = true;
      const li = el('li', { class: 'zone', 'data-id': z.id }, [
        handle,
        el('div', { class: 'zone-info' }, [
          el('div', { class: 'zone-row' }, [
            el('span', { class: 'zone-name', text: z.city, title: z.city + ' — ' + z.tz }),
            el('span', { class: 'zone-now', text: T.clockTime(z.tz, now, state.use24), title: 'Current time' }),
          ]),
          el('div', { class: 'zone-meta', text: (z.country ? z.country + ' · ' : '') + zoneDesc(z.tz, now), title: z.tz }),
        ]),
        homeBtn, removeBtn,
      ]);
      homeBtn.addEventListener('click', () => setHome(z.id));
      removeBtn.addEventListener('click', () => removeZone(z.id));
      setupDrag(handle, li);
      list.append(li);
    }
    if (focusId) {
      const target = list.querySelector('[data-id="' + focusId + '"] ' + (focusSel || '.handle'));
      if (target) target.focus();
    }
  }

  function setHome(id) {
    if (state.homeId === id) return;
    state.homeId = id;
    save();
    renderZones(id, '.home-btn');
    renderCalendar();
    renderGrid(true);
  }

  function removeZone(id) {
    if (state.zones.length <= 1) return;
    const idx = state.zones.findIndex((z) => z.id === id);
    state.zones.splice(idx, 1);
    if (state.homeId === id) state.homeId = state.zones[0].id;
    save();
    const next = state.zones[Math.min(idx, state.zones.length - 1)];
    renderZones(next.id, '.remove-btn');
    renderCalendar();
    renderGrid(false);
  }

  function addZone(p) {
    const dup = state.zones.find((z) => z.tz === p.tz && z.city === p.city);
    if (!dup) {
      state.zones.push(zoneFromPlace(p));
      save();
    }
    renderZones();
    renderGrid(false);
  }

  function moveZone(id, delta) {
    const i = state.zones.findIndex((z) => z.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= state.zones.length) return;
    const [z] = state.zones.splice(i, 1);
    state.zones.splice(j, 0, z);
    save();
    renderZones(id);
    renderGrid(false);
  }

  /* Pointer-based drag & drop (works with mouse, pen and touch). */
  function setupDrag(handle, li) {
    handle.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); moveZone(li.dataset.id, -1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); moveZone(li.dataset.id, 1); }
    });
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const list = li.parentNode;
      const pid = e.pointerId;
      li.classList.add('dragging');
      let lastOrder = order();

      function order() { return [...list.children].map((n) => n.dataset.id).join(','); }
      function onMove(ev) {
        if (ev.pointerId !== pid) return;
        const y = ev.clientY;
        let before = null;
        for (const it of list.children) {
          if (it === li) continue;
          const r = it.getBoundingClientRect();
          if (y < r.top + r.height / 2) { before = it; break; }
        }
        if (before) { if (li.nextSibling !== before) list.insertBefore(li, before); }
        else if (list.lastElementChild !== li) list.append(li);
        const o = order();
        if (o !== lastOrder) { lastOrder = o; applyDomOrder(list); renderGrid(false); }
      }
      function onEnd(ev) {
        if (ev.pointerId !== pid) return;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onEnd);
        document.removeEventListener('pointercancel', onEnd);
        li.classList.remove('dragging');
        applyDomOrder(list);
        save();
        renderGrid(false);
      }
      // Listen on the document: moving the <li> in the DOM would drop pointer capture.
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onEnd);
      document.addEventListener('pointercancel', onEnd);
    });
  }

  function applyDomOrder(list) {
    const ids = [...list.children].map((n) => n.dataset.id);
    state.zones.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  }

  /* ---------------- search ---------------- */

  const searchBox = $('searchBox');
  const searchInput = $('searchInput');
  const searchResults = $('searchResults');
  let results = [];
  let active = -1;

  function openSearch() {
    searchBox.hidden = false;
    searchInput.value = '';
    renderResults();
    searchInput.focus();
  }
  function closeSearch() {
    searchBox.hidden = true;
    searchInput.value = '';
    results = [];
    renderResults();
    $('addZoneBtn').focus();
  }

  function renderResults() {
    searchResults.textContent = '';
    const q = searchInput.value;
    results = C.searchPlaces(places, q, 8);
    active = results.length ? 0 : -1;
    searchInput.setAttribute('aria-expanded', String(results.length > 0));
    const now = Date.now();
    results.forEach((p, i) => {
      const li = el('li', { role: 'option', id: 'opt' + i, 'aria-selected': String(i === active) }, [
        el('div', null, [
          el('div', { class: 'r-city', text: p.city }),
          el('div', { class: 'r-country', text: p.country }),
        ]),
        el('div', { class: 'r-time' }, [
          el('div', { text: T.clockTime(p.tz, now, state.use24) }),
          el('div', { text: zoneDesc(p.tz, now) }),
        ]),
      ]);
      li.addEventListener('mousedown', (e) => e.preventDefault());
      li.addEventListener('click', () => { addZone(p); closeSearch(); });
      li.addEventListener('mousemove', () => setActive(i));
      searchResults.append(li);
    });
    if (q.trim() && !results.length) {
      searchResults.append(el('li', { class: 'r-empty', text: 'No match — try a larger city nearby or a country.' }));
    }
    if (active >= 0) searchInput.setAttribute('aria-activedescendant', 'opt' + active);
    else searchInput.removeAttribute('aria-activedescendant');
  }

  function setActive(i) {
    active = i;
    [...searchResults.children].forEach((n, k) => n.setAttribute('aria-selected', String(k === i)));
    searchInput.setAttribute('aria-activedescendant', 'opt' + i);
    const n = searchResults.children[i];
    if (n) n.scrollIntoView({ block: 'nearest' });
  }

  $('addZoneBtn').addEventListener('click', () => (searchBox.hidden ? openSearch() : closeSearch()));
  searchInput.addEventListener('input', renderResults);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setActive((active + 1) % results.length); }
    else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setActive((active - 1 + results.length) % results.length); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); addZone(results[active]); closeSearch(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
  });

  /* ---------------- time grid ---------------- */

  let currentSlots = [];

  function computeSlots() {
    const home = homeZone();
    const { y, m, d } = state.date;
    return T.daySlots(home.tz, y, m, d, SLOT_MIN).map((ms, idx) => {
      const cats = state.zones.map((z) => T.category(z.tz, ms));
      const scores = cats.map((c) => T.SCORE[c]);
      return {
        ms, idx, cats,
        score: scores.reduce((a, b) => a + b, 0),
        min: Math.min(...scores),
        nights: cats.filter((c) => c === 'night').length,
        goods: cats.filter((c) => c === 'good').length,
      };
    });
  }

  function renderDayHead(slots) {
    const home = homeZone();
    const { y, m, d } = state.date;
    $('dayTitle').textContent = T.longDateYMD(y, m, d);
    const parts = ['Calendar day in ' + home.city + ' (' + zoneDesc(home.tz, slots.length ? slots[0].ms : Date.now()) + ')'];
    if (slots.length) {
      const first = slots[0].ms;
      const last = slots[slots.length - 1].ms + SLOT_MIN * T.MIN - 1;
      const changes = [];
      for (const z of state.zones) {
        const a = T.offsetMinutes(z.tz, first), b = T.offsetMinutes(z.tz, last);
        if (a !== b) {
          const diff = (b - a) / 60;
          changes.push(z.city + ' (clocks ' + (diff > 0 ? 'forward ' : 'back ') + fmtHours(Math.abs(diff)) + ')');
        }
      }
      if (changes.length) parts.push('Daylight-saving change: ' + [...new Set(changes)].join(', '));
    }
    $('daySub').textContent = parts.join(' · ');
  }
  function fmtHours(h) { return h === 1 ? '1 h' : (h === 0.5 ? '30 min' : h + ' h'); }

  function renderGrid(resetScroll) {
    const slots = computeSlots();
    currentSlots = slots;
    renderDayHead(slots);
    const grid = $('grid');
    grid.textContent = '';
    if (!state.zones.length) { grid.append(el('div', { class: 'grid-empty', text: 'Add a time zone to get started.' })); return; }

    const { y, m, d } = state.date;
    const n = state.zones.length;
    const now = Date.now();
    const homeId = state.homeId;

    // Label column
    const labels = el('div', { class: 'labels' }, [el('div', { class: 'lab fit-lab', text: 'Overlap', title: 'How well each time works for everyone' })]);
    for (const z of state.zones) {
      const city = el('div', { class: 'l-city', title: z.tz }, [document.createTextNode(z.city)]);
      if (z.id === homeId) city.append(el('span', { class: 'l-home', text: 'Home' }));
      labels.append(el('div', { class: 'lab' }, [
        city,
        el('div', { class: 'l-meta', text: zoneDesc(z.tz, slots.length ? slots[Math.floor(slots.length / 2)].ms : now) }),
      ]));
    }
    grid.append(labels);

    const ordered = state.sort === 'best'
      // Fewest people at night first, then the best overall fit, then earliest.
      ? slots.slice().sort((a, b) => a.nights - b.nights || b.score - a.score || b.goods - a.goods || a.ms - b.ms)
      : slots;

    const startOffsets = state.zones.map((z) => T.offsetMinutes(z.tz, slots[0].ms));

    for (const s of ordered) {
      const isNow = now >= s.ms && now < s.ms + SLOT_MIN * T.MIN;
      const fitPct = Math.round((s.score / (T.SCORE.good * n)) * 100);
      const fit = el('div', { class: 'fit' + (s.min === T.SCORE.good ? ' perfect' : '') + (s.score === 0 ? ' zero' : '') }, [
        el('i', { style: 'height:' + Math.max(8, fitPct) + '%' }),
      ]);
      if (isNow) fit.append(el('span', { class: 'now-tag', text: 'now' }));

      const col = el('button', { type: 'button', class: 'col', 'data-idx': String(s.idx) }, [fit]);
      const aria = [];
      state.zones.forEach((z, i) => {
        const time = T.shortTime(z.tz, s.ms, state.use24);
        const diff = T.dayDiff(z.tz, s.ms, y, m, d);
        // Every tile shows its local date; dates that differ from the selected day are emphasized.
        const day = T.shortDay(z.tz, s.ms);
        // After a daylight-saving change during the day, also show the new zone abbreviation.
        const dst = T.offsetMinutes(z.tz, s.ms) !== startOffsets[i] ? (T.abbreviation(z.tz, s.ms) || T.offsetLabel(z.tz, s.ms)) : '';
        const small = day + (dst ? ' ' + dst : '');
        const cell = el('div', { class: 'cell ' + s.cats[i] }, [document.createTextNode(time)]);
        cell.append(el('small', { class: diff !== 0 ? 'other-day' : '', text: day }));
        if (dst) cell.append(el('small', { text: dst }));
        const p = T.getParts(z.tz, s.ms);
        if (state.sort === 'chrono' && p.hour === 0 && s.idx > 0) cell.classList.add('daystart');
        col.append(cell);
        aria.push(z.city + ' ' + time + (small ? ' ' + small : ''));
      });
      col.setAttribute('aria-label', aria.join(', ') + '. Open text to copy.');
      col.title = T.clockTime(homeZone().tz, s.ms, state.use24) + ' ' + homeZone().city + ' — click for email text';
      col.addEventListener('click', () => openModal(s.ms));
      grid.append(col);
    }

    if (resetScroll) scrollGrid();
  }

  function scrollGrid() {
    const wrap = $('gridWrap');
    if (state.sort === 'best') { wrap.scrollLeft = 0; return; }
    // In chronological mode start the view around 6am in the home zone.
    const home = homeZone();
    const target = currentSlots.find((s) => T.getParts(home.tz, s.ms).hour >= 6);
    const col = target && $('grid').querySelector('.col[data-idx="' + target.idx + '"]');
    const labels = $('grid').querySelector('.labels');
    if (col && labels) wrap.scrollLeft = Math.max(0, col.offsetLeft - labels.offsetWidth);
  }

  /* ---------------- sort & format toggles ---------------- */

  function setSort(mode) {
    state.sort = mode;
    $('sortChrono').setAttribute('aria-pressed', String(mode === 'chrono'));
    $('sortBest').setAttribute('aria-pressed', String(mode === 'best'));
    save();
    renderGrid(true);
  }
  $('sortChrono').addEventListener('click', () => setSort('chrono'));
  $('sortBest').addEventListener('click', () => setSort('best'));

  function setFormat(use24) {
    state.use24 = use24;
    $('fmt12').setAttribute('aria-pressed', String(!use24));
    $('fmt24').setAttribute('aria-pressed', String(use24));
    save();
    renderZones();
    renderGrid(false);
    if (!$('modal').hidden) updateEmailText();
  }
  $('fmt12').addEventListener('click', () => setFormat(false));
  $('fmt24').addEventListener('click', () => setFormat(true));

  /* ---------------- modal ---------------- */

  let modalMs = null;
  let lastFocus = null;

  function timeRange(tz, start, end, use24) {
    const a = T.clockTime(tz, start, use24);
    if (end == null) return a;
    const b = T.clockTime(tz, end, use24);
    const pa = T.getParts(tz, start), pb = T.getParts(tz, end);
    const sameDay = pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
    let range;
    if (T.offsetMinutes(tz, start) !== T.offsetMinutes(tz, end)) {
      // Clocks change during the meeting (DST): label both ends explicitly.
      const za = T.abbreviation(tz, start) || T.offsetLabel(tz, start);
      const zb = T.abbreviation(tz, end) || T.offsetLabel(tz, end);
      range = a + ' ' + za + ' – ' + b + ' ' + zb;
    } else if (!use24 && sameDay && (pa.hour < 12) === (pb.hour < 12)) range = a.slice(0, -3) + ' – ' + b;
    else range = a + ' – ' + b;
    if (!sameDay) range += ' (next day)';
    return range;
  }

  function buildEmailText(ms) {
    const dur = parseInt($('durationSel').value, 10);
    const end = dur ? ms + dur * T.MIN : null;
    const withOffset = $('offsetChk').checked;
    const lines = ["Let's meet on:", ''];
    for (const z of state.zones) {
      const abbr = T.abbreviation(z.tz, ms);
      const dstChange = end != null && T.offsetMinutes(z.tz, ms) !== T.offsetMinutes(z.tz, end);
      const tags = [];
      if (dstChange) { if (withOffset) tags.push(T.offsetLabel(z.tz, ms) + ' → ' + T.offsetLabel(z.tz, end)); }
      else {
        if (abbr) tags.push(abbr);
        if (withOffset) tags.push(T.offsetLabel(z.tz, ms));
      }
      lines.push('• ' + z.city + ': ' + T.longDate(z.tz, ms) + ', ' + timeRange(z.tz, ms, end, state.use24) +
        (tags.length ? ' (' + tags.join(', ') + ')' : ''));
    }
    return lines.join('\n');
  }

  function updateEmailText() {
    const text = buildEmailText(modalMs);
    $('emailText').value = text;
    $('emailText').rows = Math.min(16, text.split('\n').length + 1);
    $('copiedMsg').textContent = '';
  }

  function openModal(ms) {
    modalMs = ms;
    lastFocus = document.activeElement;
    const home = homeZone();
    $('modalTitle').textContent = T.longDate(home.tz, ms).replace(/, \d{4}$/, '') + ' · ' +
      T.clockTime(home.tz, ms, state.use24) + ' in ' + home.city;
    updateEmailText();
    $('modal').hidden = false;
    $('copyBtn').focus();
  }
  function closeModal() {
    $('modal').hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  async function copyText() {
    const text = $('emailText').value;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { ok = false; }
    if (!ok) {
      const ta = $('emailText');
      ta.focus(); ta.select();
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    }
    $('copiedMsg').textContent = ok ? 'Copied to clipboard ✓' : 'Press Ctrl/Cmd+C to copy';
    clearTimeout(copyText.t);
    copyText.t = setTimeout(() => { $('copiedMsg').textContent = ''; }, 2500);
  }

  $('copyBtn').addEventListener('click', copyText);
  $('modalClose').addEventListener('click', closeModal);
  $('modalCancel').addEventListener('click', closeModal);
  $('durationSel').addEventListener('change', updateEmailText);
  $('offsetChk').addEventListener('change', updateEmailText);
  $('modal').addEventListener('mousedown', (e) => { if (e.target === $('modal')) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if ($('modal').hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
    if (e.key === 'Tab') { // keep focus inside the dialog
      const f = [...$('modal').querySelectorAll('button, select, input, textarea')].filter((x) => !x.disabled);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------------- boot ---------------- */

  setFormat(state.use24);
  $('sortChrono').setAttribute('aria-pressed', String(state.sort === 'chrono'));
  $('sortBest').setAttribute('aria-pressed', String(state.sort === 'best'));
  renderCalendar();
  renderZones();
  renderGrid(true);

  // Keep the live clocks and the "now" marker current.
  function nowSlotIdx() {
    const t = Date.now();
    const s = currentSlots.find((x) => t >= x.ms && t < x.ms + SLOT_MIN * T.MIN);
    return s ? s.idx : -1;
  }
  let lastNowIdx = nowSlotIdx();
  setInterval(() => {
    if (document.hidden) return;
    const now = Date.now();
    for (const li of $('zoneList').children) {
      const z = state.zones.find((x) => x.id === li.dataset.id);
      if (z) li.querySelector('.zone-now').textContent = T.clockTime(z.tz, now, state.use24);
    }
    const idx = nowSlotIdx();
    if (idx !== lastNowIdx && !document.querySelector('.zone.dragging')) {
      lastNowIdx = idx;
      renderGrid(false);
    }
  }, 30 * 1000);

  // Expose for debugging / tests.
  window.WMApp = { state, buildEmailText };
})();
