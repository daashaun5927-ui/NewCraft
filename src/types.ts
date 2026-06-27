/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  SAND = 4,
  SNOW = 5,
  BEDROCK = 6,
  WATER = 7,
  OAK_LOG = 8,
  OAK_LEAVES = 9,
  SPRUCE_LOG = 10,
  SPRUCE_LEAVES = 11,
  BIRCH_LOG = 12,
  BIRCH_LEAVES = 13,
  JUNGLE_LOG = 14,
  JUNGLE_LEAVES = 15,
  CACTUS = 16,
  MYCELIUM = 17,
  RED_MUSHROOM_BLOCK = 18,
  TERRACOTTA_RED = 19,
  TERRACOTTA_ORANGE = 20,
  TERRACOTTA_YELLOW = 21,
  GLASS = 22,
  COAL_ORE = 23,
  IRON_ORE = 24,
  GOLD_ORE = 25,
  DIAMOND_ORE = 26,
}

export enum BiomeType {
  PLAINS = "Plains",
  FOREST = "Forest",
  DARK_FOREST = "Dark Oak Forest",
  SAVANNA = "Savanna",
  DESERT = "Desert",
  JUNGLE = "Jungle",
  OCEAN = "Ocean",
  TAIGA = "Taiga",
  SNOWY_TAIGA = "Snowy Taiga",
  TUNDRA = "Tundra",
  MUSHROOM_ISLAND = "Mushroom Island",
  BADLANDS = "Badlands",
  SNOWY_PEAKS = "Snowy Peaks",
}

export interface BiomeConfig {
  type: BiomeType;
  color: string; // Theme color for HUD
  topBlock: BlockType;
  middleBlock: BlockType;
  baseBlock: BlockType;
  treeChance: number;
  hasCactus: boolean;
}

export const BIOME_CONFIGS: Record<BiomeType, BiomeConfig> = {
  [BiomeType.PLAINS]: {
    type: BiomeType.PLAINS,
    color: "#8BC34A",
    topBlock: BlockType.GRASS,
    middleBlock: BlockType.DIRT,
    baseBlock: BlockType.STONE,
    treeChance: 0.015,
    hasCactus: false,
  },
  [BiomeType.FOREST]: {
    type: BiomeType.FOREST,
    color: "#4CAF50",
    topBlock: BlockType.GRASS,
    middleBlock: BlockType.DIRT,
    baseBlock: BlockType.STONE,
    treeChance: 0.06,
    hasCactus: false,
  },
  [BiomeType.DARK_FOREST]: {
    type: BiomeType.DARK_FOREST,
    color: "#2E7D32",
    topBlock: BlockType.GRASS,
    middleBlock: BlockType.DIRT,
    baseBlock: BlockType.STONE,
    treeChance: 0.09,
    hasCactus: false,
  },
  [BiomeType.SAVANNA]: {
    type: BiomeType.SAVANNA,
    color: "#CDDC39",
    topBlock: BlockType.GRASS,
    middleBlock: BlockType.DIRT,
    baseBlock: BlockType.STONE,
    treeChance: 0.02,
    hasCactus: false,
  },
  [BiomeType.DESERT]: {
    type: BiomeType.DESERT,
    color: "#FFEB3B",
    topBlock: BlockType.SAND,
    middleBlock: BlockType.SAND,
    baseBlock: BlockType.STONE,
    treeChance: 0.01, // Cactus chance
    hasCactus: true,
  },
  [BiomeType.JUNGLE]: {
    type: BiomeType.JUNGLE,
    color: "#00E676",
    topBlock: BlockType.GRASS,
    middleBlock: BlockType.DIRT,
    baseBlock: BlockType.STONE,
    treeChance: 0.08,
    hasCactus: false,
  },
  [BiomeType.OCEAN]: {
    type: BiomeType.OCEAN,
    color: "#2196F3",
    topBlock: BlockType.SAND,
    middleBlock: BlockType.SAND,
    baseBlock: BlockType.STONE,
    treeChance: 0,
    hasCactus: false,
  },
  [BiomeType.TAIGA]: {
    type: BiomeType.TAIGA,
    color: "#00796B",
    topBlock: BlockType.GRASS,
    middleBlock: BlockType.DIRT,
    baseBlock: BlockType.STONE,
    treeChance: 0.05,
    hasCactus: false,
  },
  [BiomeType.SNOWY_TAIGA]: {
    type: BiomeType.SNOWY_TAIGA,
    color: "#80CBC4",
    topBlock: BlockType.SNOW,
    middleBlock: BlockType.DIRT,
    baseBlock: BlockType.STONE,
    treeChance: 0.04,
    hasCactus: false,
  },
  [BiomeType.TUNDRA]: {
    type: BiomeType.TUNDRA,
    color: "#B2DFDB",
    topBlock: BlockType.SNOW,
    middleBlock: BlockType.SNOW,
    baseBlock: BlockType.STONE,
    treeChance: 0.002,
    hasCactus: false,
  },
  [BiomeType.MUSHROOM_ISLAND]: {
    type: BiomeType.MUSHROOM_ISLAND,
    color: "#BA68C8",
    topBlock: BlockType.MYCELIUM,
    middleBlock: BlockType.DIRT,
    baseBlock: BlockType.STONE,
    treeChance: 0.03, // Giant mushroom chance
    hasCactus: false,
  },
  [BiomeType.BADLANDS]: {
    type: BiomeType.BADLANDS,
    color: "#FF5722",
    topBlock: BlockType.TERRACOTTA_ORANGE,
    middleBlock: BlockType.TERRACOTTA_RED,
    baseBlock: BlockType.STONE,
    treeChance: 0,
    hasCactus: false,
  },
  [BiomeType.SNOWY_PEAKS]: {
    type: BiomeType.SNOWY_PEAKS,
    color: "#E0F7FA",
    topBlock: BlockType.SNOW,
    middleBlock: BlockType.STONE,
    baseBlock: BlockType.STONE,
    treeChance: 0,
    hasCactus: false,
  },
};

