import { readFile } from 'node:fs/promises';
import { fal } from '@fal-ai/client';
import type { HintGenerator } from '@snaphunt/core';

export const HINT_ENDPOINT = 'fal-ai/nano-banana-2/edit';

export const PUG_ACTIONS = [
  'The pug is happily hugging the object.',
  'The pug is peeking out from behind the object and pointing at it with one paw, playful expression.',
  'The pug wears a tiny detective hat and inspects the object through a magnifying glass.',
  'The pug balances the object on its head, proud and cheerful.',
  'The pug sniffs the object curiously with its nose close to it, one paw raised.',
] as const;

const REFERENCES =
  'The first image is the object to feature; the second image is the pug mascot character. Keep the pug mascot exactly as designed in the second image: same simple flat style, same fawn body, dark muzzle and ears, big ringed eyes, plain solid red bow tie, bold dark outlines, solid flat colors, no shading. The pug has no blush or pink cheeks and no whiskers. Redraw the object from the first image as a simplified cartoon in the same flat style, keeping its silhouette and most distinctive non-text features.';
const STYLE =
  'Plain pastel lavender background, no text, no labels, no scenery, no location cues, the object is clearly the focus and readable at small size.';

export const buildHintPrompt = (action: string) => `${REFERENCES} ${action} ${STYLE}`;

const MASCOT_LOCATIONS = ['../../assets/pug-mascot.webp', './pug-mascot.webp'];

export async function loadPugMascot(): Promise<Uint8Array> {
  for (const location of MASCOT_LOCATIONS) {
    try {
      return new Uint8Array(await readFile(new URL(location, import.meta.url)));
    } catch {
      continue;
    }
  }
  throw new Error('pug-mascot.webp not found next to the bundle or in packages/infra/assets');
}

export interface FalHintsOptions {
  mascot: Uint8Array;
  pickAction?: () => string;
}

export function createFalHints(apiKey: string, { mascot, pickAction = () => PUG_ACTIONS[Math.floor(Math.random() * PUG_ACTIONS.length)]! }: FalHintsOptions): HintGenerator {
  fal.config({ credentials: apiKey });
  let mascotUrl: Promise<string> | undefined;
  const uploadMascot = () =>
    (mascotUrl ??= fal.storage.upload(new Blob([mascot as BlobPart], { type: 'image/webp' })).catch((e) => {
      mascotUrl = undefined;
      throw e;
    }));

  return {
    async stylize(imageUrl) {
      const { data } = await fal.subscribe(HINT_ENDPOINT, {
        input: { prompt: buildHintPrompt(pickAction()), image_urls: [imageUrl, await uploadMascot()], num_images: 1, resolution: '1K', output_format: 'webp' },
      });
      const url = data.images[0]?.url;
      if (!url) throw new Error('Fal returned no image');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Fal image download failed: ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}
