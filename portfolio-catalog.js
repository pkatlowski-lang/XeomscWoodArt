const imageDir='portfolio-studio/public/images/';
function study(title,category,description,files) {
  return {title,category,description,material:'Sklejka',photos:files.map(name=>({alt:title+' — wizualizacja',url:imageDir+name+'.jpg'}))};
}
export const samples=[
  study('Baza do koszyka','Makrama','Wizualizacja okrągłej bazy z otworami do przeplatania sznurka. Średnica projektu 10 cm.',['baza','baza-rysunek']),
  study('Krążki do personalizacji','Półfabrykaty','Wizualizacja elementów o średnicy 5 cm do ozdabiania i grawerowania.',['krazki','krazek'])
];

function unpack(field) {
  if (!field) return undefined;
  if ('mapValue' in field) return Object.fromEntries(Object.entries(field.mapValue.fields||{}).map(([key,val])=>[key,unpack(val)]));
  if ('arrayValue' in field) return (field.arrayValue.values||[]).map(unpack);
  return Object.values(field)[0];
}
export function catalogRows(categories,galleries) {
  const rows=[];
  for(const cat of Object.values(categories||{}).filter(c=>c&&!c.isHidden).sort((a,b)=>(a.order??9999)-(b.order??9999))) {
    for(const sub of Object.values(cat.subs||{})) {
      if (!sub || sub.isHidden) continue;
      for(const p of sub.products||[]) {
        if(!p||p.isHidden) continue;
        const urls=[p.image,...(Array.isArray(p.gallery)?p.gallery:[]),...(galleries?.[p.id]?.images||[])];
        const unique=[...new Set(urls.map(u=>typeof u==='string'?u:u?.src).filter(u=>typeof u==='string' && (/^https:\/\//i.test(u)||/^data:image\/(jpeg|png|webp);base64,/i.test(u))))];
        if(!unique.length) continue;
        const title=String(p.title||p.name||'Projekt pracowni');
        rows.push({title,category:String(cat.title||'Realizacje'),description:String(p.desc||''),material:String(p.material||''),code:String(p.code||''),photos:unique.map((url,i)=>({url,alt:title+' — zdjęcie '+(i+1)}))});
      }
    }
  }
  return rows;
}
export async function liveProjects() {
  const config={"apiKey":"AIzaSyDeRtreUSAmNWvhZm2_Fkt9OcpWs07PrVw","authDomain":"xeomsc-a8edd.firebaseapp.com","projectId":"xeomsc-a8edd","storageBucket":"xeomsc-a8edd.firebasestorage.app","messagingSenderId":"43822805612","appId":"1:43822805612:web:d343653e47777d8ebf5e49"};
  const [{initializeApp},{getAuth,signInAnonymously}]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js')
  ]);
  const auth=getAuth(initializeApp(config));await auth.authStateReady();
  const user=auth.currentUser || (await signInAnonymously(auth)).user;
  const url=new URL('https://firestore.googleapis.com/v1/projects/'+config.projectId+'/databases/(default)/documents/artifacts/xeomsc-fusionart/public/data/siteConfig/main');
  for(const key of ['categories','galleries'])url.searchParams.append('mask.fieldPaths',key);
  const response=await fetch(url,{headers:{Authorization:'Bearer '+await user.getIdToken()}});
  if(!response.ok) throw Error('Katalog jest chwilowo niedostępny.');
  const {fields}=await response.json();return catalogRows(unpack(fields?.categories),unpack(fields?.galleries));
}
