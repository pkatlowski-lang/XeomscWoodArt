export const homeDocument = 'pf-home-intro-v1';
export const defaultHome = {
  eyebrow: 'Pracownia cięcia i graweru',
  title: 'Ze szkicu\nw drewno.',
  description: 'Wycinam i graweruję w sklejce – od pojedynczego napisu po wielowarstwowe logo Twojej firmy.',
  caption: 'Sklejka · cięcie laserowe',
  alt: 'Wizualizacja drewnianej bazy z równym rzędem otworów wzdłuż krawędzi'
};
export const defaultHomeImage = '/portfolio-studio/public/images/baza.jpg';

export function homeChanges(input) {
  const limits = {eyebrow:80, title:120, description:600, caption:140, alt:180};
  const changes = {};
  for (const [key, limit] of Object.entries(limits)) {
    const value = input[key];
    if (typeof value !== 'string' || value.length > limit) throw Error('Sprawdź długość tekstu.');
    changes[key] = value.trim();
  }
  if (!changes.title || !changes.description) throw Error('Uzupełnij nagłówek i opis.');
  if (input.image !== undefined) {
    if (typeof input.image !== 'string' || input.image.length > 750000 || !/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(input.image)) {
      throw Error('Nie udało się przygotować zdjęcia. Wybierz inny plik.');
    }
    changes.image = input.image;
  }
  return changes;
}

export function renderHome(hero, data) {
  const heading = hero.querySelector('h1');
  const lines = data.title.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  heading.replaceChildren(document.createTextNode(lines.shift() || defaultHome.title.replace('\n',' ')));
  if (lines.length) {
    const accent = document.createElement('em');
    accent.textContent = lines.join(' ');
    heading.append(document.createElement('br'), accent);
  }
  const eyebrow = hero.querySelector('.eyebrow');
  eyebrow.replaceChildren(document.createElement('b'), document.createTextNode(' ' + data.eyebrow));
  eyebrow.hidden = !data.eyebrow;
  hero.querySelector('.herocopy > p:not(.eyebrow)').textContent = data.description;
  const caption = hero.querySelector('figcaption');
  caption.replaceChildren(caption.querySelector('span'), document.createTextNode(data.caption));
  caption.hidden = !data.caption;
  const image = hero.querySelector('.herofigure img');
  image.alt = data.alt;
  if (data.image) {
    image.src = data.image;
    image.style.mixBlendMode = 'normal';
  }
}
