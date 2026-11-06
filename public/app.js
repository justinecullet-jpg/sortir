import { APP_NAME, CATEGORIES, OPTIONS, BANLIEUE, ACCESS } from './config.js';

// ════════════════════════════════════════════════════════════
//  Outils
// ════════════════════════════════════════════════════════════
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
const ACC = Object.fromEntries(ACCESS.map((a) => [a.id, a]));
const VERSION = '1.4.1';
const REPO = 'https://github.com/justinecullet-jpg/sortir';
const QFAP_DATASET = 'https://opendata.paris.fr/explore/dataset/que-faire-a-paris-/information/';
const ODBL = 'https://opendatacommons.org/licenses/odbl/';
const TAG_LABEL = Object.fromEntries(CATEGORIES.flatMap((c) => c.tags.map((t) => [`${c.id}:${t.id}`, t.label])));
const GRANDE_COURONNE = ['77', '78', '91', '95'];
const DECISIONS = {
  oui: { label: 'Oui', icon: '♥', toast: 'Ajouté à tes sorties ♥' },
  peutetre: { label: 'Pourquoi pas', icon: '?', toast: 'Gardé en « pourquoi pas »' },
  non: { label: 'Non', icon: '✕', toast: null },
};
const WHEN = [
  { id: 'aujourdhui', label: "Aujourd'hui" },
  { id: 'demain', label: 'Demain' },
  { id: 'weekend', label: 'Ce week-end' },
  { id: 'semaine', label: '7 prochains jours' },
  { id: 'dates', label: 'Dates…' },
];
const STORE_KEY = 'sortir.v1';

const app = document.getElementById('app');
const wideMQ = window.matchMedia('(min-width: 1000px)');
const isWide = () => wideMQ.matches; // ordinateur / grande tablette en paysage : pile + carte côte à côte
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : null);
const clamp01 = (n) => Math.max(0, Math.min(1, n));

// ── Dates : on manipule des heures « murales » de Paris, "AAAA-MM-JJTHH:MM"
const pad = (n) => String(n).padStart(2, '0');
const toWall = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const parseWall = (s) => {
  const [d, t = '00:00'] = s.split('T');
  const [y, m, dd] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  return new Date(y, m - 1, dd, h, mi);
};
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const endOfDay = (d) => toWall(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59));
const nowWall = () => toWall(new Date());

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const fmtDate = (s) => { const d = parseWall(s); return `${d.getDate()} ${MOIS[d.getMonth()]}`; };
function fmtDay(s) {
  const d = dayStart(parseWall(s));
  const today = dayStart(new Date());
  const diff = Math.round((d - today) / 864e5);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}
function fmtTime(s) {
  const t = s.slice(11, 16);
  if (!t || t === '00:00') return '';
  const [h, m] = t.split(':');
  return `${Number(h)}h${m === '00' ? '' : m}`;
}

// ════════════════════════════════════════════════════════════
//  État (sauvegardé dans le navigateur)
// ════════════════════════════════════════════════════════════
const defaultFilters = () => ({
  when: 'semaine', from: null, to: null,
  cats: Object.fromEntries(CATEGORIES.map((c) => [c.id, []])), // [] = tous les genres ; null = catégorie décochée
  places: { paris: 'all', banlieue: [] }, // paris : 'all' ou liste d'arrondissements
  options: [],
  access: [], // critères d'accessibilité exigés (tous à la fois)
});

function loadState() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { /* stockage indisponible */ }
  return {
    filters: { ...defaultFilters(), ...(s.filters || {}) },
    decisions: s.decisions || {},
    name: s.name || '',
    onboarded: !!s.onboarded,
  };
}
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      filters: S.filters, decisions: S.decisions, name: S.name, onboarded: S.onboarded,
    }));
  } catch { /* navigation privée : tant pis, ça marche quand même pour la session */ }
}

const S = {
  ...loadState(),
  events: [], byId: new Map(), meta: null, loadError: null,
  deck: [], history: [], draft: null, deckBuiltFor: null,
  map: null, mapView: null, mapPlace: null, mapFitFor: null, lastView: 'deck',
  listDay: null, listMonth: null, // jour et mois affichés dans le calendrier de « Mes sorties »
};

// ════════════════════════════════════════════════════════════
//  Filtres
// ════════════════════════════════════════════════════════════
function rangeFor(f, now = new Date()) {
  const today = dayStart(now);
  switch (f.when) {
    case 'aujourdhui': return { from: toWall(now), to: endOfDay(today) };
    case 'demain': { const t = addDays(today, 1); return { from: toWall(t), to: endOfDay(t) }; }
    case 'weekend': {
      const dow = now.getDay(); // 0 = dimanche … 6 = samedi
      if (dow === 6 || dow === 0) return { from: toWall(now), to: endOfDay(addDays(today, dow === 6 ? 1 : 0)) };
      const fri = addDays(today, 5 - dow);
      const fri18 = new Date(fri.getFullYear(), fri.getMonth(), fri.getDate(), 18, 0);
      return { from: toWall(fri18 > now ? fri18 : now), to: endOfDay(addDays(fri, 2)) };
    }
    case 'dates': {
      const from = f.from ? parseWall(`${f.from}T00:00`) : today;
      let to = f.to ? parseWall(`${f.to}T00:00`) : from;
      if (to < from) to = from;
      return { from: toWall(from <= today ? now : from), to: endOfDay(to) };
    }
    default: return { from: toWall(now), to: endOfDay(addDays(today, 6)) };
  }
}

// Premier créneau de l'événement qui tombe dans la période (ou null).
function slotIn(ev, r) {
  if (ev.slots) {
    for (const sl of ev.slots) if (sl[1] >= r.from && sl[0] <= r.to) return sl;
    return null;
  }
  return ev.end >= r.from && ev.start <= r.to ? [ev.start, ev.end] : null;
}
const nextSlot = (ev) => slotIn(ev, { from: nowWall(), to: '9999' });

function placeOk(ev, p) {
  const arrs = Array.isArray(p.paris) ? p.paris : [];
  if (p.paris !== 'all' && !arrs.length && !p.banlieue.length) return true; // rien coché = partout
  if (ev.zone === 'paris') return p.paris === 'all' || (ev.arr != null && arrs.includes(ev.arr));
  if (ev.zone === 'banlieue') return p.banlieue.includes(GRANDE_COURONNE.includes(ev.dept) ? 'gc' : ev.dept);
  return false;
}

function catOk(ev, f) {
  const sel = f.cats[ev.cat];
  if (!sel) return false;
  return !sel.length || sel.some((t) => ev.tags.includes(t));
}

function baseOk(ev, f, r) {
  if (!placeOk(ev, f.places)) return false;
  if (f.options.includes('gratuit') && !ev.free) return false;
  if (f.options.includes('nouveaute') && !ev.isNew) return false;
  if (f.options.includes('billetterie') && !ev.ticketUrl) return false;
  if (f.options.includes('municipal') && !ev.municipal) return false;
  if (f.access?.length && !f.access.every((a) => ev.a11y?.includes(a))) return false;
  return !!slotIn(ev, r);
}

// La pile : les catégories sont alternées (concert, ciné, expo, event…), chacune triée par date.
function buildDeck() {
  const f = S.filters;
  const r = rangeFor(f);
  const buckets = CATEGORIES.map((c) => S.events
    .filter((e) => e.cat === c.id && !S.decisions[e.id] && catOk(e, f) && baseOk(e, f, r))
    .map((e) => { const sl = slotIn(e, r); return { e, k: `${sl[0] > r.from ? sl[0] : r.from}|${sl[1]}` }; })
    .sort((a, b) => a.k.localeCompare(b.k))
    .map((x) => x.e));
  const deck = [];
  for (let i = 0; buckets.some((b) => i < b.length); i++) for (const b of buckets) if (i < b.length) deck.push(b[i]);
  S.deck = deck;
  S.history = [];
  S.deckBuiltFor = JSON.stringify(f);
}

function summary(f) {
  const when = f.when === 'dates'
    ? (f.from ? `${fmtDate(`${f.from}T00:00`)}${f.to && f.to !== f.from ? ` → ${fmtDate(`${f.to}T00:00`)}` : ''}` : 'Dates')
    : WHEN.find((w) => w.id === f.when)?.label;
  const arrs = Array.isArray(f.places.paris) ? f.places.paris : [];
  const where = [
    f.places.paris === 'all' ? 'Tout Paris' : arrs.length ? `Paris ${arrs.slice().sort((a, b) => a - b).map((a) => (a === 1 ? '1er' : `${a}e`)).join(', ')}` : null,
    f.places.banlieue.length ? `Banlieue ${f.places.banlieue.map((b) => (b === 'gc' ? 'GC' : b)).join(', ')}` : null,
  ].filter(Boolean).join(' + ') || 'Partout';
  const cats = CATEGORIES.filter((c) => f.cats[c.id]);
  const what = cats.length === CATEGORIES.length && cats.every((c) => !f.cats[c.id].length)
    ? 'Tout'
    : cats.map((c) => c.label + (f.cats[c.id].length ? ` (${f.cats[c.id].length})` : '')).join(', ') || 'Rien';
  const acc = (f.access || []).map((a) => ACC[a]?.emoji).join('');
  return `${when} · ${where} · ${what}${acc ? ` · ${acc}` : ''}`;
}

