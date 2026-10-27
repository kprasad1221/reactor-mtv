import { STYLES } from "./styles.js";
import { ReactorAttempt } from "./reactor-session.js";
import { prepareImage, testSignal, recordStream } from "./media.js";
const $ = (id) => document.getElementById(id),
  player = $("player");
let config = null,
  index = 0,
  source = null,
  sourceURL = null,
  free = null,
  attempt = null,
  busy = false,
  unknown = false,
  recorder = null,
  meter = null,
  mediaTimer = null,
  frames = 0,
  audioDetected = false,
  frameCallback = null;
const takes = new Map();
const stages = {
  preflight: "Checking player",
  authorizing: "Creating bounded session",
  connecting: "Connecting to Reactor",
  uploading: "Uploading source image",
  uploaded: "Source image uploaded",
  generating: "Generating music + video",
  playing: "Receiving generated take",
  closing: "Closing Reactor session",
  closed: "Session closed",
  closure_unknown: "Session closure unconfirmed",
};
const errors = {
  credentials_rejected:
    "Reactor rejected this key. Check the key and account access.",
  invalid_key: "Enter a Reactor API key beginning with rk_.",
  key_required: "Set your Reactor key locally first.",
  attempt_active:
    "Another attempt is active in this local server. Stop it before starting again.",
  attempt_cancelled: "Attempt cancelled.",
  attempt_timeout:
    "The bounded test timed out. Check the last stage before trying again.",
  cancelled: "Attempt stopped.",
  closure_unknown:
    "Session closure is unconfirmed. New generation is blocked. Retry closure and check your Reactor dashboard.",
  reactor_sdk_error:
    "Reactor reported a connection or command error. Check account access and the last completed stage.",
  command_refused:
    "Reactor refused a model command. See the test guide before retrying.",
  command_not_acknowledged:
    "The model did not acknowledge the expected command.",
  generation_failed: "Reactor reported a generation failure.",
  generation_stopped: "Reactor stopped this generation.",
  invalid_upload_response: "The SDK did not return the expected uploaded-image reference.",
  attempt_failed:
    "The Reactor attempt failed. Check the last stage and your account.",
  reactor_unavailable: "The local server could not reach Reactor.",
  session_create_failed: "Reactor could not create the session.",
  token_failed: "Reactor could not issue a session token.",
  invalid_token_response: "Reactor returned an unexpected token response.",
  invalid_session_response: "Reactor returned an unexpected session response.",
};
function feedback(text, error = false) {
  $("feedback").textContent = text;
  $("feedback").classList.toggle("error", error);
}
function log(text) {
  const li = document.createElement("li");
  li.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  $("events").append(li);
  $("events").scrollTop = $("events").scrollHeight;
}
function setStage(stage) {
  $("status").textContent = stages[stage] || stage;
  log(stages[stage] || stage);
}
function update() {
  const locked = busy || unknown;
  for (const id of ["style", "previous", "next", "source", "test", "consent"])
    $(id).disabled = locked;
  $("generate").disabled =
    locked || !config?.configured || !source || !$("consent").checked;
  $("upload-test").disabled = $("generate").disabled;
  $("stop").disabled = !attempt || !busy;
  $("stop-test").disabled = !free;
  $("key-form")
    .querySelectorAll("input,button")
    .forEach((el) => (el.disabled = locked));
  $("retry-close").hidden = !unknown;
  $("key-status").textContent = config?.configured ? "set locally" : "not set";
  $("replay").disabled = busy || !takes.has(STYLES[index].id);
  $("download").hidden = busy || !takes.has(STYLES[index].id);
  if (takes.has(STYLES[index].id))
    $("download").href = takes.get(STYLES[index].id).url;
}
async function api(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Station-CSRF": config.csrf,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(Error("Local API request failed."), {
      code: data.error,
    });
  return data;
}
async function refresh() {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) throw Error();
    config = await response.json();
    $("local-controls").hidden = false;
    $("local-notice").textContent =
      "Local server connected. Generation uses your Reactor account.";
    unknown = ["closure_unknown", "closing", "starting", "active"].includes(
      config.state,
    );
  } catch {
    $("local-controls").hidden = true;
    $("local-notice").textContent =
      "Run this repository locally to use Reactor. This preview only supports the free signal check.";
  }
  update();
}
function clearMedia() {
  free?.stop();
  free = null;
  clearInterval(mediaTimer);
  mediaTimer = null;
  if (frameCallback !== null && player.cancelVideoFrameCallback)
    player.cancelVideoFrameCallback(frameCallback);
  frameCallback = null;
  meter?.source.disconnect();
  if (meter) void meter.context.close();
  meter = null;
  player.pause();
  player.srcObject = null;
  player.removeAttribute("src");
  player.load();
}
function observe(stream, context) {
  frames = 0;
  audioDetected = false;
  if (player.requestVideoFrameCallback) {
    const frame = () => {
      frames++;
      frameCallback = player.requestVideoFrameCallback(frame);
    };
    frameCallback = player.requestVideoFrameCallback(frame);
  }
  if (context && stream.getAudioTracks().length) {
    const input = context.createMediaStreamSource(stream),
      analyser = context.createAnalyser();
    input.connect(analyser);
    meter = {
      context,
      source: input,
      analyser,
      data: new Float32Array(analyser.fftSize),
    };
  }
  mediaTimer = setInterval(() => {
    if (!player.requestVideoFrameCallback)
      frames = player.getVideoPlaybackQuality?.().totalVideoFrames || 0;
    if (meter) {
      meter.analyser.getFloatTimeDomainData(meter.data);
      audioDetected ||= meter.data.some((v) => Math.abs(v) > 0.0001);
    }
    $("media-status").textContent =
      `${frames} displayed frames · audio ${audioDetected ? "signal detected" : "not detected yet"}`;
  }, 200);
}
function showStream(stream, context) {
  player.srcObject = stream;
  $("ident").hidden = true;
  observe(stream, context);
  void player.play().catch(() => {
    player.muted = true;
    syncMute();
    void player.play().catch(() => {});
    feedback("Use the player controls to enable sound.");
  });
}
function syncMute() {
  $("mute").textContent = player.muted ? "Sound off" : "Sound on";
  $("mute").setAttribute("aria-pressed", String(player.muted));
}
function playTake() {
  const take = takes.get(STYLES[index].id);
  if (!take) return;
  clearMedia();
  player.src = take.url;
  player.loop = true;
  $("ident").hidden = true;
  $("signal-label").textContent = "RECORDED TAKE";
  $("media-status").textContent =
    "Replaying a captured take · no Reactor session";
  void player
    .play()
    .catch(() => feedback("Press play in the video to replay this take."));
}
function tune(next) {
  if (busy || unknown) return;
  clearMedia();
  index = (next + STYLES.length) % STYLES.length;
  const style = STYLES[index],
    number = String(index + 1).padStart(2, "0");
  $("style").value = style.id;
  $("channel-number").textContent = number;
  $("channel-label").textContent = "CH " + number;
  $("style-title").textContent = style.name;
  $("style-description").textContent = style.description;
  $("reference").textContent = "REFERENCE / " + style.reference;
  $("tuning").hidden = false;
  setTimeout(() => ($("tuning").hidden = true), 180);
  $("signal-label").textContent = "STANDBY";
  $("status").textContent = "Standby";
  $("ident").hidden = false;
  $("consent").checked = false;
  feedback(
    source
      ? "Source ready. Choose a direction and generate one take."
      : "Choose a source image, or start with the free signal check.",
  );
  if (takes.has(style.id)) playTake();
  else $("media-status").textContent = "No take on this channel yet";
  update();
}
STYLES.forEach((style, i) => {
  const option = document.createElement("option");
  option.value = style.id;
  option.textContent = String(i + 1).padStart(2, "0") + " / " + style.name;
  $("style").append(option);
});
$("style").onchange = () =>
  tune(STYLES.findIndex((s) => s.id === $("style").value));
