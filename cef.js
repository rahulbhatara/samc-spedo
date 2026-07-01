/* =========================================================================
   DRIVER HUD — Clean Speedometer CEF JS API
   Only contains telemetry-handling APIs. All simulator logic was removed.
   ========================================================================= */

// === STATE ===
let currentEngine = false;
let currentSpeed = 0;       // In m/s
let currentRpm = 0;         // Float 0.0 - 1.0
let currentFuel = 1.0;      // Float 0.0 - 1.0
let currentHealth = 1.0;    // Float 0.0 - 1.0
let currentGear = 0;        // Integer (0=N, -1=R, 1..7)
let currentOdometer = 0;    // In miles
let driverInPit = false;    // Pit mode status for speed warning

// Headlights: 0 = Off, 1 = On, 2 = High
let currentHeadlights = 0;
let leftIndicator = false;
let rightIndicator = false;
let seatbeltFastened = false;

// Race Telemetry State
let currentLapTime = 0.0;   // Realtime lap seconds
let lastLapTime = 0.0;      // Seconds
let bestLapTime = null;     // Seconds
let currentLap = 1;
let totalLaps = 10;
let currentPosition = 3;
let timeDiff = 1250;        // In milliseconds

// === SMOOTH NEEDLE ANIMATION (Lerp System - Frame-rate Independent) ===
// Target angles set by setSpeed/setRPM, lerp loop animates toward them.
// FINE-TUNING VALUE:
// Higher decay rate = needle reacts faster and more responsively (e.g., 12.0 - 15.0).
// Lower decay rate = needle moves slower and is more smoothed (e.g., 3.0 - 5.0).
const SPEED_NEEDLE_DECAY = 7.5;    // Responsiveness of the speedometer needle
const RPM_NEEDLE_DECAY = 7.5;      // Responsiveness of the RPM needle
const LERP_THRESHOLD = 0.15;       // Stop threshold in degrees (close enough = settled)

let targetSpeedAngle = -110;    // Target angle for speed needle
let displaySpeedAngle = -110;   // Currently displayed angle (lerped)
let targetRpmAngle = -110;      // Target angle for RPM needle
let displayRpmAngle = -110;     // Currently displayed angle (lerped)
let animationRunning = false;   // Auto-stop when settled
let lastFrameTime = 0;          // Track last frame timestamp
let speedNeedleEl = null;
let rpmNeedleEl = null;

function animateNeedles(timestamp) {
    const now = timestamp || performance.now();
    // Calculate delta time (dt) in seconds, cap at 0.1s (100ms) to prevent teleportation during lag
    const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
    lastFrameTime = now;

    let needsUpdate = false;

    // Frame-rate independent lerp: value += delta * (1 - e^(-decay * dt))
    const speedDecayFactor = 1 - Math.exp(-SPEED_NEEDLE_DECAY * dt);
    const speedDelta = targetSpeedAngle - displaySpeedAngle;
    if (Math.abs(speedDelta) > LERP_THRESHOLD) {
        displaySpeedAngle += speedDelta * speedDecayFactor;
        needsUpdate = true;
    } else if (displaySpeedAngle !== targetSpeedAngle) {
        displaySpeedAngle = targetSpeedAngle; // Snap to exact target
        needsUpdate = true;
    }

    // RPM needle lerp
    const rpmDecayFactor = 1 - Math.exp(-RPM_NEEDLE_DECAY * dt);
    const rpmDelta = targetRpmAngle - displayRpmAngle;
    if (Math.abs(rpmDelta) > LERP_THRESHOLD) {
        displayRpmAngle += rpmDelta * rpmDecayFactor;
        needsUpdate = true;
    } else if (displayRpmAngle !== targetRpmAngle) {
        displayRpmAngle = targetRpmAngle; // Snap to exact target
        needsUpdate = true;
    }

    // Apply transforms only when values changed
    if (needsUpdate) {
        if (!speedNeedleEl) speedNeedleEl = document.getElementById('speedo-needle');
        if (speedNeedleEl) speedNeedleEl.style.transform = `rotate(${displaySpeedAngle}deg)`;

        if (!rpmNeedleEl) rpmNeedleEl = document.getElementById('rpm-needle');
        if (rpmNeedleEl) rpmNeedleEl.style.transform = `rotate(${displayRpmAngle}deg)`;

        requestAnimationFrame(animateNeedles);
    } else {
        // Both needles settled — stop loop to save CPU
        animationRunning = false;
    }
}

/** Kick the animation loop if not already running */
function startAnimation() {
    if (!animationRunning) {
        animationRunning = true;
        lastFrameTime = performance.now();
        requestAnimationFrame(animateNeedles);
    }
}

// === GLOBAL CEF API FUNCTIONS (Invoked by RageMP Client CEF Execute) ===

