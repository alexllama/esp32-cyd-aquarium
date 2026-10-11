import { blendPackedOver } from "./framebuffer.js";

export const DAYNIGHT = Object.freeze({
  duskStartHour: 19,
  nightStartHour: 20,
  dawnStartHour: 6,
  dayStartHour: 7,
  backgroundScale: 0.28,
  foregroundScale: 0.7,
});

export const computeNightness = (date = new Date()) => {
  const hour = date.getHours() + date.getMinutes() / 60;
  const { duskStartHour, nightStartHour, dawnStartHour, dayStartHour } = DAYNIGHT;

  if (hour >= nightStartHour || hour < dawnStartHour) {
    return 1;
  }
  if (hour >= duskStartHour && hour < nightStartHour) {
    return (hour - duskStartHour) / (nightStartHour - duskStartHour);
  }
  if (hour >= dawnStartHour && hour < dayStartHour) {
    return 1 - (hour - dawnStartHour) / (dayStartHour - dawnStartHour);
  }
  return 0;
};

const buildChannelLut = (scale) => {
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) {
    lut[i] = Math.round(i * scale);
  }
  return lut;
};

const scalePacked = (packed, lut) => {
  if (packed === 0) {
    return 0;
  }
  const alpha = (packed >>> 24) & 0xff;
  return (
    ((alpha << 24) |
      (lut[(packed >>> 16) & 0xff] << 16) |
      (lut[(packed >>> 8) & 0xff] << 8) |
      lut[packed & 0xff]) >>>
    0
  );
};

export const applyNightTint = (framebuffer, nightness) => {
  const clamped = clampUnit(nightness);
  const backgroundScale = 1 - (1 - DAYNIGHT.backgroundScale) * clamped;
  const foregroundScale = 1 - (1 - DAYNIGHT.foregroundScale) * clamped;
  const backgroundLut = buildChannelLut(backgroundScale);
  const foregroundLut = buildChannelLut(foregroundScale);

  const background = framebuffer.background.pixels;
  const foreground = framebuffer.foreground.pixels;
  const output = framebuffer.composite;

  for (let i = 0; i < output.length; i += 1) {
    const back = scalePacked(background[i], backgroundLut);
    const front = foreground[i];
    output[i] = front === 0 ? back : blendPackedOver(back, scalePacked(front, foregroundLut));
  }

  framebuffer.clearForeground();
  return output;
};

const clampUnit = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.min(1, number));
};

export default { DAYNIGHT, computeNightness, applyNightTint };