// ════════════════════════════════════════════════════════════
//  Fragments d'interface
// ════════════════════════════════════════════════════════════
function whenLabel(ev, slot = nextSlot(ev)) {
  const multiDay = ev.end.slice(0, 10) !== ev.start.slice(0, 10);
  if (multiDay && (!ev.slots || ev.cat === 'expo')) {
    return ev.start <= nowWall() ? `Jusqu'au ${fmtDate(ev.end)}` : `Du ${fmtDate(ev.start)} au ${fmtDate(ev.end)}`;
  }
  if (!slot) return `${fmtDay(ev.start)}`;
  const t = fmtTime(slot[0]);
  const more = ev.slots ? ev.slots.filter((s) => s[1] >= nowWall()).length - 1 : 0;
  return `${fmtDay(slot[0])}${t ? ` · ${t}` : ''}${more > 0 ? ` <span class="muted">(+${more} date${more > 1 ? 's' : ''})</span>` : ''}`;
}
const whereLabel = (ev) => [ev.venue, ev.area].filter(Boolean).join(' · ') || 'Lieu à préciser';
const isLastChance = (ev) => ev.end.slice(0, 10) !== ev.start.slice(0, 10) && ev.end <= toWall(addDays(new Date(), 7)) && ev.start <= nowWall();
const tagLabels = (ev) => (ev.tags || []).map((t) => TAG_LABEL[`${ev.cat}:${t}`]).filter(Boolean);

function badges(ev) {
  const c = CAT[ev.cat];
  return `<span class="badge cat" style="--c:${c.color}">${c.emoji} ${esc(c.label)}</span>`
    + (ev.isNew ? '<span class="badge new">Nouveau</span>' : '')
    + (ev.free ? '<span class="badge free">Gratuit</span>' : '')
    + (isLastChance(ev) ? '<span class="badge last">Dernière chance</span>' : '')
    + (ev.municipal ? '<span class="badge ville" title="Lieu de la Ville de Paris">🏛️ Lieu municipal</span>' : '')
    + a11yBadge(ev);
}

// Pictos d'accessibilité (déclarée par l'organisateur), lisibles par les lecteurs d'écran.
function a11yBadge(ev) {
  const list = (ev.a11y || []).map((a) => ACC[a]).filter(Boolean);
  if (!list.length) return '';
  const label = list.map((a) => a.long).join(', ');
  return `<span class="badge a11y" role="img" title="${esc(label)}" aria-label="${esc(label)}">${list.map((a) => a.emoji).join('')}</span>`;
}

function coverHTML(ev, cls = 'cover') {
  const c = CAT[ev.cat];
  const fallback = `<div class="cover-fallback" style="--c:${c.color}55">${c.emoji}</div>`;
  if (!safeUrl(ev.image)) return fallback;
  return `${fallback}<img class="${cls}" src="${esc(ev.image)}" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.remove()">`;
}

