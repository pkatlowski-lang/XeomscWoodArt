import {homeDocument, defaultHome, renderHome} from './panel/homepage.js?v=nowy-katalog';
import {$,node,button,dialogControls} from './portfolio-studio/public/common.js';
import {liveProjects} from './portfolio-catalog.js?v=nowy-katalog';
import {studioPhoto as photo,publishedChanges,mergeProjects,publicRecord} from './panel/photos.js?v=nowy-katalog';
import {projectPath} from './realizacje/adresy.js?v=nowy-katalog';
import {setupGallery} from './realizacje/kategorie.js?v=nowy-katalog';
import {initRecent} from './realizacje/ostatnie.js?v=nowy-katalog';
import {projectPrices,formatPrice,publishedPrices} from './realizacje/ceny.js?v=nowy-katalog';
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
    data.image = fields.portfolioImage?.stringValue;
    if (data.description === 'Wycinamy i grawerujemy w sklejce. Zobacz detale naszych projektów lub opowiedz nam, co chcesz stworzyć.') data.description = defaultHome.description;
    renderHome($('.hero'), data);
  }).catch(() => { /* The initial HTML already contains the workshop introduction. */ });
  const updateGallery = setupGallery([], projectCard);
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
  const base=latest.status==='fulfilled' ? latest.value : [];
  const overlays = changes.status === 'fulfilled' ? changes.value : [];
  projects=mergeProjects(base, overlays);
  updateGallery(projects);
  initRecent(projects, changes.status === 'fulfilled' ? changes.value : [], projectCard);
}

