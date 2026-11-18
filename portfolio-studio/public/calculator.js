export function estimate(f) {
  const num = key => Number(f.get(key));
  const area = num('width') * num('height') * num('qty');
  const material = area / (num('sheetW') * num('sheetH')) * num('sheetCost');
  const laser = num('minutes') * num('rate');
  const extra = num('extras');
  const total = material + laser + extra;
  return {area,material,laser,extra,total,unit:total/num('qty')};
}
export const money = value => new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN'}).format(value);
