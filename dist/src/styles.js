// Style IDs are the public selection keys; prompt text is an internal implementation detail.
export const MODEL = "reactor/fast-h3-omni";
export const CLIP_SECONDS = 5.875;
export const STYLES = [
  {
    id: "cinematic-noir",
    name: "Cinematic noir",
    reference: "David Fincher · Express Yourself (1989)",
    description: "Sculpted light. Monumental space. A deliberate camera.",
    music:
      "Original late-1980s industrial dance-pop, 112 BPM, 4/4. Tight drum-machine kick, gated snare, syncopated bass and restrained metallic synth accents. Instrumental; a clear rhythmic phrase, not a drone.",
    video:
      "Cinematic performance staged in a monumental interior. Preserve the main subject from <Picture 1>. Sculpt it with hard side light, deep shadows, narrow backlit haze and controlled highlights. Desaturated steel and amber palette. Begin with a low medium-wide composition, then make one precise forward dolly as the subject turns or moves with conviction. Keep camera movement deliberate and the silhouette legible. Film-like contrast and fine grain, not a VHS overlay.",
  },
  {
    id: "drawn-world",
    name: "Drawn into the video",
    reference:
      "Steve Barron; animation by Michael Patterson + Candace Reckinger · Take On Me (1985)",
    description: "Live action crosses into a hand-drawn world.",
    music:
      "Original bright 1980s synth-pop, 124 BPM, 4/4. A short memorable arpeggiated synth hook, springy bass, brisk electronic drums and sustained chords. Instrumental, buoyant and propulsive.",
    video:
      "Translate the subject and setting of <Picture 1> into expressive graphite rotoscope drawing on off-white paper. Retain facial or object identity and the source composition landmarks. Use visible pencil hatching, subtly boiling outlines and convincing live-action movement underneath the drawing. Start with a recognizable photographic view; a diagonal paper boundary sweeps across the scene, revealing the pencil world while the subject continues the same gesture. End predominantly drawn. One coherent transformation, not unrelated images or smooth plastic 3D.",
  },
  {
    id: "stage-spectacle",
    name: "Pop stage spectacle",
    reference: "Mary Lambert · Material Girl (1985)",
    description: "Theatrical staging. Saturated sets. Performance first.",
    music:
      "Original 1980s dance-pop, 118 BPM, 4/4. Crisp handclaps, round synth bass, bright chord stabs and a playful repeating melodic hook. Instrumental with confident stop-and-start accents.",
    video:
      "Re-stage the recognizable subject of <Picture 1> as the star of a theatrical pop performance. Use a frontal proscenium composition, saturated crimson and warm ivory scenery, soft beauty light and polished practical surfaces. Build one simple choreographed gesture or object movement that lands on a musical accent. Begin wide enough to read the stage, then make one motivated cut closer on the gesture. Maintain subject identity and spatial continuity across the cut. Glamorous, knowingly artificial studio craft.",
  },
  {
    id: "tactile-animation",
    name: "Frame-by-frame fantasy",
    reference:
      "Stephen R. Johnson; Aardman + Brothers Quay · Sledgehammer (1986)",
    description: "Handmade objects spring into rhythmic life.",
    music:
      "Original exuberant art-funk, 98 BPM, 4/4. Elastic bass, punchy drums, bright brass-like stabs and short call-and-answer figures. Instrumental with clear accents for physical movement.",
    video:
      "Reinterpret <Picture 1> as a tactile handmade animation set. Preserve the recognizable main subject and arrangement. Use painted cardboard, clay and practical miniature props, consistent real shadows and frame-by-frame stepped motion. Keep the camera mostly frontal. Make one nearby object assemble from a few visible pieces, move around the subject on the beat and resolve into a clear final pose. Maintain material texture and spatial logic; no liquid morphing or glossy CGI. Stage a short visual gag with a beginning and payoff.",
  },
  {
    id: "adventure-pop",
    name: "Adventure on location",
    reference: "Russell Mulcahy · Rio / Hungry Like the Wolf (1982)",
    description: "Bold locations. Movement. Cinematic pop escapism.",
    music:
      "Original early-1980s new-wave pop, 126 BPM, 4/4. Driving bass guitar, crisp drums, bright synth motifs and rhythmic guitar. Instrumental with an energetic recurring hook.",
    video:
      "Turn the location in <Picture 1> into an expansive pop-adventure setting while preserving its recognizable geography and subject. Saturated daylight, bold wardrobe or object color, wind and practical environmental movement. Track laterally alongside the subject, then cut once to a wider location reveal on a strong musical accent. Use clear screen direction and purposeful movement through space, not a slideshow or an unrelated tropical location pasted over the reference.",
  },
  {
    id: "surreal-room",
    name: "Surreal after-hours",
    reference: "Tim Pope · Close to Me (1985) / Lullaby (1989)",
    description: "An intimate room becomes an uncanny stage.",
    music:
      "Original 1980s alternative pop, 104 BPM, 4/4. Close dry drums, melodic bass, spare plucked guitar and a slightly uneasy repeating keyboard figure. Instrumental with space between phrases.",
    video:
      "Preserve the subject of <Picture 1> and compress the setting into an intimate theatrical space. Use close wide-angle perspective, practical props, muted color and a single motivated pool of light. The subject performs a small expressive gesture while one background element subtly tilts or changes scale. Make the oddity physical, playful and slightly unsettling. A slow camera creep reveals the change; keep the face or main object stable. No gore, random monsters, or digital glitch montage.",
  },
];
export function styleFor(id) {
  const style = STYLES.find((s) => s.id === id);
  if (!style) throw new Error("Unknown directing style.");
  return style;
}
export function promptFor(id) {
  const s = styleFor(id);
  return `MUSIC DIRECTION\n${s.music}\nCreate an original soundtrack; do not reproduce an existing song.\n\nVIDEO DIRECTION\n<Picture 1> is the source image: use its subject, visual identity and setting as the basis of this music video.\n${s.video}\nTie the main visual action to the musical phrasing. Complete one readable passage within ${CLIP_SECONDS} seconds. No captions, logos or text in the generated picture.`;
}
