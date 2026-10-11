import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import type { SpeechSynth } from '@snaphunt/core';

export const HOST_VOICE_ID = 'IKne3meq5aSn9XLyUdCD';
export const SPEECH_MODEL_ID = 'eleven_v4';

export function createElevenLabsSpeech(apiKey: string, voiceId = HOST_VOICE_ID): SpeechSynth {
  const client = new ElevenLabsClient({ apiKey });
  return {
    async speak(text) {
      const stream = await client.textToSpeech.convert(voiceId, { text, modelId: SPEECH_MODEL_ID, outputFormat: 'mp3_44100_128' });
      return new Uint8Array(await new Response(stream).arrayBuffer());
    },
  };
}
