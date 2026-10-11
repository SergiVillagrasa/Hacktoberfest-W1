export const MAX_SIDE = 1280;
export const JPEG_QUALITY = 0.82;
export const MAX_FALLBACK_BYTES = 3_500_000;
export const MIN_SIDE = 480;

export function fitWithin(width: number, height: number, maxSide = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Decides whether an encoded photo needs a smaller redraw. A JPEG result is
 * always fine; some browsers ignore the JPEG request and return a bigger PNG
 * or WebP, which only needs a retry when it risks the API's 4 MB limit.
 * Returns the smaller maxSide to redraw at, or null to keep the blob.
 */
export function shrinkSideFor(blob: Pick<Blob, 'type' | 'size'>, maxSide: number): number | null {
  if (blob.type === 'image/jpeg' || blob.size <= MAX_FALLBACK_BYTES) return null;
  const next = Math.floor(maxSide * 0.75);
  return next >= MIN_SIDE ? next : null;
}

/**
 * Shrinks a camera photo under the API's 4 MB limit, honouring the phone's
 * orientation. Prefers JPEG but may return PNG or WebP on browsers that
 * ignore the JPEG request, shrinking further if that output is too large.
 */
export async function resizeToJpeg(file: Blob, maxSide = MAX_SIDE, quality = JPEG_QUALITY): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error("We couldn't read that photo. Try taking it again.");
  }
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  let side = maxSide;
  for (;;) {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, side);
    canvas.width = width;
    canvas.height = height;
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) {
      bitmap.close();
      throw new Error("We couldn't prepare that photo. Try taking it again.");
    }
    const next = shrinkSideFor(blob, side);
    if (next === null) {
      bitmap.close();
      return blob;
    }
    side = next;
  }
}
