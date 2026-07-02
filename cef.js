/* =========================================================================
   DRIVER HUD — Canvas 2D Speedometer CEF Overlay
   Optimized for CPU-only rendering without GPU acceleration.
   All dial rendering uses a single <canvas> with cached static elements.
   ========================================================================= */

// === CONSTANTS ===
const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;

// Needle animation (frame-rate independent lerp)
// Higher decay = more responsive, lower = smoother
const SPEED_DECAY = 7.5;
const RPM_DECAY = 7.5;
const LERP_THRESHOLD = 0.15;   // Degrees — snap to target when close enough

// Canvas base dimensions (logical pixels — all drawing uses these coords)
const BASE_CANVAS_W = 310;
const BASE_CANVAS_H = 180;

// ---------- Speed Dial Geometry (canvas pixels) ----------
// SVG viewBox 300×240 → element 220×180, scale=0.7333, y-offset=2px
const S_CX = 110, S_CY = 112;         // Dial center
const S_MAIN_R = 88;                   // Background circle radius  (120 × 0.7333)
const S_ARC_R = 80.7;                 // Zone arc radius           (110 × 0.7333)
const S_TICK_OUTER = 88;               // Tick outer radius         (120 × 0.7333)
const S_TICK_MAJ = 79.2;             // Tick inner — major        (108 × 0.7333)
const S_TICK_MIN = 80.7;             // Tick inner — minor        (110 × 0.7333)
const S_LABEL_R = 67;               // Number label radius       (~91 × 0.7333)
const S_NEEDLE_LEN = 77;               // Needle length             (105 × 0.7333)
const S_CAP_OUTER = 7.3;              // Cap outer circle radius   (10  × 0.7333)
const S_CAP_INNER = 3.7;              // Cap inner circle radius   (5   × 0.7333)
const S_NEEDLE_W = 2.57;             // Needle stroke width       (3.5 × 0.7333)

// ---------- RPM Dial Geometry (canvas pixels) ----------
// SVG viewBox 200×200 → element 150×150, scale=0.75, positioned at (160, 15) in container
const R_CX = 235, R_CY = 90;          // Dial center
const R_MAIN_R = 60;                   // Background circle radius  (80 × 0.75)
const R_ARC_R = 52.5;                 // Zone arc radius           (70 × 0.75)
const R_TICK_OUTER = 60;               // Tick outer radius         (80 × 0.75)
const R_TICK_INNER = 54;               // Tick inner radius         (72 × 0.75)
const R_LABEL_R = 46;               // Number label radius       (~61 × 0.75)
const R_NEEDLE_LEN = 56;               // Needle length             (75 × 0.75)
const R_CAP_OUTER = 7.5;              // Cap outer circle radius   (10 × 0.75)
const R_CAP_INNER = 3.75;             // Cap inner circle radius   (5  × 0.75)
const R_NEEDLE_W = 2.1;              // Needle stroke width       (2.8 × 0.75)
const R_UNIT_Y = 123.75;           // "RPM" text Y              (15 + 145 × 0.75)
const R_MULT_Y = 132.75;           // "x1000" text Y            (15 + 157 × 0.75)

// === STATE ===
let currentSpeed = 0;       // In m/s
let currentRpm = 0;       // Float 0.0 – 1.0
let currentFuel = 1.0;     // Float 0.0 – 1.0
let currentHealth = 1.0;     // Float 0.0 – 1.0
let currentGear = 0;       // Integer (0=N, −1=R, 1..7)
let currentOdometer = 0;      // In miles
let currentEngine = false;
let currentHeadlights = 0;    // 0=Off, 1=On, 2=High
let leftIndicator = false;
let rightIndicator = false;
let seatbeltFastened = false;

// Animation state
let targetSpeedAngle = -110;
let displaySpeedAngle = -110;
let targetRpmAngle = -110;
let displayRpmAngle = -110;
let animRunning = false;
let lastFrame = 0;
let renderDirty = true;

// === CACHED DOM ELEMENTS ===
const EL = {};

// === CANVAS ===
let mainCanvas, mainCtx;
let bgCanvas, bgCtx;          // Offscreen static buffer

// === BLINK SYSTEM (replaces CSS infinite animation) ===
const blinkTimers = {};

// =========================================================================
//  CANVAS RENDERING — STATIC ELEMENTS (drawn once, cached)
// =========================================================================