export const BLOCK_DETAILS: Record<
  BlockType,
  { name: string; color: number; hex: string; isSolid: boolean; isTransparent: boolean }
> = {
  [BlockType.AIR]: { name: "Air", color: 0x000000, hex: "transparent", isSolid: false, isTransparent: true },
  [BlockType.GRASS]: { name: "Grass", color: 0x5a9a3a, hex: "#5a9a3a", isSolid: true, isTransparent: false },
  [BlockType.DIRT]: { name: "Dirt", color: 0x866043, hex: "#866043", isSolid: true, isTransparent: false },
  [BlockType.STONE]: { name: "Stone", color: 0x808080, hex: "#808080", isSolid: true, isTransparent: false },
  [BlockType.SAND]: { name: "Sand", color: 0xdbcc9e, hex: "#dbcc9e", isSolid: true, isTransparent: false },
  [BlockType.SNOW]: { name: "Snow", color: 0xf3f9fb, hex: "#f3f9fb", isSolid: true, isTransparent: false },
  [BlockType.BEDROCK]: { name: "Bedrock", color: 0x222222, hex: "#222222", isSolid: true, isTransparent: false },
  [BlockType.WATER]: { name: "Water", color: 0x3b77da, hex: "#3b77da", isSolid: false, isTransparent: true },
  [BlockType.OAK_LOG]: { name: "Oak Log", color: 0x5d432c, hex: "#5d432c", isSolid: true, isTransparent: false },
  [BlockType.OAK_LEAVES]: { name: "Oak Leaves", color: 0x3d7426, hex: "#3d7426", isSolid: true, isTransparent: true },
  [BlockType.SPRUCE_LOG]: { name: "Spruce Log", color: 0x332211, hex: "#332211", isSolid: true, isTransparent: false },
  [BlockType.SPRUCE_LEAVES]: { name: "Spruce Leaves", color: 0x23491b, hex: "#23491b", isSolid: true, isTransparent: true },
  [BlockType.BIRCH_LOG]: { name: "Birch Log", color: 0xd7d7d2, hex: "#d7d7d2", isSolid: true, isTransparent: false },
  [BlockType.BIRCH_LEAVES]: { name: "Birch Leaves", color: 0x547c35, hex: "#547c35", isSolid: true, isTransparent: true },
  [BlockType.JUNGLE_LOG]: { name: "Jungle Log", color: 0x4d3826, hex: "#4d3826", isSolid: true, isTransparent: false },
  [BlockType.JUNGLE_LEAVES]: { name: "Jungle Leaves", color: 0x2e6f15, hex: "#2e6f15", isSolid: true, isTransparent: true },
  [BlockType.CACTUS]: { name: "Cactus", color: 0x225522, hex: "#225522", isSolid: true, isTransparent: true },
  [BlockType.MYCELIUM]: { name: "Mycelium", color: 0x7c6e7c, hex: "#7c6e7c", isSolid: true, isTransparent: false },
  [BlockType.RED_MUSHROOM_BLOCK]: { name: "Red Mushroom Block", color: 0xbf2c2c, hex: "#bf2c2c", isSolid: true, isTransparent: false },
  [BlockType.TERRACOTTA_RED]: { name: "Red Terracotta", color: 0x984d3d, hex: "#984d3d", isSolid: true, isTransparent: false },
  [BlockType.TERRACOTTA_ORANGE]: { name: "Orange Terracotta", color: 0xa15d36, hex: "#a15d36", isSolid: true, isTransparent: false },
  [BlockType.TERRACOTTA_YELLOW]: { name: "Yellow Terracotta", color: 0xb9853c, hex: "#b9853c", isSolid: true, isTransparent: false },
  [BlockType.GLASS]: { name: "Glass", color: 0xddf1f5, hex: "#ddf1f5", isSolid: true, isTransparent: true },
  [BlockType.COAL_ORE]: { name: "Coal Ore", color: 0x616161, hex: "#616161", isSolid: true, isTransparent: false },
  [BlockType.IRON_ORE]: { name: "Iron Ore", color: 0x7a736a, hex: "#7a736a", isSolid: true, isTransparent: false },
  [BlockType.GOLD_ORE]: { name: "Gold Ore", color: 0xdcb237, hex: "#dcb237", isSolid: true, isTransparent: false },
  [BlockType.DIAMOND_ORE]: { name: "Diamond Ore", color: 0x6e8790, hex: "#6e8790", isSolid: true, isTransparent: false },
};

export interface WorldSettings {
  seed: number;
  viewDistance: number;
  mountainScale: number;
  waterLevel: number;
  caveDensity: number;
  dayProgress: number; // 0 to 1, where 0.25 is sunrise, 0.5 is noon, 0.75 is sunset, 0 is midnight
  flightMode: boolean;
  biomeLock: BiomeType | "None";
}
