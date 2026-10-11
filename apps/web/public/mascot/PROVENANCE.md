# Mascot and voice assets

## Poses (`public/mascot/*.webp`)
- `idle.webp` is the approved canonical pug host, generated with `fal-ai/nano-banana-2` (text to image), candidate "a" of three, chosen by the product owner on 2026-10-11. The other seven poses (`talking`, `thinking`, `celebrating`, `sad`, `shocked`, `countdown`, `trophy`) were generated with `fal-ai/nano-banana-2/edit` using the canonical pug as the single reference image, one image each, and approved by the product owner.
- Every file had its flat lavender ground cut out, its baked-in ground shadow recoloured to a neutral translucent shadow and was trimmed with `scripts/mascot-cutout.py`. The unmodified canonical original stays in `packages/infra/assets/pug-mascot.webp` for hint generation.
- Each `<pose>.webp.json` sidecar holds the exact generation prompt.

## Host voice (`public/voice/*.mp3`)
Generated once with ElevenLabs (`eleven_v4`, voice "Charlie", id `IKne3meq5aSn9XLyUdCD`) on 2026-10-11 and approved by the product owner. The lines contain no player names so they can be static:

- `welcome`: "Welcome to SnapHunt! Find your friends' secret objects, snap the proof, and enjoy the great outdoors."
- `countdown`: "Ready? Here we go! Three, two, one... start hunting!"
- `find`: "Boom! You found it! What a great snap!"
- `eliminated`: "Oh no, you've been knocked out! Stick around and cheer on the rest of the hunt."
- `solo`: "Only a few hunters left, so it's a solo hunt now. No more knockouts, just find your object!"
- `winner`: "And that's the game! Let's see who is the champion of the hunt!"
