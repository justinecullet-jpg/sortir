// Petits utilitaires texte partagés par les sources.

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: '’', lsquo: '‘', hellip: '…', laquo: '«', raquo: '»', euro: '€', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç' };

export function cleanText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>|<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, e) => ENTITIES[e.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

export function excerpt(text, max) {
  if (!text) return '';
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).replace(/[\s,;:.–-]+$/, '') + '…';
}