/** Convert dial angle (degrees from 12 o'clock, CW positive) to Canvas arc angle */
function d2c(dialDeg) {
    return (dialDeg - 90) * DEG;
}

/** Draw a dial background circle */
function drawDialBg(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.fillStyle = 'rgba(10, 10, 10, 0.65)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
}

/** Draw zone arcs for a dial */
function drawZoneArcs(ctx, cx, cy, arcR, zones, lineWidth) {
    ctx.lineCap = 'round';
    ctx.lineWidth = lineWidth;
    for (let i = 0; i < zones.length; i++) {
        const z = zones[i];
        ctx.beginPath();
        ctx.arc(cx, cy, arcR, d2c(z.start), d2c(z.end), false);
        ctx.strokeStyle = z.color;
        ctx.globalAlpha = z.alpha;
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

/** Draw tick marks for a dial */
function drawTicks(ctx, cx, cy, outerR, innerMaj, innerMin, ticks) {
    for (let i = 0; i < ticks.length; i++) {
        const t = ticks[i];
        const rad = t.angle * DEG;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rad);

        ctx.beginPath();
        ctx.moveTo(0, -outerR);
        ctx.lineTo(0, -(t.major ? innerMaj : innerMin));
        ctx.strokeStyle = t.major ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = t.major ? 1.47 : 0.73;
        ctx.lineCap = 'butt';
        ctx.stroke();

        ctx.restore();
    }
}

/** Draw labels around a dial */
function drawLabels(ctx, cx, cy, labelR, labels, font, defaultColor) {
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < labels.length; i++) {
        const l = labels[i];
        const rad = l.angle * DEG;
        const lx = cx + labelR * Math.sin(rad);
        const ly = cy - labelR * Math.cos(rad);
        ctx.fillStyle = l.color || defaultColor;
        ctx.fillText(l.text, lx, ly);
    }
}

/** Build static offscreen buffer (called once after fonts load) */
function drawStaticBuffer() {
    const ctx = bgCtx;
    ctx.clearRect(0, 0, BASE_CANVAS_W, BASE_CANVAS_H);

    // ---- Speed Dial ----
    drawDialBg(ctx, S_CX, S_CY, S_MAIN_R);

    // Zone arcs (green / yellow / red)
    drawZoneArcs(ctx, S_CX, S_CY, S_ARC_R, [
        { start: -110, end: 10, color: '#2ecc71', alpha: 0.6 },  // 0–109 MPH
        { start: 10, end: 50, color: '#f1c40f', alpha: 0.6 },  // 109–145 MPH
        { start: 50, end: 110, color: '#e74c3c', alpha: 0.8 },  // 145–200 MPH
    ], 2.93);

    // Ticks (every 20 MPH, major at 0/40/80/120/160/200)
    const speedTicks = [];
    for (let mph = 0; mph <= 200; mph += 20) {
        speedTicks.push({
            angle: mph * 1.1 - 110,
            major: mph % 40 === 0
        });
    }
    drawTicks(ctx, S_CX, S_CY, S_TICK_OUTER, S_TICK_MAJ, S_TICK_MIN, speedTicks);

    // Number labels
    const speedLabels = [];
    for (let mph = 0; mph <= 200; mph += 20) {
        speedLabels.push({ angle: mph * 1.1 - 110, text: '' + mph });
    }
    drawLabels(ctx, S_CX, S_CY, S_LABEL_R, speedLabels, 'bold 7px Formula1, sans-serif', 'rgba(255,255,255,0.5)');

    // ---- RPM Dial ----
    drawDialBg(ctx, R_CX, R_CY, R_MAIN_R);

    // Redline zone arc (RPM 9–11, dial angles 70°–110°)
    drawZoneArcs(ctx, R_CX, R_CY, R_ARC_R, [
        { start: 70, end: 110, color: '#e74c3c', alpha: 0.8 },
    ], 2.25);

    // Ticks (0–11, every 1 unit = 20° step)
    const rpmTicks = [];
    for (let v = 0; v <= 11; v++) {
        rpmTicks.push({ angle: v * 20 - 110, major: true });
    }
    drawTicks(ctx, R_CX, R_CY, R_TICK_OUTER, R_TICK_INNER, R_TICK_INNER, rpmTicks);

    // Number labels (0–11, redline colour for 7+)
    const rpmLabels = [];
    for (let v = 0; v <= 11; v++) {
        rpmLabels.push({
            angle: v * 20 - 110,
            text: '' + v,
            color: v >= 7 ? '#ff4757' : undefined
        });
    }
    drawLabels(ctx, R_CX, R_CY, R_LABEL_R, rpmLabels, 'bold 7px Formula1, sans-serif', 'rgba(255,255,255,0.5)');

    // RPM unit text
    ctx.font = 'bold 7.5px Formula1, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RPM', R_CX, R_UNIT_Y);

    ctx.font = '5px Formula1, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('x1000', R_CX, R_MULT_Y);
}

