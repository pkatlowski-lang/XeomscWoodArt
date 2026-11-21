const formats = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxFileBytes = 10_000_000;
const maxPreviewBytes = 350_000;

export async function prepareReference(file) {
  if (!file) return null;
  if (!file.size || !formats.has(file.type)) throw Error('Wybierz obraz JPG, PNG lub WebP.');
  if (file.size > maxFileBytes) throw Error('Plik przekracza 10 MB. Wybierz mniejszy obraz.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    for (const edge of [1600, 1200, 900, 640]) {
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const preview = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.84));
      if (preview?.type === 'image/jpeg' && preview.size && preview.size <= maxPreviewBytes) {
        return new Uint8Array(await preview.arrayBuffer());
      }
    }
  } catch {
    throw Error('Nie udało się odczytać obrazu. Wybierz inny plik JPG, PNG lub WebP.');
  } finally {
    URL.revokeObjectURL(url);
  }
  throw Error('Nie udało się pomniejszyć obrazu. Wybierz mniejsze zdjęcie.');
}
