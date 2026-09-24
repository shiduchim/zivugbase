/* A real, valid PDF that carries the whole backup inside it as an embedded file.
   Why: Android Chrome can share PDFs from a web app but not ZIPs (Chromium's shareable-file
   list), and the raw bytes avoid base64's one-third size penalty. Page 1 is a readable cover.
   Standard PDF viewers show the backup as an attachment; ZivugBase reads it back. */

const enc = new TextEncoder();
const MARK = '/ZivugBaseBackup true';

function pdfString(s: string): string {
  /* Cover text is plain ASCII; escape PDF string delimiters. */
  return '(' + s.replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1') + ')';
}

export interface CoverInfo { title: string; lines: string[] }

export function makeBackupPdf(payload: Uint8Array, cover: CoverInfo, fileName: string): Uint8Array {
  const text = [
    'BT /F1 22 Tf 56 760 Td ' + pdfString(cover.title) + ' Tj ET',
    ...cover.lines.map((l, i) => `BT /F1 12 Tf 56 ${720 - i * 20} Td ${pdfString(l)} Tj ET`)
  ].join('\n');

  const objects: (string | { head: string; data: Uint8Array })[] = [
    /* 1 */ '<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles 6 0 R >> /PageMode /UseAttachments >>',
    /* 2 */ '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    /* 3 */ '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    /* 4 */ '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    /* 5 */ { head: `<< /Length ${enc.encode(text).length} >>`, data: enc.encode(text) },
    /* 6 */ `<< /Names [${pdfString(fileName)} 7 0 R] >>`,
    /* 7 */ `<< /Type /Filespec /F ${pdfString(fileName)} /UF ${pdfString(fileName)} /EF << /F 8 0 R >> /Desc (ZivugBase backup) >>`,
    /* 8 */ { head: `<< /Type /EmbeddedFile /Subtype /application#2Fzip ${MARK} /Length ${payload.length} /Params << /Size ${payload.length} >> >>`, data: payload }
  ];

  const parts: Uint8Array[] = [];
  let offset = 0;
  const push = (b: Uint8Array | string) => { const u = typeof b === 'string' ? enc.encode(b) : b; parts.push(u); offset += u.length; };
  push('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n');
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(offset);
    if (typeof o === 'string') push(`${i + 1} 0 obj\n${o}\nendobj\n`);
    else { push(`${i + 1} 0 obj\n${o.head}\nstream\n`); push(o.data); push('\nendstream\nendobj\n'); }
  });
  const xref = offset;
  push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map((n) => String(n).padStart(10, '0') + ' 00000 n \n').join(''));
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(offset);
  let p = 0;
  for (const part of parts) { out.set(part, p); p += part.length; }
  return out;
}

export const isPdf = (b: Uint8Array): boolean => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; /* %PDF */

/* Finds the embedded backup in a PDF made by makeBackupPdf. */
export function readBackupPdf(pdf: Uint8Array): Uint8Array | undefined {
  const latin = new TextDecoder('latin1').decode(pdf);
  const at = latin.indexOf(MARK);
  if (at < 0) return undefined;
  const dictStart = latin.lastIndexOf('<<', at);
  const dictEnd = latin.indexOf('>> >>', at);
  const length = Number(/\/Length (\d+)/.exec(latin.slice(dictStart, dictEnd + 5))?.[1]);
  const streamAt = latin.indexOf('stream\n', dictEnd);
  if (!Number.isFinite(length) || streamAt < 0) return undefined;
  const start = streamAt + 'stream\n'.length;
  return pdf.slice(start, start + length);
}