function cardHTML(ev, pos) {
  const ticket = safeUrl(ev.ticketUrl);
  const tags = tagLabels(ev).slice(0, 3);
  return `
  <article class="card" data-id="${esc(ev.id)}" data-pos="${pos}" style="z-index:${10 - pos}" aria-label="${esc(ev.title)}">
    ${coverHTML(ev)}
    <div class="shade"></div>
    <div class="card-top">${badges(ev)}</div>
    <div class="stamp stamp-oui">Oui</div>
    <div class="stamp stamp-non">Non</div>
    <div class="stamp stamp-pp">Pourquoi pas</div>
    <div class="card-body">
      <h2>${esc(ev.title)}</h2>
      <div class="line"><span class="ico">📅</span><b>${whenLabel(ev, slotIn(ev, rangeFor(S.filters)) || undefined)}</b></div>
      <div class="line"><span class="ico">📍</span><span>${esc(whereLabel(ev))}</span></div>
      ${ev.text ? `<p class="text">${esc(ev.text)}</p>` : ''}
      ${tags.length ? `<div class="tagline">${tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="card-foot">
        ${ticket ? `<a class="btn primary small" href="${esc(ticket)}" target="_blank" rel="noopener">🎟️ Billetterie</a>` : ''}
        <button class="btn ghost small" data-open="${esc(ev.id)}">Détails</button>
        <button class="btn ghost small" data-share="${esc(ev.id)}" aria-label="Partager">↗ Partager</button>
      </div>
    </div>
  </article>`;
}

const savedCount = () => Object.values(S.decisions).filter((d) => d.d !== 'non').length;

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

// ════════════════════════════════════════════════════════════
//  Vue : la pile à swiper
// ════════════════════════════════════════════════════════════
function renderDeck() {
  if (S.deckBuiltFor !== JSON.stringify(S.filters)) buildDeck();
  S.lastView = 'deck';
  const wide = isWide();
  app.innerHTML = `${topbarHTML('deck')}
    ${wide ? '<div class="split"><section class="deckcol">' : ''}
    <main class="deck" id="deck"></main>
    <nav class="actions" aria-label="Décision">
      <button class="act undo" data-undo aria-label="Annuler le dernier swipe"><span class="disc">↺</span></button>
      <button class="act non" data-decide="non"><span class="disc">✕</span>Non</button>
      <button class="act pp" data-decide="peutetre"><span class="disc">?</span>Pourquoi pas</button>
      <button class="act oui" data-decide="oui"><span class="disc">♥</span>Oui</button>
    </nav>
    ${wide ? `</section>${mapPanelHTML('aside', 'side')}</div>` : ''}`;
  renderStack();
  if (wide) initMap();
}

function renderStack() {
  const deck = $('#deck');
  if (!deck) return;
  const top3 = S.deck.slice(0, 3);
  if (!top3.length) {
    const saved = savedCount();
    deck.innerHTML = `
      <div class="empty">
        <div class="big">🎉</div>
        <h2>Plus rien à swiper</h2>
        <p>Tu as fait le tour de ces filtres.<br>Élargis la date, le quartier ou les genres pour en voir plus.</p>
        <button class="btn primary" data-go="#/filtres">Modifier les filtres</button>
        ${saved ? `<button class="btn" data-go="#/liste">Voir mes sorties (${saved})</button>` : ''}
      </div>`;
  } else {
    deck.innerHTML = top3.map((ev, i) => cardHTML(ev, i)).join('');
    bindDrag($('.card[data-pos="0"]', deck), top3[0]);
  }
  $$('.act[data-decide]').forEach((b) => { b.disabled = !top3.length; });
  const undo = $('.act.undo');
  if (undo) undo.disabled = !S.history.length;
  const count = $('.icon-btn .count');
  if (count) { count.textContent = savedCount(); count.hidden = !savedCount(); }
  refreshMap();
}

const THRESHOLD = 90;
const dirFrom = (dx, dy) => {
  if (dy < -THRESHOLD && Math.abs(dy) > Math.abs(dx)) return 'peutetre';
  if (dx > THRESHOLD) return 'oui';
  if (dx < -THRESHOLD) return 'non';
  return null;
};
function setStamps(card, dx, dy) {
  const vertical = Math.abs(dy) > Math.abs(dx);
  $('.stamp-oui', card).style.opacity = vertical ? 0 : clamp01(dx / THRESHOLD);
  $('.stamp-non', card).style.opacity = vertical ? 0 : clamp01(-dx / THRESHOLD);
  $('.stamp-pp', card).style.opacity = vertical ? clamp01(-dy / THRESHOLD) : 0;
}

function bindDrag(card, ev) {
  let sx = 0; let sy = 0; let dx = 0; let dy = 0; let dragging = false; let moved = false;
  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a,button') || e.button > 0) return;
    dragging = true; moved = false; sx = e.clientX; sy = e.clientY; dx = 0; dy = 0;
    card.setPointerCapture(e.pointerId);
    card.style.transition = 'none';
  });
  card.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx * 0.05}deg)`;
    setStamps(card, dx, dy);
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    const dir = dirFrom(dx, dy);
    if (dir) { flyOut(card, ev, dir); return; }
    card.style.transition = '';
    card.style.transform = '';
    setStamps(card, 0, 0);
    if (!moved && e.type === 'pointerup') go(`#/e/${ev.id}`);
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
}

function flyOut(card, ev, dir) {
  const w = window.innerWidth;
  const out = {
    oui: `translate(${w * 1.3}px, 60px) rotate(24deg)`,
    non: `translate(${-w * 1.3}px, 60px) rotate(-24deg)`,
    peutetre: `translate(0, ${-window.innerHeight}px) rotate(-3deg)`,
  }[dir];
  setStamps(card, dir === 'oui' ? THRESHOLD : dir === 'non' ? -THRESHOLD : 0, dir === 'peutetre' ? -THRESHOLD : 0);
  card.style.transition = 'transform .32s ease-in, opacity .32s ease-in';
  card.style.transform = out;
  card.style.opacity = '0';
  decide(ev, dir);
  if (DECISIONS[dir].toast) toast(DECISIONS[dir].toast);
  setTimeout(renderStack, 260);
}

function decide(ev, d) {
  S.decisions[ev.id] = { d, at: Date.now(), snap: snapshot(ev), plan: S.decisions[ev.id]?.plan };
  const idx = S.deck.findIndex((x) => x.id === ev.id);
  if (idx !== -1) { S.deck.splice(idx, 1); S.history.push({ ev, idx }); }
  save();
}

function undo() {
  const h = S.history.pop();
  if (!h) return;
  delete S.decisions[h.ev.id];
  S.deck.splice(h.idx, 0, h.ev);
  save();
  renderStack();
}

// Copie légère de l'événement : la liste reste lisible même s'il disparaît des sources.
function snapshot(ev) {
  const { id, cat, title, image, start, end, venue, area, address, ticketUrl, infoUrl, text, free, tags, isNew, lat, lon, a11y, municipal, source, credit } = ev;
  return { id, cat, title, image, start, end, slots: ev.slots ? ev.slots.slice(0, 20) : null, venue, area, address, ticketUrl, infoUrl, text, free, tags, isNew, lat, lon, a11y, municipal, source, credit };
}

// ════════════════════════════════════════════════════════════
//  Vue : filtres
// ════════════════════════════════════════════════════════════
function renderFilters() {
  if (!S.draft) S.draft = structuredClone(S.filters);
  const f = S.draft;
  const r = rangeFor(f);
  const base = S.events.filter((e) => !S.decisions[e.id] && baseOk(e, f, r));
  const total = base.filter((e) => catOk(e, f)).length;
  // Compteurs d'accessibilité : calculés sans le filtre d'accessibilité lui-même.
  const accessBase = f.access.length
    ? S.events.filter((e) => !S.decisions[e.id] && catOk(e, f) && baseOk(e, { ...f, access: [] }, r))
    : base.filter((e) => catOk(e, f));
  const arrs = Array.isArray(f.places.paris) ? f.places.paris : [];
  const scroll = $('.page')?.scrollTop || 0;
  const first = !S.onboarded;

  app.innerHTML = `
  <div class="page">
    ${first ? `
      <div class="hero">
        <h1>On sort où&nbsp;?</h1>
        <p>Choisis quand, où et ce qui te branche. Ensuite : swipe à droite si t'es chaud·e, à gauche si non, vers le haut pour « pourquoi pas ».</p>
        <p class="hero-note">Gratuit, sans compte ni pub, tes choix restent sur ton téléphone. <button class="link-btn" data-go="#/apropos">En savoir plus</button></p>
      </div>` : `
      <div class="page-head">
        <button class="icon-btn" data-cancel aria-label="Fermer">✕</button>
        <h1>Filtres</h1>
        <button class="link-btn" data-reset-filters>Réinitialiser</button>
      </div>`}

    <section class="section">
      <h2>Quand ?</h2>
      <div class="chips">
        ${WHEN.map((w) => `<button class="chip" data-when="${w.id}" aria-pressed="${f.when === w.id}">${w.label}</button>`).join('')}
      </div>
      ${f.when === 'dates' ? `
        <div class="dates">
          <label>Du<input type="date" data-date="from" value="${esc(f.from || toWall(new Date()).slice(0, 10))}" min="${toWall(new Date()).slice(0, 10)}"></label>
          <label>Au<input type="date" data-date="to" value="${esc(f.to || f.from || toWall(new Date()).slice(0, 10))}" min="${esc(f.from || toWall(new Date()).slice(0, 10))}"></label>
        </div>` : ''}
    </section>

    <section class="section">
      <h2>Où ?</h2>
      <div class="chips"><button class="chip" data-paris-all aria-pressed="${f.places.paris === 'all'}">Tout Paris</button></div>
      <p class="sub">ou seulement certains arrondissements :</p>
      <div class="arr-grid">
        ${Array.from({ length: 20 }, (_, i) => i + 1).map((a) => `<button class="chip sm" data-arr="${a}" aria-pressed="${arrs.includes(a)}">${a === 1 ? '1er' : `${a}e`}</button>`).join('')}
      </div>
      <p class="sub">Banlieue :</p>
      <div class="chips">
        ${BANLIEUE.map((b) => `<button class="chip sm" data-banlieue="${b.id}" aria-pressed="${f.places.banlieue.includes(b.id)}">${esc(b.label)}</button>`).join('')}
      </div>
    </section>

    <section class="section">
      <h2>Quoi ?</h2>
      ${CATEGORIES.map((c) => {
        const sel = f.cats[c.id];
        const inCat = base.filter((e) => e.cat === c.id);
        const n = sel ? inCat.filter((e) => !sel.length || sel.some((t) => e.tags.includes(t))).length : inCat.length;
        return `
        <div class="cat-row ${sel ? 'on' : ''}" style="--c:${c.color}">
          <button class="cat-toggle" data-cat="${c.id}" aria-pressed="${!!sel}">
            <span class="emo">${c.emoji}</span>
            <span class="lbl">${esc(c.label)}<small>${n} sortie${n > 1 ? 's' : ''}${sel && sel.length ? ` · ${sel.length} genre${sel.length > 1 ? 's' : ''}` : sel ? ' · tous les genres' : ''}</small></span>
            <span class="switch" aria-hidden="true"></span>
          </button>
          ${sel ? `
          <div class="cat-tags">
            <p class="hint">Touche des genres pour affiner (rien de coché = tout) :</p>
            <div class="chips">
              ${c.tags.map((t) => {
                const k = inCat.filter((e) => e.tags.includes(t.id)).length;
                return `<button class="chip sm" data-tag="${c.id}:${t.id}" aria-pressed="${sel.includes(t.id)}" ${k ? '' : 'data-zero'}>${esc(t.label)} <span class="n">${k}</span></button>`;
              }).join('')}
            </div>
          </div>` : ''}
        </div>`;
      }).join('')}
    </section>

    <section class="section">
      <h2>Options</h2>
      <div class="chips">
        ${OPTIONS.map((o) => `<button class="chip sm" data-option="${o.id}" aria-pressed="${f.options.includes(o.id)}">${esc(o.label)}</button>`).join('')}
      </div>
    </section>

    <section class="section">
      <h2>Accessibilité</h2>
      <div class="chips">
        ${ACCESS.map((a) => {
          const k = accessBase.filter((e) => e.a11y?.includes(a.id)).length;
          return `<button class="chip sm" data-access="${a.id}" aria-pressed="${f.access.includes(a.id)}" aria-label="${esc(a.long)}" ${k ? '' : 'data-zero'}>${a.emoji} ${esc(a.label)} <span class="n">${k}</span></button>`;
        }).join('')}
      </div>
      <p class="sub">D'après les organisateurs. Une sortie sans picto n'est pas forcément inaccessible : l'info n'a juste pas été donnée, renseigne-toi auprès du lieu.</p>
    </section>

    <div class="sticky-foot">
      <button class="btn primary block" data-apply ${total ? '' : 'disabled'}>${total ? `Swiper ${total} sortie${total > 1 ? 's' : ''}` : 'Aucune sortie avec ces filtres'}</button>
    </div>
    <div class="foot-note">
      Données : ${(S.meta?.sources || []).map((s) => `<a href="${esc(safeUrl(s.url) || '#')}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(', ')}
      (Ville de Paris, licence ODbL) · mises à jour le ${S.meta ? `${fmtDate(S.meta.generatedAt)} à ${fmtTime(S.meta.generatedAt) || '0h'}` : '—'}.<br>
      <button class="link-btn" data-go="#/apropos">À propos · crédits · confidentialité</button><br>
      ${Object.values(S.decisions).some((d) => d.d === 'non') ? '<button class="link-btn" data-reset-non>Revoir les sorties que j\'ai passées (Non)</button>' : ''}
    </div>
  </div>`;
  $('.page').scrollTop = scroll;
}

function onFilterClick(t) {
  const f = S.draft;
  if (t.dataset.when) {
    f.when = t.dataset.when;
    if (f.when === 'dates' && !f.from) { f.from = toWall(new Date()).slice(0, 10); f.to = f.from; }
  } else if ('parisAll' in t.dataset) {
    f.places.paris = f.places.paris === 'all' ? [] : 'all';
  } else if (t.dataset.arr) {
    const a = Number(t.dataset.arr);
    const arrs = Array.isArray(f.places.paris) ? f.places.paris : [];
    f.places.paris = arrs.includes(a) ? arrs.filter((x) => x !== a) : [...arrs, a];
  } else if (t.dataset.banlieue) {
    const b = t.dataset.banlieue;
    f.places.banlieue = f.places.banlieue.includes(b) ? f.places.banlieue.filter((x) => x !== b) : [...f.places.banlieue, b];
  } else if (t.dataset.cat) {
    f.cats[t.dataset.cat] = f.cats[t.dataset.cat] ? null : [];
  } else if (t.dataset.tag) {
    const [c, tag] = t.dataset.tag.split(':');
    const sel = f.cats[c] || [];
    f.cats[c] = sel.includes(tag) ? sel.filter((x) => x !== tag) : [...sel, tag];
  } else if (t.dataset.option) {
    const o = t.dataset.option;
    f.options = f.options.includes(o) ? f.options.filter((x) => x !== o) : [...f.options, o];
  } else if (t.dataset.access) {
    const a = t.dataset.access;
    f.access = f.access.includes(a) ? f.access.filter((x) => x !== a) : [...f.access, a];
  } else if ('resetFilters' in t.dataset) {
    S.draft = defaultFilters();
  } else if ('resetNon' in t.dataset) {
    for (const [id, d] of Object.entries(S.decisions)) if (d.d === 'non') delete S.decisions[id];
    save();
    S.deckBuiltFor = null;
    toast('Les « Non » reviennent dans la pile');
  } else if ('apply' in t.dataset) {
    S.filters = S.draft;
    S.draft = null;
    S.onboarded = true;
    S.deckBuiltFor = null;
    save();
    go(S.lastView === 'carte' ? '#/carte' : '#/', { replace: true });
    return;
  } else if ('cancel' in t.dataset) {
    S.draft = null;
    go(S.lastView === 'carte' ? '#/carte' : '#/', { replace: true });
    return;
  } else {
    return;
  }
  renderFilters();
}

// ════════════════════════════════════════════════════════════
//  Vue : mes sorties
// ════════════════════════════════════════════════════════════
// Un événement « sur plusieurs jours » (expo, spectacle à l'affiche sans horaires précis)
// n'a pas une date unique : on le range à part, trié par date de fin.
const isRanged = (ev) => ev.end.slice(0, 10) !== ev.start.slice(0, 10) && (!ev.slots || ev.cat === 'expo');
const dayKey = (d) => toWall(d).slice(0, 10);
const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function dayTitle(key) {
  const d = parseWall(`${key}T00:00`);
  const full = `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
  const rel = fmtDay(`${key}T00:00`);
  return rel === "Aujourd'hui" || rel === 'Demain' ? `${rel} · ${full}` : cap(full);
}

// Ouvert ce jour-là ? (pour les événements sur plusieurs jours)
const coversDay = (ev, key) => (ev.slots
  ? ev.slots.some((s) => s[0].slice(0, 10) <= key && s[1].slice(0, 10) >= key)
  : ev.start.slice(0, 10) <= key && ev.end.slice(0, 10) >= key);

function savedItems() {
  const now = nowWall();
  return Object.values(S.decisions)
    .filter((d) => d.d === 'oui' || d.d === 'peutetre')
    .map((d) => {
      const ev = S.byId.get(d.snap.id) || d.snap;
      const plan = d.plan && d.plan.end >= now ? d.plan : null; // date choisie via « Ajouter à mon agenda »
      const upcoming = plan ? [[plan.start, plan.end]]
        : ev.slots ? ev.slots.filter((s) => s[1] >= now) : (ev.end >= now ? [[ev.start, ev.end]] : []);
      return { ev, d: d.d, ranged: plan ? false : isRanged(ev), planned: !!plan, upcoming, past: !upcoming.length };
    });
}

function calendarHTML(items) {
  const today = dayKey(new Date());
  const ym = S.listMonth || today.slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7; // semaine qui commence le lundi
  const nbDays = new Date(y, m, 0).getDate();
  const cells = Math.ceil((offset + nbDays) / 7) * 7;

  // Pastilles : une par sortie datée, sur chacun de ses jours de représentation.
  const dots = {};
  for (const it of items) {
    if (it.ranged || it.past) continue;
    for (const s of it.upcoming.slice(0, 30)) (dots[s[0].slice(0, 10)] ||= []).push(it.d);
  }

  const days = Array.from({ length: cells }, (_, i) => addDays(first, i - offset)).map((d) => {
    const k = dayKey(d);
    const ds = dots[k] || [];
    const cls = [d.getMonth() !== m - 1 && 'out', k === today && 'today', k === S.listDay && 'sel', k < today && 'before'].filter(Boolean).join(' ');
    return `<button class="cal-day ${cls}" data-cal-day="${k}" aria-pressed="${k === S.listDay}" aria-label="${dayTitle(k)}${ds.length ? `, ${ds.length} sortie${ds.length > 1 ? 's' : ''}` : ''}">
      <span class="num">${d.getDate()}</span>
      <span class="dots">${ds.slice(0, 3).map((x) => `<i class="${x}"></i>`).join('')}${ds.length > 3 ? '<b>+</b>' : ''}</span>
    </button>`;
  }).join('');

  return `
  <div class="cal">
    <div class="cal-head">
      <button class="icon-btn sm" data-cal-month="-1" aria-label="Mois précédent">‹</button>
      <b>${cap(MOIS_LONG[m - 1])} ${y}</b>
      <button class="icon-btn sm" data-cal-month="1" aria-label="Mois suivant">›</button>
    </div>
    <div class="cal-grid">
      ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x) => `<span class="dow">${x}</span>`).join('')}
      ${days}
    </div>
    <div class="cal-legend">
      <span><i class="oui"></i>Oui</span><span><i class="peutetre"></i>Pourquoi pas</span>
      ${S.listDay ? '<button class="link-btn" data-cal-clear>Voir toutes les dates</button>' : ''}
    </div>
  </div>`;
}

function renderList(tab = 'tout') {
  const all = savedItems();
  const items = tab === 'tout' ? all : all.filter((i) => i.d === tab);
  const counts = { tout: all.length, oui: all.filter((i) => i.d === 'oui').length, peutetre: all.filter((i) => i.d === 'peutetre').length };

  const itemHTML = ({ ev, d, upcoming, past, ranged, planned }, slot) => {
    const ticket = safeUrl(ev.ticketUrl);
    const other = d === 'oui' ? 'peutetre' : 'oui';
    let when;
    if (past) when = 'Passé';
    else if (ranged) when = ev.start <= nowWall() ? `Jusqu'au ${fmtDate(ev.end)}` : `Du ${fmtDate(ev.start)} au ${fmtDate(ev.end)}`;
    else {
      const t = fmtTime((slot || upcoming[0])[0]);
      const others = upcoming.length - 1;
      if (planned) when = `${t || 'Toute la journée'} <span class="muted">· 📅 dans ton agenda</span>`;
      else when = `${t || 'Horaire à préciser'}${others > 0 ? ` <span class="muted">· ${others} autre${others > 1 ? 's' : ''} date${others > 1 ? 's' : ''}</span>` : ''}`;
    }
    return `
    <div class="item ${d} ${past ? 'past' : ''}">
      ${safeUrl(ev.image) ? `<img class="thumb" src="${esc(ev.image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<div class="thumb">${CAT[ev.cat]?.emoji || '✨'}</div>`}
      <div class="meta">
        <button class="item-title" data-go="#/e/${esc(ev.id)}">${esc(ev.title)}</button>
        <div class="line"><span class="mark ${d}">${d === 'oui' ? '♥' : '?'}</span> ${when}</div>
        <div class="line">📍 ${esc(whereLabel(ev))}</div>
        <div class="row">
          ${ticket && !past ? `<a class="btn primary small" href="${esc(ticket)}" target="_blank" rel="noopener">🎟️ Billets</a>` : ''}
          ${!past ? `<button class="btn small" data-share="${esc(ev.id)}">↗ Partager</button>` : ''}
          ${!past ? `<button class="btn small" data-agenda="${esc(ev.id)}" ${S.listDay ? `data-day="${S.listDay}"` : ''} aria-label="Ajouter à mon agenda">📅</button>` : ''}
          <button class="btn small" data-move="${esc(ev.id)}" data-to="${other}">${other === 'oui' ? '→ Oui' : '→ Pourquoi pas'}</button>
          <button class="btn small" data-remove="${esc(ev.id)}" aria-label="Retirer">✕</button>
        </div>
      </div>
    </div>`;
  };

  let body = '';
  if (S.listDay) {
    // Un jour choisi dans le calendrier
    const k = S.listDay;
    const dated = items
      .filter((i) => !i.ranged)
      .map((i) => ({ i, slot: i.upcoming.find((s) => s[0].slice(0, 10) === k) || (i.planned ? null : (i.ev.slots || []).find((s) => s[0].slice(0, 10) === k) || (!i.ev.slots && i.ev.start.slice(0, 10) === k ? [i.ev.start, i.ev.end] : null)) }))
      .filter((x) => x.slot)
      .sort((a, b) => a.slot[0].localeCompare(b.slot[0]));
    const open = items.filter((i) => i.ranged && coversDay(i.ev, k));
    body = `<p class="group-title day">${dayTitle(k)}</p>
      ${dated.length ? dated.map((x) => itemHTML(x.i, x.slot)).join('') : '<p class="none">Rien de calé ce jour-là.</p>'}
      ${open.length ? `<p class="group-title">À voir aussi ce jour-là</p>${open.map((i) => itemHTML(i)).join('')}` : ''}`;
  } else {
    // Toutes les dates : groupées par jour, puis les « plusieurs jours », puis les passés
    const dated = items.filter((i) => !i.ranged && !i.past).sort((a, b) => a.upcoming[0][0].localeCompare(b.upcoming[0][0]));
    const groups = new Map();
    for (const i of dated) {
      const k = i.upcoming[0][0].slice(0, 10);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(i);
    }
    const ranged = items.filter((i) => i.ranged && !i.past).sort((a, b) => a.ev.end.localeCompare(b.ev.end));
    const past = items.filter((i) => i.past);
    body = [...groups].map(([k, list]) => `<p class="group-title day">${dayTitle(k)}</p>${list.map((i) => itemHTML(i)).join('')}`).join('')
      + (ranged.length ? `<p class="group-title">Sur plusieurs jours · à voir avant la fin</p>${ranged.map((i) => itemHTML(i)).join('')}` : '')
      + (past.length ? `<p class="group-title">Passés</p>${past.map((i) => itemHTML(i)).join('')}` : '');
  }

  const emptyIcon = { tout: '📅', oui: '♥', peutetre: '🤔' }[tab];
  app.innerHTML = `
  <div class="page">
    <div class="page-head">
      <button class="icon-btn" data-go="#/" aria-label="Retour">←</button>
      <h1>Mes sorties</h1>
    </div>
    <div class="tabs">
      <button class="chip" data-go="#/liste" aria-pressed="${tab === 'tout'}">Tout <span class="n">${counts.tout}</span></button>
      <button class="chip" data-go="#/liste/oui" aria-pressed="${tab === 'oui'}">♥ Oui <span class="n">${counts.oui}</span></button>
      <button class="chip" data-go="#/liste/peutetre" aria-pressed="${tab === 'peutetre'}">? Pourquoi pas <span class="n">${counts.peutetre}</span></button>
    </div>
    ${items.length ? `<div class="list-layout">${calendarHTML(items)}<div class="items">${body}</div></div>` : `
    <div class="items"><div class="empty" style="position:static;padding:40px 20px"><div class="big">${emptyIcon}</div><p>Rien ici pour l'instant.<br>Swipe à droite (oui) ou vers le haut (pourquoi pas) pour remplir ton agenda.</p><button class="btn primary" data-go="#/">Swiper</button></div></div>`}
  </div>`;
}

// ════════════════════════════════════════════════════════════
//  Vue : fiche événement (aussi la page d'arrivée d'un lien partagé)
// ════════════════════════════════════════════════════════════
function renderDetail(id, params) {
  const ev = S.byId.get(id) || S.decisions[id]?.snap;
  const from = (params.get('de') || '').slice(0, 30);
  if (!ev) {
    app.innerHTML = `
    <div class="page"><div class="empty" style="position:static;margin:40px 16px;padding:40px 20px">
      <div class="big">🕸️</div><h2>Cette sortie n'est plus au programme</h2>
      <p>Elle est peut-être passée, ou retirée par l'organisateur.</p>
      <button class="btn primary" data-go="#/">Découvrir d'autres sorties</button>
    </div></div>`;
    return;
  }
  const c = CAT[ev.cat];
  const dec = S.decisions[id]?.d;
  const ticket = safeUrl(ev.ticketUrl);
  const info = safeUrl(ev.infoUrl);
  const now = nowWall();
  const upcoming = ev.slots ? ev.slots.filter((s) => s[1] >= now) : null;
  const maps = ev.lat && ev.lon
    ? `https://www.google.com/maps/search/?api=1&query=${ev.lat},${ev.lon}`
    : ev.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.address)}` : null;
  const tags = tagLabels(ev);

  app.innerHTML = `
  <div class="page">
    <div class="detail-cover">
      ${coverHTML(ev, '')}
      <div class="shade"></div>
      <button class="icon-btn back" data-back aria-label="Retour">←</button>
      ${ev.credit ? `<span class="credit">© ${esc(ev.credit)}</span>` : ''}
    </div>
    <div class="detail">
      ${from ? `<div class="invite"><b>${esc(from)} te propose cette sortie 👋</b><br>Partant·e ? Réponds avec les boutons en bas, puis dis-lui !</div>` : ''}
      <div class="chips">${badges(ev)}</div>
      <h1>${esc(ev.title)}</h1>
      <div class="line"><span class="ico">📅</span><b>${whenLabel(ev)}</b></div>
      ${upcoming && upcoming.length > 1 ? `<div class="slots">${upcoming.slice(0, 8).map((s) => `<span class="tag">${fmtDay(s[0])}${fmtTime(s[0]) ? ` ${fmtTime(s[0])}` : ''}</span>`).join('')}${upcoming.length > 8 ? `<span class="tag">+${upcoming.length - 8}</span>` : ''}</div>` : ''}
      <div class="line"><span class="ico">📍</span><span>${esc(ev.venue || 'Lieu à préciser')}${ev.address ? `<br><span style="color:var(--muted)">${esc(ev.address)}</span>` : ''}</span></div>
      ${tags.length ? `<div class="tagline" style="margin-left:26px">${tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}</div>` : ''}
      ${ev.municipal ? '<div class="line"><span class="ico">🏛️</span><span>Lieu de la Ville de Paris</span></div>' : ''}
      ${ev.a11y?.length ? `${ev.a11y.map((a) => ACC[a]).filter(Boolean).map((a) => `<div class="line"><span class="ico" aria-hidden="true">${a.emoji}</span><span>${esc(a.long)}</span></div>`).join('')}
        <div class="line"><span class="ico"></span><small class="muted">Accessibilité déclarée par l'organisateur</small></div>` : ''}
      <div class="cta">
        ${ticket ? `<a class="btn primary" href="${esc(ticket)}" target="_blank" rel="noopener">🎟️ Billetterie</a>` : ''}
        <button class="btn" data-share="${esc(ev.id)}">↗ Partager à mes potes</button>
        <button class="btn" data-agenda="${esc(ev.id)}">📅 Ajouter à mon agenda</button>
        ${maps ? `<a class="btn" href="${esc(maps)}" target="_blank" rel="noopener">🧭 Y aller</a>` : ''}
      </div>
      ${ev.text ? `<p class="desc">${esc(ev.text)}${ev.more ? `<br><br>${esc(ev.more)}` : ''}</p>` : ''}
      <p class="source">Source : ${info ? `<a href="${esc(info)}" target="_blank" rel="noopener">${esc(ev.source || 'fiche officielle')}</a>` : esc(ev.source || '—')}${ev.source === 'Que faire à Paris' ? ' · Ville de Paris, licence ODbL' : ''}
        · <button class="link-btn" data-go="#/apropos">crédits</button></p>
    </div>
    <div class="decide-bar" style="--c:${c.color}">
      <button class="non" data-detail-decide="non" aria-pressed="${dec === 'non'}">✕ Non</button>
      <button class="pp" data-detail-decide="peutetre" aria-pressed="${dec === 'peutetre'}">? Pourquoi pas</button>
      <button class="oui" data-detail-decide="oui" aria-pressed="${dec === 'oui'}">♥ Oui</button>
    </div>
  </div>`;
}

// ════════════════════════════════════════════════════════════
//  Vue : à propos (crédits, confidentialité, mentions légales)
// ════════════════════════════════════════════════════════════
function renderAbout() {
  const ext = (href, label) => `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
  const updated = S.meta ? `${fmtDate(S.meta.generatedAt)} à ${fmtTime(S.meta.generatedAt) || '0h'}` : '—';
  app.innerHTML = `
  <div class="page about">
    <div class="page-head">
      <button class="icon-btn" data-back aria-label="Retour">←</button>
      <h1>À propos</h1>
    </div>

    <section class="section">
      <h2>${esc(APP_NAME)}, c'est quoi ?</h2>
      <p>Une app gratuite pour trouver une sortie à Paris en quelques gestes : concerts, cinéma, expos, spectacles. Tu choisis quand, où et ce qui te branche, tu swipes, et tu partages à tes potes.</p>
      <p>C'est un projet personnel et non commercial : pas de compte, pas de pub, pas de pistage.</p>
    </section>

    <section class="section">
      <h2>D'où viennent les sorties</h2>
      <p>Toutes les sorties viennent de ${ext(QFAP_DATASET, '« Que faire à Paris »')}, l'agenda participatif de la <b>Ville de Paris</b> (Direction de la Communication), publié en open data sous ${ext(ODBL, 'licence ODbL')}. Elles sont importées automatiquement deux fois par jour. Dernière mise à jour : ${updated}.</p>
      <p>${esc(APP_NAME)} réorganise ces données (catégories, genres, quartiers, lieux de la Ville). La base qui en résulte est publiée sous la même licence ODbL : ${ext('data/events.json', 'data/events.json')}.</p>
      <p>Les infos d'accessibilité et les tarifs sont ceux déclarés par les organisateurs : en cas de doute, vérifie auprès du lieu.</p>
    </section>

    <section class="section">
      <h2>Crédits</h2>
      <ul class="about-list">
        <li><b>Photos</b> : © leurs auteurs et les organisateurs, crédit indiqué sur chaque fiche quand il est connu.</li>
        <li><b>Carte</b> : fond ${ext('https://openfreemap.org', 'OpenFreeMap')}, © ${ext('https://openmaptiles.org', 'OpenMapTiles')}, données © ${ext('https://www.openstreetmap.org/copyright', 'contributeurs OpenStreetMap')}. Affichage avec ${ext('https://maplibre.org', 'MapLibre GL JS')} (licence BSD).</li>
        <li><b>Police</b> : Bricolage Grotesque (${ext('fonts/OFL.txt', 'SIL Open Font License')}).</li>
        <li><b>Code</b> : ${ext(REPO, 'ouvert sur GitHub')}.</li>
      </ul>
    </section>

    <section class="section">
      <h2>Tes données</h2>
      <ul class="about-list">
        <li><b>Rien n'est collecté.</b> Pas de compte, pas de cookie, pas de mesure d'audience.</li>
        <li>Tes choix (oui, non, pourquoi pas), tes filtres et le prénom que tu donnes pour partager restent <b>dans ce navigateur, sur cet appareil</b>. Personne d'autre n'y a accès.</li>
        <li>Pour fonctionner, l'app se connecte à son hébergeur (GitHub Pages, qui note l'adresse IP dans ses journaux techniques, comme tout site), aux serveurs de la Ville de Paris pour les photos, et à OpenFreeMap pour le fond de carte quand tu ouvres la carte.</li>
        <li>Ta position n'est utilisée que si tu appuies sur ◎ dans la carte et que tu l'acceptes. Elle reste sur ton téléphone.</li>
        <li>Les boutons Billetterie, Google Agenda, WhatsApp ou Y aller t'emmènent vers d'autres services, seulement quand tu appuies dessus. Leurs propres règles s'appliquent alors.</li>
      </ul>
      <button class="btn small" data-wipe>🗑️ Effacer mes choix sur cet appareil</button>
    </section>

    <section class="section">
      <h2>Mentions légales</h2>
      <p>${esc(APP_NAME)} est édité à titre non professionnel par un particulier qui, comme le permet la loi pour la confiance dans l'économie numérique (LCEN), a choisi de rester anonyme. Ses coordonnées ont été communiquées à l'hébergeur.</p>
      <p><b>Hébergeur</b> : GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.</p>
      <p><b>Une erreur, une photo à retirer ?</b> ${ext(`${REPO}/issues`, 'Écris via la page du projet sur GitHub')}.</p>
    </section>

    <div class="foot-note">${esc(APP_NAME)} v${VERSION}</div>
  </div>`;
}

