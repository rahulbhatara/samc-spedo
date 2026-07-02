# 🏁 Speedometer CEF — Visual Test Script

Test script visual untuk memverifikasi semua fungsi speedometer CEF overlay.
Paste script di **Console browser** (F12) saat `index.html` terbuka.

> ⚠️ **Semua test berjalan dengan delay realistis** — bukan instant.
> Kamu bisa melihat setiap perubahan di HUD secara visual.

---

## Cara Pakai

| Command | Durasi | Fungsi |
|---|---|---|
| `SpedoTest.runAll()` | ~2 menit | Full visual test — simulasi nyala mesin, akselerasi, belok, damage, hampir kehabisan bensin, rem, parkir |
| `SpedoTest.testSpeed()` | ~20 detik | Needle speed naik gradual 0 → 200 mph |
| `SpedoTest.testRPM()` | ~15 detik | RPM sweep 0 → redline → idle |
| `SpedoTest.testGear()` | ~12 detik | Gear N → R → 1-7 → N |
| `SpedoTest.testFuelHealth()` | ~20 detik | Fuel & health drain gradual sampai habis |
| `SpedoTest.testIndicators()` | ~25 detik | Semua indicator nyala/blink satu per satu |
| `SpedoTest.testOdometer()` | ~8 detik | Odometer counting up |
| `SpedoTest.testControls()` | ~6 detik | Scale up/down/reset |
| `SpedoTest.testDOM()` | instant | DOM element check (non-visual) |

---

## Script

Paste seluruh code block berikut ke Console browser:

```javascript
const SpedoTest = (() => {

    const PASS = '✅';
    const FAIL = '❌';
    const INFO = 'ℹ️';
    const PHASE = '🔶';
    let passed = 0, failed = 0;

    // --- Helpers ---

    function log(icon, msg) {
        console.log(`${icon} ${msg}`);
    }

    function assert(condition, label) {
        if (condition) {
            passed++;
            log(PASS, label);
        } else {
            failed++;
            log(FAIL, label);
        }
    }

    function wait(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    function resetCounters() {
        passed = 0;
        failed = 0;
    }

    function printSummary() {
        console.log('\n' + '='.repeat(50));
        console.log(`📊 HASIL: ${passed} passed, ${failed} failed, ${passed + failed} total`);
        console.log('='.repeat(50));
        if (failed === 0) {
            console.log('🎉 SEMUA TEST LULUS!');
        } else {
            console.log(`⚠️  ${failed} test GAGAL — cek output di atas.`);
        }
    }

    /** Smoothly ramp a value using small incremental steps */
    async function rampSpeed(fromMph, toMph, durationMs) {
        const steps = Math.max(Math.abs(toMph - fromMph) / 2, 10);
        const stepDelay = durationMs / steps;
        const stepSize = (toMph - fromMph) / steps;
        for (let i = 0; i <= steps; i++) {
            const mph = fromMph + stepSize * i;
            setSpeed(mph / 2.237); // Convert MPH to m/s
            await wait(stepDelay);
        }
    }

    async function rampRPM(fromRpm, toRpm, durationMs) {
        const steps = 20;
        const stepDelay = durationMs / steps;
        const stepSize = (toRpm - fromRpm) / steps;
        for (let i = 0; i <= steps; i++) {
            setRPM(fromRpm + stepSize * i);
            await wait(stepDelay);
        }
    }

    async function rampFuel(fromVal, toVal, durationMs) {
        const steps = 20;
        const stepDelay = durationMs / steps;
        const stepSize = (toVal - fromVal) / steps;
        for (let i = 0; i <= steps; i++) {
            setFuel(Math.max(0, Math.min(1, fromVal + stepSize * i)));
            await wait(stepDelay);
        }
    }

    async function rampHealth(fromVal, toVal, durationMs) {
        const steps = 20;
        const stepDelay = durationMs / steps;
        const stepSize = (toVal - fromVal) / steps;
        for (let i = 0; i <= steps; i++) {
            setHealth(Math.max(0, Math.min(1, fromVal + stepSize * i)));
            await wait(stepDelay);
        }
    }

    // =========================================================================
    //  1. DOM ELEMENT TESTS (non-visual, instant)
    // =========================================================================

    function testDOM() {
        console.group('🔍 Test: DOM Elements');

        const ids = [
            'speedometer', 'speedo-canvas', 'speed-display', 'speed-unit',
            'gear-display', 'odometer', 'fuel-fill', 'fuel-text',
            'health-fill', 'health-text', 'indicator-left', 'indicator-right',
            'indicator-headlights', 'indicator-seatbelt', 'indicator-engine',
            'btn-scale-up', 'btn-scale-down', 'btn-reset'
        ];

        ids.forEach(id => {
            assert(document.getElementById(id) !== null, `Element #${id} ada`);
        });

        const canvas = document.getElementById('speedo-canvas');
        assert(canvas.getContext('2d') !== null, 'Canvas 2D context tersedia');
        assert(canvas.width === 310, `Canvas width = ${canvas.width} (expected 310)`);
        assert(canvas.height === 180, `Canvas height = ${canvas.height} (expected 180)`);

        console.groupEnd();
    }

    // =========================================================================
    //  2. SPEED TEST — Gradual ramp 0 → 100 → 200 → 0 mph (~20s)
    // =========================================================================

    async function testSpeed() {
        console.group('🏎️ Test: setSpeed() — Visual Ramp');

        log(INFO, 'Akselerasi 0 → 100 mph...');
        await rampSpeed(0, 100, 5000);
        await wait(500);
        const s100 = document.getElementById('speed-display').textContent;
        assert(s100 === '100', `Speed 100 mph → display "${s100}"`);

        log(INFO, 'Akselerasi 100 → 200 mph (top speed)...');
        await rampSpeed(100, 200, 5000);
        await wait(500);
        const s200 = document.getElementById('speed-display').textContent;
        assert(s200 === '200', `Speed 200 mph → display "${s200}"`);

        log(INFO, 'Hard braking 200 → 0 mph...');
        await rampSpeed(200, 0, 4000);
        await wait(500);
        const s0 = document.getElementById('speed-display').textContent;
        assert(s0 === '0', `Speed 0 mph → display "${s0}"`);

        console.groupEnd();
    }

    // =========================================================================
    //  3. RPM TEST — Sweep idle → redline → idle (~15s)
    // =========================================================================

    async function testRPM() {
        console.group('🔧 Test: setRPM() — Visual Sweep');

        log(INFO, 'RPM naik idle → redline...');
        await rampRPM(0, 1.0, 5000);
        await wait(500);
        assert(currentRpm === 1.0, `RPM redline → currentRpm = ${currentRpm}`);

        log(INFO, 'Hold redline 2 detik...');
        await wait(2000);

        log(INFO, 'RPM turun ke idle...');
        await rampRPM(1.0, 0.08, 3000);
        await wait(500);
        assert(currentRpm <= 0.1, `RPM idle → currentRpm = ${currentRpm.toFixed(2)}`);

        // Reset
        setRPM(0);
        await wait(1000);

        console.groupEnd();
    }

    // =========================================================================
    //  4. GEAR TEST — N → R → 1-7 → N with delay (~12s)
    // =========================================================================

    async function testGear() {
        console.group('⚙️ Test: setGear() — Visual Shift');
        const gearEl = document.getElementById('gear-display');

        log(INFO, 'Neutral...');
        setGear(0);
        await wait(1500);
        assert(gearEl.textContent === 'N', `Gear N → "${gearEl.textContent}"`);

        log(INFO, 'Reverse...');
        setGear(-1);
        await wait(1500);
        assert(gearEl.textContent === 'R', `Gear R → "${gearEl.textContent}"`);

        for (let g = 1; g <= 7; g++) {
            log(INFO, `Gear ${g}...`);
            setGear(g);
            await wait(1000);
            assert(gearEl.textContent === String(g), `Gear ${g} → "${gearEl.textContent}"`);
        }

        log(INFO, 'Kembali ke Neutral...');
        setGear(0);
        await wait(1000);
        assert(gearEl.textContent === 'N', `Gear N → "${gearEl.textContent}"`);

        console.groupEnd();
    }

    // =========================================================================
    //  5. FUEL & HEALTH — Gradual drain & recover (~20s)
    // =========================================================================

    async function testFuelHealth() {
        console.group('⛽ Test: setFuel() & setHealth() — Visual Drain');

        // Fuel drain
        log(INFO, 'Fuel drain 100% → 5%...');
        await rampFuel(1.0, 0.05, 5000);
        await wait(500);
        assert(document.getElementById('fuel-text').textContent === '5%', 'Fuel 5%');
        assert(document.getElementById('fuel-fill').style.width === '5%', 'Fuel bar 5%');

        log(INFO, 'Isi bensin 5% → 100%...');
        await rampFuel(0.05, 1.0, 3000);
        await wait(500);
        assert(document.getElementById('fuel-text').textContent === '100%', 'Fuel 100%');

        // Health drain
        log(INFO, 'Engine health turun 100% → 10% (kerusakan)...');
        await rampHealth(1.0, 0.10, 4000);
        await wait(500);
        assert(document.getElementById('health-text').textContent === '10%', 'Health 10%');

        log(INFO, 'Repair engine 10% → 100%...');
        await rampHealth(0.10, 1.0, 3000);
        await wait(500);
        assert(document.getElementById('health-text').textContent === '100%', 'Health 100%');

        console.groupEnd();
    }

    // =========================================================================
    //  6. INDICATORS — Each one visible for several seconds (~25s)
    // =========================================================================

    async function testIndicators() {
        console.group('💡 Test: Indicators — Visual');

        // Engine
        log(INFO, 'Engine ON...');
        setEngine(true);
        await wait(2000);
        assert(document.getElementById('indicator-engine').classList.contains('on'), 'Engine ON');
        setEngine(false);
        await wait(1000);
        assert(!document.getElementById('indicator-engine').classList.contains('on'), 'Engine OFF');

        // Headlights
        log(INFO, 'Headlights ON...');
        setHeadlights(1);
        await wait(2000);
        assert(document.getElementById('indicator-headlights').classList.contains('on'), 'Headlights ON');
        log(INFO, 'High beams...');
        setHeadlights(2);
        await wait(2000);
        assert(document.getElementById('indicator-headlights').classList.contains('on'), 'High beams ON');
        setHeadlights(0);
        await wait(1000);
        assert(!document.getElementById('indicator-headlights').classList.contains('on'), 'Headlights OFF');

        // Left indicator — blink visible
        log(INFO, 'Sein kiri (blink 3 detik)...');
        setLeftIndicator(true);
        await wait(3000);
        assert(document.getElementById('indicator-left').classList.contains('on'), 'Left indicator ON');
        setLeftIndicator(false);
        await wait(1000);
        assert(!document.getElementById('indicator-left').classList.contains('on'), 'Left indicator OFF');

        // Right indicator — blink visible
        log(INFO, 'Sein kanan (blink 3 detik)...');
        setRightIndicator(true);
        await wait(3000);
        assert(document.getElementById('indicator-right').classList.contains('on'), 'Right indicator ON');
        setRightIndicator(false);
        await wait(1000);
        assert(!document.getElementById('indicator-right').classList.contains('on'), 'Right indicator OFF');

        // Hazard (both) — blink visible
        log(INFO, 'Hazard lights (kedua sein, 3 detik)...');
        setLeftIndicator(true);
        setRightIndicator(true);
        await wait(3000);
        setLeftIndicator(false);
        setRightIndicator(false);
        await wait(500);

        // Seatbelt warning
        log(INFO, 'Seatbelt warning (tidak pakai sabuk)...');
        setSeatbelts(false);
        await wait(3000);
        assert(document.getElementById('indicator-seatbelt').classList.contains('on'), 'Seatbelt warning ON');
        log(INFO, 'Pasang sabuk...');
        setSeatbelts(true);
        await wait(1000);
        assert(!document.getElementById('indicator-seatbelt').classList.contains('on'), 'Seatbelt warning OFF');

        console.groupEnd();
    }

    // =========================================================================
    //  7. ODOMETER — Count up visually (~8s)
    // =========================================================================

    async function testOdometer() {
        console.group('📏 Test: setOdometer() — Visual Count');

        log(INFO, 'Odometer counting up...');
        setOdometer(0);
        await wait(500);
        assert(document.getElementById('odometer').textContent === '0.0 mi', 'Odometer 0.0 mi');

        // Count up from 0 to 50 miles
        for (let d = 0; d <= 50; d += 2.5) {
            setOdometer(d);
            await wait(300);
        }
        assert(document.getElementById('odometer').textContent === '50.0 mi', 'Odometer 50.0 mi');

        log(INFO, 'Jump to 99999.9 mi...');
        setOdometer(99999.9);
        await wait(1500);
        assert(document.getElementById('odometer').textContent === '99999.9 mi', 'Odometer 99999.9 mi');

        setOdometer(0);
        await wait(500);

        console.groupEnd();
    }

    // =========================================================================
    //  8. SCALE CONTROLS — Visible zoom in/out (~6s)
    // =========================================================================

    async function testControls() {
        console.group('🎛️ Test: Scale Controls — Visual');

        const btnUp = document.getElementById('btn-scale-up');
        const btnDown = document.getElementById('btn-scale-down');
        const btnReset = document.getElementById('btn-reset');

        assert(btnUp !== null, 'btn-scale-up ada');
        assert(btnDown !== null, 'btn-scale-down ada');
        assert(btnReset !== null, 'btn-reset ada');

        log(INFO, 'Zoom in...');
        btnUp.click(); await wait(600);
        btnUp.click(); await wait(600);
        btnUp.click(); await wait(600);
        const scaleUp = currentScale;
        assert(scaleUp > 1.0, `Scale up: ${scaleUp}`);

        log(INFO, 'Zoom out...');
        btnDown.click(); await wait(600);
        btnDown.click(); await wait(600);
        btnDown.click(); await wait(600);
        btnDown.click(); await wait(600);
        btnDown.click(); await wait(600);

        log(INFO, 'Reset...');
        btnReset.click();
        await wait(1000);
        assert(currentScale === 1.0, `Reset: scale = ${currentScale}`);

        console.groupEnd();
    }

    // =========================================================================
    //  FULL VISUAL TEST — Realistic driving scenario (~2 min)
    // =========================================================================

    async function runAll() {
        resetCounters();
        console.clear();
        console.log('🏁 SPEEDOMETER CEF — VISUAL TEST SUITE');
        console.log('='.repeat(50));
        console.log('⏱️ Durasi ~2 menit. Lihat speedometer HUD bergerak.\n');

        // ---- Phase 0: DOM Check ----
        testDOM();
        await wait(500);

        // ---- Phase 1: Start Engine ----
        console.group(PHASE + ' Phase 1: Nyalakan Mesin');
        log(INFO, 'Masuk mobil... seatbelt belum dipasang');
        setSeatbelts(false);
        await wait(2000);

        log(INFO, 'Pasang seatbelt...');
        setSeatbelts(true);
        await wait(1500);

        log(INFO, 'Nyalakan mesin...');
        setEngine(true);
        setHeadlights(1);
        setRPM(0.08); // idle RPM
        setGear(0);    // Neutral
        setFuel(1.0);
        setHealth(1.0);
        setOdometer(0);
        await wait(2000);
        assert(document.getElementById('indicator-engine').classList.contains('on'), 'Engine ON');
        log(INFO, 'Mesin idle. Siap jalan.');
        console.groupEnd();

        // ---- Phase 2: Reverse out of parking ----
        console.group(PHASE + ' Phase 2: Mundur dari Parkir');
        log(INFO, 'Masuk gear R...');
        setGear(-1);
        await wait(1000);

        log(INFO, 'Mundur pelan...');
        await rampSpeed(0, 10, 2000);
        setRPM(0.15);
        await wait(1500);

        log(INFO, 'Stop, masuk gear 1...');
        await rampSpeed(10, 0, 1000);
        setRPM(0.08);
        setGear(1);
        await wait(1000);
        console.groupEnd();

        // ---- Phase 3: Akselerasi melalui gear ----
        console.group(PHASE + ' Phase 3: Akselerasi');
        const gearShifts = [
            { gear: 1, fromMph: 0,   toMph: 25,  rpmStart: 0.15, rpmPeak: 0.65, duration: 2500 },
            { gear: 2, fromMph: 25,  toMph: 45,  rpmStart: 0.30, rpmPeak: 0.70, duration: 2500 },
            { gear: 3, fromMph: 45,  toMph: 65,  rpmStart: 0.28, rpmPeak: 0.65, duration: 2000 },
            { gear: 4, fromMph: 65,  toMph: 85,  rpmStart: 0.30, rpmPeak: 0.60, duration: 2000 },
            { gear: 5, fromMph: 85,  toMph: 110, rpmStart: 0.25, rpmPeak: 0.55, duration: 2500 },
            { gear: 6, fromMph: 110, toMph: 130, rpmStart: 0.30, rpmPeak: 0.65, duration: 2500 },
        ];

        let odometerMiles = 0;
        let fuel = 0.98;

        for (const shift of gearShifts) {
            log(INFO, `Gear ${shift.gear} — ${shift.fromMph} → ${shift.toMph} mph`);
            setGear(shift.gear);
            setRPM(shift.rpmStart);
            await wait(200);

            // Ramp speed + RPM together
            const steps = 20;
            const speedStep = (shift.toMph - shift.fromMph) / steps;
            const rpmStep = (shift.rpmPeak - shift.rpmStart) / steps;
            const delay = shift.duration / steps;

            for (let i = 0; i <= steps; i++) {
                const mph = shift.fromMph + speedStep * i;
                setSpeed(mph / 2.237);
                setRPM(shift.rpmStart + rpmStep * i);
                odometerMiles += (mph / 3600) * (delay / 1000);
                setOdometer(parseFloat(odometerMiles.toFixed(1)));
                fuel -= 0.001;
                setFuel(Math.max(fuel, 0));
                await wait(delay);
            }
        }

        const gearEl = document.getElementById('gear-display');
        assert(gearEl.textContent === '6', 'Final gear = 6');
        log(INFO, 'Cruising 130 mph di gear 6.');
        console.groupEnd();

        // ---- Phase 4: Cruise + Turn Signals ----
        console.group(PHASE + ' Phase 4: Belok Kiri, Lalu Belok Kanan');
        log(INFO, 'Sein kiri — mau pindah jalur...');
        setLeftIndicator(true);
        await wait(3000);
        setLeftIndicator(false);
        await wait(1500);
        assert(!document.getElementById('indicator-left').classList.contains('on'), 'Left indicator off setelah pindah jalur');

        log(INFO, 'Sein kanan — mau keluar tol...');
        setRightIndicator(true);
        // Slow down while signaling
        await rampSpeed(130, 90, 3000);
        setRPM(0.35);
        setGear(4);
        setRightIndicator(false);
        await wait(1000);
        assert(!document.getElementById('indicator-right').classList.contains('on'), 'Right indicator off');
        console.groupEnd();

        // ---- Phase 5: Engine Damage ----
        console.group(PHASE + ' Phase 5: Tabrak Sesuatu! Engine Damage');
        log(INFO, 'BRAKK! Nabrak...');
        await rampSpeed(90, 40, 1500);
        setRPM(0.20);
        setGear(2);
        await wait(500);

        log(INFO, 'Engine health turun drastis...');
        await rampHealth(1.0, 0.25, 3000);
        await wait(1000);
        assert(document.getElementById('health-text').textContent === '25%', 'Health 25% setelah nabrak');
        console.groupEnd();

        // ---- Phase 6: Low Fuel Warning ----
        console.group(PHASE + ' Phase 6: Bensin Hampir Habis');
        log(INFO, 'Bensin tinggal sedikit...');
        await rampFuel(fuel, 0.08, 3000);
        await wait(1000);
        assert(parseInt(document.getElementById('fuel-text').textContent) <= 10, 'Fuel sangat rendah');

        log(INFO, 'Cari SPBU... pelan-pelan...');
        await rampSpeed(40, 20, 2000);
        setRPM(0.12);
        setGear(1);
        await wait(2000);
        console.groupEnd();

        // ---- Phase 7: Stop & Park ----
        console.group(PHASE + ' Phase 7: Berhenti & Parkir');
        log(INFO, 'Rem sampai berhenti...');
        await rampSpeed(20, 0, 2000);
        setRPM(0.08);
        await wait(1000);

        log(INFO, 'Masuk Neutral...');
        setGear(0);
        await wait(1000);

        log(INFO, 'Matikan headlights...');
        setHeadlights(0);
        await wait(1000);

        log(INFO, 'Matikan mesin...');
        setEngine(false);
        setRPM(0);
        await wait(1500);
        assert(!document.getElementById('indicator-engine').classList.contains('on'), 'Engine OFF');

        const s0 = document.getElementById('speed-display').textContent;
        assert(s0 === '0', 'Speed = 0 setelah parkir');
        assert(gearEl.textContent === 'N', 'Gear = N setelah parkir');
        console.groupEnd();

        // ---- Phase 8: Scale Controls ----
        console.group(PHASE + ' Phase 8: Test Zoom');
        await testControls();
        console.groupEnd();

        // ---- Summary ----
        // Reset to clean state
        setFuel(1.0);
        setHealth(1.0);
        setOdometer(0);
        setSeatbelts(true);

        printSummary();
    }

    // --- Public API ---
    return {
        runAll,
        testDOM,
        testSpeed,
        testRPM,
        testGear,
        testFuelHealth,
        testIndicators,
        testOdometer,
        testControls,
    };

})();

console.log('✅ SpedoTest loaded. Jalankan: SpedoTest.runAll()');
```