/**
 * Toggle engine state
 * @param {boolean} state 
 */
function setEngine(state) {
    currentEngine = state;
    // Toggle engine SVG indicator icon (green = on, red/default = off)
    const icon = document.getElementById('indicator-engine');
    if (icon) {
        if (state) {
            icon.classList.add('on');
        } else {
            icon.classList.remove('on');
        }
    }
}

/**
 * Set vehicle speed
 * @param {number} speed - Raw speed value (typically meters per second, m/s)
 */
function setSpeed(speed) {
    currentSpeed = speed;

    // Convert to MPH (integer): 1 m/s = 2.236936 mph
    const val = Math.round(speed * 2.236936);

    // 1. Digital Text Update
    const speedEl = document.getElementById('speed-display');
    if (speedEl) {
        speedEl.innerText = val;
    }

    // 2. Set TARGET angle for lerp animation (0..200 MPH → -110..110 deg)
    const cappedVal = Math.min(Math.max(val, 0), 200);
    targetSpeedAngle = cappedVal * 1.1 - 110;
    startAnimation();

    // 3. Pit Speed Limit Warning (20 MPH limit = ~8.94 m/s; game has tolerance to 21 MPH = 9.39 m/s)
    const warningEl = document.getElementById('pit-speed-warning');
    if (warningEl) {
        if (driverInPit && speed > 9.39) {
            warningEl.style.display = 'block';
        } else {
            warningEl.style.display = 'none';
        }
    }
}

/**
 * Set engine RPM
 * @param {number} rpm - Float value between 0.0 and 1.0
 */
function setRPM(rpm) {
    currentRpm = rpm;

    // 1. Set TARGET angle for lerp animation (0..11 x1000 RPM → -110..110 deg)
    const rpmVal = rpm * 11;
    const angle = rpmVal * 20 - 110;
    targetRpmAngle = Math.min(Math.max(angle, -110), 110);
    startAnimation();
}

/**
 * Set Fuel capacity
 * @param {number} fuel - Float value between 0.0 and 1.0
 */
function setFuel(fuel) {
    currentFuel = fuel;
    const fillEl = document.getElementById('fuel-fill');
    const textEl = document.getElementById('fuel-text');

    if (fillEl) fillEl.style.width = `${fuel * 100}%`;
    if (textEl) textEl.innerText = `${Math.round(fuel * 100)}%`;
}

/**
 * Set Engine Health
 * @param {number} health - Float value between 0.0 and 1.0
 */
function setHealth(health) {
    currentHealth = health;
    const fillEl = document.getElementById('health-fill');
    const textEl = document.getElementById('health-text');

    if (fillEl) fillEl.style.width = `${health * 100}%`;
    if (textEl) textEl.innerText = `${Math.round(health * 100)}%`;
}

/**
 * Set vehicle gear
 * @param {number} gear - Integer (0 = Neutral, -1 = Reverse, 1..7 = forward gears)
 */
function setGear(gear) {
    currentGear = gear;
    const display = gear === 0 ? 'N' : (gear === -1 ? 'R' : gear.toString());
    const el = document.getElementById('gear-display');
    if (el) el.innerText = display;
}

/**
 * Set Headlights state
 * @param {number} state - 0 = Off, 1 = On, 2 = High Beams
 */
function setHeadlights(state) {
    currentHeadlights = state;

    // Toggle SVG indicator icon glow
    const icon = document.getElementById('indicator-headlights');
    if (icon) {
        if (state > 0) {
            icon.classList.add('on');
        } else {
            icon.classList.remove('on');
        }
    }
}

/**
 * Set left indicator/turn signal
 * @param {boolean} state 
 */
function setLeftIndicator(state) {
    leftIndicator = state;
    const el = document.getElementById('indicator-left');
    if (el) {
        if (state) {
            el.classList.add('on');
        } else {
            el.classList.remove('on');
        }
    }
}

/**
 * Set right indicator/turn signal
 * @param {boolean} state 
 */
function setRightIndicator(state) {
    rightIndicator = state;
    const el = document.getElementById('indicator-right');
    if (el) {
        if (state) {
            el.classList.add('on');
        } else {
            el.classList.remove('on');
        }
    }
}

/**
 * Set seatbelt fastening warning state
 * @param {boolean} state - True if seatbelt is fastened (warning goes OFF)
 */
function setSeatbelts(state) {
    seatbeltFastened = state;

    // Toggle warning icon (Seatbelt unfastened [false] triggers warning ON)
    const icon = document.getElementById('indicator-seatbelt');
    if (icon) {
        if (!state) {
            icon.classList.add('on');
        } else {
            icon.classList.remove('on');
        }
    }
}

/**
 * Set vehicle odometer distance
 * @param {number} distance - Distance in miles
 */
