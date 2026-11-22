export function recentProjects(projects, changes) {
  const visible = new Map(projects.filter(p => p.photos?.length && p.published !== false).map(p => [p.id, p]));
  const added = changes.filter(p => !p.removed && (p.addedOrder || /^[0-9a-f-]{36}$/i.test(p.id)));
  added.sort((a, b) => (b.addedOrder || 0) - (a.addedOrder || 0));
  const ids = new Set(added.map(p => p.id));
  return Array.from(ids, id => visible.get(id)).filter(Boolean).slice(0, 12);
}

export function initRecent(projects, changes, projectCard) {
  const items = recentProjects(projects, changes);
  if (!items.length) return;
  const section = document.querySelector('#ostatnio-wykonane');
  const cards = document.querySelector('#recent-cards');
  const mobile = matchMedia('(max-width: 720px)');
  const nav = document.querySelector('#recent-nav');
  let start = 0;
  function render() {
    const count = Math.min(items.length, mobile.matches ? 1 : 3);
    nav.hidden = count === items.length;
    if (nav.hidden) start = 0;
    const visible = Array.from({length: count}, (_, offset) => projectCard(items[(start + offset) % items.length]));
    cards.replaceChildren(...visible);
  }
  function move(step) {
    if (nav.hidden) return;
    start = (start + step + items.length) % items.length;
    render();
  }
  document.querySelector('#recent-prev').onclick = () => move(-1);
  document.querySelector('#recent-next').onclick = () => move(1);
  let touch;
  cards.addEventListener('touchstart', event => {
    touch = event.touches.length === 1 ? event.touches[0] : null;
  }, {passive: true});
  cards.addEventListener('touchcancel', () => { touch = null; });
  cards.addEventListener('touchend', event => {
    if (!touch || nav.hidden) return;
    const end = event.changedTouches[0];
    const dx = end.clientX - touch.clientX;
    const dy = end.clientY - touch.clientY;
    touch = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (event.cancelable) event.preventDefault();
      move(dx < 0 ? 1 : -1);
    }
  }, {passive: false});
  mobile.addEventListener('change', render);
  section.hidden = false;
  render();
  if (location.hash === '#ostatnio-wykonane') section.scrollIntoView();
}
