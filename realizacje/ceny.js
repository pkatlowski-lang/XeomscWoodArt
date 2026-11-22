export const priceDocument = 'pf-prices-v2';

export function categoryKey(name) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl');
}
export function parsePrice(value) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) return null;
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(text) || Number(text) <= 0) throw Error('Wpisz dodatnią kwotę z dokładnością do grosza.');
  return Math.round(Number(text) * 100);
}
const pln = new Intl.NumberFormat('pl-PL', {style:'currency', currency:'PLN'});
const wholePln = new Intl.NumberFormat('pl-PL', {style:'currency', currency:'PLN', maximumFractionDigits:0, minimumFractionDigits:0});
export function formatPrice(grosze) { return (grosze % 100 ? pln : wholePln).format(grosze / 100); }
export function projectPrices(project, rates) {
  const rate = rates.find(row => categoryKey(row.category) === categoryKey(project.category || ''));
  const lines = [];
  if (rate) lines.push('Cena w kategorii od ' + formatPrice(rate.amount) + (rate.variant ? ' · ' + rate.variant : ''));
  if (project.actualGrosze > 0) lines.push('Cena tej realizacji: ' + formatPrice(project.actualGrosze));
  return lines;
}
export async function publishedPrices(publicRecord) {
  const fields = await publicRecord(priceDocument);
  return JSON.parse(fields?.rates?.stringValue || '[]');
}
