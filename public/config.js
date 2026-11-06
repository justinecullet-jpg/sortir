// ─────────────────────────────────────────────────────────────
//  Configuration de l'app : catégories, tags par genre, zones.
//  C'est LE fichier à modifier pour ajouter / renommer un tag.
//  Il est lu à la fois par l'import (ingest/run.mjs), qui calcule
//  les tags de chaque événement, et par l'app, qui affiche les filtres.
//
//  Un tag « matche » un événement si :
//   - l'un des tags de la source (`src`) est présent sur l'événement, OU
//   - l'expression `re` (insensible à la casse) est trouvée dans
//     le titre, le chapô ou la description.
// ─────────────────────────────────────────────────────────────

export const APP_NAME = 'Sortir';

export const CATEGORIES = [
  {
    id: 'concert', label: 'Concert', emoji: '🎵', color: '#ff4d8d',
    tags: [
      { id: 'techno', label: 'Techno', re: 'techno|minimal|\\brave\\b|acid house|hard ?techno' },
      { id: 'electro', label: 'Électro / House', re: '[ée]lectro|\\bhouse\\b|dj[ -]?set|\\bdj\\b|clubbing|disco' },
      { id: 'inde', label: 'Indé', re: '\\bind[ée]\\b|indie|lo-?fi|shoegaze|post-punk|dream ?pop|folk' },
      { id: 'rock', label: 'Rock / Punk', re: '\\brock\\b|punk|metal|grunge|garage rock' },
      { id: 'pop', label: 'Pop', re: '\\bpop\\b' },
      { id: 'hiphop', label: 'Rap / Hip-hop', re: 'hip[- ]?hop|\\brap\\b|rappeu|\\br&b\\b|\\brnb\\b' },
      { id: 'jazz', label: 'Jazz / Soul / Funk', re: 'jazz|swing|blues|\\bsoul\\b|funk|groove' },
      { id: 'classique', label: 'Classique / Lyrique', re: 'classique|orchestre|symphon|quatuor|r[ée]cital|baroque|op[ée]ra|musique de chambre' },
      { id: 'world', label: 'Musiques du monde', re: 'world music|afro|latin|tango|salsa|flamenco|cumbia|fado|maloya|klezmer|reggae|br[ée]sil' },
      { id: 'chanson', label: 'Chanson', re: 'chanson' },
    ],
  },
  {
    id: 'cinema', label: 'Cinéma', emoji: '🎬', color: '#ffb020',
    tags: [
      { id: 'avantpremiere', label: 'Avant-première', re: 'avant[- ]premi' },
      { id: 'docu', label: 'Documentaire', re: 'documentaire' },
      { id: 'court', label: 'Courts métrages', re: 'courts?[- ]m[ée]trages?' },
      { id: 'cineconcert', label: 'Ciné-concert', re: 'cin[ée][- ]concert' },
      { id: 'pleinair', label: 'Plein air', re: 'plein air|en ext[ée]rieur' },
      { id: 'cycle', label: 'Cycle / Festival', re: '\\bcycle\\b|r[ée]trospective|festival' },
      { id: 'animation', label: 'Animation', re: "film d'animation|\\banimation\\b" },
      { id: 'debat', label: 'Projection-débat', re: 'd[ée]bat|rencontre avec|en pr[ée]sence' },
    ],
  },
  {
    id: 'expo', label: 'Expo', emoji: '🖼️', color: '#22d3b6',
    tags: [
      { id: 'artcontemporain', label: 'Art contemporain', src: ['Art contemporain'], re: 'art contemporain|installation' },
      { id: 'photo', label: 'Photo', src: ['Photo'], re: 'photograph' },
      { id: 'peinture', label: 'Peinture / Dessin / BD', src: ['Peinture'], re: 'peinture|peintre|dessin|illustration|gravure|bande dessin' },
      { id: 'streetart', label: 'Street art', src: ['Street-art'], re: 'street[- ]?art|graff' },
      { id: 'design', label: 'Design / Mode / Archi', re: 'design|\\bmode\\b|architecture' },
      { id: 'histoire', label: 'Histoire', src: ['Histoire'], re: 'histoire|patrimoine|archives' },
      { id: 'sciences', label: 'Sciences / Nature', re: 'science|climat|biodiversit' },
      { id: 'immersif', label: 'Immersif / Numérique', src: ['Numérique'], re: 'immersi|r[ée]alit[ée] virtuelle' },
    ],
  },
  {
    id: 'event', label: 'Event', emoji: '✨', color: '#a78bfa',
    tags: [
      { id: 'theatre', label: 'Théâtre', src: ['Théâtre'] },
      { id: 'danse', label: 'Danse', src: ['Danse'] },
      { id: 'humour', label: 'Humour / Stand-up', src: ['Humour'], re: 'stand[- ]?up|one[- ]man' },
      { id: 'cirque', label: 'Cirque', src: ['Cirque'] },
      { id: 'festival', label: 'Festival', src: ['Festival'] },
      { id: 'soiree', label: 'Soirée / Nuit', src: ['Nuit'], re: 'afterwork|clubbing|nuit blanche' },
      { id: 'rencontre', label: 'Rencontre / Conférence', src: ['Conférence', 'Littérature'] },
      { id: 'balade', label: 'Balade / Visite', src: ['Balade urbaine'], re: 'visite guid[ée]e' },
    ],
  },
];

// Options valables pour toutes les catégories (filtres « ET »).
export const OPTIONS = [
  { id: 'nouveaute', label: '🆕 Nouveautés' },
  { id: 'gratuit', label: '🆓 Gratuit' },
  { id: 'billetterie', label: '🎟️ Avec billetterie en ligne' },
];

// Un événement est une « nouveauté » s'il est apparu dans les sources
// depuis moins de N jours, ou si son texte contient ces mots-clés.
export const NOUVEAUTE_JOURS = 7;
export const NOUVEAUTE_RE = "avant[- ]premi|in[ée]dit|nouvel album|nouveau spectacle|cr[ée]ation 20\\d\\d|premi[eè]re fois [àa] Paris";

// Fenêtre d'import : on ne garde que ce qui a lieu dans les N prochains jours.
export const FENETRE_JOURS = 120;

// Zones de banlieue proposées dans le filtre de lieu.
export const BANLIEUE = [
  { id: '92', label: 'Hauts-de-Seine (92)' },
  { id: '93', label: 'Seine-Saint-Denis (93)' },
  { id: '94', label: 'Val-de-Marne (94)' },
  { id: 'gc', label: 'Grande couronne (77, 78, 91, 95)' },
];
