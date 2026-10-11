<script>
  import { onDestroy, onMount } from "svelte";
  import { PANEL_MODE_IDS, PANEL_MODES } from "@/lib/aquarium/constants.js";
  import { createAquariumEngine } from "@/lib/aquarium/engine.js";
  import { createFixedEnvironment } from "@/lib/aquarium/environment.js";
  import { createAquariumFramebuffer } from "@/lib/aquarium/framebuffer.js";
  import { drawCenteredPixelText, measurePixelText } from "@/lib/aquarium/pixel-text.js";
  import { CanvasAquariumRenderer, RENDER_STYLES, SCALE_MODES } from "@/lib/aquarium/renderer.js";

  const DENSITY_PRESETS = [
    { id: "coarse", label: "Coarse", totalPixels: 6000, description: "~6000 logical px" },
    { id: "medium", label: "Medium", totalPixels: 10000, description: "~10000 logical px" },
    { id: "fine", label: "Fine", totalPixels: 25000, description: "~25000 logical px" },
  ];
  const DEFAULT_DENSITY = "medium";

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const getInitialPortrait = () =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("portrait");

  const environment = createFixedEnvironment();

  const pad2 = (value) => String(value).padStart(2, "0");
  const dayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const monthLabels = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  const getClockText = (date = new Date()) => ({
    time: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
    date: `${dayLabels[date.getDay()]} ${pad2(date.getDate())} ${monthLabels[date.getMonth()]}`,
  });

  let canvas;
  let renderer;
  let framebuffer;
  let engine;
  let frameId = null;
  let resizeTimer = null;
  let mounted = false;
  let lastFrameTime = 0;
  let touchPoint = null;
  let showDebug = false;
  let debugText = "";
  let lastDebugTime = 0;
  let isPortrait = getInitialPortrait();
  let density = DEFAULT_DENSITY;
  let sizeLabel = "";

  const dateColor = { r: 132, g: 222, b: 190, a: 220 };

  const computeLogicalSize = (densityId = density) => {
    if (isPortrait) {
      const mode = PANEL_MODES[PANEL_MODE_IDS.DEVICE_80X106];
      return { modeId: mode.id, width: mode.logicalWidth, height: mode.logicalHeight };
    }

    const preset = DENSITY_PRESETS.find((candidate) => candidate.id === densityId) ?? DENSITY_PRESETS[1];
    const totalPixels = preset.totalPixels;
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const logicalHeight = clamp(Math.round(Math.sqrt(totalPixels / aspect)), 40, 240);
    const logicalWidth = Math.max(1, Math.round(logicalHeight * aspect));
    return { modeId: PANEL_MODE_IDS.BROWSER_LANDSCAPE, width: logicalWidth, height: logicalHeight };
  };

  const applyTargetSize = () => {
    if (!renderer) return;
    const dpr = window.devicePixelRatio || 1;
    renderer.targetWidth = Math.max(1, Math.round(window.innerWidth * dpr));
    renderer.targetHeight = Math.max(1, Math.round(window.innerHeight * dpr));
  };

  const applyLogicalSize = () => {
    if (!engine || !mounted) return;
    const { modeId, width, height } = computeLogicalSize(density);
    const mode = { ...PANEL_MODES[modeId], id: modeId, logicalWidth: width, logicalHeight: height };
    framebuffer = createAquariumFramebuffer(modeId, { width, height });
    engine.resize({ mode, environment });
    sizeLabel = `${width}×${height}`;
  };

  const handleWindowResize = () => {
    if (!mounted) return;
    applyTargetSize();
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(applyLogicalSize, 150);
  };

  const setDensity = (densityId) => {
    density = densityId;
    applyLogicalSize();
  };

  const setPortrait = (portrait) => {
    isPortrait = portrait;
    const url = new URL(window.location.href);
    if (portrait) {
      url.searchParams.set("portrait", "1");
    } else {
      url.searchParams.delete("portrait");
    }
    window.history.replaceState(null, "", url.toString());
    applyLogicalSize();
  };

  const drawClockOverlay = (now) => {
    const { width, height, foreground } = framebuffer;
    const overlay = getClockText();
    const centerX = Math.round(width / 2);
    const timeScale = width >= 74 ? 2 : 1;
    const timeSize = measurePixelText(overlay.time, { scale: timeScale, letterSpacing: timeScale });
    const dateSize = measurePixelText(overlay.date, { scale: 1, letterSpacing: 1 });
    const pulse = Math.round(((Math.sin(now * 0.004) + 1) / 2) * 24);
    const clockColor = { r: 208 + pulse, g: 248, b: 234 + Math.floor(pulse / 2), a: 236 };

    drawCenteredPixelText(foreground, overlay.time, centerX, 3, {
      scale: timeScale,
      letterSpacing: timeScale,
      color: clockColor,
    });
    drawCenteredPixelText(foreground, overlay.date, centerX, Math.max(3 + timeSize.height + 3, height - dateSize.height - 3), {
      scale: 1,
      letterSpacing: 1,
      color: dateColor,
    });
  };

  const refreshDebug = (now) => {
    if (!showDebug) return;
    if (now - lastDebugTime < 250) return;
    lastDebugTime = now;
    const snapshot = engine?.getDebugSnapshot() ?? {};
    debugText = JSON.stringify({
      size: sizeLabel,
      density: density,
      orientation: isPortrait ? "portrait" : "landscape",
      fish: snapshot.fish?.count ?? 0,
      food: snapshot.food?.count ?? 0,
      plants: snapshot.plants?.count ?? 0,
      boids: snapshot.boids?.count ?? 0,
      frame: snapshot.frameCount ?? 0,
      updateOrderMatches: snapshot.updateOrder?.engineMatchesExpected ?? null,
      stateLoaded: snapshot.startup?.stateLoaded ?? null,
    });
  };

  const frame = (now) => {
    if (!mounted) return;
    const delta = lastFrameTime ? Math.min(80, now - lastFrameTime) : 0;
    lastFrameTime = now;

    engine?.update({ now, delta, framebuffer, environment, touchPoint });
    if (framebuffer) {
      drawClockOverlay(now);
      renderer.presentFramebuffer(framebuffer, {
        scaleMode: SCALE_MODES.FIT,
        renderStyle: RENDER_STYLES.DOTS,
        clearForeground: true,
      });
    }
    refreshDebug(now);
    frameId = requestAnimationFrame(frame);
  };

  const handlePointer = (event, phase) => {
    event.preventDefault();
    const point = renderer?.pointerToLogical(event, canvas);
    if (point) touchPoint = point;
    if (phase === "down") {
      engine?.onTouchStarted({ point, now: performance.now() });
    } else if (phase === "up" || phase === "cancel") {
      engine?.onTouchReleased();
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen?.();
    }
  };

  const exitStandalone = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  };

  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        exitStandalone();
      }
    } else if (event.key === "d" || event.key === "D") {
      showDebug = !showDebug;
    } else if (event.key === "f" || event.key === "F") {
      toggleFullscreen();
    } else if (event.key === "p" || event.key === "P") {
      setPortrait(!isPortrait);
    } else if (event.key === "1") {
      setDensity("coarse");
    } else if (event.key === "2") {
      setDensity("medium");
    } else if (event.key === "3") {
      setDensity("fine");
    }
  };

  onMount(() => {
    mounted = true;
    renderer = new CanvasAquariumRenderer(canvas, {
      modeId: PANEL_MODE_IDS.BROWSER_LANDSCAPE,
      scaleMode: SCALE_MODES.FIT,
      renderStyle: RENDER_STYLES.DOTS,
    });
    const initial = computeLogicalSize(density);
    const initialMode = {
      ...PANEL_MODES[initial.modeId],
      id: initial.modeId,
      logicalWidth: initial.width,
      logicalHeight: initial.height,
    };
    framebuffer = createAquariumFramebuffer(initial.modeId, { width: initial.width, height: initial.height });
    engine = createAquariumEngine({ mode: initialMode, environment });
    sizeLabel = `${initial.width}×${initial.height}`;
    applyTargetSize();
    window.addEventListener("resize", handleWindowResize);
    window.addEventListener("keydown", handleKeydown);
    frameId = requestAnimationFrame(frame);
  });

  onDestroy(() => {
    mounted = false;
    if (frameId !== null) cancelAnimationFrame(frameId);
    if (resizeTimer !== null) window.clearTimeout(resizeTimer);
    window.removeEventListener("resize", handleWindowResize);
    window.removeEventListener("keydown", handleKeydown);
    engine?.destroy?.();
  });
