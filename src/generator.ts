/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BlockType, BiomeType, WorldSettings, BIOME_CONFIGS } from "./types";
import { PerlinNoise } from "./noise";

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 64;

// Simple deterministic hash to get random-like values for a position
function hash2D(x: number, z: number, seed: number): number {
  const val = Math.sin(x * 12.9898 + z * 78.233 + seed) * 43758.5453123;
  return val - Math.floor(val);
}

export class TerrainGenerator {
  private noise: PerlinNoise;

  constructor(seed: number) {
    this.noise = new PerlinNoise(seed);
  }

  setSeed(seed: number) {
    this.noise.reseed(seed);
  }

  /**
   * Samples temperature and humidity to determine the biome.
   */
  getBiome(wx: number, wz: number, settings: WorldSettings): BiomeType {
    if (settings.biomeLock && settings.biomeLock !== "None") {
      return settings.biomeLock as BiomeType;
    }

    // Low-frequency noise for climate
    const scale = 0.003;
    const temp = this.noise.fbm2D(wx * scale, wz * scale, 3, 2.0, 0.5) * 0.5 + 0.5;
    const hum = this.noise.fbm2D((wx + 1000) * scale, (wz + 1000) * scale, 3, 2.0, 0.5) * 0.5 + 0.5;

    // Check height afterward for Mountains.
    // If we just want general flat/hilly biomes:
    if (temp < 0.25) {
      if (hum < 0.35) return BiomeType.TUNDRA;
      return BiomeType.SNOWY_TAIGA;
    } else if (temp < 0.45) {
      if (hum < 0.3) return BiomeType.PLAINS;
      if (hum < 0.75) return BiomeType.FOREST;
      return BiomeType.TAIGA;
    } else if (temp < 0.75) {
      if (hum < 0.25) return BiomeType.DESERT;
      if (hum < 0.45) return BiomeType.SAVANNA;
      if (hum < 0.8) return BiomeType.FOREST;
      return BiomeType.DARK_FOREST;
    } else {
      // Hot
      if (hum < 0.2) return BiomeType.BADLANDS;
      if (hum < 0.4) return BiomeType.SAVANNA;
      if (hum < 0.7) return BiomeType.JUNGLE;
      return BiomeType.MUSHROOM_ISLAND; // rare lush mushroom islands
    }
  }

