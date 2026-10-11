import { fal } from '@fal-ai/client';
import type { HintGenerator } from '@snaphunt/core';

export const HINT_ENDPOINT = 'fal-ai/nano-banana-2/edit';
export const HINT_PROMPT =
  'stylized cheerful cartoon illustration of only the main object, same silhouette and distinctive non-text features, plain pastel background, no text, no labels, no surroundings';

export function createFalHints(apiKey: string): HintGenerator {
  fal.config({ credentials: apiKey });
  return {
    async stylize(imageUrl) {
      const { data } = await fal.subscribe(HINT_ENDPOINT, {
        input: { prompt: HINT_PROMPT, image_urls: [imageUrl], num_images: 1, resolution: '1K', output_format: 'webp' },
      });
      const url = data.images[0]?.url;
      if (!url) throw new Error('Fal returned no image');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Fal image download failed: ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}
