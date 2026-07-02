# Vehicle Speedometer Dashboard

A template for a vehicle speedometer dashboard that displays various vehicle metrics including speed, RPM, fuel level, and more. Optimized for GTA V / RageMP CEF overlays with **CPU-only rendering** (no GPU acceleration required).

## Core Features
- **Canvas 2D Rendering**: All dials rendered on a single `<canvas>` element with offscreen static buffer caching — minimal CPU overhead per frame.
- **Draggable Layout**: Click and drag the speedometer from anywhere to move it around the screen.
- **Dynamic Scale**: Use the hover controls (`+` / `-`) to scale the HUD between `0.5x` and `2.0x`.
- **Reset Button**: Press `↺` to snap the speedometer back to its default bottom-right position and 1.0x scale.
- **Persistence**: Layout coordinates and scale settings are saved automatically in `localStorage`.
- **Frame-rate Independent**: Needle interpolation adjusts dynamically to player monitor refresh rates (60Hz to 240Hz+).
- **Dirty-flag Rendering**: Canvas only redraws when data changes — zero CPU cost when idle.
- **No GPU Required**: No `backdrop-filter`, no `will-change`, no GPU compositing layers. Pure CPU-rendered.

## Performance Optimizations
- **Single Canvas**: Replaces 80+ SVG DOM nodes with 1 canvas element (~6 draw calls per frame).
- **Static Buffer Cache**: Dial backgrounds, arcs, ticks, and labels drawn once to an offscreen canvas, then blitted per frame via `drawImage()`.
- **Padé Approximation**: Replaces `Math.exp()` with `k*dt/(1+k*dt)` for 10× faster needle interpolation.
- **JS Blink System**: Replaces CSS infinite animations with `setInterval` toggle (controllable, stoppable).
- **DOM Element Caching**: All `getElementById` calls executed once at init, stored in a lookup object.
- **`textContent` over `innerText`**: Avoids layout recalculation on text updates.
- **rAF-Throttled Dragging**: Drag events batched to 1 DOM update per animation frame.

## Functions Documentation

#### `setEngine(state)`
Updates the display of the engine state.
- **Parameters:**
  - `state` (boolean): If true, the engine is on (green icon); otherwise, it is off (red icon).

#### `setSpeed(speed)`
Updates the speed display based on the current speed mode.
- **Parameters:**
  - `speed` (number): The speed value in meters per second (m/s).

#### `setRPM(rpm)`
Updates the RPM (Revolutions Per Minute) display.
- **Parameters:**
  - `rpm` (number): The RPM value to display as a float (0.0 to 1.0).

#### `setFuel(fuel)`
Updates the fuel level display as a percentage.
- **Parameters:**
  - `fuel` (number): The fuel level as a float (0.0 to 1.0).

#### `setHealth(health)`
Updates the vehicle health display as a percentage.
- **Parameters:**
  - `health` (number): The vehicle health level as a float (0.0 to 1.0).

#### `setGear(gear)`
Updates the current gear display.
- **Parameters:**
  - `gear` (number): The current gear (0 represents Neutral (N), -1 represents Reverse (R), 1..7 represent forward gears).

#### `setHeadlights(state)`
Updates the headlights status display.
- **Parameters:**
  - `state` (number): The headlight state (0: Off, 1: On, 2: High Beam).

#### `setLeftIndicator(state)`
Sets the state of the left turn indicator.
- **Parameters:**
  - `state` (boolean): If true, turns the left indicator on; otherwise, off.

#### `setRightIndicator(state)`
Sets the state of the right turn indicator.
- **Parameters:**
  - `state` (boolean): If true, turns the right indicator on; otherwise, off.

#### `setSeatbelts(state)`
Updates the seatbelt status display.
- **Parameters:**
  - `state` (boolean): If true, seatbelt is buckled (no warning); if false, indicates seatbelt is unfastened (red warning flashes).

#### `setOdometer(distance)`
Sets the Odometer value of the Speedometer.
- **Parameters:**
  - `distance` (number): The distance in miles.

