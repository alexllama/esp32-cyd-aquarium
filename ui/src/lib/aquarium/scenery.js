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
      const radius = Math.max(1, Math.round(this.rng.float(1.1, 2.4) * this.unit));
      const x = Math.round(this.rng.float(radius, Math.max(radius + 1, this.width - radius)));
      const baseY = this.floorBaseY(x);
      this.rocks.push({
        x,
        y: baseY - Math.floor(radius * 0.35),
        radius,
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
        return { radius: Math.max(1, Math.round(unit * this.rng.float(1.2, 2.4))) };
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
          cap: Math.max(1, Math.round(unit * this.rng.float(1.3, 2.3))),
          sway: unit * this.rng.float(0.4, 1.0),
        };
      default: {
        const tentacles = this.rng.int(6, 12);
        return {
          tentacles,
          lengths: Array.from({ length: tentacles }, () => unit * this.rng.float(1.4, 3.0)),
          sway: unit * this.rng.float(0.7, 1.5),
        };
      }
    }
  }

  floorBaseY(x) {
    const index = clamp(Math.round(x), 0, Math.max(0, this.width - 1));
    return this.crest[index] ?? this.floorTop;
  }

  update({ framebuffer, now = 0 } = {}) {
    if (!framebuffer?.background) {
      throw new Error("AquariumScenery.update requires a framebuffer with a background layer");
    }

    this.resize(framebuffer.width, framebuffer.height);
    const layer = framebuffer.background;
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
      layer.fillCircle(rock.x, rock.y, rock.radius, rock.color);
      layer.fillCircle(
        rock.x - rock.radius * 0.35,
        rock.y - rock.radius * 0.45,
        Math.max(1, rock.radius * 0.45),
        shade(rock.color, 1.28),
      );
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
      layer.fillCircle(endX, endY, Math.max(1, this.unit * 0.45), tip);
    }
    layer.fillCircle(x, baseY - height, Math.max(1, this.unit * 0.5), tip);
  }

  drawFanCoral(layer, { x, baseY, color, params, phase }, now) {
    const { radius, rays, sway } = params;
    const tip = shade(color, 1.32);
    const stalkTop = baseY - Math.round(radius * 0.35);
    const wave = Math.sin(now * 0.0011 + phase) * sway;
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
    const ridgeColor = shade(color, 0.68);
    for (let dy = -radius; dy <= 0; dy += 1) {
      const half = Math.round(Math.sqrt(Math.max(0, radius * radius - dy * dy)));
      for (let dx = -half; dx <= half; dx += 1) {
        const ridge = (dx + dy) % 3 === 0;
        layer.setPixel(x + dx, baseY + dy, ridge ? ridgeColor : color);
      }
    }
    layer.fillCircle(x - radius * 0.35, baseY - radius * 0.6, Math.max(1, radius * 0.32), shade(color, 1.2));
  }

  drawTubeCoral(layer, { x, baseY, color, params }) {
    const { tubes, heights } = params;
    const tip = shade(color, 1.28);
    for (let index = 0; index < tubes; index += 1) {
      const offset = Math.round((index - (tubes - 1) / 2) * this.unit * 0.9);
      const tubeX = x + offset;
      const top = baseY - (heights[index] ?? this.unit);
      layer.drawLine(tubeX, baseY, tubeX, top, color);
      layer.fillCircle(tubeX, top, Math.max(1, this.unit * 0.5), tip);
    }
  }

  drawMushroomCoral(layer, { x, baseY, color, params, phase }, now) {
    const { stalk, cap, sway } = params;
    const wave = Math.sin(now * 0.0016 + phase) * sway;
    const capX = Math.round(x + wave);
    const capY = baseY - stalk;
    layer.drawLine(x, baseY, capX, capY, shade(color, 0.85));
    layer.fillCircle(capX, capY, cap, color);
    layer.fillCircle(capX - cap * 0.3, capY - cap * 0.35, Math.max(1, cap * 0.5), shade(color, 1.22));
  }

  drawAnemone(layer, { x, baseY, color, params, phase }, now) {
    const { tentacles, lengths, sway } = params;
    const tip = shade(color, 1.4);
    const baseColor = shade(color, 0.65);
    layer.fillCircle(x, baseY - Math.round(this.unit * 0.2), Math.max(1, this.unit * 0.8), baseColor);
    for (let index = 0; index < tentacles; index += 1) {
      const t = tentacles === 1 ? 0.5 : index / (tentacles - 1);
      const angle = -Math.PI * (0.05 + 0.9 * t);
      const length = lengths[index] ?? this.unit;
      const wave = Math.sin(now * 0.0021 + phase + index * 0.6) * sway;
      const endX = x + Math.cos(angle) * length + wave;
      const endY = baseY + Math.sin(angle) * length - Math.abs(wave) * 0.35;
      layer.drawLine(x, baseY - Math.round(this.unit * 0.3), endX, endY, color);
      layer.fillCircle(endX, endY, Math.max(1, this.unit * 0.4), tip);
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
