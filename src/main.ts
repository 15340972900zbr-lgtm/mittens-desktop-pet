import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./style.css";

const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const LOOK_STEP = 22.5;
const isTauri = "__TAURI_INTERNALS__" in window;

type StandardState =
  | "idle"
  | "running-right"
  | "running-left"
  | "waving"
  | "jumping"
  | "failed"
  | "waiting"
  | "running"
  | "review";

interface AnimationDefinition {
  row: number;
  frames: number;
  frameDuration: number;
  loop: boolean;
}

const animations: Record<StandardState, AnimationDefinition> = {
  idle: { row: 0, frames: 6, frameDuration: 520, loop: true },
  "running-right": { row: 1, frames: 8, frameDuration: 92, loop: true },
  "running-left": { row: 2, frames: 8, frameDuration: 92, loop: true },
  waving: { row: 3, frames: 4, frameDuration: 180, loop: false },
  jumping: { row: 4, frames: 5, frameDuration: 130, loop: false },
  failed: { row: 5, frames: 8, frameDuration: 170, loop: false },
  waiting: { row: 6, frames: 6, frameDuration: 260, loop: true },
  running: { row: 7, frames: 6, frameDuration: 150, loop: true },
  review: { row: 8, frames: 6, frameDuration: 230, loop: true },
};

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required element not found: ${selector}`);
  return element;
}

function canvasContext(element: HTMLCanvasElement): CanvasRenderingContext2D {
  const value = element.getContext("2d", { alpha: true });
  if (!value) throw new Error("Canvas 2D is unavailable.");
  return value;
}

const canvas = requiredElement<HTMLCanvasElement>("#pet");
const loading = requiredElement<HTMLDivElement>("#loading");
const speech = requiredElement<HTMLDivElement>("#speech");

canvas.tabIndex = 0;
const context = canvasContext(canvas);

const atlas = new Image();
atlas.decoding = "async";
atlas.src = "/mittens-spritesheet.webp";

let state: StandardState = "idle";
let frame = 0;
let lastFrameAt = performance.now();
let temporaryStateEndsAt = 0;
let lookDirection: number | null = null;
let speechTimer: number | undefined;
let idleActionTimer: number | undefined;

interface PointerOrigin {
  id: number;
  x: number;
  y: number;
  dragging: boolean;
}

let pointerOrigin: PointerOrigin | null = null;

function drawCell(row: number, column: number): void {
  context.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
  context.drawImage(
    atlas,
    column * CELL_WIDTH,
    row * CELL_HEIGHT,
    CELL_WIDTH,
    CELL_HEIGHT,
    0,
    0,
    CELL_WIDTH,
    CELL_HEIGHT,
  );
}

function lookCell(degrees: number): { row: number; column: number } {
  const normalized = (degrees + 360) % 360;
  const index = Math.round(normalized / LOOK_STEP) % 16;
  return index < 8
    ? { row: 9, column: index }
    : { row: 10, column: index - 8 };
}

function animate(now: number): void {
  if (lookDirection !== null) {
    const cell = lookCell(lookDirection);
    drawCell(cell.row, cell.column);
    requestAnimationFrame(animate);
    return;
  }

  const definition = animations[state];
  if (now - lastFrameAt >= definition.frameDuration) {
    lastFrameAt = now;
    frame += 1;

    if (frame >= definition.frames) {
      if (definition.loop && now < temporaryStateEndsAt) {
        frame = 0;
      } else if (definition.loop && temporaryStateEndsAt === 0) {
        frame = 0;
      } else {
        setState("idle");
      }
    }
  }

  drawCell(animations[state].row, Math.min(frame, animations[state].frames - 1));
  requestAnimationFrame(animate);
}

function setState(next: StandardState, duration = 0): void {
  state = next;
  frame = 0;
  lastFrameAt = performance.now();
  temporaryStateEndsAt = duration > 0 ? performance.now() + duration : 0;
}

function say(message: string): void {
  window.clearTimeout(speechTimer);
  speech.textContent = message;
  speech.classList.add("visible");
  speechTimer = window.setTimeout(() => speech.classList.remove("visible"), 1900);
}

function playNamedState(requested: string): void {
  if (!(requested in animations)) return;
  const next = requested as StandardState;
  const duration = ["idle", "waiting", "running", "review"].includes(next)
    ? 4200
    : animations[next].frames * animations[next].frameDuration;
  lookDirection = null;
  setState(next, duration);

  const messages: Partial<Record<StandardState, string>> = {
    waving: "你好呀！",
    jumping: "喵！",
    failed: "再试一次吧…",
    waiting: "我在等你～",
    running: "正在努力工作！",
    review: "让我仔细看看。",
  };
  const message = messages[next];
  if (message) say(message);
}

function scheduleIdleAction(): void {
  window.clearTimeout(idleActionTimer);
  idleActionTimer = window.setTimeout(() => {
    if (state === "idle" && lookDirection === null && pointerOrigin === null) {
      const choices: StandardState[] = ["waving", "jumping", "review"];
      playNamedState(choices[Math.floor(Math.random() * choices.length)]);
    }
    scheduleIdleAction();
  }, 14_000 + Math.random() * 18_000);
}

function updateLook(event: PointerEvent): void {
  if (pointerOrigin) return;
  const rect = canvas.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height * 0.42;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const distance = Math.hypot(dx, dy);

  if (distance < Math.min(rect.width, rect.height) * 0.12) {
    lookDirection = null;
    return;
  }

  lookDirection = (Math.atan2(dx, -dy) * 180) / Math.PI;
}

canvas.addEventListener("pointerenter", updateLook);
canvas.addEventListener("pointermove", async (event) => {
  if (!pointerOrigin) {
    updateLook(event);
    return;
  }

  const distance = Math.hypot(event.clientX - pointerOrigin.x, event.clientY - pointerOrigin.y);
  if (!pointerOrigin.dragging && distance > 5) {
    pointerOrigin.dragging = true;
    document.body.classList.add("dragging");
    try {
      if (isTauri) await getCurrentWindow().startDragging();
    } finally {
      document.body.classList.remove("dragging");
    }
  }
});

canvas.addEventListener("pointerleave", () => {
  if (!pointerOrigin) lookDirection = null;
});

canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  lookDirection = null;
  pointerOrigin = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointerup", (event) => {
  if (!pointerOrigin || event.pointerId !== pointerOrigin.id) return;
  const wasDragging = pointerOrigin.dragging;
  pointerOrigin = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (!wasDragging) playNamedState("waving");
});

canvas.addEventListener("pointercancel", () => {
  pointerOrigin = null;
  document.body.classList.remove("dragging");
});

canvas.addEventListener("dblclick", () => playNamedState("jumping"));
canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  playNamedState("review");
});

canvas.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    playNamedState("waving");
  }
});

if (isTauri) {
  void listen<string>("pet://play", (event) => playNamedState(event.payload));
  void listen("pet://hello", () => {
    playNamedState("waving");
    say("Mittens 来啦！");
  });
}

atlas.addEventListener("load", () => {
  loading.classList.add("hidden");
  drawCell(0, 0);
  requestAnimationFrame(animate);
  scheduleIdleAction();
});

atlas.addEventListener("error", () => {
  loading.textContent = "图集加载失败";
  loading.classList.remove("hidden");
});
