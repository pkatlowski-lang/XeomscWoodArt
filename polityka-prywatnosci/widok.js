import {catalogFields} from '/portfolio-catalog.js?v=privacy-layout';
const index = document.querySelector('.policy-index');
if (matchMedia('(max-width:760px)').matches) index.open = false;

async function showSavedPolicy() {
  const fields = await catalogFields(['textContent.legal.privacy20261121']);
  const saved = fields?.textContent?.mapValue?.fields?.legal?.mapValue?.fields?.privacy20261121?.stringValue;
  if (!saved?.trim()) return;
  const article = document.querySelector('article'), nav = index.querySelector('nav');
  const blocks = saved.trim().split(/\r?\n\s*\r?\n/);
  if (blocks[0].toLocaleLowerCase('pl') === 'polityka prywatności') blocks.shift();
  const edition = document.querySelector('#edition');
  edition.textContent = /^Wersja z /.test(blocks[0]) ? blocks.shift() : '';
  const content = document.createDocumentFragment(), links = document.createDocumentFragment();
  let section, count = 0;
  for (const block of blocks) {
    if (block.length < 90 && !/[.!:;]$/.test(block) && !block.includes('\n')) {
      section = document.createElement('section'); section.id = 'sekcja-' + (++count);
      const heading = document.createElement('h2'), link = document.createElement('a');
      heading.textContent = link.textContent = block; link.href = '#' + section.id;
      section.append(heading); content.append(section); links.append(link);
    } else {
      const el = document.createElement(block.startsWith('- ') ? 'ul' : 'p');
      if (el.tagName === 'UL') {
        for (const line of block.split(/\r?\n/)) {
          const li = document.createElement('li'); li.textContent = line.replace(/^- /,''); el.append(li);
        }
      } else el.textContent = block;
      (section || content).append(el);
    }
  }
  article.replaceChildren(content); nav.replaceChildren(links); index.hidden = !count;
}
showSavedPolicy().catch(() => { /* The published policy is present in the HTML. */ });
