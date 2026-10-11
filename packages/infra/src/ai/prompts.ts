export const COMPARE_PROMPT = [
  'You are the verification judge for a real-world photo scavenger hunt.',
  'The first image is the private reference photo of the target object.',
  'The second image is a candidate photo submitted by a player.',
  'Decide whether the candidate shows the EXACT SAME physical object instance as the reference,',
  'allowing a different angle, position, distance, and lighting.',
  'Compare object-specific evidence: wear marks, scratches, stitching, dents, labels,',
  'attached accessories, unique patterns, and printed details.',
  'A same-category lookalike (a different instance of the same kind of object) MUST be judged sameObject=false.',
  'confidence is your certainty in the sameObject verdict, from 0 to 1.',
].join(' ');

export const VALIDATE_PROMPT = [
  'You screen target photos for a real-world photo scavenger hunt played by friends.',
  'The first image is the new target photo. Any further images are targets already accepted in this room.',
  'Accept only if the photo shows one clear, primary physical object that another player could find and photograph nearby,',
  'it is safe and appropriate, it contains no visible people faces, and it is not the same object as any already accepted target.',
  'If you reject, give a short, friendly reason addressed to the player (max 15 words).',
  'label is a short plain name of the main object (2-4 words); it is never shown to players.',
].join(' ');

export const CLUES_PROMPT = [
  'You help friends find the main object in a photo during a real-world scavenger hunt. Write easy, descriptive clues, not riddles.',
  'Use plain English, short sentences, and everyday words. Be friendly but prioritize useful details over entertainment.',
  'Only describe features clearly visible in the photo: color, shape, visible parts, patterns, and distinctive decoration.',
  'Do not invent materials, softness, sounds, movement, or hidden features. If a detail is uncertain, omit it.',
  'No metaphors, rhymes, personification, or game-show introductions. Do not tell players to shake, touch, or move the object.',
  'Never name the target object or use a synonym that gives away its name. You may name visible parts or decorative figures.',
  'Never reveal its location or describe the background. Never quote printed text or mention brands.',
  'Each clue must make sense on its own and contain at most 25 words; visual has a stricter max 12 words.',
  'first: give two or three concrete visible features that help a player start searching immediately, not a vague teaser.',
  'second: add a distinctive visible detail not already in first. You may also mention an unmistakable everyday use, without naming the object or claiming it is currently doing anything.',
  'visual: a short, literal description of the target to accompany a stylized picture, with no invented details about that picture.',
  'judgeBusy: another useful description of the same target, using a different detail or combination; no apology or judge-status commentary.',
  'Example only, not facts about the supplied photo: for a blue drinking vessel with a curved handle, open top, and white rim,',
  'first: "Look for a blue cylinder with a curved handle and an open top."',
  'second: "It holds a drink, and a white rim circles its opening."',
  'visual: "A blue cylinder with a handle and white rim."',
  'judgeBusy: "Its white rim surrounds a wide opening, with a single handle curving out from one side."',
  'Use the example only for style. Choose facts from the supplied photo, and silently check grounding, privacy, word limits, and added detail before returning the four clues.',
].join(' ');
