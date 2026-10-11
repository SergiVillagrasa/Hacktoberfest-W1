export interface SpeechSynth {
  speak(text: string): Promise<Uint8Array>;
}

export interface HintGenerator {
  stylize(imageUrl: string): Promise<Uint8Array>;
}
