const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;
const SPEED_DECAY = 7.5;
const RPM_DECAY = 7.5;
const LERP_THRESHOLD = 0.15;
const BASE_CANVAS_W = 310;
const BASE_CANVAS_H = 180;
const S_CX = 110, S_CY = 112;
const S_MAIN_R = 88;
const S_ARC_R = 80.7;
const S_TICK_OUTER = 88;
const S_TICK_MAJ = 79.2;
const S_TICK_MIN = 80.7;
const S_LABEL_R = 67;
const S_NEEDLE_LEN = 77;
const S_CAP_OUTER = 7.3;
const S_CAP_INNER = 3.7;
const S_NEEDLE_W = 2.57;
const R_CX = 235, R_CY = 90;
const R_MAIN_R = 60;
const R_ARC_R = 52.5;
const R_TICK_OUTER = 60;
const R_TICK_INNER = 54;
const R_LABEL_R = 46;
const R_NEEDLE_LEN = 56;
const R_CAP_OUTER = 7.5;
const R_CAP_INNER = 3.75;
const R_NEEDLE_W = 2.1;
const R_UNIT_Y = 123.75;
const R_MULT_Y = 132.75;

let currentSpeed = 0;
let currentRpm = 0;
let currentFuel = 1.0;
let currentHealth = 1.0;
let currentGear = 0;
let currentOdometer = 0;
let currentEngine = false;
let currentHeadlights = 0;
let leftIndicator = false;
let rightIndicator = false;
let seatbeltFastened = false;

let targetSpeedAngle = -110;
let displaySpeedAngle = -110;
let targetRpmAngle = -110;
let displayRpmAngle = -110;
let animRunning = false;
let lastFrame = 0;
let renderDirty = true;

const EL = {};

let mainCanvas, mainCtx;
let bgCanvas, bgCtx;

const blinkTimers = {};

function d2c(dialDeg) {
    return (dialDeg - 90) * DEG;
}

function drawDialBg(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.fillStyle = 'rgba(10, 10, 10, 0.65)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
}

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

function drawStaticBuffer() {
    const ctx = bgCtx;
    ctx.clearRect(0, 0, BASE_CANVAS_W, BASE_CANVAS_H);

    drawDialBg(ctx, S_CX, S_CY, S_MAIN_R);

    drawZoneArcs(ctx, S_CX, S_CY, S_ARC_R, [
        { start: -110, end: 10, color: '#2ecc71', alpha: 0.6 },
        { start: 10, end: 50, color: '#f1c40f', alpha: 0.6 },
        { start: 50, end: 110, color: '#e74c3c', alpha: 0.8 },
    ], 2.93);

    const speedTicks = [];
    for (let mph = 0; mph <= 200; mph += 20) {
        speedTicks.push({
            angle: mph * 1.1 - 110,
            major: mph % 40 === 0
        });
    }
    drawTicks(ctx, S_CX, S_CY, S_TICK_OUTER, S_TICK_MAJ, S_TICK_MIN, speedTicks);

    const speedLabels = [];
    for (let mph = 0; mph <= 200; mph += 20) {
        speedLabels.push({ angle: mph * 1.1 - 110, text: '' + mph });
    }
    drawLabels(ctx, S_CX, S_CY, S_LABEL_R, speedLabels, 'bold 7px Formula1, sans-serif', 'rgba(255,255,255,0.5)');

    drawDialBg(ctx, R_CX, R_CY, R_MAIN_R);

    drawZoneArcs(ctx, R_CX, R_CY, R_ARC_R, [
        { start: 70, end: 110, color: '#e74c3c', alpha: 0.8 },
    ], 2.25);

    const rpmTicks = [];
    for (let v = 0; v <= 11; v++) {
        rpmTicks.push({ angle: v * 20 - 110, major: true });
    }
    drawTicks(ctx, R_CX, R_CY, R_TICK_OUTER, R_TICK_INNER, R_TICK_INNER, rpmTicks);

    const rpmLabels = [];
    for (let v = 0; v <= 11; v++) {
        rpmLabels.push({
            angle: v * 20 - 110,
            text: '' + v,
            color: v >= 7 ? '#ff4757' : undefined
        });
    }
    drawLabels(ctx, R_CX, R_CY, R_LABEL_R, rpmLabels, 'bold 7px Formula1, sans-serif', 'rgba(255,255,255,0.5)');

    ctx.font = 'bold 7.5px Formula1, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RPM', R_CX, R_UNIT_Y);

    ctx.font = '5px Formula1, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('x1000', R_CX, R_MULT_Y);
}

function drawNeedle(ctx, cx, cy, angleDeg, len, strokeW, capOuter, capInner) {
    const rad = angleDeg * DEG;

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

    ctx.beginPath();
    ctx.arc(cx, cy, capOuter, 0, TWO_PI);
    ctx.fillStyle = '#1e1e1e';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.75;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, capInner, 0, TWO_PI);
    ctx.fillStyle = '#ff4757';
    ctx.fill();
}