// =========================================================================
//  CANVAS RENDERING — DYNAMIC ELEMENTS (per frame)
// =========================================================================

/** Draw a single needle with cap circles */
function drawNeedle(ctx, cx, cy, angleDeg, len, strokeW, capOuter, capInner) {
    const rad = angleDeg * DEG;

    // Needle line
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rad);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -len);
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = strokeW;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    // Outer cap
    ctx.beginPath();
    ctx.arc(cx, cy, capOuter, 0, TWO_PI);
    ctx.fillStyle = '#1e1e1e';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.75;
    ctx.stroke();

    // Inner cap
    ctx.beginPath();
    ctx.arc(cx, cy, capInner, 0, TWO_PI);
    ctx.fillStyle = '#ff4757';
    ctx.fill();
}

/** Render one frame to the main canvas */
function renderFrame() {
    if (!renderDirty || !bgCanvas) return;
    renderDirty = false;

    mainCtx.clearRect(0, 0, BASE_CANVAS_W, BASE_CANVAS_H);

    // 1. Blit cached static background (instant — single drawImage call)
    mainCtx.drawImage(bgCanvas, 0, 0, BASE_CANVAS_W, BASE_CANVAS_H);

    // 2. Draw speed needle
    drawNeedle(mainCtx, S_CX, S_CY, displaySpeedAngle, S_NEEDLE_LEN, S_NEEDLE_W, S_CAP_OUTER, S_CAP_INNER);

    // 3. Draw RPM needle
    drawNeedle(mainCtx, R_CX, R_CY, displayRpmAngle, R_NEEDLE_LEN, R_NEEDLE_W, R_CAP_OUTER, R_CAP_INNER);
}

// =========================================================================
//  ANIMATION LOOP (frame-rate independent, auto-stop when settled)
// =========================================================================

function animateNeedles(timestamp) {
    const now = timestamp || performance.now();
    // Cap dt at 100ms to prevent teleportation during lag
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;

    let needsUpdate = false;

    // Padé approximation: k*dt / (1 + k*dt) ≈ 1 − e^(−k·dt)  — 10× faster than Math.exp()
    const sFactor = SPEED_DECAY * dt / (1 + SPEED_DECAY * dt);
    const sDelta = targetSpeedAngle - displaySpeedAngle;
    if (Math.abs(sDelta) > LERP_THRESHOLD) {
        displaySpeedAngle += sDelta * sFactor;
        needsUpdate = true;
    } else if (displaySpeedAngle !== targetSpeedAngle) {
        displaySpeedAngle = targetSpeedAngle;
        needsUpdate = true;
    }

    const rFactor = RPM_DECAY * dt / (1 + RPM_DECAY * dt);
    const rDelta = targetRpmAngle - displayRpmAngle;
    if (Math.abs(rDelta) > LERP_THRESHOLD) {
        displayRpmAngle += rDelta * rFactor;
        needsUpdate = true;
    } else if (displayRpmAngle !== targetRpmAngle) {
        displayRpmAngle = targetRpmAngle;
        needsUpdate = true;
    }

    if (needsUpdate) {
        renderDirty = true;
        renderFrame();
        requestAnimationFrame(animateNeedles);
    } else {
        // Both needles settled — stop loop to save CPU
        animRunning = false;
    }
}

/** Kick the animation loop if not already running */
function startAnimation() {
    if (!animRunning) {
        animRunning = true;
        lastFrame = performance.now();
        requestAnimationFrame(animateNeedles);
    }
}

// =========================================================================
//  BLINK SYSTEM (JS-driven, replaces CSS infinite animation)
// =========================================================================

function startBlink(el, intervalMs) {
    const id = el.id;
    if (blinkTimers[id]) return;
    let visible = true;
    blinkTimers[id] = setInterval(function () {
        visible = !visible;
        el.style.opacity = visible ? '1' : '0.2';
    }, intervalMs);
}

