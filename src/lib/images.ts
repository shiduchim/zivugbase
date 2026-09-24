/* Photos are re-saved before storing: that removes hidden details such as the GPS location a
   phone camera writes into the file, and makes a small preview for lists. If anything fails the
   original file is kept as it came — a file is never lost because a preview couldn't be made. */

const REENCODE: Record<string, { type: string; quality?: number; maxSide: number }> = {
  'image/jpeg': { type: 'image/jpeg', quality: 0.9, maxSide: 3000 },
  'image/png': { type: 'image/png', maxSide: 6000 },
  'image/webp': { type: 'image/webp', quality: 0.9, maxSide: 3000 }
};

async function draw(src: ImageBitmap, maxSide: number, type: string, quality?: number): Promise<Blob | undefined> {
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(w, h);
    const ctx = c.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(src, 0, 0, w, h);
    return c.convertToBlob({ type, ...(quality ? { quality } : {}) });
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return undefined;
  ctx.drawImage(src, 0, 0, w, h);
  return new Promise((resolve) => c.toBlob((b) => resolve(b ?? undefined), type, quality));
}

export async function prepareImage(file: Blob): Promise<{ blob: Blob; thumb?: Blob }> {
  const plan = REENCODE[file.type];
  if (!plan || typeof createImageBitmap === 'undefined') return { blob: file };
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
      const clean = await draw(bmp, plan.maxSide, plan.type, plan.quality);
      let thumb = await draw(bmp, 320, 'image/webp', 0.8);
      if (thumb && thumb.type !== 'image/webp') thumb = await draw(bmp, 320, 'image/jpeg', 0.8);
      return { blob: clean && clean.size > 0 ? clean : file, ...(thumb ? { thumb } : {}) };
    } finally {
      bmp.close();
    }
  } catch {
    return { blob: file };
  }
}

export const isImage = (type: string): boolean => /^image\//.test(type);
export const isPdfType = (type: string, name = ''): boolean => type === 'application/pdf' || /\.pdf$/i.test(name);
export const isAudio = (type: string, name = ''): boolean => /^audio\//.test(type) || /\.(opus|ogg|m4a|mp3|aac|amr|wav|webm)$/i.test(name);
export const isVcard = (type: string, name = ''): boolean => /vcard/i.test(type) || /\.vcf$/i.test(name);
