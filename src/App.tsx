/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { BlockType, BiomeType, WorldSettings, BIOME_CONFIGS } from "./types";
import { VoxelWorld } from "./components/VoxelWorld";
import { HUD } from "./components/HUD";
import { sound } from "./audio";
import { 
  Sliders, 
  Sun, 
  Compass, 
  RefreshCw, 
  Sparkles, 
  Save, 
  Upload, 
  Info, 
  Lock, 
  Play, 
  Volume2, 
  VolumeX, 
  Maximize2,
  Activity,
  RotateCcw
} from "lucide-react";

export default function App() {
  // Main World Configuration State
  const [settings, setSettings] = useState<WorldSettings>({
    seed: 13742,
    viewDistance: 4,
    mountainScale: 1.0,
    waterLevel: 10,
    caveDensity: 0.45,
    dayProgress: 0.3, // bright afternoon
    flightMode: false,
    biomeLock: "None",
  });

  // Selected Building Block
  const [selectedBlock, setSelectedBlock] = useState<BlockType>(BlockType.GRASS);

  // Audio State
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Active Live Telemetry
  const [telemetry, setTelemetry] = useState({
    loadedChunks: 0,
    totalBlocks: 0,
    position: { x: 0, y: 0, z: 0 },
    biome: BiomeType.PLAINS,
    fps: 60,
  });

  // Pointer lock state
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // Teleport & Reset triggers
  const [teleportTrigger, setTeleportTrigger] = useState<{ biome: BiomeType; seed: number } | null>(null);
  const [resetTrigger, setResetTrigger] = useState<boolean>(false);

  // Sound toggler
  const handleSetSoundEnabled = (enabled: boolean) => {
    setSoundEnabled(enabled);
    sound.toggle(enabled);
  };

  const handleTeleportToBiome = (biome: BiomeType) => {
    setTeleportTrigger({ biome, seed: settings.seed });
    // Auto resume/lock cursor when teleporter is pressed
    setTimeout(() => {
      document.getElementById("viewport")?.click();
    }, 100);
  };

  const handleResetWorld = () => {
    setResetTrigger(true);
    // Auto resume/lock cursor when resetting
    setTimeout(() => {
      document.getElementById("viewport")?.click();
    }, 100);
  };

  const handleUpdateStats = (
    loadedChunks: number,
    totalBlocks: number,
    position: { x: number; y: number; z: number },
    biome: string,
    fps: number
  ) => {
    setTelemetry({
      loadedChunks,
      totalBlocks,
      position,
      biome: biome as BiomeType,
      fps,
    });
  };

  // Save Settings to Local Storage
  const handleSaveParameters = () => {
    localStorage.setItem("voxel_forge_settings", JSON.stringify(settings));
    alert("World configurations saved successfully!");
  };

  // Load Settings from Local Storage
  const handleLoadParameters = () => {
    const saved = localStorage.getItem("voxel_forge_settings");
    if (saved) {
      setSettings(JSON.parse(saved));
      alert("World configurations loaded successfully!");
    } else {
      alert("No saved configurations found.");
    }
  };

  const handleRandomizeSeed = () => {
    const newSeed = Math.floor(Math.random() * 99999) + 1;
    setSettings((prev) => ({ ...prev, seed: newSeed }));
  };

  // Resume game logic
  const handleResumeGame = () => {
    document.getElementById("viewport")?.click();
  };

  return (
    <div className="w-screen h-screen bg-[#030408] text-white overflow-hidden select-none font-sans relative">
      
      {/* 1. Main 3D Interactive World Engine */}
      <div className="w-full h-full relative">
        <VoxelWorld
          settings={settings}
          setSettings={setSettings}
          selectedBlock={selectedBlock}
          onTeleportTrigger={teleportTrigger}
          onTeleportComplete={() => setTeleportTrigger(null)}
          onResetTrigger={resetTrigger}
          onResetComplete={() => setResetTrigger(false)}
          onUpdateStats={handleUpdateStats}
          onLockChange={setIsLocked}
        />

        {/* 2. Floating Live HUD Overlay (Active during gameplay) */}
        {isLocked && (
          <HUD
            selectedBlock={selectedBlock}
            setSelectedBlock={setSelectedBlock}
            playerPos={telemetry.position}
            currentBiome={telemetry.biome}
            fps={telemetry.fps}
            flightMode={settings.flightMode}
            soundEnabled={soundEnabled}
            setSoundEnabled={handleSetSoundEnabled}
          />
        )}
      </div>

      {/* 3. Immersive Game Pause Menu Overlay (Visible when pointer unlocked) */}
      {!isLocked && (
        <div className="absolute inset-0 bg-[#060814]/85 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-y-auto animate-fade-in z-50">
          
          {/* Main Pause Container */}
          <div className="w-full max-w-4xl bg-[#090b14]/90 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
            
            {/* Header: Title and subtitle */}
            <div className="text-center flex flex-col items-center">
              <div className="px-3 py-1 bg-yellow-400/15 border border-yellow-400/30 rounded-full mb-3 animate-pulse">
                <span className="text-yellow-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" /> Immersive Game Stage
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white flex items-center gap-2">
                VOXEL<span className="text-yellow-400">FORGE</span>
              </h1>
              <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mt-1">Game Menu & World Customizer</p>
            </div>

            {/* Split Settings / Biome grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              
              {/* Left Column: World Customizer parameters */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                  <Sliders className="w-4.5 h-4.5 text-yellow-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">World Parameters</h3>
                </div>

                {/* Seed config */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider flex justify-between">
                    <span>World Generator Seed</span>
                    <span className="text-yellow-400/80 font-mono">#{settings.seed}</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={settings.seed}
                      onChange={(e) => setSettings((prev) => ({ ...prev, seed: parseInt(e.target.value) || 0 }))}
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm font-mono focus:border-yellow-400 focus:outline-none text-white"
                    />
                    <button
                      onClick={handleRandomizeSeed}
                      className="p-2 bg-yellow-400 hover:bg-yellow-500 text-black rounded-lg transition-colors active:scale-95 cursor-pointer"
                      title="Random Seed"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* View Distance slider */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                    <span className="text-white/50">Render Distance</span>
                    <span className="text-white font-mono">{settings.viewDistance} Chunks</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    step="1"
                    value={settings.viewDistance}
                    onChange={(e) => setSettings((prev) => ({ ...prev, viewDistance: parseInt(e.target.value) }))}
                    className="w-full accent-yellow-400 cursor-pointer"
                  />
                </div>

                {/* Day progress slider */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                    <span className="text-white/50 flex items-center gap-1"><Sun className="w-3.5 h-3.5 text-orange-400" /> Cycle Of Orbit</span>
                    <span className="text-white font-mono">
                      {settings.dayProgress < 0.25 || settings.dayProgress > 0.75 ? "Night" : "Day"}{" "}
                      ({Math.round(settings.dayProgress * 100)}%)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.dayProgress}
                    onChange={(e) => setSettings((prev) => ({ ...prev, dayProgress: parseFloat(e.target.value) }))}
                    className="w-full accent-yellow-400 cursor-pointer"
                  />
                </div>

                {/* Mountain Scale slider */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                    <span className="text-white/50 flex items-center gap-1">🏔️ Mountain Peak Elevation</span>
                    <span className="text-white font-mono">{Math.round(settings.mountainScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.0"
                    step="0.1"
                    value={settings.mountainScale}
                    onChange={(e) => setSettings((prev) => ({ ...prev, mountainScale: parseFloat(e.target.value) }))}
                    className="w-full accent-yellow-400 cursor-pointer"
                  />
                </div>

                {/* Water Level slider */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                    <span className="text-white/50 flex items-center gap-1">🌊 Sea / Water Level</span>
                    <span className="text-white font-mono">Y = {settings.waterLevel}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="30"
                    step="1"
                    value={settings.waterLevel}
                    onChange={(e) => setSettings((prev) => ({ ...prev, waterLevel: parseInt(e.target.value) }))}
                    className="w-full accent-yellow-400 cursor-pointer"
                  />
                </div>

                {/* Cave Density slider */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                    <span className="text-white/50 flex items-center gap-1">🕳️ Cave System Density</span>
                    <span className="text-white font-mono">{Math.round(settings.caveDensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={settings.caveDensity}
                    onChange={(e) => setSettings((prev) => ({ ...prev, caveDensity: parseFloat(e.target.value) }))}
                    className="w-full accent-yellow-400 cursor-pointer"
                  />
                </div>

                {/* Biome lock selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Locked Active Biome</label>
                  <select
                    value={settings.biomeLock}
                    onChange={(e) => setSettings((prev) => ({ ...prev, biomeLock: e.target.value }))}
                    className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:border-yellow-400 focus:outline-none cursor-pointer"
                  >
                    <option value="None">None (Dynamic Endless Generation)</option>
                    <option value={BiomeType.PLAINS}>Plains</option>
                    <option value={BiomeType.DESERT}>Desert</option>
                    <option value={BiomeType.JUNGLE}>Jungle</option>
                    <option value={BiomeType.TUNDRA}>Tundra</option>
                    <option value={BiomeType.BADLANDS}>Badlands</option>
                    <option value={BiomeType.SNOWY_PEAKS}>Snowy Peaks</option>
                  </select>
                </div>
              </div>

              {/* Right Column: Biome Gateways */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                  <Compass className="w-4.5 h-4.5 text-yellow-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">Biome Warp Gateways</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {Object.values(BiomeType).map((biome) => {
                    const conf = BIOME_CONFIGS[biome];
                    return (
                      <button
                        key={biome}
                        onClick={() => handleTeleportToBiome(biome)}
                        className="flex flex-col text-left p-3 rounded-xl border border-white/5 bg-black/30 hover:border-white/20 hover:bg-white/5 hover:scale-102 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-2 h-2 rounded-full group-hover:scale-125 transition-transform"
                            style={{ backgroundColor: conf.color }}
                          />
                          <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Gateway</span>
                        </div>
                        <span className="text-sm font-extrabold" style={{ color: conf.color }}>
                          {biome}
                        </span>
                        <span className="text-[9px] text-white/50 mt-1 line-clamp-1 italic">
                          Click to Teleport
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Parameters Saving/Loading */}
                <div className="border-t border-white/5 pt-4 mt-2 flex flex-col gap-3">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Configurations Presets</span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleSaveParameters}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" /> Save State
                    </button>
                    <button
                      onClick={handleLoadParameters}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" /> Load State
                    </button>
                  </div>
                </div>

                {/* Telemetry quick facts */}
                <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex justify-between items-center text-xs font-mono">
                  <div className="flex flex-col">
                    <span className="text-white/40 text-[9px] uppercase tracking-wider font-sans font-bold">Active Chunks</span>
                    <span className="text-white font-medium">{telemetry.loadedChunks} Loaded</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-white/40 text-[9px] uppercase tracking-wider font-sans font-bold">Total Solid Blocks</span>
                    <span className="text-white font-medium">{telemetry.totalBlocks.toLocaleString()}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Actions Row: Large Resume button and Reset world */}
            <div className="flex flex-col sm:flex-row gap-4 border-t border-white/5 pt-6 mt-2 items-center">
              
              <button
                onClick={handleResumeGame}
                className="w-full sm:flex-1 py-3.5 px-6 bg-yellow-400 hover:bg-yellow-500 text-[#090b14] font-extrabold text-base rounded-xl shadow-xl shadow-yellow-400/10 hover:shadow-yellow-400/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="fill-current w-5 h-5" /> RESUME GAMEPLAY
              </button>

              <button
                onClick={handleResetWorld}
                className="w-full sm:w-auto py-3.5 px-6 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-bold text-sm rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                title="Regenerate seed chunks"
              >
                <RotateCcw className="w-4 h-4" /> REGENERATE WORLD
              </button>
            </div>

            {/* Interactive hint banner */}
            <div className="flex items-center gap-2 justify-center text-[11px] text-white/40 mt-1">
              <Info className="w-3.5 h-3.5 text-yellow-400/80" />
              <span>Click the resume button or anywhere on the screen to lock your mouse and control the world! Press <kbd className="px-1 bg-white/10 rounded font-mono text-white">ESC</kbd> to return here anytime.</span>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
