import { AGE, BODY_TYPES } from "../constants.js";
import { createSeededRandom } from "../random.js";
import { Vector2 } from "../vector.js";
import { ColorPalette } from "./color-palette.js";
import { createFin } from "./fin.js";
import { FishBody } from "./fish-body.js";
import { createHead } from "./head.js";
import { createTail } from "./tail.js";
import { asVector, getForeground } from "./utils.js";

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(Number(value) || 0)));

export class SpeciesPalette extends ColorPalette {
  constructor(colorsHSV, rng = createSeededRandom()) {
    super(colorsHSV.length, { rng });
    this.setColors(colorsHSV);
  }

  setColors(colorsHSV = []) {
    super.setColors(colorsHSV);
    this.baseColors = this.colorsHSV.map((color) => ({ ...color }));
    return this;
  }

  adjustColorByAgeAndHealth(age, health) {
    let ageFactor = 1;
    if (age >= AGE.AGE_ADULT) {
      ageFactor = 1 - ((age - AGE.AGE_ADULT) / (AGE.AGE_DEAD - AGE.AGE_ADULT)) * 0.35;
    }

    const healthFactor = 0.6 + 0.4 * health;
    this.colorsHSV = this.baseColors.map((color) => ({
      h: color.h,
      s: clampByte(color.s * healthFactor),
      v: clampByte(color.v * ageFactor * healthFactor),
    }));

    this.updateRGB();
    return this.colors;
  }
}

const CLOWNFISH_SEGMENTS = [4, 5, 5, 4, 3];
const CLOWNFISH_COLORS = [
  { h: 18, s: 235, v: 255 },
  { h: 0, s: 0, v: 255 },
  { h: 18, s: 235, v: 255 },
  { h: 0, s: 0, v: 255 },
  { h: 18, s: 235, v: 255 },
];

export class ClownfishBody extends FishBody {
  constructor({ rng = createSeededRandom() } = {}) {
    super({
      rng,
      head: createHead("TriangleHead", { rng }),
      tail: createTail("TriangleTail", { rng }),
      fin: createFin("RoundFin", { rng }),
    });
    this.segments = [...CLOWNFISH_SEGMENTS];
    this.segmentPositions = this.segments.map(() => new Vector2());
    this.gapBetweenSegments = 0.8;
    this.colorPalette = new SpeciesPalette(CLOWNFISH_COLORS, rng);
  }
}

const NEON_TETRA_SEGMENTS = [2, 3, 3, 3, 2];
const NEON_TETRA_COLORS = [
  { h: 150, s: 255, v: 255 },
  { h: 150, s: 255, v: 255 },
  { h: 150, s: 255, v: 255 },
  { h: 4, s: 255, v: 255 },
  { h: 4, s: 255, v: 255 },
];

export class NeonTetraBody extends FishBody {
  constructor({ rng = createSeededRandom() } = {}) {
    super({
      rng,
      head: createHead("TriangleHead", { rng }),
      tail: createTail("CurvyTail", { rng }),
      fin: createFin("EllipseFin", { rng }),
    });
    this.segments = [...NEON_TETRA_SEGMENTS];
    this.segmentPositions = this.segments.map(() => new Vector2());
    this.gapBetweenSegments = 0.75;
    this.colorPalette = new SpeciesPalette(NEON_TETRA_COLORS, rng);
  }
}

const ANGELFISH_SEGMENTS = [2, 3, 4, 3, 2];
const ANGELFISH_COLORS = [
  { h: 40, s: 34, v: 240 },
  { h: 220, s: 60, v: 60 },
  { h: 40, s: 34, v: 240 },
  { h: 220, s: 60, v: 60 },
  { h: 40, s: 34, v: 240 },
];

export class AngelfishBody extends FishBody {
  constructor({ rng = createSeededRandom() } = {}) {
    super({
      rng,
      head: createHead("TriangleHead", { rng }),
      tail: createTail("TriangleTail", { rng }),
      fin: createFin("EllipseFin", { rng }),
    });
    this.segments = [...ANGELFISH_SEGMENTS];
    this.segmentPositions = this.segments.map(() => new Vector2());
    this.gapBetweenSegments = 0.7;
    this.tallFactor = 2.3;
    this.colorPalette = new SpeciesPalette(ANGELFISH_COLORS, rng);
  }

  drawSegment(index, input, color, drawExtras, framebuffer) {
    const foreground = getForeground(framebuffer);
    const vin = asVector(input);
    const current = asVector(this.segmentPositions[index]);
    const diff = vin.subtract(current);
    const segmentAngle = diff.heading();
    const currentSegmentSize = this.segments[index] * this.size;

    if (index === 0) {
      this.segmentPositions[index] = new Vector2(
        vin.x - Math.cos(segmentAngle) * currentSegmentSize,
        vin.y - Math.sin(segmentAngle) * currentSegmentSize,
      );
    } else {
      const previousSegmentSize = this.segments[index - 1] * this.size;
      const maxSegmentSize = Math.max(previousSegmentSize, currentSegmentSize) * this.gapBetweenSegments;
      this.segmentPositions[index] = new Vector2(
        vin.x - Math.cos(segmentAngle) * maxSegmentSize,
        vin.y - Math.sin(segmentAngle) * maxSegmentSize,
      );
    }

    const position = this.segmentPositions[index];
    if (drawExtras && (index === 1 || index === 3)) {
      this.fin?.display({
        framebuffer,
        position,
        angle: segmentAngle,
        size: currentSegmentSize,
        color,
      });
    } else if (drawExtras && index === this.segments.length - 1) {
      this.tail?.display({
        framebuffer,
        position,
        angle: segmentAngle,
        size: currentSegmentSize * 2,
        color,
      });
    } else {
      foreground.drawCircleArray(
        position.x,
        position.y,
        Math.max(1, currentSegmentSize * this.tallFactor),
        Math.max(1, currentSegmentSize),
        segmentAngle,
        color,
      );
    }
  }
}

export const TROPICAL_BODY_CONSTRUCTORS = Object.freeze({
  [BODY_TYPES.ANGELFISH]: AngelfishBody,
  [BODY_TYPES.CLOWNFISH]: ClownfishBody,
  [BODY_TYPES.NEON_TETRA]: NeonTetraBody,
});

export default { AngelfishBody, ClownfishBody, NeonTetraBody, SpeciesPalette };
