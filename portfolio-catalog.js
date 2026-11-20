import {catalogDescription} from './realizacje/opisy.js';
const imageDir='portfolio-studio/public/images/';
function study(title,category,description,files) {
  return {id:'sample-'+files[0],title,category,description,material:'Sklejka',photos:files.map(name=>({alt:title+' — wizualizacja',url:'/'+imageDir+name+'.jpg'}))};
}
export const samples=[
  study('Baza do koszyka','Makrama','Okrągła baza o średnicy 10 cm wyznacza kształt dna niewielkiego koszyka. Otwory rozmieszczone wokół krawędzi pozwalają rozpocząć splot i poprowadzić sznurek wzdłuż obwodu. Wizualizacja i rysunek pokazują układ otworów względem środka.\n\nJeśli potrzebujesz bazy do innego splotu, podaj średnicę dna i grubość sznurka. Na tej podstawie można dobrać wielkość i rozstaw otworów.',['baza','baza-rysunek']),
  study('Krążki do personalizacji','Półfabrykaty','Krążki ze sklejki o średnicy 5 cm mają prosty obrys i miejsce na drobny motyw, inicjały lub krótki napis. Na wizualizacji możesz ocenić proporcje elementu przed przygotowaniem własnej dekoracji. Krążek tej wielkości sprawdzi się jako mała etykieta prezentowa lub baza do ozdobienia.\n\nW zapytaniu podaj liczbę krążków i informację, czy chcesz otrzymać czystą powierzchnię, czy grawer według własnego wzoru.',['krazki','krazek'])
];

export function catalogRows(categories,galleries) {
  const rows=[];
  for(const [catId,cat] of Object.entries(categories||{}).filter(([,c])=>c&&!c.isHidden).sort(([,a],[,b])=>(a.order??9999)-(b.order??9999))) {
    for(const [subId,sub] of Object.entries(cat.subs||{})) {
      if (!sub || sub.isHidden) continue;
      for(const p of sub.products||[]) {
        if(!p||p.isHidden) continue;
        const urls=[p.image,...(Array.isArray(p.gallery)?p.gallery:[]),...(galleries?.[p.id]?.images||[])];
        const unique=[...new Set(urls.map(u=>typeof u==='string'?u:u?.src).filter(u=>typeof u==='string' && (/^https:\/\//i.test(u)||/^data:image\/(jpeg|png|webp);base64,/i.test(u))))];
        if(!unique.length) continue;
        const title=String(p.title||p.name||'Projekt pracowni');
        rows.push({id:JSON.stringify([catId,subId,p.id||p.code||title]),title,category:String(cat.title||'Realizacje'),description:catalogDescription(p),customDescription:!!p.customDescription,material:String(p.material||''),code:String(p.code||''),photos:unique.map((url,i)=>({url,alt:title+' — zdjęcie '+(i+1)}))});
      }
    }
  }
  return rows;
}
export async function readWorkshop() {
  const url = 'https://firestore.googleapis.com/v1/projects/xeomsc-licencje/databases/(default)/documents/app_config/pf-workshop-v1';
  const response = await fetch(url, {cache:'no-store',referrerPolicy:'no-referrer'});
  if (!response.ok) throw Error('Katalog jest chwilowo niedostępny.');
  const data = (await response.json()).fields?.catalog?.stringValue;
  if (!data) throw Error('Brak opublikowanego katalogu.');
  return JSON.parse(data);
}
export async function liveProjects() {
  const {categories,galleries} = await readWorkshop();
  return catalogRows(categories,galleries);
}
