/**
 * Small seeded PRNG used to keep simulations reproducible across reruns.
 * The current engine uses it for request inter-arrival generation.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next() {
    this.state += 0x6d2b79f5;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  exponential(lambdaPerSecond: number) {
    if (lambdaPerSecond <= 0) {
      return Number.POSITIVE_INFINITY;
    }

    const u = 1 - this.next();
    return (-Math.log(u) / lambdaPerSecond) * 1000;
  }
}