function wipeData() {
  if (!window.confirm('Effacer tes oui, non, pourquoi pas, tes filtres et ton prénom sur cet appareil ?')) return;
  try { localStorage.removeItem(STORE_KEY); } catch { /* stockage indisponible */ }
  Object.assign(S, { filters: defaultFilters(), decisions: {}, name: '', onboarded: false, deckBuiltFor: null, listDay: null });
  toast('C\'est effacé');
  go('#/', { replace: true });
}

// ════════════════════════════════════════════════════════════
//  Vue : carte
//  Fond de carte OpenFreeMap (gratuit, sans clé, usage commercial permis)
//  affiché avec MapLibre, chargé seulement quand on ouvre la carte.
// ════════════════════════════════════════════════════════════
// Hébergée avec l'app (version 4.7.1, licence BSD) : aucun appel à un CDN tiers.
const MAPLIBRE_JS = 'vendor/maplibre-gl/maplibre-gl.js';
const MAPLIBRE_CSS = 'vendor/maplibre-gl/maplibre-gl.css';
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';
const PARIS = { center: [2.3488, 48.8566], zoom: 11.3 };

let mapLibLoading;
function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve();
  mapLibLoading ||= new Promise((resolve, reject) => {
    document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: MAPLIBRE_CSS }));
    const s = Object.assign(document.createElement('script'), { src: MAPLIBRE_JS, async: true });
    s.onload = resolve;
    s.onerror = () => { mapLibLoading = null; reject(new Error('Impossible de charger la carte (connexion ?)')); };
    document.head.append(s);
  });
  return mapLibLoading;
}

