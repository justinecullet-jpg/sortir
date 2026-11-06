// Import des événements : toutes les sources → un seul fichier normalisé
// public/data/events.json, lu par l'app.
//
//   node ingest/run.mjs
//
// À lancer une fois par jour (cron, GitHub Action…) une fois l'app en ligne.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CATEGORIES, NOUVEAUTE_JOURS, NOUVEAUTE_RE, FENETRE_JOURS, LIEUX_VILLE } from '../public/config.js';
import * as queFaireAParis from './sources/quefaireaparis.mjs';

// Ajouter ici les prochaines sources (OpenAgenda, Ticketmaster…), par ordre de priorité :
// en cas de doublon, c'est la première source qui gagne.
const SOURCES = [queFaireAParis];

// Hors expos, un « événement » qui dure plus de N jours est en général une offre permanente
// (visites guidées toute l'année, agenda de saison…) : il polluerait toutes les dates, on l'écarte.
const DUREE_MAX_HORS_EXPO = 90;

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'public/data/events.json');
const FIRST_SEEN = path.join(ROOT, 'ingest/first_seen.json');

// ── Dates (heure de Paris, sans fuseau) ───────────────────────
const parisNow = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date()).replace(' ', 'T');
const addDays = (isoDate, n) => {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// ── Lieu : code postal → zone / arrondissement / département ──
function locate(zip, city) {
  const z = (zip || '').replace(/\s/g, '');
  if (/^75\d{3}$/.test(z)) {
    const n = z === '75116' ? 16 : Number(z.slice(3));
    const arr = n >= 1 && n <= 20 ? n : null;
    return { zone: 'paris', dept: '75', arr, area: arr ? (arr === 1 ? '1er' : `${arr}e`) : 'Paris' };
  }
  const m = z.match(/^(9[1-5]|7[78])\d{3}$/);
  if (m) {
    const dept = m[1];
    return { zone: 'banlieue', dept, arr: null, area: `${city || 'Banlieue'} (${dept})` };
  }
  if (!z && (!city || /paris/i.test(city))) return { zone: 'paris', dept: '75', arr: null, area: 'Paris' };
  return null; // hors Île-de-France proche : ignoré
}

// ── Tags de genre (définis dans public/config.js) ─────────────
const TAG_RULES = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.tags.map((t) => ({
  id: t.id, src: t.src || [], rx: t.re ? new RegExp(t.re, 'i') : null,
}))]));
const NOUVEAUTE_RX = new RegExp(NOUVEAUTE_RE, 'i');
const LIEUX_VILLE_RX = new RegExp(LIEUX_VILLE.re, 'i');
// Lieu de la Ville de Paris : réseau municipal déclaré par la source, ou établissement reconnu à son nom.
const isMunicipal = (ev, where) => where.zone === 'paris'
  && (LIEUX_VILLE.groupes.includes(ev.group) || LIEUX_VILLE_RX.test(`${ev.venue || ''} ${ev.address || ''}`));

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

