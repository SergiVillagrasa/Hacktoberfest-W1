export interface ImageStore {
  put(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(path: string): Promise<Uint8Array>;
  signedUrl(path: string, ttlSeconds: number): Promise<string>;
}

export const storagePaths = {
  target: (roomId: string, targetId: string) => `rooms/${roomId}/targets/${targetId}.jpg`,
  submission: (roomId: string, submissionId: string) => `rooms/${roomId}/submissions/${submissionId}.jpg`,
  audio: (roomId: string, targetId: string, kind: string) => `rooms/${roomId}/audio/${targetId}-${kind}.mp3`,
  hint: (roomId: string, targetId: string) => `rooms/${roomId}/hints/${targetId}.webp`,
};
