export function createPhotoViewer() {
  const dialog = document.createElement('dialog');
  dialog.className = 'photo-dialog';
  dialog.setAttribute('aria-label', 'Powiększenie zdjęcia produktu');
  dialog.innerHTML = '<div class="photo-tools"><button type="button" class="photo-zoom" aria-pressed="false">Przybliż 2×</button><button type="button" class="photo-close" autofocus>Zamknij ×</button></div><div class="photo-pan"><img class="photo-full" alt="" draggable="false"></div>';
  document.body.append(dialog);
  const stage = dialog.querySelector('.photo-pan');
  const image = dialog.querySelector('img');
  const zoomButton = dialog.querySelector('.photo-zoom');
  let zoomed = false, opener;
  function resetZoom() {
    zoomed = false;
    image.style.removeProperty('width');
    image.classList.remove('magnified');
    zoomButton.textContent = 'Przybliż 2×';
    zoomButton.setAttribute('aria-pressed','false');
    stage.scrollTo(0,0);
  }
  function toggleZoom(event) {
    if (zoomed) { resetZoom(); return; }
    const rect = image.getBoundingClientRect();
    if (!image.naturalWidth || !rect.width) return;
    const x = event.target === image ? (event.clientX-rect.left)/rect.width : .5;
    const y = event.target === image ? (event.clientY-rect.top)/rect.height : .5;
    image.style.width = (2*rect.width)+'px';
    image.classList.add('magnified');
    zoomed = true;
    zoomButton.textContent = 'Oddal';
    zoomButton.setAttribute('aria-pressed','true');
    stage.scrollTo(x*image.offsetWidth-stage.clientWidth/2, y*image.offsetHeight-stage.clientHeight/2);
  }
  image.onclick = toggleZoom;
  zoomButton.onclick = toggleZoom;
  dialog.querySelector('.photo-close').onclick = () => dialog.close();
  dialog.onclick = event => {
    if (event.target === dialog || event.target === stage || event.target.classList.contains('photo-tools')) dialog.close();
  };
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.onclose = () => {
    document.documentElement.classList.remove('photo-modal-open');
    resetZoom();
    const focusTarget = opener?.isConnected ? opener : document.querySelector('.project-body .viewer');
    focusTarget?.focus({preventScroll:true});
  };
  return (trigger, paintImage) => {
    opener = trigger;
    resetZoom();
    paintImage(image);
    document.documentElement.classList.add('photo-modal-open');
    dialog.showModal();
  };
}