function stopBlink(el) {
    const id = el.id;
    if (blinkTimers[id]) {
        clearInterval(blinkTimers[id]);
        delete blinkTimers[id];
        el.style.opacity = '';
    }
}

// =========================================================================
//  PUBLIC API FUNCTIONS (invoked by RageMP Client CEF Execute)
// =========================================================================

/**
 * Toggle engine state
 * @param {boolean} state
 */
function setEngine(state) {
    currentEngine = state;
    if (EL.indicatorEngine) {
        if (state) {
            EL.indicatorEngine.classList.add('on');
        } else {
            EL.indicatorEngine.classList.remove('on');
        }
    }
}

/**
 * Set vehicle speed
 * @param {number} speed — Raw speed in meters per second (m/s)
 */
function setSpeed(speed) {
    currentSpeed = speed;

    // Convert to MPH: 1 m/s = 2.236936 mph
    const mph = Math.round(speed * 2.236936);

    // Digital text update (textContent avoids layout recalc unlike innerText)
    if (EL.speedDisplay) EL.speedDisplay.textContent = mph;

    // Set TARGET angle for lerp animation (0..200 MPH → −110..110 deg)
    const capped = Math.min(Math.max(mph, 0), 200);
    targetSpeedAngle = capped * 1.1 - 110;
    startAnimation();
}

/**
 * Set engine RPM
 * @param {number} rpm — Float 0.0 – 1.0
 */
function setRPM(rpm) {
    currentRpm = rpm;

    // Set TARGET angle (0..11 ×1000 RPM → −110..110 deg)
    const rpmVal = rpm * 11;
    const angle = rpmVal * 20 - 110;
    targetRpmAngle = Math.min(Math.max(angle, -110), 110);
    startAnimation();
}

/**
 * Set fuel capacity
 * @param {number} fuel — Float 0.0 – 1.0
 */
function setFuel(fuel) {
    // 1. Guard Clause: Jika nilai tidak berubah, langsung exit (Hemat CPU)
    if (currentFuel === fuel) return;
    currentFuel = fuel;

    if (EL.fuelFill) {
        // Batasi nilai minimal ke 0.001 untuk menghindari error pembagian dengan nol di CSS calc()
        const safeFuel = Math.max(fuel, 0.001);
        EL.fuelFill.style.setProperty('--value', safeFuel);
    }
    if (EL.fuelText) EL.fuelText.textContent = Math.round(fuel * 100) + '%';
}

/**
 * Set engine health
 * @param {number} health — Float 0.0 – 1.0
 */
function setHealth(health) {
    // 1. Guard Clause: Jika nilai tidak berubah, langsung exit
    if (currentHealth === health) return;
    currentHealth = health;

    if (EL.healthFill) {
        // Batasi nilai minimal ke 0.001 untuk menghindari error pembagian dengan nol di CSS calc()
        const safeHealth = Math.max(health, 0.001);
        EL.healthFill.style.setProperty('--value', safeHealth);
    }
    if (EL.healthText) EL.healthText.textContent = Math.round(health * 100) + '%';
}

/**
 * Set vehicle gear
 * @param {number} gear — 0 = Neutral, −1 = Reverse, 1..7 = forward gears
 */
function setGear(gear) {
    currentGear = gear;
    const display = gear === 0 ? 'N' : (gear === -1 ? 'R' : gear.toString());
    if (EL.gearDisplay) EL.gearDisplay.textContent = display;
}

/**
 * Set headlights state
 * @param {number} state — 0 = Off, 1 = On, 2 = High Beams
 */
function setHeadlights(state) {
    currentHeadlights = state;
    if (EL.indicatorHeadlights) {
        if (state > 0) {
            EL.indicatorHeadlights.classList.add('on');
        } else {
            EL.indicatorHeadlights.classList.remove('on');
        }
    }
}

/**
 * Set left indicator / turn signal
 * @param {boolean} state
 */
function setLeftIndicator(state) {
    leftIndicator = state;
    if (EL.indicatorLeft) {
        if (state) {
            EL.indicatorLeft.classList.add('on');
            startBlink(EL.indicatorLeft, 500);
        } else {
            EL.indicatorLeft.classList.remove('on');
            stopBlink(EL.indicatorLeft);
        }
    }
}

/**
 * Set right indicator / turn signal
 * @param {boolean} state
 */
