/* =========================================================
   NEON SNAKE
   ---------------------------------------------------------
   1. Setup & constants
   2. Game state
   3. Sound effects (Web Audio)
   4. Game logic (step, food, death)
   5. Effects (particles, floating text, shake)
   6. Rendering
   7. Main loop
   8. Input (keyboard, buttons, swipe)
   ========================================================= */

/* ---------- 1. Setup & constants ---------- */
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const $ = (id) => document.getElementById(id);
const ui = {
  score: $("score"),
  best: $("best"),
  level: $("level"),
  finalScore: $("finalScore"),
  newBest: $("newBest"),
  soundState: $("soundState"),
  start: $("startScreen"),
  pause: $("pauseScreen"),
  over: $("overScreen"),
};

const GRID = 20;              // board is GRID x GRID cells
const START_SPEED = 130;      // ms per move at the start
const MIN_SPEED = 60;         // fastest the snake can go
const SPEED_STEP = 3;         // ms faster per orb eaten
const BONUS_EVERY = 5;        // a gold orb shows up every N orbs
const BONUS_LIFETIME = 6000;  // ms before the gold orb disappears

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

let cell = 0; // pixel size of one cell (set in resize)
let dpr = 1;

function resize() {
  const size = canvas.getBoundingClientRect().width;
  dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
  cell = size / GRID;
}
window.addEventListener("resize", resize);
resize();

/* ---------- 2. Game state ---------- */
let state = "menu"; // "menu" | "playing" | "paused" | "over"
let snake, prevSnake, dir, dirQueue, food, bonus, score, eaten, stepMs;
let best = loadBest();
let particles = [];
let floaters = [];
let shake = 0;
let flash = 0;
let accumulator = 0;
let time = 0;

ui.best.textContent = best;

function loadBest() {
  try {
    return Number(localStorage.getItem("neonSnakeBest")) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem("neonSnakeBest", value);
  } catch {}
}

function resetGame() {
  const mid = Math.floor(GRID / 2);
  snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
  prevSnake = snake.map((s) => ({ ...s }));
  dir = DIRS.right;
  dirQueue = [];
  score = 0;
  eaten = 0;
  stepMs = START_SPEED;
  bonus = null;
  particles = [];
  floaters = [];
  accumulator = 0;
  food = randomFreeCell();
  setText(ui.score, 0);
  setText(ui.level, 1);
}

/* ---------- 3. Sound effects ---------- */
let audioCtx = null;
let muted = false;

function tone(freq, duration, type = "sine", volume = 0.08, slideTo = null, delay = 0) {
  if (muted) return;
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + duration);
  } catch {}
}

const sfx = {
  eat: () => tone(520, 0.12, "triangle", 0.1, 1040),
  bonus: () => {
    tone(660, 0.1, "square", 0.05);
    tone(880, 0.1, "square", 0.05, null, 0.08);
    tone(1320, 0.18, "square", 0.05, null, 0.16);
  },
  die: () => tone(300, 0.6, "sawtooth", 0.08, 40),
  start: () => tone(220, 0.25, "triangle", 0.08, 660),
};

/* ---------- 4. Game logic ---------- */
function randomFreeCell() {
  let spot;
  do {
    spot = { x: rand(GRID), y: rand(GRID) };
  } while (
    snake.some((s) => s.x === spot.x && s.y === spot.y) ||
    (food && food.x === spot.x && food.y === spot.y)
  );
  return spot;
}

function rand(n) {
  return Math.floor(Math.random() * n);
}

// One "tick" of the game: move the snake one cell
function step() {
  if (dirQueue.length) dir = dirQueue.shift();

  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  const eatsFood = head.x === food.x && head.y === food.y;
  const eatsBonus = bonus && head.x === bonus.x && head.y === bonus.y;
  const grows = eatsFood || eatsBonus;

  // If we don't grow, the tail moves out of the way this tick
  const body = grows ? snake : snake.slice(0, -1);
  const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
  const hitSelf = body.some((s) => s.x === head.x && s.y === head.y);

  if (hitWall || hitSelf) return die();

  prevSnake = snake.map((s) => ({ ...s }));
  snake.unshift(head);
  if (!grows) snake.pop();

  if (eatsFood) {
    eaten++;
    addScore(10, head, "#00f5d4");
    burst(head, 18, 170);
    sfx.eat();
    stepMs = Math.max(MIN_SPEED, stepMs - SPEED_STEP);
    setText(ui.level, Math.round((START_SPEED - stepMs) / SPEED_STEP) + 1);
    food = randomFreeCell();
    if (eaten % BONUS_EVERY === 0) spawnBonus();
  }

  if (eatsBonus) {
    addScore(50, head, "#ffd166");
    burst(head, 40, 45);
    sfx.bonus();
    shake = 6;
    bonus = null;
  }
}

function spawnBonus() {
  bonus = { ...randomFreeCell(), born: time };
}

function addScore(points, at, color) {
  score += points;
  setText(ui.score, score);
  floaters.push({ x: at.x, y: at.y, text: `+${points}`, color, life: 1 });
  flash = 0.25;
}

