/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BlockType, BLOCK_DETAILS, BiomeType, BIOME_CONFIGS } from "../types";
import { Volume2, VolumeX, ShieldAlert, Sparkles, Navigation } from "lucide-react";

interface HUDProps {
  selectedBlock: BlockType;
  setSelectedBlock: (b: BlockType) => void;
  playerPos: { x: number; y: number; z: number };
  currentBiome: BiomeType;
  fps: number;
  flightMode: boolean;
  soundEnabled: boolean;
  setSoundEnabled: (b: boolean) => void;
}

// 9 quick select blocks for the hotbar
export const HOTBAR_BLOCKS = [
  BlockType.GRASS,
  BlockType.DIRT,
  BlockType.STONE,
  BlockType.SAND,
  BlockType.SNOW,
  BlockType.OAK_LOG,
  BlockType.OAK_LEAVES,
  BlockType.WATER,
  BlockType.GLASS,
  BlockType.DIAMOND_ORE,
];

export const HUD: React.FC<HUDProps> = ({
  selectedBlock,
  setSelectedBlock,
  playerPos,
  currentBiome,
  fps,
  flightMode,
  soundEnabled,
  setSoundEnabled,
}) => {
  const biomeConfig = BIOME_CONFIGS[currentBiome] || BIOME_CONFIGS[BiomeType.PLAINS];

  // Map key presses to Hotbar (1-9)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "1" && e.key <= "9") {
        const index = parseInt(e.key) - 1;
        if (index < HOTBAR_BLOCKS.length) {
          setSelectedBlock(HOTBAR_BLOCKS[index]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSelectedBlock]);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-5 select-none font-sans">
      {/* Top HUD Row */}
      <div className="w-full flex justify-between items-start">
        {/* Left: Biome and Player Coordinates */}
        <div className="bg-[#090b14]/75 border border-white/5 backdrop-blur-md px-4 py-3 rounded-xl flex flex-col gap-1 shadow-lg pointer-events-auto">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ backgroundColor: biomeConfig.color }}
            />
            <span className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">Biome</span>
            <span className="text-white font-bold text-sm tracking-tight" style={{ color: biomeConfig.color }}>
              {currentBiome}
            </span>
          </div>

          <div className="flex gap-4 mt-1.5 border-t border-white/5 pt-1.5">
            <div className="text-xs font-mono">
              <span className="text-white/30 mr-1 font-sans">X:</span>
              <span className="text-white font-medium">{playerPos.x}</span>
            </div>
            <div className="text-xs font-mono">
              <span className="text-white/30 mr-1 font-sans">Y:</span>
              <span className="text-white font-medium">{playerPos.y}</span>
            </div>
            <div className="text-xs font-mono">
              <span className="text-white/30 mr-1 font-sans">Z:</span>
              <span className="text-white font-medium">{playerPos.z}</span>
            </div>
          </div>
        </div>

        {/* Right: Flight, FPS and Audio controls */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <div className="bg-[#090b14]/75 border border-white/5 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-3 shadow-md">
            {flightMode && (
              <span className="flex items-center gap-1 text-[10px] bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                <Navigation className="w-3 h-3 rotate-45" /> Flight On
              </span>
            )}
            <span className="text-xs font-mono font-medium text-[#ffd700] bg-yellow-400/15 border border-yellow-400/25 px-2 py-0.5 rounded-full">
              {fps} FPS
            </span>
          </div>

          {/* Toggle Ambient/sound button */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 bg-[#090b14]/75 hover:bg-[#0d101d] text-white border border-white/5 rounded-xl backdrop-blur-md shadow-md transition-all active:scale-95 cursor-pointer"
            title={soundEnabled ? "Mute audio" : "Unmute audio"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-green-400" /> : <VolumeX className="w-4 h-4 text-white/40" />}
          </button>
        </div>
      </div>

      {/* Bottom Center: Hotbar Block Selection */}
      <div className="w-full flex flex-col items-center gap-3">
        {/* Guide helper banner (Fading/Disappearing in normal play) */}
        <div className="bg-[#090b14]/65 border border-white/5 px-4 py-1.5 rounded-full text-[11px] text-white/50 tracking-wide backdrop-blur-sm shadow-md flex items-center gap-2">
          <span><kbd className="px-1 py-0.2 bg-white/10 rounded font-mono text-white">W,A,S,S</kbd> Walk</span>
          <span className="opacity-30">•</span>
          <span><kbd className="px-1 py-0.2 bg-white/10 rounded font-mono text-white">SPACE</kbd> Jump</span>
          <span className="opacity-30">•</span>
          <span><kbd className="px-1 py-0.2 bg-white/10 rounded font-mono text-white">F</kbd> Flying</span>
          <span className="opacity-30">•</span>
          <span><kbd className="px-1 py-0.2 bg-white/10 rounded font-mono text-white">1-9</kbd> Hotbar</span>
        </div>

        {/* Hotbar Slots */}
        <div className="bg-[#090b14]/80 border border-white/10 p-2 rounded-2xl flex gap-1.5 backdrop-blur-lg shadow-2xl pointer-events-auto">
          {HOTBAR_BLOCKS.map((type, idx) => {
            const details = BLOCK_DETAILS[type];
            const isSelected = type === selectedBlock;

            return (
              <button
                key={type}
                onClick={() => setSelectedBlock(type)}
                className={`group relative w-12 h-12 flex items-center justify-center rounded-xl border-2 transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? "border-yellow-400 bg-yellow-400/15 scale-110 shadow-lg shadow-yellow-400/20"
                    : "border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10"
                }`}
              >
                {/* Visual Block Swatch representing its voxel color */}
                <div
                  className="w-7 h-7 rounded-md border border-white/10 shadow-inner group-hover:scale-105 transition-transform"
                  style={{ backgroundColor: details.hex }}
                />

                {/* Hotbar slot number */}
                <span className="absolute bottom-1 right-1.5 text-[8.5px] font-mono font-bold text-white/50">
                  {idx + 1}
                </span>

                {/* Floating tooltip on hover */}
                <span className="absolute bottom-14 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] px-2 py-1 rounded font-semibold whitespace-nowrap tracking-wide border border-white/10 pointer-events-none shadow-md">
                  {details.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