function setRightIndicator(state) {
    rightIndicator = state;
    if (EL.indicatorRight) {
        if (state) {
            EL.indicatorRight.classList.add('on');
            startBlink(EL.indicatorRight, 500);
        } else {
            EL.indicatorRight.classList.remove('on');
            stopBlink(EL.indicatorRight);
        }
    }
}

/**
 * Set seatbelt fastening warning
 * @param {boolean} state — true = fastened (no warning), false = unfastened (warning blinks)
 */
function setSeatbelts(state) {
    seatbeltFastened = state;
    if (EL.indicatorSeatbelt) {
        if (!state) {
            EL.indicatorSeatbelt.classList.add('on');
            startBlink(EL.indicatorSeatbelt, 600);
        } else {
            EL.indicatorSeatbelt.classList.remove('on');
            stopBlink(EL.indicatorSeatbelt);
        }
    }
}

/**
 * Set vehicle odometer distance
 * @param {number} distance — Distance in miles
 */
function setOdometer(distance) {
    currentOdometer = distance;
    if (EL.odometer) EL.odometer.textContent = distance.toFixed(1) + ' mi';
}

// =========================================================================
//  SETTINGS (Position & Scale Persistence)
// =========================================================================

let dashboardEl = null;
let currentScale = 1.0;

function loadSettings() {
    dashboardEl = document.getElementById('speedometer');
    if (!dashboardEl) return;

    try {
        const settings = JSON.parse(localStorage.getItem('spedo_settings'));
        if (settings) {
            currentScale = typeof settings.scale === 'number' ? settings.scale : 1.0;
            if (typeof settings.left === 'number' && typeof settings.top === 'number') {
                dashboardEl.style.left = settings.left + 'px';
                dashboardEl.style.top = settings.top + 'px';
                dashboardEl.style.bottom = 'auto';
                dashboardEl.style.right = 'auto';
            }
            updateScale();
        }
    } catch (e) {
        console.error('Error loading speedometer settings:', e);
    }
}

function saveSettings() {
    if (!dashboardEl) return;
    const style = window.getComputedStyle(dashboardEl);
    const settings = {
        scale: currentScale,
        left: parseFloat(style.left) || dashboardEl.offsetLeft,
        top: parseFloat(style.top) || dashboardEl.offsetTop
    };
    localStorage.setItem('spedo_settings', JSON.stringify(settings));
}

function updateScale() {
    if (!dashboardEl) return;
    dashboardEl.style.transform = 'scale(' + currentScale + ')';
    dashboardEl.style.transformOrigin = 'center center';
    resizeCanvasForScale();
}

function resetSettings() {
    currentScale = 1.0;
    if (dashboardEl) {
        dashboardEl.style.left = '';
        dashboardEl.style.top = '';
        dashboardEl.style.bottom = '15px';
        dashboardEl.style.right = '15px';
        dashboardEl.style.transform = 'scale(1)';
        dashboardEl.style.transformOrigin = '';
    }
    localStorage.removeItem('spedo_settings');
    resizeCanvasForScale();
}

/**
 * Resize canvas internal resolution to match current scale + devicePixelRatio.
 * Drawing code uses the same logical coordinates (BASE_CANVAS_W × BASE_CANVAS_H)
 * but the canvas has enough actual pixels to stay sharp at any zoom level.
 */
function resizeCanvasForScale() {
    if (!mainCanvas || !bgCanvas) return;
    var dpr = window.devicePixelRatio || 1;
    var totalScale = currentScale * dpr;

    // Resize resets all canvas state (content + transforms)
    mainCanvas.width = Math.round(BASE_CANVAS_W * totalScale);
    mainCanvas.height = Math.round(BASE_CANVAS_H * totalScale);
    mainCanvas.style.width = BASE_CANVAS_W + 'px';
    mainCanvas.style.height = BASE_CANVAS_H + 'px';

    bgCanvas.width = Math.round(BASE_CANVAS_W * totalScale);
    bgCanvas.height = Math.round(BASE_CANVAS_H * totalScale);

    // Re-apply scale (was reset by resize)
    mainCtx.scale(totalScale, totalScale);
    bgCtx.scale(totalScale, totalScale);

    // Redraw at new resolution
    drawStaticBuffer();
    renderDirty = true;
    renderFrame();
}

