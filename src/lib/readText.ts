/* "Attach + parse text": reads the words out of a PDF or a picture, on the phone.
   PDF text comes from PDF.js, which is part of the app (works offline and under a filter).
   Scanned PDFs and photos need OCR (Tesseract), loaded from the internet the first time — if the
   filter blocks it, the file is still attached; only the reading is skipped. */

export async function pdfText(blob: Blob, maxPages = 12): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = '';
    const lines: string[] = [];
    for (const item of content.items as { str?: string; hasEOL?: boolean }[]) {
      line += item.str ?? '';
      if (item.hasEOL) { lines.push(line.trim()); line = ''; }
    }
    if (line.trim()) lines.push(line.trim());
    pages.push(lines.join('\n'));
  }
  return pages.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* The first pages of a PDF as pictures, for OCR when the PDF has no text layer. */
async function pdfPages(blob: Blob, maxPages = 4): Promise<Blob[]> {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const out: Blob[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width;
    canvas.height = vp.height;
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
    out.push(await new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('no image'))), 'image/png')));
  }
  return out;
}

interface TesseractApi { recognize(img: Blob, langs: string): Promise<{ data: { text: string } }> }
let tesseract: Promise<TesseractApi> | undefined;
function loadTesseract(): Promise<TesseractApi> {
  tesseract ??= new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.onload = () => { const t = (window as unknown as { Tesseract?: TesseractApi }).Tesseract; if (t) ok(t); else no(new Error('OCR did not load')); };
    s.onerror = () => { tesseract = undefined; no(new Error('OCR could not be downloaded (offline or blocked)')); };
    document.head.appendChild(s);
  });
  return tesseract;
}

export async function ocr(img: Blob): Promise<string> {
  const t = await loadTesseract();
  for (const langs of ['eng+heb+rus', 'eng+heb', 'eng']) {
    try { return (await t.recognize(img, langs)).data.text.trim(); } catch { /* try fewer languages */ }
  }
  return '';
}

/* Text of any profile file: PDF text layer first, OCR when there's (almost) none. */
export async function readFileText(blob: Blob, name = ''): Promise<string> {
  const isPdf = /pdf/i.test(blob.type) || /\.pdf$/i.test(name);
  if (isPdf) {
    const text = await pdfText(blob);
    if (text.replace(/\s/g, '').length >= 80) return text;
    const parts: string[] = [];
    for (const page of await pdfPages(blob)) parts.push(await ocr(page));
    return parts.join('\n\n').trim() || text;
  }
  if (/^image\//.test(blob.type)) return ocr(blob);
  if (/^text\//.test(blob.type)) return (await blob.text()).trim();
  return '';
}
