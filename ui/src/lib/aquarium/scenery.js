import { SCENERY } from "./constants.js";
import { createSeededRandom } from "./random.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const lerp = (a, b, t) => Math.round(a + (b - a) * t);

const smoothstep = (t) => t * t * (3 - 2 * t);

const mixColor = (from, to, t) => ({
  r: lerp(from.r, to.r, t),
  g: lerp(from.g, to.g, t),
  b: lerp(from.b, to.b, t),
  a: 255,
});

const shade = (color, factor) => ({
  r: clamp(Math.round(color.r * factor), 0, 255),
  g: clamp(Math.round(color.g * factor), 0, 255),
  b: clamp(Math.round(color.b * factor), 0, 255),
  a: 255,
});

export class AquariumScenery {
  constructor(options = {}) {
    this.rngSeed = options.rngSeed ?? 0xc07a1e;
    this.rng = createSeededRandom(this.rngSeed);
    this.width = 0;
    this.height = 0;
    this.unit = 1;
    this.floorHeight = 0;
    this.floorTop = 0;
    this.crest = [];
    this.speckles = [];
    this.corals = [];
    this.rocks = [];
    this.resize(options.width ?? 0, options.height ?? 0);
  }

  resize(width, height) {
    const nextWidth = Math.max(0, Math.floor(width));
    const nextHeight = Math.max(0, Math.floor(height));
    if (nextWidth === this.width && nextHeight === this.height && this.corals.length) {
      return this;
    }
    this.width = nextWidth;
    this.height = nextHeight;
    this.rng = createSeededRandom(this.rngSeed);
    this.build();
    return this;
  }

  build() {
    this.corals = [];
    this.rocks = [];
    this.speckles = [];
    this.crest = [];
    if (this.width <= 0 || this.height <= 0) return this;

    this.unit = clamp(Math.round(this.height / 34), 1, 8);
    this.floorHeight = clamp(
      Math.round(this.height * SCENERY.FLOOR_HEIGHT_FRACTION),
      SCENERY.FLOOR_MIN_PX,
      Math.max(SCENERY.FLOOR_MIN_PX, Math.round(this.height * SCENERY.FLOOR_MAX_FRACTION)),
    );
    this.floorTop = this.height - this.floorHeight;

    this.buildTerrain();
    this.buildSpeckles();
    this.buildRocks();
    this.buildCorals();
    return this;
  }

  makeNoise(spacing, amplitude) {
    const count = Math.max(2, Math.ceil(this.width / spacing) + 2);
    const values = Array.from({ length: count }, () => this.rng.float(-1, 1));
    return (x) => {
      const t = x / spacing;
      const index = Math.floor(t);
      const fraction = smoothstep(t - index);
      const a = values[clamp(index, 0, count - 1)] ?? 0;
      const b = values[clamp(index + 1, 0, count - 1)] ?? 0;
      return (a + (b - a) * fraction) * amplitude;
    };
  }

  buildTerrain() {
    const octaves = [
      { spacing: Math.max(10, this.width * 0.62), amp: 1 },
      { spacing: Math.max(7, this.width * 0.3), amp: 0.55 },
      { spacing: Math.max(5, this.width * 0.14), amp: 0.3 },
      { spacing: Math.max(3, this.width * 0.06), amp: 0.16 },
    ].map(({ spacing, amp }) => this.makeNoise(spacing, amp));

    const raw = new Array(this.width);
    let minValue = Number.POSITIVE_INFINITY;
    let maxValue = Number.NEGATIVE_INFINITY;
    for (let x = 0; x < this.width; x += 1) {
      let value = 0;
      for (const octave of octaves) value += octave(x);
      raw[x] = value;
      minValue = Math.min(minValue, value);
      maxValue = Math.max(maxValue, value);
    }

    const range = maxValue - minValue;
    const amplitude = Math.max(1, this.floorHeight * 0.5);
    for (let x = 0; x < this.width; x += 1) {
      const norm = range > 0 ? (raw[x] - minValue) / range : 0.5;
      const mound = norm * 2 - 1;
      const y = Math.round(this.floorTop - mound * amplitude);
      this.crest[x] = clamp(y, Math.max(1, this.floorTop - this.floorHeight), this.height - 1);
    }
  }