// Les sorties filtrées, regroupées par lieu (un point par lieu, même s'il y a plusieurs sorties).
function mapPlaces() {
  const f = S.filters;
  const r = rangeFor(f);
  const places = new Map();
  for (const e of S.events) {
    if (e.lat == null || e.lon == null || S.decisions[e.id]?.d === 'non') continue;
    if (!catOk(e, f) || !baseOk(e, f, r)) continue;
    const key = `${e.lat.toFixed(4)},${e.lon.toFixed(4)}`;
    if (!places.has(key)) places.set(key, { key, lat: e.lat, lon: e.lon, venue: e.venue, area: e.area, events: [] });
    places.get(key).events.push(e);
  }
  for (const p of places.values()) p.events.sort((a, b) => (slotIn(a, r)[0]).localeCompare(slotIn(b, r)[0]));
  return { places, r };
}

function mapGeoJSON(places) {
  return {
    type: 'FeatureCollection',
    features: [...places.values()].map((p) => {
      const saved = p.events.map((e) => S.decisions[e.id]?.d).filter(Boolean);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
        properties: {
          key: p.key, n: p.events.length, cat: p.events[0].cat,
          saved: saved.includes('oui') ? 'oui' : saved.includes('peutetre') ? 'peutetre' : '',
        },
      };
    }),
  };
}

