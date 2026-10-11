import { createClient } from '@supabase/supabase-js';
import type { ImageStore } from '@snaphunt/core';

export const IMAGE_BUCKET = 'snaphunt-private';

export function createSupabaseImageStore(url: string, serviceRoleKey: string, bucket = IMAGE_BUCKET): ImageStore {
  const storage = createClient(url, serviceRoleKey, { auth: { persistSession: false } }).storage;
  let ready: Promise<void> | undefined;
  const ensureBucket = () =>
    (ready ??= (async () => {
      const { error } = await storage.createBucket(bucket, { public: false });
      if (error && !/already exists|duplicate/i.test(error.message)) throw error;
    })().catch((e) => {
      ready = undefined;
      throw e;
    }));

  return {
    async put(path, bytes, contentType) {
      await ensureBucket();
      const { error } = await storage.from(bucket).upload(path, bytes, { contentType, upsert: true });
      if (error) throw error;
    },
    async get(path) {
      const { data, error } = await storage.from(bucket).download(path);
      if (error) throw error;
      return new Uint8Array(await data.arrayBuffer());
    },
    async signedUrl(path, ttlSeconds) {
      const { data, error } = await storage.from(bucket).createSignedUrl(path, ttlSeconds);
      if (error) throw error;
      return data.signedUrl;
    },
  };
}