  buildSpeckles() {
    const count = Math.round(this.width * this.floorHeight * 0.06);
    for (let index = 0; index < count; index += 1) {
      const x = this.rng.int(0, this.width);
      const top = this.crest[x] ?? this.floorTop;
      const y = this.rng.int(top + 1, Math.max(top + 2, this.height));
      this.speckles.push({
        x,
        y,
        color: this.rng.next() < 0.5 ? SCENERY.SAND_SPECKLE_LIGHT : SCENERY.SAND_SPECKLE_DARK,
      });
    }
  }

  buildRocks() {
    const count = clamp(
      Math.round(this.width / SCENERY.ROCK_SPACING),
      SCENERY.ROCK_MIN,
      SCENERY.ROCK_MAX,
    );
    for (let index = 0; index < count; index += 1) {
      const half = Math.max(1, Math.round(this.rng.float(1.2, 2.6) * this.unit));
      const x = Math.round(this.rng.float(half, Math.max(half + 1, this.width - half)));
      const baseY = this.floorBaseY(x);
      const height = Math.max(1, Math.round(this.rng.float(0.6, 1.3) * this.unit));
      const rows = [];
      for (let row = 0; row < height; row += 1) {
        const t = height === 1 ? 0 : row / (height - 1);
        const taper = Math.sqrt(Math.max(0, 1 - t * t * 0.85));
        rows.push(Math.max(1, Math.round(half * taper * this.rng.float(0.7, 1.05))));
      }
      this.rocks.push({
        x,
        baseY,
        rows,
        color: SCENERY.ROCK_COLORS[this.rng.int(0, SCENERY.ROCK_COLORS.length)],
      });
    }
  }

  buildCorals() {
    const count = clamp(
      Math.round(this.width / SCENERY.CORAL_SPACING),
      SCENERY.CORAL_MIN,
      SCENERY.CORAL_MAX,
    );
    for (let index = 0; index < count; index += 1) {
      const x = Math.round((this.width * (index + 0.5)) / count + this.rng.float(-2, 2) * this.unit);
      if (x < 1 || x > this.width - 2) continue;
      const type = SCENERY.CORAL_TYPES[this.rng.int(0, SCENERY.CORAL_TYPES.length)];
      const isAnemone = type === "anemone";
      this.corals.push({
        type,
        x,
        baseY: this.floorBaseY(x),
        color: (isAnemone ? SCENERY.ANEMONE_COLORS : SCENERY.CORAL_COLORS)[
          this.rng.int(0, isAnemone ? SCENERY.ANEMONE_COLORS.length : SCENERY.CORAL_COLORS.length)
        ],
        phase: this.rng.float(0, Math.PI * 2),
        params: this.buildCoralParams(type),
      });
    }
  }

  buildCoralParams(type) {
    const unit = this.unit;
    switch (type) {
      case "branch":
        return {
          height: Math.round(unit * this.rng.float(2.6, 5.4)),
          forks: this.rng.int(2, 5),
        };
      case "fan":
        return {
          radius: Math.round(unit * this.rng.float(1.8, 3.4)),
          rays: this.rng.int(4, 8),
          sway: unit * this.rng.float(0.3, 0.8),
        };
      case "brain":
        return { radius: Math.max(1, Math.round(unit * this.rng.float(1.0, 1.9))) };
      case "tube": {
        const tubes = this.rng.int(3, 6);
        return {
          tubes,
          heights: Array.from({ length: tubes }, () => Math.round(unit * this.rng.float(1.2, 3.0))),
        };
      }
      case "mushroom":
        return {
          stalk: Math.round(unit * this.rng.float(1.4, 2.8)),
          cap: Math.max(1, Math.round(unit * this.rng.float(1.0, 1.8))),
          sway: unit * this.rng.float(0.4, 1.0),
        };
      default: {
        const tentacles = this.rng.int(7, 13);
        return {
          tentacles,
          lengths: Array.from({ length: tentacles }, () => unit * this.rng.float(2.4, 4.4)),
          sway: unit * this.rng.float(0.8, 1.7),
        };
      }
    }
  }