</script>

<svelte:head>
  <style>
    .standalone-canvas {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      display: block;
      touch-action: none;
      cursor: crosshair;
      background: #00161a;
    }

    .overlay-panel {
      border: 1px solid rgb(255 255 255 / 0.1);
      background: rgb(0 0 0 / 0.4);
      backdrop-filter: blur(6px);
      border-radius: 8px;
    }
  </style>
</svelte:head>

<canvas
  bind:this={canvas}
  class="standalone-canvas"
  aria-label="Fullscreen aquarium simulator"
  on:pointerdown={(event) => handlePointer(event, "down")}
  on:pointermove={(event) => handlePointer(event, "move")}
  on:pointerup={(event) => handlePointer(event, "up")}
  on:pointercancel={(event) => handlePointer(event, "cancel")}
></canvas>

<div class="pointer-events-none fixed left-4 top-4 flex items-center gap-2 text-xs font-medium text-emerald-100/80">
  <span class="overlay-panel px-3 py-1">ESP32 CYD Aquarium — Simulator</span>
  <span class="overlay-panel px-2 py-1 font-mono text-emerald-200/70">{sizeLabel}</span>
</div>

<div class="pointer-events-none fixed left-4 top-12 flex items-center gap-2 text-xs text-emerald-100/70">
  <div class="overlay-panel flex items-center gap-0.5 p-1">
    {#each DENSITY_PRESETS as preset (preset.id)}
      <button
        class="rounded px-2 py-0.5 font-medium transition-colors {density === preset.id
          ? 'bg-emerald-500/25 text-emerald-100'
          : 'text-emerald-100/60 hover:bg-white/5 hover:text-emerald-100/80'}"
        title="Dot density: {preset.description}; [preset.id === 'coarse' ? '1' : preset.id === 'medium' ? '2' : '3']"
        on:click={() => setDensity(preset.id)}
      >{preset.label}</button>
    {/each}
  </div>
  <button
    class="overlay-panel px-3 py-1.5 font-medium transition-colors hover:bg-black/60 {isPortrait ? 'bg-emerald-500/25' : ''}"
    title="Toggle orientation (p); ?portrait=1 forces the 80×106 device view"
    on:click={() => setPortrait(!isPortrait)}
  >{isPortrait ? "Portrait" : "Landscape"}</button>
</div>

<div class="pointer-events-none fixed bottom-4 left-4 text-xs text-emerald-100/50">
  click = feed · 1/2/3 = density · p = orientation · d = debug · f = fullscreen · esc = exit
</div>

<div class="fixed bottom-4 right-4 flex items-center gap-2">
  {#if showDebug}
    <pre class="pointer-events-none max-w-xs select-none overflow-auto rounded border border-white/10 bg-black/60 p-2 text-[10px] leading-snug text-emerald-200/90">{debugText}</pre>
  {/if}
  <button
    class="rounded border border-white/10 bg-black/40 px-3 py-1 text-xs font-medium text-emerald-100/80 backdrop-blur hover:bg-black/60"
    on:click={toggleFullscreen}
  >Fullscreen</button>
  <button
    class="rounded border border-white/10 bg-black/40 px-3 py-1 text-xs font-medium text-emerald-100/80 backdrop-blur hover:bg-black/60"
    on:click={exitStandalone}
  >Exit</button>
</div>