  /**
   * Generates a smooth, realistic blended heightmap using Multi-Noise continentalness.
   */
  getTerrainHeight(wx: number, wz: number, settings: WorldSettings): { height: number; biome: BiomeType } {
    const biome = this.getBiome(wx, wz, settings);

    // 1. Continentalness: Large scale continent shape (-1 to 1)
    const contScale = 0.0012;
    const continentalness = this.noise.fbm2D(wx * contScale, wz * contScale, 4, 2.0, 0.5);

    // 2. Plains/Rolling Hills base height (8 to 16)
    const plainsScale = 0.015;
    const plainsVal = this.noise.fbm2D(wx * plainsScale, wz * plainsScale, 3, 2.1, 0.48) * 0.5 + 0.5;
    const plainsHeight = 10 + plainsVal * 7;

    // 3. Mountains: Jagged ridges with peaks (up to 55)
    const mountScale = 0.008;
    // Ridge noise: 1.0 - abs(noise) creates sharp peaks and valleys
    const ridgeNoise = 1.0 - Math.abs(this.noise.fbm2D(wx * mountScale, wz * mountScale, 4, 2.0, 0.55));
    const mountainHeight = Math.pow(ridgeNoise, 2.2) * 45 * settings.mountainScale + 8;

    // Blend heights based on continentalness
    // -1.0 to -0.2: Ocean
    // -0.2 to 0.15: Smooth plains transition
    // 0.15 to 0.45: Hilly valleys
    // 0.45 to 1.0: Huge mountain ranges
    let blendedHeight = plainsHeight;
    let finalBiome = biome;

    if (continentalness < -0.25) {
      // Deep Ocean
      const depthFactor = Math.min(1, (-0.25 - continentalness) * 2.5);
      blendedHeight = plainsHeight - depthFactor * 10;
      if (blendedHeight < 3) blendedHeight = 3;
      finalBiome = BiomeType.OCEAN;
    } else if (continentalness < 0.2) {
      // Transition from oceans/lowlands to plains/hills
      const t = (continentalness - (-0.25)) / 0.45;
      blendedHeight = (1 - t) * 9 + t * plainsHeight;
    } else if (continentalness < 0.45) {
      // Normal biome hills
      const t = (continentalness - 0.2) / 0.25;
      blendedHeight = (1 - t) * plainsHeight + t * (plainsHeight + 8);
    } else {
      // Majestic Mountain Ranges!
      const t = Math.min(1, (continentalness - 0.45) * 4);
      blendedHeight = (1 - t) * (plainsHeight + 8) + t * mountainHeight;

      // If mountains go high and aren't locked to desert/badlands, make them Snowy Peaks!
      if (blendedHeight > 26 && biome !== BiomeType.DESERT && biome !== BiomeType.BADLANDS) {
        finalBiome = BiomeType.SNOWY_PEAKS;
      }
    }

    // Add micro-noise details to make terrain look rustic/bumpy
    const detailNoise = this.noise.noise2D(wx * 0.1, wz * 0.1) * 0.75;
    let finalHeight = Math.floor(blendedHeight + detailNoise);

    // Clamp heights
    if (finalHeight < 1) finalHeight = 1;
    if (finalHeight >= CHUNK_HEIGHT - 6) finalHeight = CHUNK_HEIGHT - 7;

    return { height: finalHeight, biome: finalBiome };
  }