function die() {
  state = "over";
  prevSnake = snake.map((s) => ({ ...s }));
  sfx.die();
  shake = 18;
  flash = 0.6;
  // Explode every segment into particles
  snake.forEach((s, i) => setTimeout(() => burst(s, 8, segmentHue(i, snake.length)), i * 18));

  const isBest = score > best;
  if (isBest) {
    best = score;
    saveBest(best);
    setText(ui.best, best);
  }
  ui.finalScore.textContent = score;
  ui.newBest.classList.toggle("show", isBest && score > 0);
  setTimeout(() => show(ui.over), 800);
}

/* ---------- 5. Effects ---------- */
function burst(at, count, hue) {
  const cx = (at.x + 0.5) * cell;
  const cy = (at.y + 0.5) * cell;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      size: 2 + Math.random() * 3,
      hue: hue + Math.random() * 40 - 20,
    });
  }
}

function updateEffects(dt) {
  const f = dt / 16.67; // normalize to 60 fps
  for (const p of particles) {
    p.x += p.vx * f;
    p.y += p.vy * f;
    p.vx *= 0.94;
    p.vy *= 0.94;
    p.life -= 0.022 * f;
  }
  particles = particles.filter((p) => p.life > 0);

  for (const t of floaters) {
    t.y -= 0.03 * f;
    t.life -= 0.02 * f;
  }
  floaters = floaters.filter((t) => t.life > 0);

  shake *= 0.88;
  flash *= 0.9;

  if (bonus && time - bonus.born > BONUS_LIFETIME) {
    burst(bonus, 12, 45);
    bonus = null;
  }
}

/* ---------- 6. Rendering ---------- */
const lerp = (a, b, t) => a + (b - a) * t;
const segmentHue = (i, len) => (170 + (i / Math.max(len - 1, 1)) * 150 + time * 0.02) % 360;