function topbarHTML(view) {
  return `
    <header class="topbar">
      <div class="logo">${esc(APP_NAME)}<i>.</i></div>
      <button class="pill" data-go="#/filtres" aria-label="Modifier les filtres">⚙︎ <span>${esc(summary(S.filters))}</span></button>
      <button class="icon-btn" data-go="#/liste" aria-label="Mes sorties">♥<span class="count" ${savedCount() ? '' : 'hidden'}>${savedCount()}</span></button>
    </header>
    <div class="viewswitch" role="group" aria-label="Affichage">
      <button data-view="#/" aria-pressed="${view === 'deck'}">🃏 Swipe</button>
      <button data-view="#/carte" aria-pressed="${view === 'carte'}">🗺️ Carte</button>
    </div>`;
}

const mapPanelHTML = (tag = 'main', cls = '') => `
    <${tag} class="mapwrap ${cls}">
      <div id="map" aria-label="Carte des sorties"></div>
      <div class="map-count" id="map-count"></div>
      <div class="map-msg" id="map-msg">Chargement de la carte…</div>
      <div class="map-sheet" id="map-sheet" hidden></div>
    </${tag}>`;

function renderMap() {
  if (isWide()) return renderDeck(); // sur grand écran, la carte est déjà à côté de la pile
  S.lastView = 'carte';
  app.innerHTML = `${topbarHTML('carte')}${mapPanelHTML()}`;
  initMap();
}

function initMap() {
  if (S.map) { S.map.remove(); S.map = null; }
  const { places } = mapPlaces();
  const fresh = S.mapFitFor !== JSON.stringify(S.filters); // filtres changés : on recadre
  if (fresh) { S.mapView = null; S.mapPlace = null; S.mapFitFor = JSON.stringify(S.filters); }
  const nEv = [...places.values()].reduce((s, p) => s + p.events.length, 0);
  $('#map-count').textContent = `${nEv} sortie${nEv > 1 ? 's' : ''} · ${places.size} lieu${places.size > 1 ? 'x' : ''}`;

  loadMapLibre().then(() => {
    if (!$('#map')) return; // on a quitté la carte entre-temps
    const colors = ['match', ['get', 'cat'], ...CATEGORIES.flatMap((c) => [c.id, c.color]), '#ffffff'];
    const map = new maplibregl.Map({
      container: 'map', style: MAP_STYLE, attributionControl: false,
      ...(S.mapView || PARIS),
    });
    S.map = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, showAccuracyCircle: false }), 'top-right');

    map.on('load', () => {
      $('#map-msg')?.remove();
      map.addSource('sorties', {
        type: 'geojson', data: mapGeoJSON(places),
        cluster: true, clusterRadius: 34, clusterMaxZoom: 14,
        clusterProperties: { total: ['+', ['get', 'n']] },
      });
      map.addLayer({
        id: 'clusters', type: 'circle', source: 'sorties', filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#f4f4f6', 'circle-opacity': 0.92,
          'circle-radius': ['step', ['get', 'total'], 15, 10, 19, 40, 24, 120, 30],
          'circle-stroke-width': 3, 'circle-stroke-color': 'rgba(244,244,246,.25)',
        },
      });
      map.addLayer({
        id: 'cluster-count', type: 'symbol', source: 'sorties', filter: ['has', 'point_count'],
        layout: { 'text-field': ['to-string', ['get', 'total']], 'text-font': ['Noto Sans Regular'], 'text-size': 13, 'text-allow-overlap': true },
        paint: { 'text-color': '#0e0e12' },
      });
      map.addLayer({
        id: 'places', type: 'circle', source: 'sorties', filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': colors,
          'circle-radius': ['case', ['>', ['get', 'n'], 1], 12, 8],
          'circle-stroke-width': ['case', ['!=', ['get', 'saved'], ''], 4, 2],
          'circle-stroke-color': ['match', ['get', 'saved'], 'oui', '#2bd576', 'peutetre', '#ffc23d', '#0e0e12'],
        },
      });
      map.addLayer({
        id: 'place-count', type: 'symbol', source: 'sorties', filter: ['all', ['!', ['has', 'point_count']], ['>', ['get', 'n'], 1]],
        layout: { 'text-field': ['to-string', ['get', 'n']], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-allow-overlap': true },
        paint: { 'text-color': '#0e0e12' },
      });

      $('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'); // crédits repliés (bouton ⓘ)
      if (!S.mapView && places.size) {
        // On cadre sur Paris s'il y a des sorties dans Paris : quelques points lointains en banlieue
        // ne doivent pas faire dézoomer toute la carte.
        const all = [...places.values()];
        const inParis = all.filter((p) => p.events[0].zone === 'paris');
        const b = new maplibregl.LngLatBounds();
        (inParis.length ? inParis : all).forEach((p) => b.extend([p.lon, p.lat]));
        map.fitBounds(b, { padding: 50, maxZoom: 14, duration: 0 });
        if (inParis.length > 40 && map.getZoom() < 11.8) map.jumpTo({ zoom: 11.8 }); // sinon tout Paris tient dans un seul rond
      }
      if (S.mapPlace && places.has(S.mapPlace)) openPlace(S.mapPlace);
      map.addSource('focus', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'focus', type: 'circle', source: 'focus',
        paint: { 'circle-radius': 22, 'circle-color': 'rgba(255,255,255,.14)', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' },
      });
      highlightTop(false);
    });

    map.on('click', 'clusters', async (e) => {
      const f = e.features[0];
      const zoom = await map.getSource('sorties').getClusterExpansionZoom(f.properties.cluster_id);
      map.easeTo({ center: f.geometry.coordinates, zoom: zoom + 0.3 });
    });
    map.on('click', 'places', (e) => openPlace(e.features[0].properties.key));
    map.on('click', (e) => {
      if (!map.queryRenderedFeatures(e.point, { layers: ['places', 'clusters'] }).length) closePlace();
    });
    for (const l of ['clusters', 'places']) {
      map.on('mouseenter', l, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', l, () => { map.getCanvas().style.cursor = ''; });
    }
    map.on('moveend', () => { S.mapView = { center: map.getCenter(), zoom: map.getZoom() }; });
  }).catch((err) => {
    const msg = $('#map-msg');
    if (msg) msg.textContent = err.message;
  });
}

// Grand écran : la carte suit la sortie du dessus de la pile.
function highlightTop(move = true) {
  const src = S.map?.getSource('focus');
  if (!src || !$('#deck')) return;
  const ev = S.deck[0];
  const here = ev && ev.lat != null;
  src.setData({ type: 'FeatureCollection', features: here ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [ev.lon, ev.lat] }, properties: {} }] : [] });
  if (move && here) S.map.easeTo({ center: [ev.lon, ev.lat], zoom: Math.max(S.map.getZoom(), 13), duration: 700 });
}

function refreshMap() {
  const src = S.map?.getSource('sorties');
  if (!src) return;
  src.setData(mapGeoJSON(mapPlaces().places));
  highlightTop();
}