// =========================================================================
//  DRAGGING SYSTEM (rAF-throttled)
// =========================================================================

function setupDragging() {
    const dashboard = document.getElementById('speedometer');
    if (!dashboard) return;

    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let initialX = 0, initialY = 0;
    let lastDragX = 0, lastDragY = 0;
    let dragRAF = null;

    dashboard.addEventListener('pointerdown', function (e) {
        // Exclude interactive buttons and control bar containers from starting drag
        if (e.target.closest('.no-drag') || e.target.closest('button')) return;
        isDragging = true;

        // offsetLeft/offsetTop are unaffected by CSS transforms (like scale)
        initialX = dashboard.offsetLeft;
        initialY = dashboard.offsetTop;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        dashboard.setPointerCapture(e.pointerId);
        dashboard.style.cursor = 'grabbing';
        e.preventDefault();
    });

    dashboard.addEventListener('pointermove', function (e) {
        if (!isDragging) return;
        lastDragX = e.clientX;
        lastDragY = e.clientY;

        // Throttle DOM updates to 1 per animation frame
        if (dragRAF) return;
        dragRAF = requestAnimationFrame(function () {
            dashboard.style.left = (initialX + (lastDragX - dragStartX)) + 'px';
            dashboard.style.top = (initialY + (lastDragY - dragStartY)) + 'px';
            dashboard.style.bottom = 'auto';
            dashboard.style.right = 'auto';
            dragRAF = null;
        });
    });

    dashboard.addEventListener('pointerup', function (e) {
        if (!isDragging) return;
        isDragging = false;
        dashboard.releasePointerCapture(e.pointerId);
        dashboard.style.cursor = '';
        saveSettings();
    });
}

// =========================================================================
//  HUD CONTROLS (Scale buttons)
// =========================================================================

function setupControls() {
    var btnUp = document.getElementById('btn-scale-up');
    var btnDown = document.getElementById('btn-scale-down');
    var btnReset = document.getElementById('btn-reset');

    if (btnUp) {
        btnUp.addEventListener('click', function (e) {
            e.stopPropagation();
            currentScale = Math.min(currentScale + 0.1, 2.0);
            updateScale();
            saveSettings();
        });
    }

    if (btnDown) {
        btnDown.addEventListener('click', function (e) {
            e.stopPropagation();
            currentScale = Math.max(currentScale - 0.1, 0.5);
            updateScale();
            saveSettings();
        });
    }

    if (btnReset) {
        btnReset.addEventListener('click', function (e) {
            e.stopPropagation();
            resetSettings();
        });
    }
}

// =========================================================================
//  PAGE INITIALIZATION
// =========================================================================

document.addEventListener('DOMContentLoaded', function () {
    // 1. Cache all DOM elements (single lookup, no runtime getElementById)
    EL.speedDisplay = document.getElementById('speed-display');
    EL.speedUnit = document.getElementById('speed-unit');
    EL.gearDisplay = document.getElementById('gear-display');
    EL.odometer = document.getElementById('odometer');
    EL.fuelFill = document.getElementById('fuel-fill');
    EL.fuelText = document.getElementById('fuel-text');
    EL.healthFill = document.getElementById('health-fill');
    EL.healthText = document.getElementById('health-text');
    EL.indicatorLeft = document.getElementById('indicator-left');
    EL.indicatorRight = document.getElementById('indicator-right');
    EL.indicatorHeadlights = document.getElementById('indicator-headlights');
    EL.indicatorSeatbelt = document.getElementById('indicator-seatbelt');
    EL.indicatorEngine = document.getElementById('indicator-engine');

    // 2. Setup Canvas
    mainCanvas = document.getElementById('speedo-canvas');
    mainCtx = mainCanvas.getContext('2d');

    bgCanvas = document.createElement('canvas');
    bgCtx = bgCanvas.getContext('2d');

    // 3. Wait for fonts → resize canvas for current scale → initial render
    document.fonts.ready.then(function () {
        resizeCanvasForScale();

        // Set baseline defaults
        setEngine(false);
        setSpeed(0);
        setRPM(0);
        setFuel(1.0);
        setHealth(1.0);
        setGear(0);
        setHeadlights(0);
        setLeftIndicator(false);
        setRightIndicator(false);
        setSeatbelts(true);
        setOdometer(0);
    });

    // 4. Position & Scale persistence + dragging + controls
    loadSettings();
    setupDragging();
    setupControls();
});
