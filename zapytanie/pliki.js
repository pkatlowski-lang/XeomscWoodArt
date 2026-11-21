import {prepareReference} from './obraz.js';

function downloadName(name, format) {
  const stem = String(name).split(/[\\/]/).pop().replace(/\.[^.]*$/, '')
    .replace(/[<>:"|?*\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '_')
    .replace(/^[. ]+|[. ]+$/g, '').slice(0, 100);
  return (stem || 'zalacznik') + '.' + format;
}

export async function prepareFile(file) {
  if (!file) return null;
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'svg' && ext !== 'pdf') {
    const bytes = await prepareReference(file);
    return {name:downloadName(file.name,'jpg'), format:'jpg', bytes};
  }
  if (!file.size || file.size > 900000) throw Error('Wybierz niepusty plik SVG lub PDF do 900 kB. Większy oryginał możesz przesłać e-mailem.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (ext === 'pdf') {
    if (new TextDecoder().decode(bytes.subarray(0,5)) !== '%PDF-') throw Error('Ten plik nie ma nagłówka PDF.');
  } else {
    const svg = new DOMParser().parseFromString(await file.text(), 'image/svg+xml').documentElement;
    if (svg.localName !== 'svg' || svg.namespaceURI !== 'http://www.w3.org/2000/svg') throw Error('Nie udało się odczytać pliku SVG.');
  }
  return {name:downloadName(file.name,ext), format:ext, bytes};
}

export function packFile(file, Bytes) {
  return {name:file.name, format:file.format, content:Bytes.fromUint8Array(file.bytes)};
}

export function fileDownload(name, load) {
  const group = document.createElement('div');
  const button = document.createElement('button');
  const status = document.createElement('output');
  status.setAttribute('role','status');
  button.type = 'button';
  button.className = 'outline';
  button.textContent = 'Pobierz załącznik · ' + name;
  button.onclick = async () => {
    button.disabled = true;
    status.textContent = 'Pobieranie…';
    try {
      const file = await load();
      if (!file || !['svg','pdf','jpg'].includes(file.format)) throw Error();
      const url = URL.createObjectURL(new Blob([file.content.toUint8Array()], {type:'application/octet-stream'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName(file.name,file.format);
      group.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status.textContent = '';
    } catch {
      status.textContent = 'Nie udało się pobrać pliku. Spróbuj ponownie.';
    } finally {
      button.disabled = false;
    }
  };
  group.append(button,status);
  return group;
}