function openPlace(key) {
  const { places, r } = mapPlaces();
  const p = places.get(key);
  const sheet = $('#map-sheet');
  if (!p || !sheet) { closePlace(); return; }
  S.mapPlace = key;
  sheet.hidden = false;
  sheet.innerHTML = `
    <div class="map-sheet-head">
      <div><b>${esc(p.venue || 'Lieu')}</b><small>${esc(p.area || '')} · ${p.events.length} sortie${p.events.length > 1 ? 's' : ''}</small></div>
      <button class="icon-btn sm" data-close-place aria-label="Fermer">✕</button>
    </div>
    ${p.events.map((ev) => {
      const d = S.decisions[ev.id]?.d;
      return `
      <div class="mini">
        ${safeUrl(ev.image) ? `<img class="thumb" src="${esc(ev.image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<div class="thumb">${CAT[ev.cat].emoji}</div>`}
        <div class="meta">
          <button class="item-title" data-go="#/e/${esc(ev.id)}">${esc(ev.title)}</button>
          <div class="line"><span class="dot" style="background:${CAT[ev.cat].color}"></span>${whenLabel(ev, slotIn(ev, r) || undefined)}</div>
          <div class="acts">
            <button class="non" data-map-decide="non" data-id="${esc(ev.id)}" aria-pressed="${d === 'non'}" aria-label="Non">✕</button>
            <button class="pp" data-map-decide="peutetre" data-id="${esc(ev.id)}" aria-pressed="${d === 'peutetre'}" aria-label="Pourquoi pas">?</button>
            <button class="oui" data-map-decide="oui" data-id="${esc(ev.id)}" aria-pressed="${d === 'oui'}" aria-label="Oui">♥</button>
            <button class="more" data-go="#/e/${esc(ev.id)}">Détails</button>
          </div>
        </div>
      </div>`;
    }).join('')}`;
  sheet.scrollTop = 0;
}

function closePlace() {
  S.mapPlace = null;
  const sheet = $('#map-sheet');
  if (sheet) { sheet.hidden = true; sheet.innerHTML = ''; }
}

function mapDecide(id, d) {
  const ev = S.byId.get(id);
  if (!ev) return;
  if (S.decisions[id]?.d === d) { delete S.decisions[id]; S.deckBuiltFor = null; save(); }
  else { decide(ev, d); if (DECISIONS[d].toast) toast(DECISIONS[d].toast); }
  const count = $('.icon-btn .count');
  if (count) { count.textContent = savedCount(); count.hidden = !savedCount(); }
  const { places } = mapPlaces();
  S.map?.getSource('sorties')?.setData(mapGeoJSON(places));
  if (places.has(S.mapPlace)) openPlace(S.mapPlace); else closePlace();
}

// ════════════════════════════════════════════════════════════
//  Partage
// ════════════════════════════════════════════════════════════
function shareLink(ev, name) {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#/e/${encodeURIComponent(ev.id)}${name ? `?de=${encodeURIComponent(name)}` : ''}`;
}
function shareText(ev) {
  const when = whenLabel(ev).replace(/<[^>]+>/g, '');
  return `${CAT[ev.cat]?.emoji || '✨'} ${ev.title}\n📅 ${when}\n📍 ${whereLabel(ev)}\nPartant·e ?`;
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }
}

function openShare(id) {
  const ev = S.byId.get(id) || S.decisions[id]?.snap;
  if (!ev) return;
  const { wrap, close } = openSheet('Partager à tes potes', ev, `
      <label class="field">Ton prénom (tes potes verront qui les invite)
        <input id="share-name" value="${esc(S.name)}" placeholder="ex. Camille" maxlength="30" autocomplete="given-name">
      </label>
      <div class="share-grid">
        ${navigator.share ? '<button class="btn primary" data-act="native" style="grid-column:1/-1">📤 Partager…</button>' : ''}
        <button class="btn" data-act="whatsapp">💬 WhatsApp</button>
        <button class="btn" data-act="sms">✉️ SMS</button>
        <button class="btn" data-act="copy" style="grid-column:1/-1">🔗 Copier le message + lien</button>
      </div>`);
  wrap.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    S.name = $('#share-name', wrap).value.trim();
    save();
    const link = shareLink(ev, S.name);
    const text = shareText(ev);
    const full = `${text} 👉 ${link}`;
    if (act === 'native') {
      try { await navigator.share({ title: ev.title, text, url: link }); close(); } catch { /* annulé */ }
    } else if (act === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(full)}`, '_blank', 'noopener');
      close();
    } else if (act === 'sms') {
      location.href = `sms:?&body=${encodeURIComponent(full)}`;
      close();
    } else if (act === 'copy') {
      if (await copy(full)) { toast('Copié ! Colle-le dans ta conv 👌'); close(); }
    }
  });
}

// Feuille du bas (partage, agenda…) : aperçu de la sortie + contenu libre.
function openSheet(title, ev, inner) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `
    <div class="sheet-backdrop" data-close></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grab"></div>
      <h3>${esc(title)}</h3>
      <div class="share-preview">
        ${safeUrl(ev.image) ? `<img src="${esc(ev.image)}" alt="">` : `<div class="thumb">${CAT[ev.cat]?.emoji}</div>`}
        <div><b>${esc(ev.title)}</b><small>${whenLabel(ev).replace(/<[^>]+>/g, '')} · ${esc(whereLabel(ev))}</small></div>
      </div>
      ${inner}
    </div>`;
  document.body.append(wrap);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  return { wrap, close };
}

// ════════════════════════════════════════════════════════════
//  Ajouter à mon agenda (Google Agenda, ou fichier .ics pour Apple / Outlook)
// ════════════════════════════════════════════════════════════
const compact = (wall) => wall.replace(/[-:]/g, ''); // "2026-11-07T20:30" → "20261107T2030"
const nextDayKey = (key) => dayKey(addDays(parseWall(`${key}T00:00`), 1));

// Transforme un créneau en rendez-vous d'agenda : à l'heure, ou sur la journée si l'heure est inconnue.
function planFromSlot(start, end) {
  const day = start.slice(0, 10);
  if (start.slice(11, 16) === '00:00') return { start: `${day}T00:00`, end: `${day}T23:59`, allDay: true };
  const dur = end ? parseWall(end) - parseWall(start) : 0;
  const fin = dur > 0 && dur <= 12 * 36e5 ? end : toWall(new Date(parseWall(start).getTime() + 2 * 36e5));
  return { start, end: fin, allDay: false };
}

// Pour un jour donné d'une sortie sur plusieurs jours : les horaires de ce jour s'ils sont connus, sinon la journée.
function planForDay(ev, key) {
  const slot = (ev.slots || []).find((s) => s[0].slice(0, 10) === key);
  return slot ? planFromSlot(slot[0], slot[1]) : { start: `${key}T00:00`, end: `${key}T23:59`, allDay: true };
}

const agendaLocation = (ev) => [ev.venue, ev.address].filter(Boolean).join(', ');
function agendaDetails(ev) {
  return [
    ev.text,
    safeUrl(ev.ticketUrl) ? `Billetterie : ${ev.ticketUrl}` : null,
    safeUrl(ev.infoUrl) ? `Infos : ${ev.infoUrl}` : null,
    `Ajouté depuis ${APP_NAME}`,
  ].filter(Boolean).join('\n\n');
}

function googleCalendarUrl(ev, plan) {
  const dates = plan.allDay
    ? `${compact(plan.start.slice(0, 10))}/${compact(nextDayKey(plan.start.slice(0, 10)))}`
    : `${compact(plan.start)}00/${compact(plan.end)}00`;
  const p = new URLSearchParams({
    action: 'TEMPLATE', text: ev.title, dates, ctz: 'Europe/Paris',
    details: agendaDetails(ev), location: agendaLocation(ev),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

function downloadIcs(ev, plan) {
  const txt = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const fold = (line) => { // lignes de 75 octets max (règle du format .ics)
    const out = [];
    let rest = line;
    while (rest.length > 60) { out.push(rest.slice(0, 60)); rest = ` ${rest.slice(60)}`; }
    out.push(rest);
    return out.join('\r\n');
  };
  const when = plan.allDay
    ? [`DTSTART;VALUE=DATE:${compact(plan.start.slice(0, 10))}`, `DTEND;VALUE=DATE:${compact(nextDayKey(plan.start.slice(0, 10)))}`]
    : [`DTSTART;TZID=Europe/Paris:${compact(plan.start)}00`, `DTEND;TZID=Europe/Paris:${compact(plan.end)}00`];
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${APP_NAME}//FR`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE', 'TZID:Europe/Paris',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${ev.id}-${compact(plan.start)}@sortir`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    ...when,
    `SUMMARY:${txt(ev.title)}`,
    agendaLocation(ev) ? `LOCATION:${txt(agendaLocation(ev))}` : null,
    `DESCRIPTION:${txt(agendaDetails(ev))}`,
    safeUrl(ev.ticketUrl || ev.infoUrl) ? `URL:${ev.ticketUrl || ev.infoUrl}` : null,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${txt(ev.title)}`, `TRIGGER:${plan.allDay ? '-PT15H' : '-PT2H'}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean);
  const blob = new Blob([`${lines.map(fold).join('\r\n')}\r\n`], { type: 'text/calendar;charset=utf-8' });
  const slug = ev.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/^-|-$/g, '');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${slug || 'sortie'}.ics` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

function openAgenda(id, preferredDay) {
  const ev = S.byId.get(id) || S.decisions[id]?.snap;
  if (!ev) return;
  const now = nowWall();
  const today = now.slice(0, 10);
  const plan0 = S.decisions[id]?.plan;
  let choose; // fonction qui renvoie le rendez-vous choisi
  let picker;

  if (isRanged(ev)) {
    // Expo ou sortie sur plusieurs jours : on choisit son jour.
    const min = ev.start.slice(0, 10) > today ? ev.start.slice(0, 10) : today;
    const max = ev.end.slice(0, 10);
    const def = [preferredDay, plan0?.start.slice(0, 10), min].find((k) => k && k >= min && k <= max);
    picker = max < min ? null : `
      <label class="field">Quel jour tu y vas ? (ouvert jusqu'au ${fmtDate(ev.end)})
        <input type="date" id="agenda-day" value="${def}" min="${min}" max="${max}">
      </label>`;
    choose = (wrap) => {
      const k = $('#agenda-day', wrap).value;
      return k && k >= min && k <= max ? planForDay(ev, k) : null;
    };
  } else {
    // Une ou plusieurs dates précises : on choisit le créneau.
    const slots = (ev.slots ? ev.slots.filter((s) => s[1] >= now) : (ev.end >= now ? [[ev.start, ev.end]] : [])).slice(0, 16);
    let sel = Math.max(0, slots.findIndex((s) => s[0].slice(0, 10) === (preferredDay || plan0?.start.slice(0, 10))));
    const label = (s) => `${fmtDay(s[0])}${fmtTime(s[0]) ? ` · ${fmtTime(s[0])}` : ''}`;
    picker = !slots.length ? null : slots.length === 1
      ? `<p class="sheet-sub">📅 ${label(slots[0])}</p>`
      : `<p class="sheet-sub">Quelle date ?</p>
         <div class="chips sheet-chips">${slots.map((s, i) => `<button class="chip sm" data-slot="${i}" aria-pressed="${i === sel}">${label(s)}</button>`).join('')}</div>`;
    choose = () => (slots[sel] ? planFromSlot(slots[sel][0], slots[sel][1]) : null);
    choose.select = (i) => { sel = i; };
  }

  const { wrap, close } = openSheet('Ajouter à mon agenda', ev, picker ? `
      ${picker}
      <div class="share-grid">
        <button class="btn primary" data-act="google">Google Agenda</button>
        <button class="btn" data-act="ics">Apple / Outlook</button>
      </div>
      <p class="sheet-hint">Apple / Outlook : un fichier .ics se télécharge, ouvre-le pour l'ajouter à ton agenda. Rappel prévu 2 h avant.</p>`
    : '<p class="sheet-sub">Cette sortie est passée 😕</p>');

  wrap.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-slot]');
    if (chip) {
      choose.select(Number(chip.dataset.slot));
      $$('[data-slot]', wrap).forEach((b) => b.setAttribute('aria-pressed', String(b === chip)));
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    const plan = choose(wrap);
    if (!plan) { toast('Choisis une date'); return; }
    if (act === 'google') window.open(googleCalendarUrl(ev, plan), '_blank', 'noopener');
    else downloadIcs(ev, plan);
    // On retient la date choisie : « Mes sorties » range la sortie à ce jour-là.
    if (!S.decisions[id]) decide(ev, 'oui');
    S.decisions[id].plan = plan;
    save();
    toast(`📅 Calé : ${fmtDay(plan.start)}${plan.allDay ? '' : ` · ${fmtTime(plan.start)}`}`);
    close();
    if (!$('#deck')) rerender();
  });
}