function setOdometer(distance) {
    currentOdometer = distance;
    const el = document.getElementById('odometer');
    if (el) {
        el.innerText = `${distance.toFixed(1)} mi`;
    }
}

/**
 * Set driver pit-lane speed status
 * @param {boolean} state 
 */
function setPitMode(state) {
    driverInPit = state;

    // Check speed warning immediately
    setSpeed(currentSpeed);
}

// === PLACEHOLDER API FUNCTIONS FOR RACE TELEMETRY ===

/**
 * Format raw seconds into mm:ss.SSS or s.SSS
 * @param {number} secs 
 */
function formatTime(secs) {
    if (!secs || secs <= 0) return '--:--.---';
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    if (mins > 0) {
        return `${mins}:${s < 10 ? '0' : ''}${s.toFixed(3)}`;
    }
    return s.toFixed(3);
}

/**
 * Update real-time laptime (Stubbed for CPU optimization)
 * @param {number} secs - Float seconds
 */
function setCurrentLapTime(secs) {
    currentLapTime = secs;
}

/**
 * Update last laptime (Stubbed for CPU optimization)
 * @param {number} secs - Float seconds
 */
function setLastLapTime(secs) {
    lastLapTime = secs;
}

/**
 * Update best laptime (Stubbed for CPU optimization)
 * @param {number} secs - Float seconds
 */
function setBestLapTime(secs) {
    bestLapTime = secs;
}

/**
 * Update leaderboard position (Stubbed for CPU optimization)
 * @param {number} pos - Position integer
 */
function setPosition(pos) {
    currentPosition = pos;
}

/**
 * Update current and total laps (Stubbed for CPU optimization)
 * @param {number} current - Current lap number
 * @param {number} total - Total laps in race
 */
function setLapCounter(current, total) {
    currentLap = current;
    totalLaps = total;
}

/**
 * Update time difference to leader/competitor (Stubbed for CPU optimization)
 * @param {number} diffMs - Difference in milliseconds (integer)
 */
function setTimeDiff(diffMs) {
    timeDiff = diffMs;
}

// === PAGE INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
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
    setSeatbelts(true); // default buckled (no warning glow)
    setOdometer(0);
    setPitMode(false);

    // Race Data defaults
    setCurrentLapTime(0.0);
    setLastLapTime(0.0);
    setBestLapTime(0.0);
    setPosition(0);
    setLapCounter(0, 0);
    setTimeDiff(0);

    // Position & Scale Setup
    loadSettings();
    setupDragging();

    // Wire up scale/reset UI buttons
    const btnScaleUp = document.getElementById('btn-scale-up');
    const btnScaleDown = document.getElementById('btn-scale-down');
    const btnReset = document.getElementById('btn-reset');

    if (btnScaleUp) {
        btnScaleUp.addEventListener('click', (e) => {
            e.stopPropagation();
            currentScale = Math.min(currentScale + 0.1, 2.0);
            updateScale();
            saveSettings();
        });
    }

    if (btnScaleDown) {
        btnScaleDown.addEventListener('click', (e) => {
            e.stopPropagation();
            currentScale = Math.max(currentScale - 0.1, 0.5);
            updateScale();
            saveSettings();
        });
    }

    if (btnReset) {
        btnReset.addEventListener('click', (e) => {
            e.stopPropagation();
            resetSettings();
        });
    }
});

// === SETTINGS (Position & Scale Persistence) ===
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
    dashboardEl.style.transform = `scale(${currentScale})`;
    dashboardEl.style.transformOrigin = 'center center';
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
}

// === DRAGGING SYSTEM ===
function setupDragging() {
    const dashboard = document.getElementById('speedometer');
    if (!dashboard) return;

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialX = 0;
    let initialY = 0;

    dashboard.addEventListener('pointerdown', (e) => {
        // Exclude interactive buttons and control bar containers from starting drag
        if (e.target.closest('.no-drag') || e.target.closest('button')) {
            return;
        }
        isDragging = true;

        // Use offsetLeft/offsetTop because they are unaffected by CSS transforms (like scale)
        initialX = dashboard.offsetLeft;
        initialY = dashboard.offsetTop;

        dragStartX = e.clientX;
        dragStartY = e.clientY;

        dashboard.setPointerCapture(e.pointerId);
        dashboard.style.cursor = 'grabbing';
        e.preventDefault();
    });

    dashboard.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;

        dashboard.style.left = `${initialX + dx}px`;
        dashboard.style.top = `${initialY + dy}px`;
        dashboard.style.bottom = 'auto';
        dashboard.style.right = 'auto';
    });

    dashboard.addEventListener('pointerup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        dashboard.releasePointerCapture(e.pointerId);
        dashboard.style.cursor = '';
        saveSettings();
    });
}