function renderFrame() {
    if (!renderDirty || !bgCanvas) return;
    renderDirty = false;

    mainCtx.clearRect(0, 0, BASE_CANVAS_W, BASE_CANVAS_H);

    mainCtx.drawImage(bgCanvas, 0, 0, BASE_CANVAS_W, BASE_CANVAS_H);

    drawNeedle(mainCtx, S_CX, S_CY, displaySpeedAngle, S_NEEDLE_LEN, S_NEEDLE_W, S_CAP_OUTER, S_CAP_INNER);

    drawNeedle(mainCtx, R_CX, R_CY, displayRpmAngle, R_NEEDLE_LEN, R_NEEDLE_W, R_CAP_OUTER, R_CAP_INNER);
}

function animateNeedles(timestamp) {
    const now = timestamp || performance.now();

    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;

    let needsUpdate = false;

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

        animRunning = false;
    }
}

function startAnimation() {
    if (!animRunning) {
        animRunning = true;
        lastFrame = performance.now();
        requestAnimationFrame(animateNeedles);
    }
}

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

function setSpeed(speed) {
    currentSpeed = speed;

    const mph = Math.round(speed * 2.236936);

    if (EL.speedDisplay) EL.speedDisplay.textContent = mph;

    const capped = Math.min(Math.max(mph, 0), 200);
    targetSpeedAngle = capped * 1.1 - 110;
    startAnimation();
}

function setRPM(rpm) {
    currentRpm = rpm;

    const rpmVal = rpm * 10;

    const angle = rpmVal * 20 - 110;
    targetRpmAngle = Math.min(Math.max(angle, -110), 110);
    startAnimation();
}
function setFuel(fuel) {

    if (currentFuel === fuel) return;
    currentFuel = fuel;

    if (EL.fuelFill) {

        const safeFuel = Math.max(fuel, 0.001);
        EL.fuelFill.style.setProperty('--value', safeFuel);
    }
    if (EL.fuelText) EL.fuelText.textContent = Math.round(fuel * 100) + '%';
}

function setHealth(health) {

    if (currentHealth === health) return;
    currentHealth = health;

    if (EL.healthFill) {

        const safeHealth = Math.max(health, 0.001);
        EL.healthFill.style.setProperty('--value', safeHealth);
    }
    if (EL.healthText) EL.healthText.textContent = Math.round(health * 100) + '%';
}

function setGear(gear) {
    currentGear = gear;
    const display = gear === 0 ? 'N' : (gear === -1 ? 'R' : gear.toString());
    if (EL.gearDisplay) EL.gearDisplay.textContent = display;
}

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

function setOdometer(distance) {
    currentOdometer = distance;
    if (EL.odometer) EL.odometer.textContent = distance.toFixed(1) + ' mi';
}

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

function resizeCanvasForScale() {
    if (!mainCanvas || !bgCanvas) return;
    var dpr = window.devicePixelRatio || 1;
    var totalScale = currentScale * dpr;

    mainCanvas.width = Math.round(BASE_CANVAS_W * totalScale);
    mainCanvas.height = Math.round(BASE_CANVAS_H * totalScale);
    mainCanvas.style.width = BASE_CANVAS_W + 'px';
    mainCanvas.style.height = BASE_CANVAS_H + 'px';

    bgCanvas.width = Math.round(BASE_CANVAS_W * totalScale);
    bgCanvas.height = Math.round(BASE_CANVAS_H * totalScale);

    mainCtx.scale(totalScale, totalScale);
    bgCtx.scale(totalScale, totalScale);

    drawStaticBuffer();
    renderDirty = true;
    renderFrame();
}

function setupDragging() {
    const dashboard = document.getElementById('speedometer');
    if (!dashboard) return;

    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let initialX = 0, initialY = 0;
    let lastDragX = 0, lastDragY = 0;
    let dragRAF = null;

    dashboard.addEventListener('pointerdown', function (e) {

        if (e.target.closest('.no-drag') || e.target.closest('button')) return;
        isDragging = true;

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

document.addEventListener('DOMContentLoaded', function () {

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

    mainCanvas = document.getElementById('speedo-canvas');
    mainCtx = mainCanvas.getContext('2d');

    bgCanvas = document.createElement('canvas');
    bgCtx = bgCanvas.getContext('2d');

    document.fonts.ready.then(function () {
        resizeCanvasForScale();

        setEngine(false);
        setSpeed(0);
        setRPM(0);
        setFuel(1);
        setHealth(1);
        setGear(0);
        setHeadlights(0);
        setLeftIndicator(false);
        setRightIndicator(false);
        setSeatbelts(0);
        setOdometer(0);
    });

    loadSettings();
    setupDragging();
    setupControls();
});
