import { MOTION_PROFILES, MOTION_TYPES } from "../constants.js";
import { Motion } from "./base-motion.js";

export class AngelfishMotion extends Motion {
  constructor(position, xResolution, yResolution, options = {}) {
    super(position, xResolution, yResolution, {
      ...options,
      type: MOTION_TYPES.ANGELFISH,
      profile: MOTION_PROFILES[MOTION_TYPES.ANGELFISH],
    });
  }

  doMotion(now) {
    this.frontSineMotion(now);
    this.noiseMotion();
  }
}

export class ClownfishMotion extends Motion {
  constructor(position, xResolution, yResolution, options = {}) {
    super(position, xResolution, yResolution, {
      ...options,
      type: MOTION_TYPES.CLOWNFISH,
      profile: MOTION_PROFILES[MOTION_TYPES.CLOWNFISH],
    });
  }

  doMotion(now) {
    this.sideSineMotion(now);
    this.noiseMotion();
  }
}

export class NeonTetraMotion extends Motion {
  constructor(position, xResolution, yResolution, options = {}) {
    super(position, xResolution, yResolution, {
      ...options,
      type: MOTION_TYPES.NEON_TETRA,
      profile: MOTION_PROFILES[MOTION_TYPES.NEON_TETRA],
    });
  }

  doMotion(now) {
    this.sideSineMotion(now);
    this.noiseMotion();
  }
}

export const TROPICAL_MOTION_CONSTRUCTORS = Object.freeze({
  [MOTION_TYPES.ANGELFISH]: AngelfishMotion,
  [MOTION_TYPES.CLOWNFISH]: ClownfishMotion,
  [MOTION_TYPES.NEON_TETRA]: NeonTetraMotion,
});

export default { AngelfishMotion, ClownfishMotion, NeonTetraMotion };
