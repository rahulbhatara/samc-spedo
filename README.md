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

## Usage

1. Include the script in your HTML file:
   ```html
   <script src="cef.js"></script>
   ```

2. Call the appropriate functions to update the dashboard:
   ```javascript
   setEngine(true);
   setSpeed(25); // 25 m/s
   setRPM(0.75); // 75% RPM
   setFuel(0.85); // 85% fuel
   setHealth(1.0); // 100% health
   setGear(1); // 1st Gear
   setHeadlights(1); // Headlights on
   setLeftIndicator(false);
   setSeatbelts(true); // Fastened
   setOdometer(123.4);
   ```

## Dependencies
- Modern web browser with JavaScript enabled.
- No external libraries required.
- No GPU acceleration required.