async function main() {
  const now = parisNow();
  const todayISO = `${now.slice(0, 10)}T00:00`;
  const untilISO = `${addDays(now, FENETRE_JOURS)}T23:59`;

  let firstSeen = {};
  try { firstSeen = JSON.parse(await readFile(FIRST_SEEN, 'utf8')); } catch { /* premier import */ }
  const bootstrap = Object.keys(firstSeen).length === 0;
  const newSince = addDays(now, -NOUVEAUTE_JOURS);

  const sourcesMeta = [];
  const seenKeys = new Set();
  const events = [];
  const failed = [];

  for (const src of SOURCES) {
    let raw = [];
    try {
      raw = await src.fetchEvents({ todayISO, untilISO });
    } catch (err) {
      console.error(`⚠️  ${src.name} : ${err.message}`);
      failed.push(src.name);
    }
    let kept = 0;
    for (const ev of raw) {
      const where = locate(ev.zip, ev.city);
      if (!where) continue;
      const days = (Date.parse(ev.end.slice(0, 10)) - Date.parse(ev.start.slice(0, 10))) / 864e5;
      if (ev.cat !== 'expo' && days > DUREE_MAX_HORS_EXPO) continue;

      const dedupKey = `${norm(ev.title)}|${norm(ev.venue)}|${ev.start.slice(0, 10)}`;
      if (seenKeys.has(dedupKey)) continue;
      seenKeys.add(dedupKey);

      // Première apparition : au tout premier import on prend la date de mise à jour
      // de la source comme approximation, ensuite la date du jour.
      if (!firstSeen[ev.id]) {
        firstSeen[ev.id] = bootstrap && ev.updatedAt ? ev.updatedAt.slice(0, 10) : now.slice(0, 10);
      }

      const tags = TAG_RULES[ev.cat]
        .filter((t) => t.src.some((s) => ev.srcTags.includes(s)) || (t.rx && t.rx.test(ev.searchText)))
        .map((t) => t.id);
      const isNew = firstSeen[ev.id] >= newSince || NOUVEAUTE_RX.test(ev.searchText);

      const { srcTags, searchText, updatedAt, zip, city, group, a11y, ...rest } = ev;
      events.push({
        ...rest, ...where, tags, isNew,
        // Champs facultatifs : absents quand vides, pour garder le fichier léger.
        ...(a11y?.length ? { a11y } : {}),
        ...(isMunicipal(ev, where) ? { municipal: true } : {}),
      });
      kept++;
    }
    sourcesMeta.push({ name: src.name, url: src.homepage, count: kept });
    console.log(`✓ ${src.name} : ${raw.length} reçus, ${kept} gardés`);
  }

  events.sort((a, b) => a.start.localeCompare(b.start));

  // Garde-fou : si une source est en panne ou si le volume s'effondre, on garde les données
  // de la veille plutôt que de publier une app vide. Le robot échoue et GitHub prévient par e-mail.
  let previous = 0;
  try { previous = JSON.parse(await readFile(OUT, 'utf8')).events.length; } catch { /* pas encore de fichier */ }
  if (failed.length || !events.length || (previous && events.length < previous * 0.5)) {
    console.error(`✗ Import suspect (${failed.length ? `source en panne : ${failed.join(', ')}` : `${events.length} événements contre ${previous} la veille`}) : rien n'est écrit.`);
    process.exit(1);
  }

  // On oublie les identifiants qui ne sont plus dans les sources depuis longtemps.
  const live = new Set(events.map((e) => e.id));
  const cutoff = addDays(now, -60);
  for (const [id, d] of Object.entries(firstSeen)) if (!live.has(id) && d < cutoff) delete firstSeen[id];

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ generatedAt: now, sources: sourcesMeta, events }));
  await writeFile(FIRST_SEEN, JSON.stringify(firstSeen, null, 0));

  // Petit bilan dans la console
  for (const c of CATEGORIES) {
    const inCat = events.filter((e) => e.cat === c.id);
    const byTag = c.tags.map((t) => `${t.id} ${inCat.filter((e) => e.tags.includes(t.id)).length}`).join(' · ');
    console.log(`  ${c.emoji} ${c.label.padEnd(8)} ${String(inCat.length).padStart(4)}  (${byTag})`);
  }
  console.log(`  🆕 nouveautés ${events.filter((e) => e.isNew).length} · banlieue ${events.filter((e) => e.zone === 'banlieue').length}`
    + ` · 🏛️ lieux de la Ville ${events.filter((e) => e.municipal).length}`);
  const a11yCount = (id) => events.filter((e) => e.a11y?.includes(id)).length;
  console.log(`  ♿ ${a11yCount('pmr')} · 👁️ ${a11yCount('blind')} · 🧏 ${a11yCount('deaf')} · 🤟 ${a11yCount('lsf')} · 🧠 ${a11yCount('mental')}`);
  console.log(`→ ${events.length} événements écrits dans public/data/events.json`);
}

main().catch((err) => { console.error(err); process.exit(1); });
