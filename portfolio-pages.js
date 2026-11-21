import {homeDocument, defaultHome, renderHome} from './panel/homepage.js';
import {$,node,button,dialogControls} from './portfolio-studio/public/common.js';
import {samples, liveProjects} from './portfolio-catalog.js';
import {studioPhoto as photo,publishedChanges,mergeProjects,publicRecord} from './panel/photos.js?v=0c6b69a';
import {projectPath,rememberProjectLinks} from './realizacje/adresy.js';
import {setupGallery, staticProjects} from './realizacje/kategorie.js?v=fade';
import {initRecent} from './realizacje/ostatnie.js';
import {projectPrices,formatPrice,publishedPrices} from './realizacje/ceny.js';
let rates = [];
let projects=[];
function ask(project=null) {
  const address = new URL('/zapytanie/', location.href);
  address.searchParams.set('zapytanie', project ? project.title : '');
  if (project?.code) address.searchParams.set('kod', project.code);
  location.assign(address.href);
}
function projectCard(p, showCategory = true) {
  const card=node('a','','card'), frame=node('div','','frame'), image=photo(p.photos[0]);
  card.href=p.staticPath || projectPath(p);
  image.loading='lazy';frame.append(image,node('span',p.photos.length+' zdj.','number'));
  card.append(frame);
  if (showCategory) card.append(node('small',p.category));
  card.append(node('h3',p.title));
  if (p.material) card.append(node('p',p.material));
  for (const line of projectPrices(p,rates)) card.append(node('p',line));
  return card;
}
dialogControls(); document.querySelectorAll('.ask').forEach(b=>b.onclick=()=>ask());
if (location.hash && !location.hash.startsWith('#galeria/') && !['#galeria','#start','#projekt-indywidualny','#ostatnio-wykonane','#cennik'].includes(location.hash)) {
  location.replace(location.hash==='#admin'?'/panel/':'pracownia.html'+location.search+location.hash);
} else {
  publicRecord(homeDocument).then(fields => {
    if (!fields) return;
    const data = {...defaultHome};
    for (const key of Object.keys(data)) data[key] = fields[key]?.stringValue ?? data[key];
    data.image = fields.image?.stringValue;
    if (data.description === 'Wycinamy i grawerujemy w sklejce. Zobacz detale naszych projektów lub opowiedz nam, co chcesz stworzyć.') data.description = defaultHome.description;
    renderHome($('.hero'), data);
  }).catch(() => { /* The initial HTML already contains the workshop introduction. */ });
  const fallback = staticProjects($('#category-grid'));
  const updateGallery = setupGallery(fallback, projectCard);
  const [latest,changes,priceResult]=await Promise.allSettled([liveProjects(),publishedChanges(),publishedPrices(publicRecord)]);
  rates = priceResult.status === 'fulfilled' ? priceResult.value : [];
  if (rates.length) {
    $('.category-prices').replaceChildren(...rates.map(rate => {
      const row = node('div'), title = node('dt',rate.category);
      if (rate.variant) title.append(node('small',rate.variant));
      row.append(title,node('dd','od ' + formatPrice(rate.amount)));
      return row;
    }));
    $('#cennik').hidden = false; $('#price-link').hidden = false;
    if (location.hash === '#cennik') $('#cennik').scrollIntoView();
  }
  const base=latest.status==='fulfilled' && latest.value.length?latest.value:samples;
  rememberProjectLinks(base);
  const overlays = changes.status === 'fulfilled' ? changes.value : [];
  projects=mergeProjects(base, overlays);
  if (latest.status === 'rejected') {
    // Keep the published static catalog available during a legacy catalog outage.
    const known = new Set([...projects,...overlays].map(projectPath));
    projects.push(...fallback.filter(item => !known.has(item.staticPath)));
  }
  updateGallery(projects);
  initRecent(projects, changes.status === 'fulfilled' ? changes.value : [], projectCard);
}

