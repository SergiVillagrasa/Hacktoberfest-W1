export interface ImageStore {
  put(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(path: string): Promise<Uint8Array>;
  signedUrl(path: string, ttlSeconds: number): Promise<string>;
}

export const storagePaths = {
  target: (roomId: string, uploadId: string) => `rooms/${roomId}/targets/${uploadId}.jpg`,
  submission: (roomId: string, submissionId: string) => `rooms/${roomId}/submissions/${submissionId}.jpg`,
  audio: (roomId: string, uploadId: string, kind: string) => `rooms/${roomId}/audio/${uploadId}-${kind}.mp3`,
  hint: (roomId: string, uploadId: string) => `rooms/${roomId}/hints/${uploadId}.webp`,
};
