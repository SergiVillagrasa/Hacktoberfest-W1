export interface TargetValidation {
  accepted: boolean;
  reason: string | null;
  label: string;
}

export interface ClueSet {
  first: string;
  second: string;
  visual: string;
  judgeBusy: string;
}

export interface MatchEvidence {
  sameObject: boolean;
  confidence: number;
  matchingFeatures: string[];
  differences: string[];
}

export interface VisionModel {
  validateTarget(image: Uint8Array, otherAccepted: Uint8Array[], signal: AbortSignal): Promise<TargetValidation>;
  writeClues(image: Uint8Array, signal: AbortSignal): Promise<ClueSet>;
  compare(reference: Uint8Array, candidate: Uint8Array, signal: AbortSignal): Promise<MatchEvidence>;
}