$("previous").onclick = () => tune(index - 1);
$("next").onclick = () => tune(index + 1);
$("consent").onchange = update;
$("mute").onclick = () => {
  player.muted = !player.muted;
  syncMute();
};
$("replay").onclick = playTake;
let imageVersion = 0;
$("source").onchange = async () => {
  const version = ++imageVersion;
  source = null;
  update();
  try {
    const image = await prepareImage($("source").files[0]);
    if (version !== imageVersion) return;
    source = image;
    if (sourceURL) URL.revokeObjectURL(sourceURL);
    sourceURL = URL.createObjectURL(source);
    $("source-preview").src = sourceURL;
    $("source-preview").hidden = false;
    $("source-label").textContent = "Source ready · choose another";
    for (const take of takes.values()) URL.revokeObjectURL(take.url);
    takes.clear();
    tune(index);
    feedback(
      "Source ready. Pick a direction, then explicitly generate one take.",
    );
  } catch (error) {
    feedback(error.message, true);
    $("source-preview").hidden = true;
    $("source-label").textContent = "＋ Choose a source image";
  } finally {
    update();
  }
};
$("test").onclick = async () => {
  clearMedia();
  busy = true;
  update();
  $("events").replaceChildren();
  let context;
  try {
    context = new AudioContext();
    await context.resume();
    free = await testSignal();
    showStream(free.stream, context);
    $("signal-label").textContent = "LOCAL TEST";
    setStage("Free signal running");
    feedback(
      "Confirm moving bars and a quiet tone. This is a local media test, not a Reactor connection.",
    );
  } catch {
    if (context) void context.close();
    clearMedia();
    feedback(
      "Could not start the local signal. Use a current Chrome or Edge browser.",
      true,
    );
  } finally {
    busy = false;
    update();
  }
};
$("stop-test").onclick = () => {
  clearMedia();
  $("ident").hidden = false;
  $("signal-label").textContent = "STANDBY";
  setStage("Free signal stopped");
  update();
};
$("key-form").onsubmit = async (event) => {
  event.preventDefault();
  const field = $("api-key");
  let key = field.value.trim();
  field.value = "";
  busy = true;
  update();
  try {
    config = { ...config, ...(await api("/api/credentials", { key })) };
    feedback(
      "Key set in local server memory. No Reactor request has been made.",
    );
    $("credentials").open = false;
  } catch (error) {
    feedback(errors[error.code] || "Could not set the local key.", true);
  } finally {
    key = "";
    busy = false;
    update();
  }
};
$("forget-key").onclick = async () => {
  busy = true;
  update();
  try {
    config = { ...config, ...(await api("/api/credentials", { key: "" })) };
    $("api-key").value = "";
    feedback("Key cleared from this local server.");
  } catch {
    feedback("Could not clear the key. Check the local server.", true);
  } finally {
    busy = false;
    update();
  }
};
function describeFailure(error) {
  const stage = error.failedStage ? `Failed at: ${stages[error.failedStage] || error.failedStage}. ` : "";
  const detail = error.details || {};
  const fields = [detail.sdkCode, detail.httpStatus && `HTTP ${detail.httpStatus}`, detail.operation].filter(Boolean);
  const hint = detail.sdkCode === "NETWORK_ERROR"
    ? " The browser could not complete the request; check the browser-policy log and network/CORS errors."
    : "";
  return stage + (errors[error.code] || "The test could not run. Check browser support and build output.") +
    (fields.length ? ` [${fields.join(" · ")}]` : "") + hint;
}
// CSP events contain signed URLs: expose only a fixed diagnostic, never the URI.
window.addEventListener("securitypolicyviolation", (event) => {
  if (!attempt || !busy || event.effectiveDirective !== "connect-src") return;
  log("Browser policy blocked a network connection (connect-src). Upload may not have reached storage. No URL recorded.");
});
$("copy-log").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("events").innerText);
    $("copy-log").textContent = "Log copied";
  } catch {
    feedback("Select the signal-monitor text and copy it manually.");
  }
};
async function runAttempt(uploadOnly = false) {
  if (
    busy ||
    unknown ||
    !source ||
    !config?.configured ||
    !$("consent").checked
  )
    return;
  clearMedia();
  busy = true;
  $("consent").checked = false;
  $("events").replaceChildren();
  $("copy-log").textContent = "Copy test log";
  log(uploadOnly ? "UPLOAD ONLY · no generation will be requested · 30-second session limit" : "GENERATE · one take · 30-second session limit");
  $("ident").hidden = false;
  $("signal-label").textContent = "REACTOR TEST";
  let context,
    completed = false;
  try {
    if (
      !globalThis.RTCPeerConnection ||
      !globalThis.MediaRecorder ||
      !globalThis.WebAssembly
    )
      throw Error("unsupported");
    context = new AudioContext();
    await context.resume();
    attempt = new ReactorAttempt({
      api,
      makeReactor: async (options) => {
        const { Reactor } = await import("/vendor/reactor.js");
        return new Reactor(options);
      },
      onStage: setStage,
      onDiagnostic: log,
      onTracks: async (tracks) => {
        const stream = new MediaStream(tracks);
        showStream(stream, context);
        recorder = recordStream(stream);
      },
    });
    update();
    const result = await attempt.run({
      styleId: STYLES[index].id,
      image: source,
      uploadOnly,
    });
    completed = result.completed;
    if (uploadOnly) {
      feedback("Upload succeeded. Session closure confirmed. No generation was requested.");
      log("UPLOAD TEST PASSED · image uploaded · session closed · no enqueue");
    } else feedback(
      frames > 0 && audioDetected
        ? "Take received. Session closure confirmed. Replay or save it below the screen."
        : "Session closed, but picture and sound have not both been verified. Review the recording and signal monitor.",
      !(frames > 0 && audioDetected),
    );
  } catch (error) {
    const message = describeFailure(error);
    feedback(message, true);
    log(message);
  } finally {
    unknown = attempt?.closure === "closure_unknown";
    if (unknown) config.attemptId = attempt.id;
    const blob = await recorder?.stop();
    recorder = null;
    if (completed && frames > 0 && blob?.size) {
      const id = STYLES[index].id;
      const old = takes.get(id);
      if (old) URL.revokeObjectURL(old.url);
      takes.set(id, { url: URL.createObjectURL(blob) });
      $("download").download =
        `reactor-mtv-${id}.${blob.type.startsWith("video/mp4") ? "mp4" : "webm"}`;
    }
    clearMedia();
    if (context && context.state !== "closed") void context.close();
    attempt = null;
    busy = false;
    if (takes.has(STYLES[index].id)) playTake();
    else $("ident").hidden = false;
    update();
  }
}
$("generate").onclick = () => runAttempt(false);
$("upload-test").onclick = () => runAttempt(true);
$("stop").onclick = () => {
  attempt?.cancel();
  feedback("Stopping the attempt and verifying session closure…");
};
$("retry-close").onclick = async () => {
  busy = true;
  update();
  try {
    const result = await api("/api/stop", { attemptId: config.attemptId });
    unknown = result.state === "closure_unknown";
    setStage(unknown ? "closure_unknown" : "closed");
    feedback(
      unknown ? errors.closure_unknown : "Session closure confirmed.",
      unknown,
    );
  } catch {
    feedback(errors.closure_unknown, true);
  } finally {
    busy = false;
    update();
  }
};
window.addEventListener("pagehide", () => {
  if (attempt && config)
    void fetch("/api/stop", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Station-CSRF": config.csrf,
      },
      body: JSON.stringify({ attemptId: attempt.id }),
      keepalive: true,
    }).catch(() => {});
});
tune(0);
void refresh();