  /**
   * Generates a 3D grid of blocks for a specific chunk.
   */
  fillChunk(cx: number, cz: number, settings: WorldSettings): Uint8Array {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    const waterLvl = settings.waterLevel;

    // Cache 2D heightmap and biomes for this chunk
    const heightMap = new Int32Array(CHUNK_SIZE * CHUNK_SIZE);
    const biomeMap = new Array<BiomeType>(CHUNK_SIZE * CHUNK_SIZE);

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const { height, biome } = this.getTerrainHeight(wx, wz, settings);
        heightMap[lz * CHUNK_SIZE + lx] = height;
        biomeMap[lz * CHUNK_SIZE + lx] = biome;
      }
    }

    // Fill blocks bottom-up
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const h = heightMap[lz * CHUNK_SIZE + lx];
        const biome = biomeMap[lz * CHUNK_SIZE + lx];
        const config = BIOME_CONFIGS[biome];

        for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
          const idx = (ly * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;

          if (ly === 0) {
            blocks[idx] = BlockType.BEDROCK;
          } else if (ly < h) {
            // Determine material layers
            const depth = h - 1 - ly;

            if (depth === 0) {
              // Surface layer
              // If surface is underwater, make it sand
              if (ly <= waterLvl && config.topBlock === BlockType.GRASS) {
                blocks[idx] = BlockType.SAND;
              } else {
                blocks[idx] = config.topBlock;
              }
            } else if (depth < 4) {
              // Sub-surface layer
              if (ly <= waterLvl && config.topBlock === BlockType.GRASS) {
                blocks[idx] = BlockType.SAND;
              } else if (biome === BiomeType.BADLANDS) {
                // Striped badlands terracotta colors based on height
                const stripe = Math.floor(ly / 2) % 3;
                blocks[idx] = stripe === 0 ? BlockType.TERRACOTTA_RED : stripe === 1 ? BlockType.TERRACOTTA_ORANGE : BlockType.TERRACOTTA_YELLOW;
              } else {
                blocks[idx] = config.middleBlock;
              }
            } else {
              // Deep stone layer
              // Inject ores deterministically in deep stone
              const oreHash = hash2D(wx, wz + ly * 13, 117);
              if (ly < 12 && oreHash < 0.004) {
                blocks[idx] = BlockType.DIAMOND_ORE;
              } else if (ly < 25 && oreHash < 0.015) {
                blocks[idx] = BlockType.GOLD_ORE;
              } else if (ly < 38 && oreHash < 0.03) {
                blocks[idx] = BlockType.IRON_ORE;
              } else if (ly < 48 && oreHash < 0.05) {
                blocks[idx] = BlockType.COAL_ORE;
              } else {
                blocks[idx] = config.baseBlock;
              }
            }
          } else {
            // Above ground
            if (ly <= waterLvl) {
              blocks[idx] = BlockType.WATER;
            } else {
              blocks[idx] = BlockType.AIR;
            }
          }
        }
      }
    }

    // 3. Caves: Cut out hollow caverns with 3D Perlin Noise
    const caveScaleX = 0.06;
    const caveScaleY = 0.09;
    const caveScaleZ = 0.06;
    const caveThresh = -0.32 - settings.caveDensity * 0.1; // adjust threshold based on density slider

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const h = heightMap[lz * CHUNK_SIZE + lx];

        for (let ly = 4; ly < h - 4; ly++) {
          const idx = (ly * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
          const currentBlock = blocks[idx];

          if (currentBlock === BlockType.STONE || currentBlock === BlockType.DIRT || currentBlock === BlockType.SAND) {
            // Cave noise is 3D FBM
            const cNoise = this.noise.fbm3D(wx * caveScaleX, ly * caveScaleY, wz * caveScaleZ, 3, 2.1, 0.55);
            if (cNoise < caveThresh) {
              blocks[idx] = BlockType.AIR;
            }
          }
        }
      }
    }

    // 4. Generate trees/cacti with absolute boundary culling safety.
    // To prevent foliage clipping at chunk boundaries, we query all trees that can spawn in a 4-block margin around this chunk
    // and rasterize their blocks directly onto our chunk arrays.
    const searchMargin = 4;
    const minWX = cx * CHUNK_SIZE - searchMargin;
    const maxWX = cx * CHUNK_SIZE + CHUNK_SIZE - 1 + searchMargin;
    const minWZ = cz * CHUNK_SIZE - searchMargin;
    const maxWZ = cz * CHUNK_SIZE + CHUNK_SIZE - 1 + searchMargin;

    for (let wx = minWX; wx <= maxWX; wx++) {
      for (let wz = minWZ; wz <= maxWZ; wz++) {
        // Find biome and height at this world coordinate
        const { height, biome } = this.getTerrainHeight(wx, wz, settings);
        const config = BIOME_CONFIGS[biome];

        // Is this coordinate a potential tree spawn location?
        if (config.treeChance > 0) {
          const treeHash = hash2D(wx, wz, 9999);
          if (treeHash < config.treeChance) {
            // Check if the ground block is valid for tree/cactus
            const groundType = config.topBlock;
            // Standard check: only on grass, sand, snow, mycelium
            if (groundType === BlockType.GRASS || groundType === BlockType.SAND || groundType === BlockType.SNOW || groundType === BlockType.MYCELIUM) {
              // Render this tree in our chunk
              this.plantStructure(cx, cz, blocks, wx, height, wz, biome, treeHash);
            }
          }
        }
      }
    }

    return blocks;
  }

  /**
   * Helper to write a single block inside a chunk using absolute world coordinates.
   */
  private writeChunkBlock(cx: number, cz: number, blocks: Uint8Array, wx: number, wy: number, wz: number, type: BlockType) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      const idx = (wy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
      // Do not replace solid blocks like Stone or Bedrock with leaves or log
      const current = blocks[idx];
      if (current === BlockType.AIR || current === BlockType.WATER || current === BlockType.OAK_LEAVES || current === BlockType.SPRUCE_LEAVES || current === BlockType.BIRCH_LEAVES || current === BlockType.JUNGLE_LEAVES) {
        blocks[idx] = type;
      }
    }
  }

  /**
   * Plants a biome-specific tree structure centered at (wx, h, wz).
   */
  private plantStructure(cx: number, cz: number, blocks: Uint8Array, wx: number, h: number, wz: number, biome: BiomeType, hash: number) {
    // Generate different structures based on biome
    switch (biome) {
      case BiomeType.DESERT:
        // Cactus: simple column
        const cactusHeight = 2 + Math.floor(hash * 2);
        for (let dy = 0; dy < cactusHeight; dy++) {
          this.writeChunkBlock(cx, cz, blocks, wx, h + dy, wz, BlockType.CACTUS);
        }
        break;

      case BiomeType.SAVANNA: {
        // Umbrella-shaped Acacia tree with a slight diagonal bend
        const trunkHeight = 5 + Math.floor(hash * 2);
        const bendDirX = hash > 0.5 ? 1 : -1;
        const bendDirZ = hash < 0.3 ? 1 : hash > 0.7 ? -1 : 0;

        // Draw trunk
        let curX = wx;
        let curZ = wz;
        for (let dy = 0; dy < trunkHeight; dy++) {
          if (dy > 2) {
            curX += bendDirX;
            curZ += bendDirZ;
          }
          this.writeChunkBlock(cx, cz, blocks, curX, h + dy, curZ, BlockType.OAK_LOG);
        }

        // Draw wide umbrella canopy at the top
        const topY = h + trunkHeight;
        for (let dx = -3; dx <= 3; dx++) {
          for (let dz = -3; dz <= 3; dz++) {
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 3.2) {
              this.writeChunkBlock(cx, cz, blocks, curX + dx, topY - 1, curZ + dz, BlockType.OAK_LEAVES);
            }
            if (dist < 2.2) {
              this.writeChunkBlock(cx, cz, blocks, curX + dx, topY, curZ + dz, BlockType.OAK_LEAVES);
            }
          }
        }
        break;
      }

      case BiomeType.TAIGA:
      case BiomeType.SNOWY_TAIGA: {
        // Conical Spruce/Pine Tree
        const trunkHeight = 6 + Math.floor(hash * 3);
        // Trunk
        for (let dy = 0; dy < trunkHeight; dy++) {
          this.writeChunkBlock(cx, cz, blocks, wx, h + dy, wz, BlockType.SPRUCE_LOG);
        }
        // Conical leaves
        const leafBaseY = h + 2;
        const leafTopY = h + trunkHeight + 1;
        for (let ly = leafBaseY; ly <= leafTopY; ly++) {
          // Leaf radius decreases as height increases
          const distToTop = leafTopY - ly;
          let radius = 1;
          if (distToTop > 4) radius = 2;
          else if (distToTop > 2) radius = 1;
          else if (distToTop > 0) radius = 1;
          else radius = 0; // single peak leaf

          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              if (radius === 0) {
                if (dx === 0 && dz === 0) {
                  this.writeChunkBlock(cx, cz, blocks, wx, ly, wz, BlockType.SPRUCE_LEAVES);
                }
              } else {
                // Spruce foliage has corners chopped off
                if (Math.abs(dx) + Math.abs(dz) <= radius + 1) {
                  // Spruce leaves are slightly staggered on alternating layers
                  if ((ly % 2 === 0 && Math.abs(dx) === radius && Math.abs(dz) === radius) === false) {
                    this.writeChunkBlock(cx, cz, blocks, wx + dx, ly, wz + dz, BlockType.SPRUCE_LEAVES);
                  }
                }
              }
            }
          }
        }
        break;
      }

      case BiomeType.JUNGLE: {
        // Huge Jungle tree with wide leaf cluster
        const trunkHeight = 8 + Math.floor(hash * 5);
        for (let dy = 0; dy < trunkHeight; dy++) {
          this.writeChunkBlock(cx, cz, blocks, wx, h + dy, wz, BlockType.JUNGLE_LOG);
        }
        const leafStart = h + trunkHeight - 3;
        for (let ly = leafStart; ly <= h + trunkHeight + 1; ly++) {
          const radius = ly >= h + trunkHeight ? 1 : ly >= h + trunkHeight - 1 ? 2 : 3;
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              const dist = Math.sqrt(dx * dx + dz * dz);
              if (dist <= radius) {
                this.writeChunkBlock(cx, cz, blocks, wx + dx, ly, wz + dz, BlockType.JUNGLE_LEAVES);
              }
            }
          }
        }
        break;
      }

      case BiomeType.MUSHROOM_ISLAND: {
        // Giant Red Mushroom
        const stemHeight = 4 + Math.floor(hash * 3);
        // Stem
        for (let dy = 0; dy < stemHeight; dy++) {
          this.writeChunkBlock(cx, cz, blocks, wx, h + dy, wz, BlockType.BIRCH_LOG);
        }
        // Cap
        const capY = h + stemHeight;
        for (let dx = -2; dx <= 2; dx++) {
          for (let dz = -2; dz <= 2; dz++) {
            const absX = Math.abs(dx);
            const absZ = Math.abs(dz);
            if (absX === 2 && absZ === 2) continue; // round corners
            this.writeChunkBlock(cx, cz, blocks, wx + dx, capY, wz + dz, BlockType.RED_MUSHROOM_BLOCK);
            // hanging rim
            if (absX === 2 || absZ === 2) {
              this.writeChunkBlock(cx, cz, blocks, wx + dx, capY - 1, wz + dz, BlockType.RED_MUSHROOM_BLOCK);
            }
          }
        }
        break;
      }

      case BiomeType.FOREST:
      case BiomeType.DARK_FOREST: {
        // Birch and Oak Trees
        const isBirch = hash > 0.6;
        const trunkType = isBirch ? BlockType.BIRCH_LOG : BlockType.OAK_LOG;
        const leavesType = isBirch ? BlockType.BIRCH_LEAVES : BlockType.OAK_LEAVES;

        const trunkHeight = 5 + Math.floor(hash * 2);
        for (let dy = 0; dy < trunkHeight; dy++) {
          this.writeChunkBlock(cx, cz, blocks, wx, h + dy, wz, trunkType);
        }

        const leafStart = h + trunkHeight - 2;
        for (let dy = 0; dy < 3; dy++) {
          const ly = leafStart + dy;
          const radius = dy === 2 ? 1 : 2;
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              // Round corners for top layer
              if (radius === 1 && Math.abs(dx) === 1 && Math.abs(dz) === 1) continue;
              // Make sure we don't block the trunk
              if (dx === 0 && dz === 0 && dy < 2) continue;

              this.writeChunkBlock(cx, cz, blocks, wx + dx, ly, wz + dz, leavesType);
            }
          }
        }
        break;
      }

      case BiomeType.PLAINS:
      default: {
        // Standard Oak Tree
        const trunkHeight = 4 + Math.floor(hash * 2);
        for (let dy = 0; dy < trunkHeight; dy++) {
          this.writeChunkBlock(cx, cz, blocks, wx, h + dy, wz, BlockType.OAK_LOG);
        }
        const leafStart = h + trunkHeight - 2;
        for (let dy = 0; dy < 3; dy++) {
          const ly = leafStart + dy;
          const radius = dy === 2 ? 1 : 2;
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              if (radius === 1 && Math.abs(dx) === 1 && Math.abs(dz) === 1) continue;
              if (dx === 0 && dz === 0 && dy < 2) continue;
              this.writeChunkBlock(cx, cz, blocks, wx + dx, ly, wz + dz, BlockType.OAK_LEAVES);
            }
          }
        }
        break;
      }
    }
  }
}
