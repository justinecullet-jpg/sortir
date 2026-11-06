// Source : « Que faire à Paris » — open data de la Ville de Paris.
// API ouverte, sans clé : https://opendata.paris.fr/explore/dataset/que-faire-a-paris-/
// Couvre surtout Paris intra-muros (+ un peu de petite couronne).

import { cleanText, excerpt } from '../text.mjs';

export const name = 'Que faire à Paris';
export const homepage = 'https://quefaire.paris.fr';

const ENDPOINT = 'https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/que-faire-a-paris-/exports/json';
const FIELDS = [
  'id', 'url', 'title', 'lead_text', 'description', 'date_start', 'date_end', 'occurrences',
  'cover_url', 'cover_credit', 'address_name', 'address_street', 'address_zipcode', 'address_city',
  'lat_lon', 'price_type', 'price_detail', 'access_type', 'access_link', 'qfap_tags', 'updated_at',
  'pmr', 'blind', 'deaf', 'sign_language', 'mental', 'group',
];

// Accessibilité : 1 = accessible, 0 ou vide = non précisé (ou non accessible).
const ACCESS_FIELDS = { pmr: 'pmr', blind: 'blind', deaf: 'deaf', lsf: 'sign_language', mental: 'mental' };
const a11yOf = (r) => Object.entries(ACCESS_FIELDS).filter(([, f]) => String(r[f]) === '1').map(([id]) => id);

// Les sorties « pour enfants » sont écartées : l'app vise les sorties entre potes.
const EXCLURE_JEUNE_PUBLIC = true;
// Titres qui trahissent un cours / stage plutôt qu'une sortie.
const PAS_UNE_SORTIE_RE = /\b(stage|cours|atelier|initiation|permanence|inscription)\b|^agenda\b|programme de la saison|programmation 20\d\d/i;
const FILM_RE = /projection|\bfilms?\b|cin[ée]ma|\bcin[ée]\b|s[ée]ance|documentaire|m[ée]trage|avant[- ]premi/i;
const EVENT_TAGS = ['Théâtre', 'Danse', 'Humour', 'Cirque', 'Festival', 'Nuit', 'Spectacle musical',
  'Conférence', 'Littérature', 'Balade urbaine', 'Salon'];
const ART_TAGS = ['Art contemporain', 'Photo', 'Peinture'];
// Au-delà de ce nombre de créneaux (expos ouvertes tous les jours…), on stocke juste début / fin.
const MAX_SLOTS = 120;

function categorize(tags, title, fullText) {
  const has = (t) => tags.includes(t);
  if (PAS_UNE_SORTIE_RE.test(title) || has('Sport') || has('Santé')) return null;
  if (EXCLURE_JEUNE_PUBLIC && has('Enfants')) return null;
  if (has('Ecrans')) return FILM_RE.test(fullText) ? 'cinema' : null;
  if (has('Concert')) return 'concert';
  if (has('Expo')) return 'expo';
  if (has('Spectacle musical') && /concert/i.test(title)) return 'concert';
  if (EVENT_TAGS.some(has)) return 'event';
  if (ART_TAGS.some(has) && !has('Atelier')) return 'expo';
  return null;
}

// Les horaires de la source sont des heures « murales » parisiennes avec un fuseau
// parfois faux : on garde uniquement AAAA-MM-JJTHH:MM, sans fuseau.
const wall = (iso) => (iso ? iso.slice(0, 16) : null);

function parseSlots(r, todayISO) {
  if (r.occurrences) {
    const slots = r.occurrences.split(';')
      .map((o) => o.split('_').map(wall))
      .filter(([s, e]) => s && e && e >= todayISO)
      .sort((a, b) => a[0].localeCompare(b[0]));
    if (!slots.length) return null;
    const start = slots[0][0];
    const end = slots[slots.length - 1][1];
    return { start, end, slots: slots.length > MAX_SLOTS ? null : slots };
  }
  if (!r.date_start || !r.date_end) return null;
  const start = wall(r.date_start);
  const end = wall(r.date_end);
  if (end < todayISO) return null;
  return { start, end, slots: null };
}

export async function fetchEvents({ todayISO, untilISO }) {
  const where = `date_end >= date'${todayISO.slice(0, 10)}' and date_start <= date'${untilISO.slice(0, 10)}'`;
  const url = `${ENDPOINT}?select=${FIELDS.join(',')}&where=${encodeURIComponent(where)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'sortir-app-ingest' } });
  if (!res.ok) throw new Error(`${name} : HTTP ${res.status}`);
  const rows = await res.json();

  const events = [];
  for (const r of rows) {
    const tags = (r.qfap_tags || '').split(';').filter(Boolean);
    const title = cleanText(r.title);
    const lead = cleanText(r.lead_text);
    const desc = cleanText(r.description);
    const fullText = `${title} ${lead} ${desc}`;
    const cat = categorize(tags, title, fullText);
    if (!cat || !title) continue;
    const when = parseSlots(r, todayISO);
    if (!when) continue;

    events.push({
      id: `qfap-${r.id}`,
      source: name,
      cat,
      srcTags: tags,
      searchText: fullText,
      title,
      text: excerpt(lead || desc, 300),
      more: lead && desc ? excerpt(desc, 700) : null,
      image: r.cover_url || null,
      credit: r.cover_credit || null,
      ...when,
      venue: cleanText(r.address_name) || null,
      address: [cleanText(r.address_street), r.address_zipcode, r.address_city].filter(Boolean).join(' ') || null,
      zip: (r.address_zipcode || '').trim() || null,
      city: r.address_city || null,
      lat: r.lat_lon?.lat ?? null,
      lon: r.lat_lon?.lon ?? null,
      free: /^gratuit/i.test(r.price_type || ''),
      price: excerpt(cleanText(r.price_detail), 140) || null,
      ticketUrl: /^https?:\/\//.test(r.access_link || '') ? r.access_link : null,
      infoUrl: r.url || null,
      updatedAt: r.updated_at || null,
      a11y: a11yOf(r),
      group: r.group || null,
    });
  }
  return events;
}