  floorBaseY(x) {
    const index = clamp(Math.round(x), 0, Math.max(0, this.width - 1));
    return this.crest[index] ?? this.floorTop;
  }

  update({ framebuffer, now = 0 } = {}) {
    if (!framebuffer?.foreground) {
      throw new Error("AquariumScenery.update requires a framebuffer with a foreground layer");
    }

    this.resize(framebuffer.width, framebuffer.height);
    const layer = framebuffer.foreground;
    this.drawSand(layer);
    this.drawRocks(layer);
    this.drawCorals(layer, now);
    return this.getDebugSnapshot();
  }

  drawSand(layer) {
    const { width, height, floorHeight, floorTop } = this;
    const span = Math.max(1, floorHeight - 1);
    for (let x = 0; x < width; x += 1) {
      const top = this.crest[x] ?? floorTop;
      for (let y = top; y < height; y += 1) {
        layer.setPixel(x, y, mixColor(SCENERY.SAND_TOP, SCENERY.SAND_BOTTOM, clamp((y - top) / span, 0, 1)));
      }
      layer.setPixel(x, top, SCENERY.SAND_CREST);
    }
    for (const speckle of this.speckles) {
      layer.setPixel(speckle.x, speckle.y, speckle.color);
    }
  }

  drawRocks(layer) {
    for (const rock of this.rocks) {
      const { x, baseY, rows, color } = rock;
      const light = shade(color, 1.28);
      const dark = shade(color, 0.72);
      const capRow = Math.max(1, Math.round(rows.length * 0.55));
      for (let row = 0; row < rows.length; row += 1) {
        const half = rows[row];
        const y = baseY - row;
        layer.fillRect(x - half, y, half * 2 + 1, 1, row >= capRow ? light : color);
      }
      layer.fillRect(x - rows[0], baseY, rows[0] * 2 + 1, 1, dark);
    }
  }

  drawCorals(layer, now) {
    for (const coral of this.corals) {
      switch (coral.type) {
        case "fan":
          this.drawFanCoral(layer, coral, now);
          break;
        case "brain":
          this.drawBrainCoral(layer, coral);
          break;
        case "tube":
          this.drawTubeCoral(layer, coral);
          break;
        case "mushroom":
          this.drawMushroomCoral(layer, coral, now);
          break;
        case "anemone":
          this.drawAnemone(layer, coral, now);
          break;
        default:
          this.drawBranchCoral(layer, coral);
          break;
      }
    }
  }

  drawBranchCoral(layer, { x, baseY, color, params }) {
    const { height, forks } = params;
    const tip = shade(color, 1.32);
    layer.drawLine(x, baseY, x, baseY - height, color);
    for (let fork = 0; fork < forks; fork += 1) {
      const originT = 0.35 + (0.6 * fork) / Math.max(1, forks);
      const originY = baseY - height * Math.min(0.95, originT);
      const direction = fork % 2 === 0 ? -1 : 1;
      const length = height * (0.4 + 0.16 * (fork % 3));
      const midX = x + direction * length * 0.5;
      const midY = originY - length * 0.5;
      const endX = x + direction * length * (0.7 + 0.12 * fork);
      const endY = originY - length;
      layer.drawLine(x, originY, midX, midY, color);
      layer.drawLine(midX, midY, endX, endY, color);
      layer.fillCircle(endX, endY, Math.max(1, Math.round(this.unit * 0.35)), tip);
    }
    layer.fillCircle(x, baseY - height, Math.max(1, Math.round(this.unit * 0.4)), tip);
  }

  drawFanCoral(layer, { x, baseY, color, params, phase }, now) {
    const { radius, rays, sway } = params;
    const tip = shade(color, 1.32);
    const stalkTop = baseY - Math.round(radius * 0.35);
    const wave = Math.sin(now * 0.0011 * SCENERY.SWAY_SPEED + phase) * sway;
    layer.drawLine(x, baseY, x, stalkTop, color);
    for (let ray = 0; ray < rays; ray += 1) {
      const t = rays === 1 ? 0.5 : ray / (rays - 1);
      const angle = -Math.PI * (0.14 + 0.72 * t);
      const endX = x + Math.cos(angle) * radius + wave * (0.4 + t);
      const endY = stalkTop + Math.sin(angle) * radius;
      layer.drawLine(x, stalkTop, endX, endY, color);
      layer.fillCircle(endX, endY, 1, tip);
    }
  }

