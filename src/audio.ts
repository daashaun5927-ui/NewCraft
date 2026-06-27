/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BlockType } from "./types";

class AudioEngine {
  private ctx: AudioContext | null = null;
  private windNode: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windOsc: OscillatorNode | null = null;
  private isWindPlaying = false;
  private enabled = true;

  private init() {
    if (!this.ctx) {
      // Lazy load to comply with browser autoplay policy
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  toggle(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled && this.isWindPlaying) {
      this.stopWind();
    } else if (enabled && !this.isWindPlaying) {
      this.startWind();
    }
  }

  /**
   * Helper to create a buffer of pure white noise
   */
  private createNoiseBuffer(): AudioBuffer {
    this.init();
    const ctx = this.ctx!;
    const bufferSize = ctx.sampleRate * 1.5; // 1.5 seconds of noise
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Synthesizes a block-breaking crunch sound
   */
  playBreak(type: BlockType) {
    if (!this.enabled) return;
    try {
      this.init();
      const ctx = this.ctx!;
      const noise = ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer();

      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      // Style sound based on block type
      if (type === BlockType.GLASS) {
        // High pitch metallic glass shatter
        filter.type = "highpass";
        filter.frequency.setValueAtTime(2500, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      } else if (type === BlockType.STONE || type === BlockType.DIAMOND_ORE || type === BlockType.COAL_ORE || type === BlockType.IRON_ORE || type === BlockType.GOLD_ORE) {
        // Stone breaking: clunky low-pass crunch
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(150, ctx.currentTime);
        filter.Q.setValueAtTime(5.0, ctx.currentTime);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

        // Add a high-pitch transient for a stone impact chisel click
        const chisel = ctx.createOscillator();
        const chiselGain = ctx.createGain();
        chisel.type = "sine";
        chisel.frequency.setValueAtTime(600, ctx.currentTime);
        chisel.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08);
        chiselGain.gain.setValueAtTime(0.12, ctx.currentTime);
        chiselGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

        chisel.connect(chiselGain);
        chiselGain.connect(ctx.destination);
        chisel.start();
        chisel.stop(ctx.currentTime + 0.1);
      } else if (type === BlockType.OAK_LEAVES || type === BlockType.SPRUCE_LEAVES || type === BlockType.BIRCH_LEAVES || type === BlockType.JUNGLE_LEAVES || type === BlockType.GRASS) {
        // Leaves/Grass: quiet rustly high-frequency crunch
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(1000, ctx.currentTime);
        filter.Q.setValueAtTime(2.0, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      } else {
        // Dirt/Sand: dull low thud crunch
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(300, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      }

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
      noise.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.warn("Break sound playback failed", e);
    }
  }

  /**
   * Synthesizes a block-placing thud/pop sound
   */
  playPlace(type: BlockType) {
    if (!this.enabled) return;
    try {
      this.init();
      const ctx = this.ctx!;

      // Sine sweep for impact thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";

      if (type === BlockType.OAK_LEAVES || type === BlockType.SPRUCE_LEAVES || type === BlockType.BIRCH_LEAVES || type === BlockType.JUNGLE_LEAVES || type === BlockType.GRASS) {
        osc.frequency.setValueAtTime(140, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
      } else {
        osc.frequency.setValueAtTime(110, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
      }

      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      // Mix in some filtered noise for textural thud
      const noise = ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer();
      const noiseFilter = ctx.createBiquadFilter();
      const noiseGain = ctx.createGain();

      noiseFilter.type = "lowpass";
      noiseFilter.frequency.setValueAtTime(type === BlockType.SAND ? 400 : 180, ctx.currentTime);
      noiseGain.gain.setValueAtTime(0.15, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
      noise.start();
      noise.stop(ctx.currentTime + 0.12);
    } catch (e) {
      console.warn("Place sound playback failed", e);
    }
  }

  /**
   * Synthesizes a short footstep scuff
   */
  playFootstep(type: BlockType) {
    if (!this.enabled) return;
    try {
      this.init();
      const ctx = this.ctx!;
      const noise = ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer();

      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      filter.type = "bandpass";
      if (type === BlockType.STONE || type === BlockType.DIAMOND_ORE || type === BlockType.COAL_ORE) {
        filter.frequency.setValueAtTime(200, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
      } else if (type === BlockType.OAK_LEAVES || type === BlockType.GRASS) {
        filter.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
      } else {
        filter.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
      }

      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
      noise.stop(ctx.currentTime + 0.1);
    } catch (e) {
      // Silent error
    }
  }

  /**
   * Synthesizes a jump spring/whoosh
   */
  playJump() {
    if (!this.enabled) return;
    try {
      this.init();
      const ctx = this.ctx!;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(80, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(220, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      // Silent error
    }
  }

  /**
   * Starts a looping, procedurally modulated mountain wind ambient sound
   */
  startWind() {
    if (!this.enabled || this.isWindPlaying) return;
    try {
      this.init();
      const ctx = this.ctx!;

      // 1. Create noise source
      const noise = ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer();
      noise.loop = true;

      // 2. Filter to make it sound like deep wind
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(160, ctx.currentTime);
      filter.Q.setValueAtTime(3.0, ctx.currentTime);

      // 3. Gain
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.02, ctx.currentTime);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      // 4. Modulator: A very slow LFO that changes the cutoff frequency to simulate wind gusts!
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.12, ctx.currentTime); // 0.12 Hz - once every 8 seconds

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(80, ctx.currentTime); // sway cutoff by 80Hz

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency); // modulate cutoff directly!

      lfo.start();
      noise.start();

      this.windNode = filter;
      this.windGain = gain;
      this.windOsc = lfo;
      this.isWindPlaying = true;
    } catch (e) {
      console.warn("Ambient wind playback failed", e);
    }
  }

  stopWind() {
    if (!this.isWindPlaying) return;
    try {
      if (this.windGain) {
        this.windGain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + 0.5);
      }
      this.windOsc = null;
      this.windNode = null;
      this.windGain = null;
      this.isWindPlaying = false;
    } catch (e) {
      // Silent error
    }
  }
}

export const sound = new AudioEngine();
