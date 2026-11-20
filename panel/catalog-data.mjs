// Only public catalogue fields may be copied into app_config.
const pick = (source, keys) => Object.fromEntries(keys.filter(k => source?.[k] !== undefined).map(k => [k, source[k]]));
export function publicWorkshop(source) {
  const categories = Object.create(null), galleries = Object.create(null);
  for (const [id, category] of Object.entries(source.categories || {})) {
    if (category.isHidden) continue;
    const subs = Object.create(null);
    for (const [subId, sub] of Object.entries(category.subs || {})) {
      if (sub.isHidden) continue;
      const products = (sub.products || []).map(p => {
        if (!p || p.isHidden) return {isHidden:true};
        const product = pick(p,['id','title','name','code','material','price','desc','image','customDescription']);
        if (Array.isArray(p.gallery)) product.gallery=p.gallery.map(i=>typeof i==='string'?i:i?.src).filter(i=>typeof i==='string');
        const images = source.galleries?.[p.id]?.images;
        if (images?.length) galleries[p.id] = {images:images.map(i=> typeof i==='string'?i:pick(i,['src']))};
        return product;
      });
      subs[subId] = {...pick(sub,['title','desc','image','order']),products};
    }
    categories[id] = {...pick(category,['title','desc','image','order','icon']),subs};
  }
  const t=source.textContent || {};
  const text={};
  if(t.hero) text.hero={...pick(t.hero,['main','accent','desc']),headlines:(t.hero.headlines||[]).map(h=>pick(h,['main','accent']))};
  if(t.about) text.about=pick(t.about,['title','subtitle']);
  if(t.aboutCards) text.aboutCards=t.aboutCards.map(c=>pick(c,['title','icon','desc']));
  if(t.reviews) text.reviews=t.reviews.map(r=>pick(r,['name','stars','text']));
  if(t.contact) text.contact=pick(t.contact,['email','phone','desc']);
  if(t.legal) text.legal=pick(t.legal,['privacy','terms']);
  if(t.footer) text.footer=pick(t.footer,['slogan','copyright']);
  return {categories,galleries,customOrders:(source.customOrders||[]).filter(x=>typeof x==='string'),heroItems:(source.heroItems||[]).map(i=>pick(i,['type','url','id'])),textContent:text};
}
export function changeCategory(catalog, input) {
  const categories = catalog.categories ||= {};
  const parent = input.parent && categories[input.parent];
  if (input.parent && !parent) throw Error('Kategoria nadrzędna już nie istnieje.');
  const items = parent ? (parent.subs ||= {}) : categories;
  const id = input.id || crypto.randomUUID();
  const previous = items[id];
  if (input.id && !previous) throw Error('Wybrana pozycja już nie istnieje.');
  const title = String(input.title || '').trim();
  if (!title || title.length > 60) throw Error('Wpisz nazwę o długości od 1 do 60 znaków.');
  if (Object.entries(items).some(([key,item])=>key!==id && item.title.trim().toLowerCase()===title.toLowerCase())) throw Error('Ta nazwa jest już na liście.');
  const order = Number(input.order);
  if (!Number.isSafeInteger(order) || order < 0) throw Error('Kolejność musi być liczbą nieujemną.');
  items[id] = {...(previous || (parent ? {products:[]} : {subs:{}})), title, order, isHidden:!!input.hidden};
  return id;
}