function draw() {
  const size = cell * GRID;
  ctx.save();
  ctx.clearRect(0, 0, size, size);

  if (shake > 0.5) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  drawGrid(size);
  if (snake) {
    drawFood(food, 170, 1);
    if (bonus) drawBonus();
    drawSnake();
  }
  drawParticles();
  drawFloaters();

  // White flash when eating / red-ish flash when dying
  if (flash > 0.01) {
    ctx.fillStyle = state === "over" ? `rgba(255,77,109,${flash * 0.4})` : `rgba(255,255,255,${flash * 0.15})`;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.restore();
}

function drawGrid(size) {
  // Dots at every cell corner, with a slow wave of brightness
  for (let x = 1; x < GRID; x++) {
    for (let y = 1; y < GRID; y++) {
      const wave = Math.sin(time * 0.002 + (x + y) * 0.4) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(140,120,255,${0.06 + wave * 0.1})`;
      ctx.fillRect(x * cell - 1, y * cell - 1, 2, 2);
    }
  }
  // Soft vignette
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

function drawFood(f, hue, scale) {
  const cx = (f.x + 0.5) * cell;
  const cy = (f.y + 0.5) * cell;
  const pulse = 1 + Math.sin(time * 0.008) * 0.12;
  const r = cell * 0.3 * pulse * scale;

  // Glow orb
  ctx.save();
  ctx.shadowBlur = 25;
  ctx.shadowColor = `hsl(${hue},100%,60%)`;
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r);
  g.addColorStop(0, "#fff");
  g.addColorStop(0.4, `hsl(${hue},100%,65%)`);
  g.addColorStop(1, `hsl(${hue},100%,40%)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Spinning dashed ring
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(time * 0.003);
  ctx.strokeStyle = `hsla(${hue},100%,70%,0.6)`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBonus() {
  const age = time - bonus.born;
  const left = 1 - age / BONUS_LIFETIME;
  // Blink faster when about to vanish
  if (left < 0.3 && Math.floor(time / 100) % 2) return;

  drawFood(bonus, 45, 1.25);

  // Countdown ring
  const cx = (bonus.x + 0.5) * cell;
  const cy = (bonus.y + 0.5) * cell;
  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, cell * 0.75, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
  ctx.stroke();
}

function drawSnake() {
  // How far we are between the last tick and the next one (0..1)
  const t = state === "playing" ? Math.min(accumulator / stepMs, 1) : 1;
  const len = snake.length;

  // Smoothly interpolated pixel position of every segment
  const pts = snake.map((s, i) => {
    const from = prevSnake[Math.min(i, prevSnake.length - 1)];
    return {
      x: (lerp(from.x, s.x, t) + 0.5) * cell,
      y: (lerp(from.y, s.y, t) + 0.5) * cell,
    };
  });

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Body: draw from tail to head so the head ends up on top
  for (let i = len - 1; i > 0; i--) {
    const hue = segmentHue(i, len);
    const width = cell * (0.5 + 0.3 * (1 - i / len)); // tapers to the tail
    ctx.strokeStyle = `hsl(${hue},100%,60%)`;
    ctx.shadowColor = `hsl(${hue},100%,60%)`;
    ctx.shadowBlur = 14;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pts[i].x, pts[i].y);
    ctx.lineTo(pts[i - 1].x, pts[i - 1].y);
    ctx.stroke();
  }

  // Head
  const head = pts[0];
  const hue = segmentHue(0, len);
  ctx.fillStyle = `hsl(${hue},100%,62%)`;
  ctx.shadowColor = `hsl(${hue},100%,60%)`;
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(head.x, head.y, cell * 0.46, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Tongue flicks out every so often
  if (state === "playing" && Math.sin(time * 0.006) > 0.85) {
    const tx = head.x + dir.x * cell * 0.5;
    const ty = head.y + dir.y * cell * 0.5;
    ctx.strokeStyle = "#ff4d6d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + dir.x * cell * 0.3, ty + dir.y * cell * 0.3);
    ctx.stroke();
  }

  // Eyes: placed sideways relative to the direction, pupils look forward
  const side = { x: -dir.y, y: dir.x };
  const dead = state === "over";
  for (const s of [-1, 1]) {
    const ex = head.x + dir.x * cell * 0.12 + side.x * s * cell * 0.2;
    const ey = head.y + dir.y * cell * 0.12 + side.y * s * cell * 0.2;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(ex, ey, cell * 0.13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0b0a1a";
    if (dead) {
      // X_X eyes
      ctx.strokeStyle = "#0b0a1a";
      ctx.lineWidth = 2;
      const k = cell * 0.07;
      ctx.beginPath();
      ctx.moveTo(ex - k, ey - k); ctx.lineTo(ex + k, ey + k);
      ctx.moveTo(ex + k, ey - k); ctx.lineTo(ex - k, ey + k);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(ex + dir.x * cell * 0.05, ey + dir.y * cell * 0.05, cell * 0.065, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter"; // overlapping particles glow brighter
  for (const p of particles) {
    ctx.fillStyle = `hsla(${p.hue},100%,60%,${p.life})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFloaters() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = `700 ${cell * 0.7}px Orbitron, sans-serif`;
  for (const t of floaters) {
    ctx.globalAlpha = Math.max(t.life, 0);
    ctx.fillStyle = t.color;
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 12;
    ctx.fillText(t.text, (t.x + 0.5) * cell, (t.y + 0.2) * cell);
  }
  ctx.restore();
}

/* ---------- 7. Main loop ---------- */
let last = performance.now();

function loop(now) {
  const dt = Math.min(now - last, 100); // clamp so a background tab doesn't teleport the snake
  last = now;
  time += dt;

  if (state === "playing") {
    accumulator += dt;
    while (accumulator >= stepMs && state === "playing") {
      accumulator -= stepMs;
      step();
    }
  }

  updateEffects(dt);
  draw();
  requestAnimationFrame(loop);
}

/* ---------- 8. Input & UI ---------- */
function setText(el, value) {
  el.textContent = value;
  el.classList.remove("bump");
  void el.offsetWidth; // restart the CSS animation
  el.classList.add("bump");
}

function show(overlay) {
  [ui.start, ui.pause, ui.over].forEach((o) => o.classList.toggle("show", o === overlay));
}

function startGame() {
  resetGame();
  show(null);
  sfx.start();
  state = "playing";
}

function togglePause() {
  if (state === "playing") {
    state = "paused";
    show(ui.pause);
  } else if (state === "paused") {
    state = "playing";
    show(null);
  }
}

function queueDirection(next) {
  // Compare against the last *queued* direction so fast double-taps work
  const lastDir = dirQueue.length ? dirQueue[dirQueue.length - 1] : dir;
  const reverses = next.x === -lastDir.x && next.y === -lastDir.y;
  const same = next.x === lastDir.x && next.y === lastDir.y;
  if (!reverses && !same && dirQueue.length < 3) dirQueue.push(next);
}

const KEYS = {
  ArrowUp: "up", w: "up", W: "up",
  ArrowDown: "down", s: "down", S: "down",
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
};

document.addEventListener("keydown", (e) => {
  if (KEYS[e.key]) {
    e.preventDefault();
    if (state === "playing") queueDirection(DIRS[KEYS[e.key]]);
    return;
  }
  if (e.key === " ") {
    e.preventDefault();
    if (state === "menu" || state === "over") startGame();
    else togglePause();
  }
  if (e.key === "m" || e.key === "M") {
    muted = !muted;
    ui.soundState.textContent = muted ? "off" : "on";
  }
});

$("startBtn").addEventListener("click", startGame);
$("restartBtn").addEventListener("click", startGame);
$("resumeBtn").addEventListener("click", togglePause);

// Swipe controls for phones
let touchStart = null;
const wrap = $("boardWrap");

wrap.addEventListener("touchstart", (e) => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });

wrap.addEventListener("touchend", (e) => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) {
    // A tap, not a swipe
    if (state === "menu") startGame();
    return;
  }
  if (state !== "playing") return;
  if (Math.abs(dx) > Math.abs(dy)) queueDirection(dx > 0 ? DIRS.right : DIRS.left);
  else queueDirection(dy > 0 ? DIRS.down : DIRS.up);
});

requestAnimationFrame(loop);
