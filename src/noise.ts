/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class PerlinNoise {
  private perm = new Uint8Array(512);

  constructor(seed: number) {
    this.reseed(seed);
  }

  reseed(seed: number) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    let s = seed;
    // Linear congruential generator to shuffle
    for (let i = 255; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      const j = (s >>> 0) % (i + 1);
      const temp = p[i];
      p[i] = p[j];
      p[j] = temp;
    }

    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = this.fade(xf);
    const v = this.fade(yf);

    const p = this.perm;
    const a = p[X] + Y;
    const b = p[X + 1] + Y;

    const n00 = this.grad(p[a], xf, yf, 0);
    const n10 = this.grad(p[b], xf - 1, yf, 0);
    const n01 = this.grad(p[a + 1], xf, yf - 1, 0);
    const n11 = this.grad(p[b + 1], xf - 1, yf - 1, 0);

    return this.lerp(this.lerp(n00, n10, u), this.lerp(n01, n11, u), v);
  }

  noise3D(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);

    const u = this.fade(xf);
    const v = this.fade(yf);
    const w = this.fade(zf);

    const p = this.perm;
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;

    const n000 = this.grad(p[AA], xf, yf, zf);
    const n100 = this.grad(p[BA], xf - 1, yf, zf);
    const n010 = this.grad(p[AB], xf, yf - 1, zf);
    const n110 = this.grad(p[BB], xf - 1, yf - 1, zf);
    const n001 = this.grad(p[AA + 1], xf, yf, zf - 1);
    const n101 = this.grad(p[BA + 1], xf - 1, yf, zf - 1);
    const n011 = this.grad(p[AB + 1], xf, yf - 1, zf - 1);
    const n111 = this.grad(p[BB + 1], xf - 1, yf - 1, zf - 1);

    return this.lerp(
      this.lerp(this.lerp(n000, n100, u), this.lerp(n010, n110, u), v),
      this.lerp(this.lerp(n001, n101, u), this.lerp(n011, n111, u), v),
      w
    );
  }

  fbm2D(x: number, y: number, octaves = 4, lacunarity = 2.0, gain = 0.5): number {
    let total = 0;
    let amplitude = 1.0;
    let frequency = 1.0;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += amplitude * this.noise2D(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  fbm3D(x: number, y: number, z: number, octaves = 3, lacunarity = 2.0, gain = 0.5): number {
    let total = 0;
    let amplitude = 1.0;
    let frequency = 1.0;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += amplitude * this.noise3D(x * frequency, y * frequency, z * frequency);
      maxValue += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }
}
