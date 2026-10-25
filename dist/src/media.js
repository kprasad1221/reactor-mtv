export async function prepareImage(file) {
  if (
    !file ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw Error("Choose a PNG, JPEG or WebP image under 10 MB.");
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw Error("This image could not be decoded.");
  }
  try {
    if (bitmap.width * bitmap.height > 25000000)
      throw Error("Choose an image under 25 megapixels.");
    const scale = Math.min(1, 1536 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#161616";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw Error("Could not prepare the source image.");
    return blob;
  } finally {
    bitmap.close();
  }
}

export async function testSignal() {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  const audio = new AudioContext();
  await audio.resume();
  const dest = audio.createMediaStreamDestination();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = 440;
  gain.gain.value = 0.035;
  osc.connect(gain).connect(dest);
  osc.start();
  const colors = [
    "#e7e4d9",
    "#e3d839",
    "#56bdb9",
    "#57a565",
    "#ca527b",
    "#ba4d3d",
    "#414776",
  ];
  let raf;
  const start = performance.now();
  function draw(now) {
    colors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect((i * 800) / 7, 0, 800 / 7 + 1, 385);
    });
    ctx.fillStyle = "#171717";
    ctx.fillRect(0, 385, 800, 215);
    ctx.fillStyle = "#f5efe0";
    ctx.font = "bold 36px monospace";
    ctx.fillText("REACTOR MTV", 46, 445);
    ctx.font = "22px monospace";
    ctx.fillText("LOCAL TEST SIGNAL  /  440 Hz", 46, 486);
    const x = ((now - start) / 7) % 690;
    ctx.fillStyle = "#edcd38";
    ctx.fillRect(46 + x, 527, 18, 22);
    ctx.fillStyle = "#fff";
    ctx.font = "18px monospace";
    ctx.fillText(((now - start) / 1000).toFixed(1) + " SEC", 650, 580);
    raf = requestAnimationFrame(draw);
  }
  draw(start);
  const stream = canvas.captureStream(25);
  stream.addTrack(dest.stream.getAudioTracks()[0]);
  return {
    stream,
    stop() {
      cancelAnimationFrame(raf);
      osc.stop();
      stream.getTracks().forEach((t) => t.stop());
      void audio.close();
    },
  };
}

export function recordStream(stream) {
  if (!globalThis.MediaRecorder) return null;
  const mime = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(
    (t) => MediaRecorder.isTypeSupported(t),
  );
  if (!mime) return null;
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  recorder.start(200);
  let stopping;
  return {
    stop() {
      return (stopping ||= new Promise((resolve) => {
        const done = () => resolve(new Blob(chunks, { type: mime }));
        if (recorder.state === "inactive") return done();
        recorder.onstop = done;
        recorder.stop();
      }));
    },
  };
}
