# 🐍 NEON SNAKE

A glowing, animated take on the classic Snake game, built with plain **HTML**, **CSS** and **JavaScript**. There's no framework, no build step and no dependencies. Open the HTML file and play.

![made with](https://img.shields.io/badge/made%20with-HTML%20%7C%20CSS%20%7C%20JS-ff3cac?style=for-the-badge)
![no deps](https://img.shields.io/badge/dependencies-zero-00f5d4?style=for-the-badge)

---

## ✨ Features

| | |
|---|---|
| 🌈 **Rainbow neon snake** | Every segment has its own hue. The colors slowly cycle, and the body narrows toward the tail. |
| 🧈 **Smooth movement** | The snake slides between cells instead of jumping from square to square. |
| 👀 **Expressive head** | Its eyes look where it's going, its tongue flicks out now and then, and the eyes turn to **X_X** when you die. |
| 🔮 **Pulsing orbs** | Each orb glows and has a dashed ring spinning around it. |
| 🟡 **Gold bonus orbs** | Worth **+50**. Each one shows a countdown ring and starts blinking just before it disappears. |
| 💥 **Particles** | Orbs burst into sparks when eaten. When you die, the whole snake explodes one segment at a time. |
| 📳 **Screen shake and flashes** | The screen shakes and flashes when you grab gold or crash. |
| ➕ **Floating "+10" text** | Points float up from where you ate. |
| 🔊 **Synth sound effects** | Generated live with the Web Audio API, so there are no audio files. Press `M` to mute. |
| 🏆 **Saved high score** | Your best score is stored in `localStorage`. |
| 📱 **Mobile support** | Swipe to steer. Tap to start. |
| 🎨 **Animated UI** | Background blobs drift, the title shimmers, the board border spins, the score numbers pop, and "Game Over" glitches. |

---

## 🚀 How to run

1. Download or clone this folder.
2. Double-click **`snake.html`**, or open it in any modern browser.
3. That's it.

> Want live reload while editing? In VS Code, install the **Live Server** extension, right-click `snake.html` and choose **Open with Live Server**.

---

## 🎮 Controls

| Key | Action |
|---|---|
| `↑ ↓ ← →` or `W A S D` | Move |
| `Space` | Start, pause, resume or restart |
| `M` | Turn sound on or off |
| Swipe (phone) | Move |
| Tap (phone) | Start |

**Scoring:** a cyan orb is worth **+10**. A gold orb is worth **+50**, and one appears after every 5 cyan orbs. It lasts 6 seconds. Each orb you eat makes the snake a little faster.

---

## 📁 Project structure

```
snakeGame/
├── snake.html   → the page structure (what's on screen)
├── snake.css    → all the styling and CSS animations
├── snake.js     → the game itself: logic, drawing, input, sound
└── README.md    → you are here
```

---

## 🧱 Part 1: `snake.html` (the skeleton)

The HTML is short. It only lays out the page, and JavaScript does the rest.

| Section | What it does |
|---|---|
| `<div class="bg">` | Holds three empty `<span class="blob">` elements. CSS blurs them heavily and moves them slowly to create the glowing background. |
| `<header class="hud">` | The **NEON SNAKE** title and three score tiles: **Score**, **Best** and **Speed**. Each number has an `id` so JavaScript can update it. |
| `<section class="board-wrap">` | Holds the `<canvas id="board">`, where the whole game is drawn, plus three **overlays**. |
| Overlays | `#startScreen`, `#pauseScreen` and `#overScreen`. All three always exist in the page. JavaScript adds or removes the `show` class to fade one in or out. |
| `<footer class="controls">` | Keyboard hints. The "Swipe to move" hint only appears on touch devices. |
| `<script src="snake.js">` | Loaded at the very end, so every element already exists when the script runs. |

**Why a `<canvas>`?** Drawing hundreds of glowing shapes and particles 60 times per second is far faster on a canvas than with hundreds of `<div>` elements.

---

## 🎨 Part 2: `snake.css` (the looks)

The file is split into numbered sections that match the comments in the code.

### 1. Design tokens
All colors live as CSS variables in `:root` (`--cyan`, `--pink`, `--purple`, `--gold`...). To re-theme the whole game, change them there.

### 2. Background blobs
Each `.blob` is a huge circle with `filter: blur(90px)`, so it turns into a soft cloud of color. The `drift` keyframes move and scale each blob. Each one has a different `animation-delay` and duration, so they never move in sync.

### 3. Layout and entrance
`.app` is a centered flex column. On load it plays the `enter` animation: it fades in and slides up with a slight overshoot. The overshoot comes from `cubic-bezier(0.2, 0.9, 0.3, 1.2)`, where the `1.2` makes it go past its target and settle back.

### 4. HUD
- **Shimmering title:** a 4-color gradient is clipped to the text with `background-clip: text`, then moved sideways forever with the `shimmer` animation.
- **Glass score tiles:** a semi-transparent background plus `backdrop-filter: blur()` gives a frosted-glass look.
- **`.bump`:** whenever a number changes, JavaScript adds this class. The number briefly grows to 1.45× and turns pink.

### 5. Spinning neon border
Here's how the border works:
1. `.board-wrap` has `padding: 3px` and `overflow: hidden`.
2. Its `::before` pseudo-element is a **giant conic gradient** (`inset: -50%`, so it's twice the size) that rotates continuously.
3. The canvas sits on top of it. Only the 3px of padding around the canvas shows the rotating gradient, so you see a moving rainbow border.

The board size comes from `min(92vw, 62vh, 560px)`, which keeps it square and fitting the screen on both phones and desktops.

### 6. Overlays
Hidden overlays use `opacity: 0; visibility: hidden`. Adding `.show` fades them in with a transition. The `.card` inside also scales up from `0.85` with a springy curve. Extra touches:
- `.danger`: the "Game Over" text glitches every 1.6 seconds with a quick skew and offset.
- `.emoji-snake`: the 🐍 wiggles.
- `.new-best`: pulses in gold.

### 7. Button
A gradient pill. On hover the gradient shifts (`background-position`), the button lifts, and its glow gets stronger.

### 8. Footer and accessibility
`kbd` styling makes key names look like keycaps. `@media (hover: none)` reveals the swipe hint only on touch devices. `prefers-reduced-motion` turns off the CSS animations for people who've asked their OS for less motion.

---

## 🧠 Part 3: `snake.js` (the brain)

This file is also split into 8 numbered sections.

### 1. Setup and constants
- Gets the canvas and its 2D drawing context (`ctx`).
- Collects the UI elements into one `ui` object.
- **Tuning knobs** sit at the top: `GRID` (board size), `START_SPEED`, `MIN_SPEED`, `SPEED_STEP`, `BONUS_EVERY` and `BONUS_LIFETIME`. Change these to make the game easier or harder.
- `DIRS` maps each direction to an `{x, y}` vector, for example `up = {x: 0, y: -1}`.
- **`resize()`** sets the canvas resolution to its on-screen size × `devicePixelRatio`. This keeps it sharp on Retina screens. It also works out `cell`, the size of one grid square in pixels.

### 2. Game state
| Variable | Meaning |
|---|---|
| `state` | One of `"menu"`, `"playing"`, `"paused"` or `"over"` |
| `snake` | Array of `{x, y}` cells. Index 0 is the **head**. |
| `prevSnake` | The snake's position one tick ago, used for smooth movement |
| `dir` / `dirQueue` | The current direction, plus key presses waiting to be applied |
| `food`, `bonus` | Orb positions (`bonus` is `null` when no gold orb is on the board) |
| `stepMs` | Milliseconds per move; it shrinks as you eat |
| `particles`, `floaters` | Active effects |
| `shake`, `flash` | Effect strengths that fade back toward 0 |

`loadBest` and `saveBest` wrap `localStorage` in `try/catch`, so the game still works in private mode, where storage can fail.

### 3. Sound effects
`tone()` builds a tiny synthesizer from an **oscillator** (the sound wave) and a **gain node** (the volume). The volume falls off quickly so each sound is a short blip. An optional `slideTo` sweeps the pitch:
- **eat**: a quick rising "bloop"
- **bonus**: three rising square-wave notes, like an arpeggio
- **die**: a sawtooth wave that slides down to a low growl

The `AudioContext` is created on first use. Browsers only allow audio after the player has interacted with the page, and the first sound always follows a key press or tap.

### 4. Game logic
**`step()`** runs once per tick and moves the snake one cell:
1. Takes the next direction from the queue.
2. Works out the new head position.
3. Checks whether the head lands on an orb.
4. **Collision check.** If the snake is *not* growing, its tail moves out of the way this tick, so the head is allowed to move into the cell the tail is leaving. That's why the check uses `snake.slice(0, -1)`.
5. Moves the snake: adds the new head with `unshift`, and removes the tail with `pop` unless the snake is growing.
6. On food: adds score, bursts particles, plays a sound, speeds up, and places a new orb. Every 5th orb also spawns a gold one.

**`randomFreeCell()`** keeps picking random cells until it finds one the snake isn't on.

**`die()`** switches to the game-over state, shakes the screen, and explodes each segment one after another (`setTimeout` with `i * 18`ms). It also updates the high score and shows the Game Over overlay after 0.8 seconds, so you get to watch the explosion first.

### 5. Effects
- **`burst()`** creates particles that fly out in random directions at random speeds.
- **`updateEffects(dt)`** runs every frame. It moves the particles, slows them with friction (`*= 0.94`), fades them out, and removes dead ones. It also fades the floating text, decays `shake` and `flash`, and removes the gold orb when its time runs out.
- Every speed is multiplied by `dt / 16.67`, so effects play at the same speed on 60Hz and 144Hz monitors.

### 6. Rendering
**`draw()`** redraws everything each frame, in this order (later items appear on top):

1. **Shake.** If `shake > 0`, the whole canvas is shifted by a random offset.
2. **`drawGrid`** draws a dot at each grid corner, with a sine wave rippling diagonally across their brightness, plus a dark vignette around the edges.
3. **`drawFood`** draws a radial gradient orb with `shadowBlur` for the glow. It pulses using `Math.sin(time)`, and a dashed ring rotates around it.
4. **`drawBonus`** draws a larger gold orb plus an arc that shrinks as its time runs out. It blinks during the last 30%.
5. **`drawSnake`** draws the snake, using these techniques:
   - **Smooth movement:** `t = accumulator / stepMs` measures how far we are between ticks, from 0 to 1. Each segment is drawn at `lerp(previous, current, t)`, so it slides instead of jumping.
   - The body is drawn as **thick, round-capped lines** between neighboring points, from the tail up to the head. Each piece gets its own hue from `segmentHue()`, which spreads cyan → purple → pink along the body and shifts slowly over time.
   - **Eyes** are placed using the `side` vector, which is the direction turned 90°, so they always sit on either side of the head. The pupils are nudged in the direction of movement.
   - **Tongue:** whenever `sin(time)` passes 0.85, a red line sticks out of the front of the head.
6. **`drawParticles`** uses `globalCompositeOperation = "lighter"`, so overlapping sparks add their light together and glow brighter.
7. **`drawFloaters`** draws the "+10" and "+50" text as it rises and fades.
8. **Flash:** a translucent white layer when you eat, or red when you die.

### 7. Main loop
```js
function loop(now) {
  dt = now - last;              // time since the last frame
  accumulator += dt;
  while (accumulator >= stepMs) // run as many game ticks as needed
    step();
  updateEffects(dt);
  draw();
  requestAnimationFrame(loop);  // repeat on the next screen refresh
}
```
This is the **fixed-timestep** pattern. The **game logic** runs at a steady speed (one move every `stepMs`), no matter how fast the screen refreshes. **Drawing** happens every frame, so the animation stays smooth. `dt` is capped at 100ms, so switching back to a background tab doesn't make the snake jump across the board.

### 8. Input and UI
- **`queueDirection()`** handles two classic Snake bugs:
  1. **Instant self-collision:** pressing ↑ then ← within one tick could turn the snake back into itself. Here every new direction is compared against the *last queued* direction, not the current one, so that can't happen.
  2. **Lost key presses:** quick taps are stored in a queue (up to 3), so fast turns are never dropped.
- **Keyboard:** the `KEYS` table maps arrow keys and WASD to directions. `preventDefault()` stops the arrow keys and space from scrolling the page.
- **Swipe:** the game stores where your finger touched down and compares it with where it lifted. Whichever axis moved more decides the direction. A movement under 20px counts as a tap.
- **`setText()`** updates a number and replays the `.bump` animation. Reading `el.offsetWidth` makes the browser restart the animation; without it, adding the same class again would do nothing.
- **`show(overlay)`** shows one overlay and hides the others. Pass `null` to hide them all.

---

## 🛠️ Customize it

| Want to... | Change |
|---|---|
| Use a bigger or smaller board | `GRID` in `snake.js` |
| Make it easier | Raise `START_SPEED` and `MIN_SPEED`, or lower `SPEED_STEP` |
| Get gold orbs more often | Lower `BONUS_EVERY` |
| Change the snake's colors | The `170` (starting hue) and `150` (hue range) in `segmentHue()` |
| Re-theme the UI | The CSS variables in `:root` |
| Make walls wrap around | In `step()`, replace the wall check with `head.x = (head.x + GRID) % GRID` (and the same for `y`) |

---

## 💡 Ideas for next steps

- Obstacles or maze levels
- A leaderboard
- Power-ups (slow-mo, ghost mode, shrink)
- Background music
- Two-player mode on the same keyboard

---

Made with 💜 and way too much `shadowBlur`.
