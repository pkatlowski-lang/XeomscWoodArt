const published=new Map([["pracownia-mapa-swiata-ze-sklejki","mapa-swiata-ze-sklejki"],["pracownia-bombki-klubowe","bombki-klubowe"],["pracownia-litery-swiateczne","litery-swiateczne"],["pracownia-herb-ruch-chorzow","herb-ruch-chorzow"],["pracownia-herb-real-madryt","herb-real-madryt"],["pracownia-bombka-sniezynka","bombka-sniezynka"],["Wieszak Dekoracyjny ze Sklejki","wieszak-dekoracyjny-ze-sklejki"],["Zegar Dekoracyjny ze Sklejki","zegar-scienny-ze-sklejki-brzozowej"],["Zegar Kolorowy ze Sklejki","kolorowy-zegar-scienny-ze-sklejki"],["Dekoracja Okazjonalna Laserowa","dekoracje-na-slub-chrzciny-i-urodziny"],["Podświetlana Tablica z Logo LED","tablica-z-logo-i-podswietleniem-led"],["Tabliczka Iron Maiden — Napis 3D","iron-maiden-napis-scienny-3d-ze-sklejki"],["Litera Alfabetu ze Sklejki","litery-ze-sklejki-wycinane-laserowo"],["Napis Imienny — Kursywa Drewniana","imie-ze-sklejki-brzozowej-pisane-kursywa"],["Napis w Kole lub Kształcie","napis-ze-sklejki-w-kole-lub-innym-ksztalcie"],["Logo Firmowe Laserowe 3D","logo-firmy-ze-sklejki-od-jednej-do-trzech-warstw"],["Logo Klubu Sportowego 3D","herb-klubu-sportowego-ze-sklejki"],["Drewniana Koszulka Sportowa LED RGB","drewniana-koszulka-sportowa-z-podswietleniem-led-rgb"],["Baza Makrama / Łapacz Snów","baza-ze-sklejki-do-makramy-i-lapacza-snow"],["Formatka Sklejkowa Cięta Laserem","formatka-ze-sklejki-cieta-laserem-na-wymiar"],["Kształt Dekoracyjny ze Sklejki","dekoracyjne-ksztalty-ze-sklejki-na-zamowienie"],["Pudelko ślubne na pieniądze","pudelko-slubne-na-pieniadze"]]);
const aliases=new Map();
export function rememberProjectLinks(base){
  for(const p of base){
    if(!p.id?.startsWith('['))continue;
    const slug=published.get(p.title.trim());
    if(slug)aliases.set(p.id,slug);
  }
}
export function projectPath(p){
  const slug=published.get(p.id)||aliases.get(p.id);
  return slug?'/realizacje/'+slug+'/':'/realizacja/?id='+encodeURIComponent(p.id);
}