  drawBrainCoral(layer, { x, baseY, color, params }) {
    const radius = params.radius;
    const height = Math.max(1, Math.round(radius * 0.6));
    const ridgeColor = shade(color, 0.68);
    for (let dy = -height; dy <= 0; dy += 1) {
      const ny = dy / height;
      const half = Math.round(radius * Math.sqrt(Math.max(0, 1 - ny * ny)));
      for (let dx = -half; dx <= half; dx += 1) {
        const ridge = (dx + dy) % 3 === 0;
        layer.setPixel(x + dx, baseY + dy, ridge ? ridgeColor : color);
      }
    }
    layer.fillCircle(x - radius * 0.3, baseY - height * 0.55, Math.max(1, radius * 0.2), shade(color, 1.2));
  }

  drawTubeCoral(layer, { x, baseY, color, params }) {
    const { tubes, heights } = params;
    const tip = shade(color, 1.28);
    for (let index = 0; index < tubes; index += 1) {
      const offset = Math.round((index - (tubes - 1) / 2) * this.unit * 0.9);
      const tubeX = x + offset;
      const top = baseY - (heights[index] ?? this.unit);
      layer.drawLine(tubeX, baseY, tubeX, top, color);
      layer.fillCircle(tubeX, top, Math.max(1, Math.round(this.unit * 0.4)), tip);
    }
  }

  drawMushroomCoral(layer, { x, baseY, color, params, phase }, now) {
    const { stalk, cap, sway } = params;
    const wave = Math.sin(now * 0.0016 * SCENERY.SWAY_SPEED + phase) * sway;
    const capX = Math.round(x + wave);
    const capY = baseY - stalk;
    const capHeight = Math.max(1, Math.round(cap * 0.55));
    layer.drawLine(x, baseY, capX, capY, shade(color, 0.85));
    const rim = shade(color, 0.7);
    for (let dy = 0; dy <= capHeight; dy += 1) {
      const t = dy / capHeight;
      const half = Math.round(cap * Math.sqrt(Math.max(0, 1 - t * t)));
      layer.fillRect(capX - half, capY - dy, half * 2 + 1, 1, dy === 0 ? rim : color);
    }
    layer.fillCircle(
      capX - Math.round(cap * 0.3),
      capY - Math.round(capHeight * 0.6),
      Math.max(1, Math.round(cap * 0.22)),
      shade(color, 1.2),
    );
  }

  drawAnemone(layer, { x, baseY, color, params, phase }, now) {
    const { tentacles, lengths, sway } = params;
    const tip = shade(color, 1.45);
    const stem = shade(color, 0.6);
    const footRadius = Math.max(1, Math.round(this.unit * 0.5));
    const footTop = baseY - Math.round(this.unit * 0.4);
    const originY = footTop - Math.round(this.unit * 0.3);
    layer.fillCircle(x, footTop, footRadius, stem);
    layer.drawLine(x, baseY, x, originY, stem);
    for (let index = 0; index < tentacles; index += 1) {
      const t = tentacles === 1 ? 0.5 : index / (tentacles - 1);
      const angle = -Math.PI * (0.2 + 0.6 * t);
      const length = lengths[index] ?? this.unit;
      const wave = Math.sin(now * 0.0021 * SCENERY.SWAY_SPEED + phase + index * 0.6) * sway;
      const originX = x + (t - 0.5) * footRadius * 1.6;
      const endX = x + Math.cos(angle) * length + wave;
      const endY = originY + Math.sin(angle) * length - Math.abs(wave) * 0.35;
      layer.drawLine(originX, originY, endX, endY, color);
      layer.fillCircle(endX, endY, Math.max(1, Math.round(this.unit * 0.25)), tip);
    }
  }

  getDebugSnapshot() {
    return {
      scenery: {
        floorHeight: this.floorHeight,
        unit: this.unit,
        corals: this.corals.length,
        rocks: this.rocks.length,
      },
    };
  }
}

export const createAquariumScenery = (options = {}) => new AquariumScenery(options);

export default AquariumScenery;
