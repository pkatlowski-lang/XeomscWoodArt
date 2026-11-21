import {setPhoto} from '../panel/photos.js';
import {categoryKey} from './ceny.js';

export function staticProjects(grid) {
  return [...grid.querySelectorAll('details')].flatMap(group => {
    const category = group.querySelector('strong').textContent;
    return [...group.querySelectorAll('li a')].map(link => ({
      title:link.textContent, category, staticPath:link.getAttribute('href'),
      photos:[{url:link.dataset.cover,alt:link.textContent}]
    }));
  });
}
export function groupedProjects(projects) {
  const groups = new Map();
  for (const project of projects) {
    if (!project.photos?.length || project.removed || project.published === false) continue;
    const name = project.category?.trim() || 'Pozostałe';
    const key = categoryKey(name);
    if (!groups.has(key)) groups.set(key,{name, key, items:[]});
    groups.get(key).items.push(project);
  }
  return groups;
}
export function setupGallery(initial, projectCard) {
  const section = document.querySelector('#galeria');
  const select = id => section.querySelector('#'+id);
  const tiles = select('category-grid'), grid = select('grid'), heading = select('gallery-title');
  const search = select('search'), back = select('all-categories'), motion = select('gallery-motion'), count = select('count');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let groups = groupedProjects(initial), paused = reduced.matches, timer, visible = true, previews = [];
  let active = '';
  function categoryFromHash() {
    if (!location.hash.startsWith('#galeria/')) return '';
    try { return categoryKey(decodeURIComponent(location.hash.slice(9))); } catch { return ''; }
  }
  function startTimer() {
    clearInterval(timer);
    if (paused || document.hidden || !visible || !previews.length || tiles.hidden) return;
    timer = setInterval(() => {
      for (const preview of previews) {
        if (preview.link.matches(':hover, :focus-within')) continue;
        preview.index = (preview.index + 1) % preview.items.length;
        setPhoto(preview.image,preview.items[preview.index].photos[0]);
      }
    },5000);
  }
  function render() {
    const key = categoryFromHash(), group = groups.get(key);
    const query = search.value.trim().toLocaleLowerCase('pl');
    const overview = !key && !query;
    active = key;
    heading.textContent = group?.name || (key ? 'Kategoria realizacji' : query ? 'Wyniki wyszukiwania' : 'Kategorie realizacji');
    back.hidden = overview;
    tiles.hidden = !overview;
    grid.hidden = overview;
    count.hidden = overview;
    previews = [];
    if (overview) {
      grid.replaceChildren();
      tiles.replaceChildren(...Array.from(groups.values(), category => {
        const link = document.createElement('a'), frame = document.createElement('div');
        const image = document.createElement('img'), name = document.createElement('h3');
        link.className = 'card category-tile'; link.href = '#galeria/' + encodeURIComponent(category.key);
        link.setAttribute('aria-label',category.name);
        frame.className = 'frame'; image.loading = 'lazy';
        setPhoto(image,category.items[0].photos[0]);
        name.textContent = category.name; frame.append(image); link.append(frame,name);
        if (category.items.length > 1) previews.push({link,image,items:category.items,index:0});
        return link;
      }));
    } else {
      const pool = key ? group?.items || [] : Array.from(groups.values()).flatMap(g => g.items);
      const shown = pool.filter(p => [p.title,p.category,p.description,p.material].join(' ').toLocaleLowerCase('pl').includes(query));
      grid.replaceChildren(...shown.map(p => projectCard(p,!key)));
      count.textContent = shown.length ? 'Liczba realizacji: '+shown.length : 'Brak pasujących realizacji.';
    }
    motion.hidden = previews.length === 0;
    motion.textContent = paused ? 'Wznów zmianę zdjęć' : 'Wstrzymaj zmianę zdjęć';
    startTimer();
  }
  motion.onclick = () => {
    paused = !paused;
    motion.textContent = paused ? 'Wznów zmianę zdjęć' : 'Wstrzymaj zmianę zdjęć';
    startTimer();
  };
  reduced.addEventListener('change',event => {paused = event.matches; render();});
  document.addEventListener('visibilitychange',startTimer);
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    startTimer();
  }).observe(tiles);
  function navigate() {
    search.value = ''; render();
    section.scrollIntoView(); heading.focus({preventScroll:true});
  }
  window.addEventListener('hashchange',() => {
    if (location.hash === '#galeria' || location.hash.startsWith('#galeria/')) navigate();
    else if (active) {search.value='';render();}
  });
  back.onclick = event => {
    if (location.hash === '#galeria') {event.preventDefault();navigate();}
  };
  search.oninput = render;
  select('gallery-search').hidden = false;
  if (categoryFromHash()) navigate(); else render();
  return projects => { groups = groupedProjects(projects); render(); };
}
