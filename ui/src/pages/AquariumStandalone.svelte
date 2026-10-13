<script>
  import { onDestroy, onMount } from "svelte";
  import { PANEL_MODE_IDS, PANEL_MODES } from "@/lib/aquarium/constants.js";
  import { createAquariumEngine } from "@/lib/aquarium/engine.js";
  import { createFixedEnvironment } from "@/lib/aquarium/environment.js";
  import { createAquariumFramebuffer } from "@/lib/aquarium/framebuffer.js";
  import { applyNightTint, computeNightness } from "@/lib/aquarium/daynight.js";
  import { drawCenteredPixelText, measurePixelText } from "@/lib/aquarium/pixel-text.js";
  import { CanvasAquariumRenderer, RENDER_STYLES, SCALE_MODES } from "@/lib/aquarium/renderer.js";
  import { createAquariumScenery } from "@/lib/aquarium/scenery.js";

  const DENSITY_PRESETS = [
    { id: "coarse", label: "Coarse", key: "1", totalPixels: 16000, description: "~16k logical px" },
    { id: "medium", label: "Medium", key: "2", totalPixels: 45000, description: "~45k logical px" },
    { id: "fine", label: "Fine", key: "3", totalPixels: 100000, description: "~100k logical px" },
    { id: "ultra", label: "Ultra", key: "4", totalPixels: 240000, description: "~240k logical px" },
  ];
  const DEFAULT_DENSITY = "fine";

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const getInitialPortrait = () =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("portrait");

  const environment = createFixedEnvironment();

  const pad2 = (value) => String(value).padStart(2, "0");
  const dayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const monthLabels = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  const getClockText = (date = new Date()) => {
    const hours24 = date.getHours();
    const meridiem = hours24 < 12 ? "AM" : "PM";
    const hours12 = hours24 % 12 || 12;
    return {
      time: `${hours12}:${pad2(date.getMinutes())} ${meridiem}`,
      date: `${dayLabels[date.getDay()]} ${pad2(date.getDate())} ${monthLabels[date.getMonth()]}`,
    };
  };

  let canvas;
  let renderer;
  let framebuffer;
  let engine;
  let scenery;
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
  let showMenus = false;
  let showClock = false;
  let showHelp = false;
  let renderStyle = RENDER_STYLES.SQUARES;

  const dateColor = { r: 132, g: 222, b: 190, a: 220 };

  const CONTROL_HELP = [
    { keys: "Click", action: "Feed the fish" },
    { keys: "+ / a", action: "Add a fish" },
    { keys: "1-4", action: "Dot density" },
    { keys: "s", action: "Dots / pixels" },
    { keys: "p", action: "Orientation" },
    { keys: "c", action: "Time & date" },
    { keys: "m", action: "Menus" },
    { keys: "/", action: "Toggle this panel" },
    { keys: "d", action: "Debug info" },
    { keys: "f", action: "Fullscreen" },
    { keys: "Esc", action: "Exit" },
  ];

  const hourOverride = (() => {
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get("hour");
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  })();

  const currentNightness = () => {
    if (hourOverride === null) {
      return computeNightness();
    }
    const date = new Date();
    const hour = Math.floor(hourOverride);
    const minute = Math.round((hourOverride - hour) * 60);
    date.setHours(hour, minute, 0, 0);
    return computeNightness(date);
  };

  const computeLogicalSize = (densityId = density) => {
    if (isPortrait) {
      const mode = PANEL_MODES[PANEL_MODE_IDS.DEVICE_80X106];
      return { modeId: mode.id, width: mode.logicalWidth, height: mode.logicalHeight };
    }

    const preset = DENSITY_PRESETS.find((candidate) => candidate.id === densityId) ?? DENSITY_PRESETS[1];
    const totalPixels = preset.totalPixels;
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const logicalHeight = clamp(Math.round(Math.sqrt(totalPixels / aspect)), 40, 540);
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
    scenery?.resize(width, height);
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

  const toggleRenderStyle = () => {
    renderStyle = renderStyle === RENDER_STYLES.DOTS ? RENDER_STYLES.SQUARES : RENDER_STYLES.DOTS;
  };

  const addFish = (count = 1) => {
    engine?.addFish({ count, now: performance.now() });
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
    const { width, foreground } = framebuffer;
    const overlay = getClockText();
    const centerX = Math.round(width / 2);
    const timeScale = width >= 74 ? 2 : 1;
    const timeSize = measurePixelText(overlay.time, { scale: timeScale, letterSpacing: timeScale });
    const pulse = Math.round(((Math.sin(now * 0.004) + 1) / 2) * 24);
    const clockColor = { r: 208 + pulse, g: 248, b: 234 + Math.floor(pulse / 2), a: 236 };

    drawCenteredPixelText(foreground, overlay.time, centerX, 3, {
      scale: timeScale,
      letterSpacing: timeScale,
      color: clockColor,
    });
    drawCenteredPixelText(foreground, overlay.date, centerX, 3 + timeSize.height + 3, {
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

    if (framebuffer) {
      scenery?.update({ framebuffer, now });
    }
    engine?.update({ now, delta, framebuffer, environment, touchPoint });
    if (framebuffer) {
      if (showClock) drawClockOverlay(now);
      const nightness = currentNightness();
      if (nightness > 0.001) {
        renderer.presentFramebuffer(framebuffer, {
          scaleMode: SCALE_MODES.FIT,
          renderStyle,
          pixels: applyNightTint(framebuffer, nightness),
        });
      } else {
        renderer.presentFramebuffer(framebuffer, {
          scaleMode: SCALE_MODES.FIT,
          renderStyle,
          clearForeground: true,
        });
      }
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
      if (showHelp) {
        showHelp = false;
      } else if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        exitStandalone();
      }
    } else if (event.key === "/" || event.key === "?") {
      showHelp = !showHelp;
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
    } else if (event.key === "4") {
      setDensity("ultra");
    } else if (event.key === "s" || event.key === "S") {
      toggleRenderStyle();
    } else if (event.key === "+" || event.key === "=" || event.key === "a" || event.key === "A") {
      addFish(1);
    } else if (event.key === "c" || event.key === "C") {
      showClock = !showClock;
    } else if (event.key === "m" || event.key === "M") {
      showMenus = !showMenus;
    }
  };

  onMount(() => {
    mounted = true;
    renderer = new CanvasAquariumRenderer(canvas, {
      modeId: PANEL_MODE_IDS.BROWSER_LANDSCAPE,
      scaleMode: SCALE_MODES.FIT,
      renderStyle,
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
    scenery = createAquariumScenery({ width: initial.width, height: initial.height });
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

<!-- Corner toggles: always visible -->
<div class="fixed right-4 top-4 flex items-center gap-2">
  <button
    class="overlay-panel flex h-8 w-8 items-center justify-center text-sm text-emerald-100/80 transition-colors hover:bg-black/60 {showClock ? 'text-emerald-100' : 'text-emerald-100/40'}"
    title="Toggle time &amp; date overlay (c)"
    on:click={() => (showClock = !showClock)}
  >◷</button>
  <button
    class="overlay-panel flex h-8 w-8 items-center justify-center text-sm text-emerald-100/80 transition-colors hover:bg-black/60 {showHelp ? 'text-emerald-100' : 'text-emerald-100/40'}"
    title="Toggle controls (/)"
    on:click={() => (showHelp = !showHelp)}
  >?</button>
  <button
    class="overlay-panel flex h-8 w-8 items-center justify-center text-sm text-emerald-100/80 transition-colors hover:bg-black/60 {showMenus ? 'text-emerald-100' : 'text-emerald-100/40'}"
    title="Toggle menus (m)"
    on:click={() => (showMenus = !showMenus)}
  >☰</button>
</div>

{#if showMenus}
  <div class="pointer-events-none fixed left-4 top-4 flex items-center gap-2 text-xs font-medium text-emerald-100/80">
    <span class="overlay-panel px-3 py-1">Aquarium Simulator</span>
    <span class="overlay-panel px-2 py-1 font-mono text-emerald-200/70">{sizeLabel}</span>
  </div>

  <div class="fixed left-4 top-12 flex items-center gap-2 text-xs text-emerald-100/70">
    <div class="overlay-panel flex items-center gap-0.5 p-1">
      {#each DENSITY_PRESETS as preset (preset.id)}
        <button
          class="rounded px-2 py-0.5 font-medium transition-colors {density === preset.id
            ? 'bg-emerald-500/25 text-emerald-100'
            : 'text-emerald-100/60 hover:bg-white/5 hover:text-emerald-100/80'}"
          title="Dot density: {preset.description} ({preset.key})"
          on:click={() => setDensity(preset.id)}
        >{preset.label}</button>
      {/each}
    </div>
    <button
      class="overlay-panel px-3 py-1.5 font-medium transition-colors hover:bg-black/60 {isPortrait ? 'bg-emerald-500/25' : ''}"
      title="Toggle orientation (p); ?portrait=1 forces the 80×106 device view"
      on:click={() => setPortrait(!isPortrait)}
    >{isPortrait ? "Portrait" : "Landscape"}</button>
    <button
      class="overlay-panel px-3 py-1.5 font-medium transition-colors hover:bg-black/60 {renderStyle === RENDER_STYLES.SQUARES ? 'bg-emerald-500/25' : ''}"
      title="Render style (s): dots = soft circles · pixels = crisp nearest-neighbour"
      on:click={toggleRenderStyle}
    >{renderStyle === RENDER_STYLES.DOTS ? "Dots" : "Pixels"}</button>
    <button
      class="overlay-panel px-3 py-1.5 font-medium transition-colors hover:bg-black/60"
      title="Add a fish (+ or a)"
      on:click={() => addFish(1)}
    >+ Fish</button>
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
{/if}

{#if showHelp}
  <div class="fixed inset-0 z-30 flex items-center justify-center p-4">
    <button
      class="absolute inset-0 h-full w-full cursor-default bg-black/50 backdrop-blur-sm"
      aria-label="Close controls"
      on:click={() => (showHelp = false)}
    ></button>
    <div
      class="overlay-panel relative z-10 w-full max-w-sm p-5 text-emerald-100/80"
      role="dialog"
      aria-label="Controls"
    >
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-semibold tracking-wide text-emerald-100">Controls</h2>
        <button
          class="text-emerald-100/60 transition-colors hover:text-emerald-100"
          title="Close (/ or Esc)"
          on:click={() => (showHelp = false)}
        >✕</button>
      </div>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        {#each CONTROL_HELP as item (item.action)}
          <dt class="font-mono text-emerald-200/80">{item.keys}</dt>
          <dd>{item.action}</dd>
        {/each}
      </dl>
    </div>
  </div>
{/if}