### Testing SetRPM(), setSpeed(), setHealth() & setFuel() 
```javascript
(function() {
  let currentMph = 0;
  let direction = 1;
  const maxMph = 200;
  const minMph = 0;
  const stepMph = 2;
  const delay = 100;
  const mphToMs = 0.44704;

  const call = (name, val) => { if (typeof window[name] === 'function') window[name](val); };

  if (window.carSimulation) clearInterval(window.carSimulation);

  window.carSimulation = setInterval(() => {
    call('setSpeed', currentMph * mphToMs);

    let gear = 'N', rpm = 0.12;
    if (currentMph > 0) {
      if (currentMph <= 25) { gear = '1'; rpm = 0.2 + (currentMph / 25) * 0.7; }
      else if (currentMph <= 55) { gear = '2'; rpm = 0.3 + ((currentMph - 25) / 30) * 0.6; }
      else if (currentMph <= 85) { gear = '3'; rpm = 0.4 + ((currentMph - 55) / 30) * 0.55; }
      else if (currentMph <= 115) { gear = '4'; rpm = 0.45 + ((currentMph - 85) / 30) * 0.5; }
      else if (currentMph <= 145) { gear = '5'; rpm = 0.5 + ((currentMph - 115) / 30) * 0.45; }
      else if (currentMph <= 175) { gear = '6'; rpm = 0.55 + ((currentMph - 145) / 30) * 0.4; }
      else { gear = '7'; rpm = 0.6 + ((currentMph - 175) / 25) * 0.38; }
    }
    call('setGear', gear);
    call('setRPM', Math.min(1, Math.max(0, rpm)));

    const progress = currentMph / maxMph;
    call('setFuel', Math.max(0.01, 1 - progress));
    call('setHealth', Math.max(0.01, 1 - (progress * 0.15)));
    if (currentMph >= maxMph && direction === 1) {
      direction = -1;
    } else if (currentMph <= minMph && direction === -1) {
      clearInterval(window.carSimulation);
      return;
    }

    currentMph += (direction * stepMph);
    currentMph = Math.max(minMph, Math.min(maxMph, currentMph));
  }, delay);
})();
```

### Testing SetRPM() & setSpeed()
```javascript
(function() {
  let currentMph = 0;
  let direction = 1;
  const maxMph = 200;
  const minMph = 0;
  const stepMph = 2;
  const delay = 100;
  const mphToMs = 0.44704;

  const call = (name, val) => { if (typeof window[name] === 'function') window[name](val); };

  if (window.carSimulation) clearInterval(window.carSimulation);

  window.carSimulation = setInterval(() => {
    call('setSpeed', currentMph * mphToMs);

    let gear = 'N', rpm = 0.12;
    if (currentMph > 0) {
      if (currentMph <= 25) { gear = '1'; rpm = 0.2 + (currentMph / 25) * 0.7; }
      else if (currentMph <= 55) { gear = '2'; rpm = 0.3 + ((currentMph - 25) / 30) * 0.6; }
      else if (currentMph <= 85) { gear = '3'; rpm = 0.4 + ((currentMph - 55) / 30) * 0.55; }
      else if (currentMph <= 115) { gear = '4'; rpm = 0.45 + ((currentMph - 85) / 30) * 0.5; }
      else if (currentMph <= 145) { gear = '5'; rpm = 0.5 + ((currentMph - 115) / 30) * 0.45; }
      else if (currentMph <= 175) { gear = '6'; rpm = 0.55 + ((currentMph - 145) / 30) * 0.4; }
      else { gear = '7'; rpm = 0.6 + ((currentMph - 175) / 25) * 0.38; }
    }
    call('setGear', gear);
    call('setRPM', Math.min(1, Math.max(0, rpm)));

    if (currentMph >= maxMph && direction === 1) {
      direction = -1;
    } else if (currentMph <= minMph && direction === -1) {
      clearInterval(window.carSimulation);
      return;
    }

    currentMph += (direction * stepMph);
    currentMph = Math.max(minMph, Math.min(maxMph, currentMph));
  }, delay);
})();
```

### Testing setFuel() & setHealth()
```javascript
(function() {
  let step = 0;
  let direction = 1;
  const maxStep = 100;
  const minStep = 0;
  const stepChange = 2;
  const delay = 100;

  const call = (name, val) => { if (typeof window[name] === 'function') window[name](val); };

  if (window.carSimulation) clearInterval(window.carSimulation);

  window.carSimulation = setInterval(() => {
    const progress = step / maxStep;

    call('setFuel', Math.max(0.01, parseFloat((1 - progress).toFixed(2))));
    call('setHealth', Math.max(0.01, parseFloat((1 - (progress * 0.15)).toFixed(2))));

    if (step >= maxStep && direction === 1) {
      direction = -1;
    } else if (step <= minStep && direction === -1) {
      clearInterval(window.carSimulation);
      return;
    }

    step += (direction * stepChange);
    step = Math.max(minStep, Math.min(maxStep, step));
  }, delay);
})();
```