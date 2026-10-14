import { FOOD } from "./constants.js";

export const AUTO_FEED = Object.freeze({
  PER_FISH: 2,
  INTERVAL_MS: FOOD.INTERVAL_MS,
});

export const feedCountForFish = (fishCount) =>
  Math.max(0, Math.floor(Number(fishCount) || 0)) * AUTO_FEED.PER_FISH;

export const hourKey = (date = new Date()) =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}`;

export class HourlyFeeder {
  constructor({ countProvider, onDrop, intervalMs = AUTO_FEED.INTERVAL_MS } = {}) {
    this.countProvider = typeof countProvider === "function" ? countProvider : () => 0;
    this.onDrop = typeof onDrop === "function" ? onDrop : null;
    this.intervalMs = intervalMs;
    this.lastKey = null;
    this.pending = 0;
    this.nextDropTime = 0;
  }

  reset(date = new Date()) {
    this.lastKey = hourKey(date);
    this.pending = 0;
    return this.lastKey;
  }

  update(date = new Date(), now = 0) {
    const key = hourKey(date);
    if (this.lastKey === null) {
      this.lastKey = key;
    } else if (key !== this.lastKey) {
      this.lastKey = key;
      this.pending = Math.max(0, Math.floor(Number(this.countProvider()) || 0));
      this.nextDropTime = now;
    }

    let dropped = 0;
    while (this.pending > 0 && now >= this.nextDropTime) {
      this.onDrop?.(1);
      this.pending -= 1;
      this.nextDropTime += this.intervalMs;
      dropped += 1;
    }

    return dropped;
  }
}

export const createHourlyFeeder = (options = {}) => new HourlyFeeder(options);

export default { AUTO_FEED, feedCountForFish, hourKey, HourlyFeeder, createHourlyFeeder };
