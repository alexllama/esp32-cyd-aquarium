export const AUTO_FEED = Object.freeze({
  PER_FISH: 2,
});

export const feedCountForFish = (fishCount) =>
  Math.max(0, Math.floor(Number(fishCount) || 0)) * AUTO_FEED.PER_FISH;

export const hourKey = (date = new Date()) =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}`;

export class HourlyFeeder {
  constructor({ onFeed } = {}) {
    this.onFeed = typeof onFeed === "function" ? onFeed : null;
    this.lastKey = null;
  }

  reset(date = new Date()) {
    this.lastKey = hourKey(date);
    return this.lastKey;
  }

  update(date = new Date()) {
    const key = hourKey(date);
    if (this.lastKey === null) {
      this.lastKey = key;
      return false;
    }
    if (key === this.lastKey) {
      return false;
    }
    this.lastKey = key;
    this.onFeed?.();
    return true;
  }
}

export const createHourlyFeeder = (options = {}) => new HourlyFeeder(options);

export default { AUTO_FEED, feedCountForFish, hourKey, HourlyFeeder, createHourlyFeeder };