// ════════════════════════════════════════════════════════════
//  Navigation
// ════════════════════════════════════════════════════════════
// Redessine la vue courante sans perdre la position de défilement.
function rerender() {
  const scroll = $('.page')?.scrollTop || 0;
  route();
  const page = $('.page');
  if (page) page.scrollTop = scroll;
}

let navDepth = 0;
function go(hash, { replace = false } = {}) {
  if (replace) { history.replaceState(null, '', hash); route(); } else { navDepth++; location.hash = hash; }
}

function route() {
  if (S.loadError) {
    app.innerHTML = `<div class="loading"><div style="text-align:center;padding:24px"><div style="font-size:48px">😵</div><p>Impossible de charger les sorties.<br><small>${esc(S.loadError)}</small></p></div></div>`;
    return;
  }
  if (!S.meta) { app.innerHTML = '<div class="loading">Chargement des sorties…</div>'; return; }
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'filtres') S.draft = null;

  if (parts[0] === 'e' && parts[1]) return renderDetail(decodeURIComponent(parts[1]), params);
  if (parts[0] && parts[0] !== 'carte' && S.map) { S.map.remove(); S.map = null; }
  if (parts[0] === 'apropos') return renderAbout();
  if (parts[0] === 'carte' && S.onboarded) return renderMap();
  if (parts[0] === 'liste') return renderList(['oui', 'peutetre'].includes(parts[1]) ? parts[1] : 'tout');
  if (parts[0] === 'filtres' || !S.onboarded) return renderFilters();
  return renderDeck();
}

app.addEventListener('click', (e) => {
  const t = e.target.closest('button, a');
  if (!t || t.disabled) return;
  if (t.dataset.go) { e.preventDefault(); go(t.dataset.go); return; }
  if ('back' in t.dataset) {
    if (navDepth > 0) { navDepth--; history.back(); } else go('#/', { replace: true });
    return;
  }
  if (t.dataset.view) { go(t.dataset.view, { replace: true }); return; }
  if (t.dataset.mapDecide) { mapDecide(t.dataset.id, t.dataset.mapDecide); return; }
  if ('closePlace' in t.dataset) { closePlace(); return; }
  if (t.dataset.share) { openShare(t.dataset.share); return; }
  if (t.dataset.agenda) { openAgenda(t.dataset.agenda, t.dataset.day); return; }
  if (t.dataset.open) { go(`#/e/${t.dataset.open}`); return; }
  if (t.dataset.decide) {
    const card = $('.card[data-pos="0"]');
    const ev = S.deck[0];
    if (card && ev) flyOut(card, ev, t.dataset.decide);
    return;
  }
  if ('undo' in t.dataset) { undo(); return; }
  if (t.dataset.detailDecide) {
    const id = decodeURIComponent(location.hash.split('/')[2]?.split('?')[0] || '');
    const ev = S.byId.get(id) || S.decisions[id]?.snap;
    if (!ev) return;
    const d = t.dataset.detailDecide;
    if (S.decisions[id]?.d === d) { delete S.decisions[id]; S.deckBuiltFor = null; save(); }
    else { decide(ev, d); if (DECISIONS[d].toast) toast(DECISIONS[d].toast); }
    $$('[data-detail-decide]').forEach((b) => b.setAttribute('aria-pressed', String(S.decisions[id]?.d === b.dataset.detailDecide)));
    return;
  }
  if (t.dataset.move) {
    const d = S.decisions[t.dataset.move];
    if (d) { d.d = t.dataset.to; save(); toast(t.dataset.to === 'oui' ? 'Passé en Oui ♥' : 'Passé en Pourquoi pas'); rerender(); }
    return;
  }
  if (t.dataset.remove) { delete S.decisions[t.dataset.remove]; S.deckBuiltFor = null; save(); rerender(); return; }
  if (t.dataset.calMonth) {
    const [y, m] = (S.listMonth || toWall(new Date()).slice(0, 7)).split('-').map(Number);
    S.listMonth = toWall(new Date(y, m - 1 + Number(t.dataset.calMonth), 1)).slice(0, 7);
    rerender();
    return;
  }
  if (t.dataset.calDay) {
    const k = t.dataset.calDay;
    S.listDay = S.listDay === k ? null : k;
    S.listMonth = k.slice(0, 7);
    rerender();
    return;
  }
  if ('calClear' in t.dataset) { S.listDay = null; rerender(); return; }
  if ('wipe' in t.dataset) { wipeData(); return; }
  if (location.hash.startsWith('#/filtres') || !S.onboarded) onFilterClick(t);
});

app.addEventListener('change', (e) => {
  const input = e.target.closest('[data-date]');
  if (!input || !S.draft) return;
  S.draft[input.dataset.date] = input.value || null;
  if (S.draft.to && S.draft.from && S.draft.to < S.draft.from) S.draft.to = S.draft.from;
  renderFilters();
});

document.addEventListener('keydown', (e) => {
  if (!$('#deck') || document.querySelector('.sheet-wrap') || e.target.matches('input') || e.target.closest('.maplibregl-map')) return;
  const map = { ArrowRight: 'oui', ArrowLeft: 'non', ArrowUp: 'peutetre' };
  if (map[e.key]) {
    e.preventDefault();
    const card = $('.card[data-pos="0"]');
    if (card && S.deck[0]) flyOut(card, S.deck[0], map[e.key]);
  } else if (e.key === 'Backspace' || e.key === 'z') { undo(); }
});

window.addEventListener('hashchange', route);
// On passe d'un écran étroit à large (rotation de tablette, fenêtre redimensionnée) : on redessine.
wideMQ.addEventListener('change', () => { if (!/^#\/(filtres|liste|e\/)/.test(location.hash)) route(); });

// ════════════════════════════════════════════════════════════
//  Démarrage
// ════════════════════════════════════════════════════════════
(async function init() {
  document.title = `${APP_NAME} · swipe tes sorties à Paris`;
  route();
  try {
    const res = await fetch('data/events.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    S.events = data.events;
    S.byId = new Map(data.events.map((e) => [e.id, e]));
    S.meta = { generatedAt: data.generatedAt, sources: data.sources };
  } catch (err) {
    S.loadError = err.message;
  }
  route();
}());
