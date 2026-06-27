/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { BlockType, BiomeType, WorldSettings, BLOCK_DETAILS } from "../types";
import { TerrainGenerator } from "../generator";
import { sound } from "../audio";

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 64;

interface VoxelWorldProps {
  settings: WorldSettings;
  setSettings: React.Dispatch<React.SetStateAction<WorldSettings>>;
  selectedBlock: BlockType;
  onTeleportTrigger: { biome: BiomeType; seed: number } | null;
  onTeleportComplete: () => void;
  onResetTrigger: boolean;
  onResetComplete: () => void;
  onUpdateStats: (loadedChunks: number, totalBlocks: number, position: { x: number; y: number; z: number }, biome: string, fps: number) => void;
  onLockChange?: (locked: boolean) => void;
}

export const VoxelWorld: React.FC<VoxelWorldProps> = ({
  settings,
  setSettings,
  selectedBlock,
  onTeleportTrigger,
  onTeleportComplete,
  onResetTrigger,
  onResetComplete,
  onUpdateStats,
  onLockChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Core Three.js Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);

  // Celestial/Environment Objects
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const moonMeshRef = useRef<THREE.Mesh | null>(null);
  const starfieldRef = useRef<THREE.Points | null>(null);

  // World Data
  const generatorRef = useRef<TerrainGenerator>(new TerrainGenerator(settings.seed));
  const chunksRef = useRef<Map<string, {
    cx: number;
    cz: number;
    blocks: Uint8Array;
    group: THREE.Group;
    mesh: THREE.Mesh | null;
    waterMesh: THREE.Mesh | null;
    dirty: boolean;
  }>>(new Map());

  // Player State
  const playerPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 35, 0));
  const playerVel = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const playerYaw = useRef<number>(0);
  const playerPitch = useRef<number>(0);
  const playerOnGround = useRef<boolean>(false);
  const keysPressed = useRef<Record<string, boolean>>({});

  // Progressive Chunk Loading Queue
  const chunkQueue = useRef<Array<{ cx: number; cz: number; action: "load" | "rebuild" }>>([]);

  // Live Performance Tracking
  const frameCount = useRef<number>(0);
  const lastFpsTime = useRef<number>(0);
  const lastPositionUpdate = useRef<number>(0);
  const lastStepTime = useRef<number>(0);

  // Handle pointer lock state
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    // ═══════════════════════════════════════════════════════════════════
    // 1. THREE.JS INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Atmospheric Fog
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.015);

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    const camera = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      250
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false; // Disable dynamic shadows for heavy voxel meshes to keep fps maxed out!
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const sunLight = new THREE.DirectionalLight(0xfff8ee, 1.1);
    sunLight.position.set(40, 80, 20);
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Starfield for night sky
    const starCount = 350;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      // Scatter stars on a giant upper dome
      const r = 180;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random()); // upper hemisphere only
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi); // Y is up
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.0, // Fade in based on time of day
    });
    const starfield = new THREE.Points(starGeo, starMat);
    scene.add(starfield);
    starfieldRef.current = starfield;

    // 3D Sun and Moon physical billboard boxes
    const sunGeo = new THREE.BoxGeometry(10, 10, 10);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff3a8 });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sunMesh);
    sunMeshRef.current = sunMesh;

    const moonGeo = new THREE.BoxGeometry(8, 8, 8);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xe0e6ed });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    scene.add(moonMesh);
    moonMeshRef.current = moonMesh;

    // Initial Terrain Spawn
    generatorRef.current.setSeed(settings.seed);
    spawnPlayerAndBuildInitialWorld();

    // Start Ambient Sound Loop
    sound.startWind();

    // Resize Observer to handle dynamic container resizing (essential to prevent black screens on layout initialization!)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          if (camera && renderer) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
          }
        }
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Keyboard controls
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysPressed.current[k] = true;

      // Quick hotbar block keys (1-9)
      if (e.key === "f") {
        // Toggle flying in settings
        setSettings((prev) => ({ ...prev, flightMode: !prev.flightMode }));
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Pointer lock events
    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === containerRef.current;
      setIsLocked(locked);
      onLockChange?.(locked);
      if (locked) {
        sound.toggle(true);
      }
    };
    document.addEventListener("pointerlockchange", onPointerLockChange);

    // Mouse movement
    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== containerRef.current) return;
      playerYaw.current -= e.movementX * 0.0022;
      playerPitch.current -= e.movementY * 0.0022;
      // Clamp pitch to avoid turning upside down
      playerPitch.current = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, playerPitch.current));
    };
    document.addEventListener("mousemove", handleMouseMove);

    // Block interaction (Click)
    const handleMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== containerRef.current) return;
      handleBlockInteraction(e.button);
    };
    document.addEventListener("mousedown", handleMouseDown);

    // Prevent default context menu
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", handleContextMenu);

    // ═══════════════════════════════════════════════════════════════════
    // 2. MAIN TICK GAME LOOP (ANIMATION FRAME)
    // ═══════════════════════════════════════════════════════════════════
    let animationFrameId: number;
    lastFpsTime.current = performance.now();

    const gameTick = (time: number) => {
      animationFrameId = requestAnimationFrame(gameTick);

      // A. Player Physics & Controls
      updatePlayerPhysics();

      // B. Progressive Chunk Loading (Processes at most 1 chunk per frame to keep FPS high!)
      processChunkQueue();

      // C. Dynamic Environment (Sky, Fog, Sun/Moon rotations)
      updateEnvironment();

      // D. Chunk radius mapping around player
      mapActiveChunksAroundPlayer();

      // E. Statistics Callback
      updateTelemetry(time);

      // F. Render frame
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    };

    animationFrameId = requestAnimationFrame(gameTick);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("contextmenu", handleContextMenu);
      sound.stopWind();

      // Dispose of everything
      clearAllChunks();
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement && containerRef.current) {
          containerRef.current.removeChild(renderer.domElement);
        }
      }
    };
  }, [settings.seed]);

  // ═══════════════════════════════════════════════════════════════════
  // 3. TELEPORT & WORLD ACTION SIDE EFFECTS
  // ═══════════════════════════════════════════════════════════════════

  // Reset World Action
  useEffect(() => {
    if (onResetTrigger) {
      clearAllChunks();
      generatorRef.current.setSeed(settings.seed);
      spawnPlayerAndBuildInitialWorld();
      onResetComplete();
    }
  }, [onResetTrigger]);

  // Teleport Action
  useEffect(() => {
    if (onTeleportTrigger) {
      clearAllChunks();
      generatorRef.current.setSeed(onTeleportTrigger.seed);

      // Scan and find coordinate for target biome
      teleportToBiome(onTeleportTrigger.biome);
      onTeleportComplete();
    }
  }, [onTeleportTrigger]);

  // Re-generate if settings like View Distance, Mountain scale, etc. change
  const lastSettingsSeed = useRef(settings.seed);
  const lastViewDist = useRef(settings.viewDistance);
  const lastMountainScale = useRef(settings.mountainScale);
  const lastCaveDensity = useRef(settings.caveDensity);
  const lastWaterLvl = useRef(settings.waterLevel);
  const lastBiomeLock = useRef(settings.biomeLock);

  useEffect(() => {
    const seedChanged = settings.seed !== lastSettingsSeed.current;
    const viewDistChanged = settings.viewDistance !== lastViewDist.current;
    const mountainScaleChanged = settings.mountainScale !== lastMountainScale.current;
    const caveDensityChanged = settings.caveDensity !== lastCaveDensity.current;
    const waterLvlChanged = settings.waterLevel !== lastWaterLvl.current;
    const biomeLockChanged = settings.biomeLock !== lastBiomeLock.current;

    if (seedChanged || viewDistChanged || mountainScaleChanged || caveDensityChanged || waterLvlChanged || biomeLockChanged) {
      lastSettingsSeed.current = settings.seed;
      lastViewDist.current = settings.viewDistance;
      lastMountainScale.current = settings.mountainScale;
      lastCaveDensity.current = settings.caveDensity;
      lastWaterLvl.current = settings.waterLevel;
      lastBiomeLock.current = settings.biomeLock;

      // Update seed
      generatorRef.current.setSeed(settings.seed);

      // Re-generate world chunks
      clearAllChunks();
      spawnPlayerAndBuildInitialWorld();
    }
  }, [settings]);

  // ═══════════════════════════════════════════════════════════════════
  // 4. CORE ENGINE CORE METHODS
  // ═══════════════════════════════════════════════════════════════════

  const lockPointer = () => {
    containerRef.current?.requestPointerLock();
  };

  const clearAllChunks = () => {
    if (!sceneRef.current) return;
    for (const chunk of chunksRef.current.values()) {
      sceneRef.current.remove(chunk.group);
      disposeChunkMesh(chunk);
    }
    chunksRef.current.clear();
    chunkQueue.current = [];
  };

  const disposeChunkMesh = (chunk: any) => {
    if (chunk.mesh) {
      chunk.mesh.geometry.dispose();
      if (Array.isArray(chunk.mesh.material)) {
        chunk.mesh.material.forEach((m: any) => m.dispose());
      } else {
        chunk.mesh.material.dispose();
      }
    }
    if (chunk.waterMesh) {
      chunk.waterMesh.geometry.dispose();
      if (Array.isArray(chunk.waterMesh.material)) {
        chunk.waterMesh.material.forEach((m: any) => m.dispose());
      } else {
        chunk.waterMesh.material.dispose();
      }
    }
  };

  const isGroundBlock = (block: BlockType): boolean => {
    return (
      block === BlockType.GRASS ||
      block === BlockType.DIRT ||
      block === BlockType.STONE ||
      block === BlockType.SAND ||
      block === BlockType.SNOW ||
      block === BlockType.BEDROCK ||
      block === BlockType.MYCELIUM ||
      block === BlockType.TERRACOTTA_RED ||
      block === BlockType.TERRACOTTA_ORANGE ||
      block === BlockType.TERRACOTTA_YELLOW ||
      (block >= BlockType.COAL_ORE && block <= BlockType.DIAMOND_ORE)
    );
  };

  /**
   * Spawns player on solid ground in center chunk, and triggers synchronous mesh building.
   */
  const spawnPlayerAndBuildInitialWorld = () => {
    // 1. Force load the center chunk synchronously to guarantee starting ground
    const centerChunk = loadChunkData(0, 0);
    buildChunkMesh(centerChunk);

    // 2. Find solid spawn height at the center of the chunk (lx = 8, lz = 8)
    const lx = 8;
    const lz = 8;
    let spawnH = 30; // safe default

    for (let ly = CHUNK_HEIGHT - 1; ly > 0; ly--) {
      const idx = (ly * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
      const block = centerChunk.blocks[idx];
      if (isGroundBlock(block)) {
        spawnH = ly + 1.2;
        break;
      }
    }

    // Safely clear a 3x3 area of 4 blocks high above the spawn point to guarantee the player does not suffocate inside any blocks or trees
    const spawnYInt = Math.floor(spawnH);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const clx = lx + dx;
        const clz = lz + dz;
        if (clx >= 0 && clx < CHUNK_SIZE && clz >= 0 && clz < CHUNK_SIZE) {
          for (let dy = 0; dy < 4; dy++) {
            const targetY = spawnYInt + dy;
            if (targetY >= 0 && targetY < CHUNK_HEIGHT) {
              const idx = (targetY * CHUNK_SIZE + clz) * CHUNK_SIZE + clx;
              centerChunk.blocks[idx] = BlockType.AIR;
            }
          }
        }
      }
    }

    playerPos.current.set(lx + 0.5, spawnH + 1.0, lz + 0.5);
    playerVel.current.set(0, 0, 0);
    playerYaw.current = 0;
    playerPitch.current = 0;
    playerOnGround.current = true;

    // Rebuild chunk mesh after clearing the blocks
    buildChunkMesh(centerChunk);

    // 3. Queue surrounding chunks immediately
    const dist = settings.viewDistance;
    for (let dx = -dist; dx <= dist; dx++) {
      for (let dz = -dist; dz <= dist; dz++) {
        if (dx === 0 && dz === 0) continue; // center is built
        chunkQueue.current.push({ cx: dx, cz: dz, action: "load" });
      }
    }
  };

  /**
   * Helper to fetch or create a chunk's voxel data
   */
  const loadChunkData = (cx: number, cz: number) => {
    const key = `${cx},${cz}`;
    let chunk = chunksRef.current.get(key);
    if (!chunk) {
      const blocks = generatorRef.current.fillChunk(cx, cz, settings);
      const group = new THREE.Group();
      sceneRef.current?.add(group);

      chunk = {
        cx,
        cz,
        blocks,
        group,
        mesh: null,
        waterMesh: null,
        dirty: true,
      };
      chunksRef.current.set(key, chunk);
    }
    return chunk;
  };

  /**
   * Scans coordinates to find where a specific biome is, then teleports there.
   */
  const teleportToBiome = (targetBiome: BiomeType) => {
    // Search spiral outwardly
    let foundX = 0;
    let foundZ = 0;
    let found = false;

    // Scan a grid of biome coordinates
    for (let r = 0; r < 25; r++) {
      const offsets = [
        [r, r], [-r, r], [r, -r], [-r, -r],
        [0, r], [r, 0], [0, -r], [-r, 0]
      ];
      for (const [ox, oz] of offsets) {
        const wx = ox * 40;
        const wz = oz * 40;
        const b = generatorRef.current.getBiome(wx, wz, settings);
        if (b === targetBiome) {
          foundX = wx;
          foundZ = wz;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    // Fallback to random coordinate if spiral search fails
    if (!found) {
      foundX = Math.floor((Math.random() - 0.5) * 800);
      foundZ = Math.floor((Math.random() - 0.5) * 800);
    }

    // Synchronously generate chunk where we land
    const cx = Math.floor(foundX / CHUNK_SIZE);
    const cz = Math.floor(foundZ / CHUNK_SIZE);
    const chunk = loadChunkData(cx, cz);
    buildChunkMesh(chunk);

    // Find height
    const lx = ((foundX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((foundZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    let landingY = 25;
    for (let ly = CHUNK_HEIGHT - 1; ly > 0; ly--) {
      const idx = (ly * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
      const b = chunk.blocks[idx];
      if (isGroundBlock(b)) {
        landingY = ly + 2.2;
        break;
      }
    }

    // Safely clear a 3x3 area of 4 blocks high above the landing point to guarantee the player does not suffocate or get trapped inside trees
    const landingYInt = Math.floor(landingY);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const clx = lx + dx;
        const clz = lz + dz;
        if (clx >= 0 && clx < CHUNK_SIZE && clz >= 0 && clz < CHUNK_SIZE) {
          for (let dy = 0; dy < 4; dy++) {
            const targetY = landingYInt + dy;
            if (targetY >= 0 && targetY < CHUNK_HEIGHT) {
              const idx = (targetY * CHUNK_SIZE + clz) * CHUNK_SIZE + clx;
              chunk.blocks[idx] = BlockType.AIR;
            }
          }
        }
      }
    }

    // Rebuild chunk mesh after clearing the blocks
    buildChunkMesh(chunk);

    playerPos.current.set(foundX + 0.5, landingY, foundZ + 0.5);
    playerVel.current.set(0, 0, 0);

    // Immediately trigger reloading of chunks around us
    const dist = settings.viewDistance;
    for (let dx = -dist; dx <= dist; dx++) {
      for (let dz = -dist; dz <= dist; dz++) {
        chunkQueue.current.push({ cx: cx + dx, cz: cz + dz, action: "load" });
      }
    }
  };

  /**
   * Checks which chunks are in radius, loads them, and unloads far ones.
   */
  const mapActiveChunksAroundPlayer = () => {
    const px = playerPos.current.x;
    const pz = playerPos.current.z;
    const currentCX = Math.floor(px / CHUNK_SIZE);
    const currentCZ = Math.floor(pz / CHUNK_SIZE);
    const dist = settings.viewDistance;
    const unloadDist = dist + 2;

    // A. Clean up far away chunks
    const toUnload: string[] = [];
    for (const [key, chunk] of chunksRef.current.entries()) {
      const dx = Math.abs(chunk.cx - currentCX);
      const dz = Math.abs(chunk.cz - currentCZ);
      if (dx > unloadDist || dz > unloadDist) {
        toUnload.push(key);
      }
    }
    for (const key of toUnload) {
      const chunk = chunksRef.current.get(key);
      if (chunk) {
        sceneRef.current?.remove(chunk.group);
        disposeChunkMesh(chunk);
        chunksRef.current.delete(key);
      }
    }

    // B. Inject missing chunks into the load queue
    for (let dx = -dist; dx <= dist; dx++) {
      for (let dz = -dist; dz <= dist; dz++) {
        const cx = currentCX + dx;
        const cz = currentCZ + dz;
        const key = `${cx},${cz}`;

        if (!chunksRef.current.has(key)) {
          // Check if already queued
          const alreadyQueued = chunkQueue.current.some((q) => q.cx === cx && q.cz === cz);
          if (!alreadyQueued) {
            chunkQueue.current.push({ cx, cz, action: "load" });
          }
        }
      }
    }

    // Sort queue based on proximity to player so nearest chunks generate first!
    chunkQueue.current.sort((a, b) => {
      const distA = Math.hypot(a.cx - currentCX, a.cz - currentCZ);
      const distB = Math.hypot(b.cx - currentCX, b.cz - currentCZ);
      return distA - distB;
    });
  };

  /**
   * Processes a single chunk loading/rebuilding task per frame.
   * This guarantees a steady 60fps frame rate and zero freeze lag during world generation.
   */
  const processChunkQueue = () => {
    if (chunkQueue.current.length === 0) return;

    const task = chunkQueue.current.shift()!;
    const chunk = loadChunkData(task.cx, task.cz);

    if (task.action === "load" || chunk.dirty) {
      buildChunkMesh(chunk);
    }
  };

  /**
   * Combines all visible solid faces inside a chunk into a single optimized BufferGeometry.
   */
  const buildChunkMesh = (chunk: any) => {
    // First, clear old geometries inside this chunk
    while (chunk.group.children.length > 0) {
      const c = chunk.group.children[0];
      chunk.group.remove(c);
    }

    const solidPos: number[] = [];
    const solidNorms: number[] = [];
    const solidColors: number[] = [];

    const waterPos: number[] = [];
    const waterNorms: number[] = [];
    const waterColors: number[] = [];

    const cx = chunk.cx;
    const cz = chunk.cz;

    // Helper to query block type including neighboring chunks
    const getBlockTypeWorld = (wx: number, wy: number, wz: number): BlockType => {
      if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockType.AIR;

      const ncx = Math.floor(wx / CHUNK_SIZE);
      const ncz = Math.floor(wz / CHUNK_SIZE);
      const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

      if (ncx === cx && ncz === cz) {
        const idx = (wy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
        return chunk.blocks[idx];
      }

      // Check if neighboring chunk is already loaded
      const key = `${ncx},${ncz}`;
      const nChunk = chunksRef.current.get(key);
      if (nChunk) {
        const idx = (wy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
        return nChunk.blocks[idx];
      }

      // Fallback: procedural heightmap query (slower but keeps border faces perfectly closed)
      const { height } = generatorRef.current.getTerrainHeight(wx, wz, settings);
      if (wy < height) {
        return BlockType.STONE; // generic solid block representation
      }
      if (wy <= settings.waterLevel) {
        return BlockType.WATER;
      }
      return BlockType.AIR;
    };

    // Sub-method to assemble geometry faces
    const addFace = (
      posArr: number[],
      normArr: number[],
      colArr: number[],
      x: number,
      y: number,
      z: number,
      nx: number,
      ny: number,
      nz: number,
      colorHex: number,
      wx: number,
      wy: number,
      wz: number
    ) => {
      const h = 0.5;
      let corners: number[][] = [];

      if (nx === 1) {
        corners = [
          [x + h, y - h, z - h],
          [x + h, y + h, z - h],
          [x + h, y + h, z + h],
          [x + h, y - h, z + h],
        ];
      } else if (nx === -1) {
        corners = [
          [x - h, y - h, z + h],
          [x - h, y + h, z + h],
          [x - h, y + h, z - h],
          [x - h, y - h, z - h],
        ];
      } else if (ny === 1) {
        corners = [
          [x - h, y + h, z - h],
          [x + h, y + h, z - h],
          [x + h, y + h, z + h],
          [x - h, y + h, z + h],
        ];
      } else if (ny === -1) {
        corners = [
          [x - h, y - h, z + h],
          [x + h, y - h, z + h],
          [x + h, y - h, z - h],
          [x - h, y - h, z - h],
        ];
      } else if (nz === 1) {
        corners = [
          [x + h, y - h, z + h],
          [x + h, y + h, z + h],
          [x - h, y + h, z + h],
          [x - h, y - h, z + h],
        ];
      } else if (nz === -1) {
        corners = [
          [x - h, y - h, z - h],
          [x - h, y + h, z - h],
          [x + h, y + h, z - h],
          [x + h, y - h, z - h],
        ];
      }

      // Add vertices forming two triangles (6 vertices)
      const indices = [0, 1, 2, 0, 2, 3];

      // Beautiful Custom Shading:
      // 1. Natural Directional Ambient: Sun shines from top (100% bright). Sides are slightly shadowed.
      let shade = 1.0;
      if (ny === 1) shade = 1.0;
      else if (ny === -1) shade = 0.5;
      else if (nx !== 0) shade = 0.72;
      else if (nz !== 0) shade = 0.85;

      // 2. Deterministic noise jitter: Adds an awesome pixelated/textured retro look!
      const noiseHash = Math.sin(wx * 12.989 + wy * 58.23 + wz * 113.19) * 43758.54;
      const jitter = 0.94 + (noiseHash - Math.floor(noiseHash)) * 0.12; // 0.94 to 1.06 scale

      // Base RGB
      const baseR = ((colorHex >> 16) & 0xff) / 255;
      const baseG = ((colorHex >> 8) & 0xff) / 255;
      const baseB = (colorHex & 0xff) / 255;

      const finalR = Math.max(0, Math.min(1, baseR * shade * jitter));
      const finalG = Math.max(0, Math.min(1, baseG * shade * jitter));
      const finalB = Math.max(0, Math.min(1, baseB * shade * jitter));

      for (const idx of indices) {
        const c = corners[idx];
        posArr.push(c[0], c[1], c[2]);
        normArr.push(nx, ny, nz);
        colArr.push(finalR, finalG, finalB);
      }
    };

    // Iterate blocks
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;

        for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
          const idx = (ly * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
          const block = chunk.blocks[idx];

          if (block === BlockType.AIR) continue;

          const isWater = block === BlockType.WATER;
          const details = BLOCK_DETAILS[block] || BLOCK_DETAILS[BlockType.STONE];

          // Check all 6 faces
          const faces = [
            { dx: 1, dy: 0, dz: 0, nx: 1, ny: 0, nz: 0 },
            { dx: -1, dy: 0, dz: 0, nx: -1, ny: 0, nz: 0 },
            { dx: 0, dy: 1, dz: 0, nx: 0, ny: 1, nz: 0 },
            { dx: 0, dy: -1, dz: 0, nx: 0, ny: -1, nz: 0 },
            { dx: 0, dy: 0, dz: 1, nx: 0, ny: 0, nz: 1 },
            { dx: 0, dy: 0, dz: -1, nx: 0, ny: 0, nz: -1 },
          ];

          for (const face of faces) {
            const nType = getBlockTypeWorld(wx + face.dx, ly + face.dy, wz + face.dz);

            // Draw face if neighboring block is transparent (or if drawing water, only draw if adjacent is Air/other transparent, but not adjacent water)
            let draw = false;
            if (isWater) {
              draw = nType === BlockType.AIR || (BLOCK_DETAILS[nType]?.isTransparent && nType !== BlockType.WATER);
            } else {
              draw = nType === BlockType.AIR || BLOCK_DETAILS[nType]?.isTransparent;
            }

            if (draw) {
              const posArr = isWater ? waterPos : solidPos;
              const normArr = isWater ? waterNorms : solidNorms;
              const colArr = isWater ? waterColors : solidColors;

              addFace(
                posArr,
                normArr,
                colArr,
                wx,
                ly,
                wz,
                face.nx,
                face.ny,
                face.nz,
                details.color,
                wx,
                ly,
                wz
              );
            }
          }
        }
      }
    }

    // A. Solid mesh
    if (solidPos.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(solidPos, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(solidNorms, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(solidColors, 3));

      const mat = new THREE.MeshLambertMaterial({
        vertexColors: true,
        flatShading: true,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geo, mat);
      chunk.group.add(mesh);
      chunk.mesh = mesh;
    }

    // B. Water mesh
    if (waterPos.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(waterPos, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(waterNorms, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(waterColors, 3));

      const mat = new THREE.MeshLambertMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.65,
        flatShading: true,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geo, mat);
      chunk.group.add(mesh);
      chunk.waterMesh = mesh;
    }

    chunk.dirty = false;
  };

  /**
   * Safe world boundary getter
   */
  const getBlockAtWorld = (wx: number, wy: number, wz: number): BlockType => {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockType.AIR;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    const key = `${cx},${cz}`;
    const chunk = chunksRef.current.get(key);
    if (!chunk) return BlockType.AIR;
    const idx = (wy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
    return chunk.blocks[idx];
  };

  /**
   * Safe world boundary setter
   */
  const setBlockAtWorld = (wx: number, wy: number, wz: number, type: BlockType) => {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    const key = `${cx},${cz}`;
    const chunk = chunksRef.current.get(key);
    if (!chunk) return;

    const idx = (wy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
    chunk.blocks[idx] = type;
    chunk.dirty = true;

    // Put this chunk back in the rebuild queue immediately so changes show up in the very next frame!
    const alreadyQueued = chunkQueue.current.some((q) => q.cx === cx && q.cz === cz && q.action === "rebuild");
    if (!alreadyQueued) {
      chunkQueue.current.unshift({ cx, cz, action: "rebuild" }); // unshift to place at front!
    }

    // Also update neighboring chunks if edited on chunk boundaries
    const neighbors = [
      { dx: 1, cxOffset: 1, czOffset: 0, borderL: 0, val: lx },
      { dx: -1, cxOffset: -1, czOffset: 0, borderL: CHUNK_SIZE - 1, val: lx },
      { dz: 1, cxOffset: 0, czOffset: 1, borderL: 0, val: lz },
      { dz: -1, cxOffset: 0, czOffset: -1, borderL: CHUNK_SIZE - 1, val: lz },
    ];
    for (const n of neighbors) {
      if (n.val === n.borderL) {
        const ncx = cx + n.cxOffset;
        const ncz = cz + n.czOffset;
        const nChunk = chunksRef.current.get(`${ncx},${ncz}`);
        if (nChunk) {
          nChunk.dirty = true;
          chunkQueue.current.push({ cx: ncx, cz: ncz, action: "rebuild" });
        }
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 5. PLAYER PHYSICS & COLLISION
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Collision checking against world blocks
   */
  const collidesWithTerrain = (pos: THREE.Vector3): boolean => {
    const r = 0.28; // player radius
    const h = 1.75; // player height

    const minX = Math.floor(pos.x - r);
    const maxX = Math.floor(pos.x + r);
    const minY = Math.floor(pos.y);
    const maxY = Math.floor(pos.y + h);
    const minZ = Math.floor(pos.z - r);
    const maxZ = Math.floor(pos.z + r);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const type = getBlockAtWorld(x, y, z);
          if (type !== BlockType.AIR && type !== BlockType.WATER) {
            // Precise overlap check
            const dx = Math.abs(pos.x - (x + 0.5));
            const dy = Math.abs(pos.y + h / 2 - (y + 0.5));
            const dz = Math.abs(pos.z - (z + 0.5));

            if (dx < r + 0.5 && dy < h / 2 + 0.5 && dz < r + 0.5) {
              return true;
            }
          }
        }
      }
    }
    return false;
  };

  const updatePlayerPhysics = () => {
    if (!cameraRef.current) return;

    // Apply rotation
    cameraRef.current.rotation.order = "YXZ";
    cameraRef.current.rotation.y = playerYaw.current;
    cameraRef.current.rotation.x = playerPitch.current;

    const forward = new THREE.Vector3();
    cameraRef.current.getWorldDirection(forward);

    // Calculate movement directions
    const forwardHoriz = forward.clone().setY(0).normalize();
    const rightHoriz = new THREE.Vector3().crossVectors(forwardHoriz, new THREE.Vector3(0, 1, 0)).normalize();

    const moveX = (keysPressed.current["a"] ? -1 : 0) + (keysPressed.current["d"] ? 1 : 0);
    const moveZ = (keysPressed.current["w"] ? 1 : 0) + (keysPressed.current["s"] ? -1 : 0);

    const moveDir = new THREE.Vector3();
    if (moveX !== 0 || moveZ !== 0) {
      moveDir.addScaledVector(rightHoriz, moveX);
      moveDir.addScaledVector(forwardHoriz, moveZ);
      moveDir.normalize();
    }

    const speed = settings.flightMode ? 0.32 : 0.095;
    const friction = 0.85;

    // Flight Mode controls
    if (settings.flightMode) {
      playerVel.current.x = moveDir.x * speed;
      playerVel.current.z = moveDir.z * speed;

      const flyUp = (keysPressed.current[" "] ? 1 : 0) + (keysPressed.current["shift"] ? -1 : 0);
      playerVel.current.y = flyUp * speed;

      playerOnGround.current = false;
    } else {
      // Normal Walking & Gravity controls
      const targetVx = moveDir.x * speed;
      const targetVz = moveDir.z * speed;

      playerVel.current.x += (targetVx - playerVel.current.x) * 0.25;
      playerVel.current.z += (targetVz - playerVel.current.z) * 0.25;

      // Apply gravity
      playerVel.current.y -= 0.009; // Gravity acceleration
      if (playerVel.current.y < -0.38) playerVel.current.y = -0.38; // Terminal velocity

      // Jump
      if (keysPressed.current[" "] && playerOnGround.current) {
        playerVel.current.y = 0.145;
        playerOnGround.current = false;
        sound.playJump();
      }
    }

    // Footstep Sound trigger
    const isMovingHoriz = Math.hypot(playerVel.current.x, playerVel.current.z) > 0.015;
    if (isMovingHoriz && playerOnGround.current && !settings.flightMode) {
      const stepInterval = 320; // ms
      const now = performance.now();
      if (now - lastStepTime.current > stepInterval) {
        lastStepTime.current = now;
        const standingOn = getBlockAtWorld(
          Math.floor(playerPos.current.x),
          Math.floor(playerPos.current.y - 1),
          Math.floor(playerPos.current.z)
        );
        sound.playFootstep(standingOn);
      }
    }

    // Sliding AABB Collision Solver
    const nextPos = playerPos.current.clone().add(playerVel.current);

    // 1. Solve X Collision
    const testX = playerPos.current.clone();
    testX.x = nextPos.x;
    if (!collidesWithTerrain(testX)) {
      playerPos.current.x = nextPos.x;
    } else {
      playerVel.current.x = 0;
    }

    // 2. Solve Z Collision
    const testZ = playerPos.current.clone();
    testZ.z = nextPos.z;
    if (!collidesWithTerrain(testZ)) {
      playerPos.current.z = nextPos.z;
    } else {
      playerVel.current.z = 0;
    }

    // 3. Solve Y Collision
    const testY = playerPos.current.clone();
    testY.y = nextPos.y;
    if (!collidesWithTerrain(testY)) {
      playerPos.current.y = nextPos.y;
      playerOnGround.current = false;
    } else {
      if (playerVel.current.y < 0) {
        playerOnGround.current = true;
      }
      playerVel.current.y = 0;
    }

    // Fall out of map protection
    if (playerPos.current.y < -10) {
      playerPos.current.set(0.5, 35, 0.5);
      playerVel.current.set(0, 0, 0);
    }

    // Position camera slightly higher inside Player box (eye level)
    cameraRef.current.position.copy(playerPos.current);
    cameraRef.current.position.y += 1.55;
  };

  // ═══════════════════════════════════════════════════════════════════
  // 6. BLOCK INTERACTION (BREAK / PLACE)
  // ═══════════════════════════════════════════════════════════════════

  const handleBlockInteraction = (mouseButton: number) => {
    if (!cameraRef.current || !sceneRef.current) return;

    const raycaster = new THREE.Raycaster();
    // Center of screen
    raycaster.setFromCamera(new THREE.Vector2(0, 0), cameraRef.current);

    // Filter to chunk meshes
    const meshes: THREE.Mesh[] = [];
    for (const chunk of chunksRef.current.values()) {
      if (chunk.mesh) meshes.push(chunk.mesh);
      if (chunk.waterMesh) meshes.push(chunk.waterMesh);
    }

    const hits = raycaster.intersectObjects(meshes);
    if (hits.length === 0) return;

    // Check interaction range
    const hit = hits[0];
    if (hit.distance > 5.5) return; // 5.5 block max reach distance

    const point = hit.point;
    const norm = hit.face!.normal;

    // A. Break Block (Left Click)
    if (mouseButton === 0) {
      // Offset slightly INTO the hit block to get its coordinate
      const bx = Math.round(point.x - norm.x * 0.45);
      const by = Math.round(point.y - norm.y * 0.45);
      const bz = Math.round(point.z - norm.z * 0.45);

      const type = getBlockAtWorld(bx, by, bz);
      if (type !== BlockType.AIR && type !== BlockType.BEDROCK) {
        setBlockAtWorld(bx, by, bz, BlockType.AIR);
        sound.playBreak(type);
      }
    }
    // B. Place Block (Right Click)
    else if (mouseButton === 2) {
      // Offset OUT of the hit block
      const bx = Math.round(point.x + norm.x * 0.45);
      const by = Math.round(point.y + norm.y * 0.45);
      const bz = Math.round(point.z + norm.z * 0.45);

      // Prevent placing a block directly inside the player's collision bounds!
      const px = playerPos.current.x;
      const py = playerPos.current.y;
      const pz = playerPos.current.z;

      // Player dimensions: width 0.6, height 1.8
      const overlapX = Math.abs(bx + 0.5 - px) < 0.8;
      const overlapY = by >= Math.floor(py) && by <= Math.floor(py + 1.8);
      const overlapZ = Math.abs(bz + 0.5 - pz) < 0.8;

      if (overlapX && overlapY && overlapZ && selectedBlock !== BlockType.WATER) {
        return; // blocked!
      }

      setBlockAtWorld(bx, by, bz, selectedBlock);
      sound.playPlace(selectedBlock);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 7. ENVIRONMENT CYCLE (DAY/NIGHT)
  // ═══════════════════════════════════════════════════════════════════

  const updateEnvironment = () => {
    const scene = sceneRef.current;
    if (!scene) return;

    const progress = settings.dayProgress;

    // Rotations: Sun/Moon rotate on opposite sides of sky
    const angle = progress * Math.PI * 2;
    const dist = 140;

    const sx = Math.cos(angle) * dist;
    const sy = Math.sin(angle) * dist;
    const sz = 0;

    if (sunLightRef.current) {
      sunLightRef.current.position.set(sx, sy, sz);
    }
    if (sunMeshRef.current) {
      sunMeshRef.current.position.set(sx, sy, sz);
    }

    if (moonMeshRef.current) {
      moonMeshRef.current.position.set(-sx, -sy, -sz);
    }

    // Determine environmental colors (sky & fog) based on sunset, night, sunrise, noon
    let skyColor = new THREE.Color(0x87ceeb); // noon sky blue
    let sunIntensity = 1.1;
    let starOpacity = 0.0;

    const yVal = Math.sin(angle); // Sun height factor (-1 to 1)

    if (yVal > 0.15) {
      // Bright Daytime
      skyColor.setHex(0x87ceeb);
      sunIntensity = 1.1;
      starOpacity = 0.0;
    } else if (yVal <= 0.15 && yVal > -0.15) {
      // Golden Hour Sunset / Sunrise
      const t = (yVal - (-0.15)) / 0.3; // 0 to 1 transition
      skyColor.lerpColors(new THREE.Color(0x0a0c1a), new THREE.Color(0xe07a5f), t);
      sunIntensity = t * 0.9;
      starOpacity = (1 - t) * 0.6;
    } else {
      // Pitch Black Night
      skyColor.setHex(0x060814);
      sunIntensity = 0.05;
      starOpacity = 0.85;
    }

    // Apply colors to scene background & fog
    scene.background = skyColor;
    if (scene.fog) {
      (scene.fog as THREE.FogExp2).color.copy(skyColor);
    }
    if (ambientLightRef.current) {
      ambientLightRef.current.color.copy(skyColor).multiplyScalar(0.7).addScalar(0.2);
    }
    if (sunLightRef.current) {
      sunLightRef.current.intensity = sunIntensity;
    }

    // Fade stars
    if (starfieldRef.current) {
      (starfieldRef.current.material as THREE.PointsMaterial).opacity = starOpacity;
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 8. TELEMETRY STATS BINDINGS
  // ═══════════════════════════════════════════════════════════════════

  const updateTelemetry = (time: number) => {
    frameCount.current++;

    if (time - lastPositionUpdate.current > 120) {
      lastPositionUpdate.current = time;

      // 1. Calculate FPS
      let fps = 60;
      if (time - lastFpsTime.current > 1000) {
        fps = Math.round((frameCount.current * 1000) / (time - lastFpsTime.current));
        frameCount.current = 0;
        lastFpsTime.current = time;
      }

      // 2. Count active blocks in memory
      let blockCount = 0;
      for (const chunk of chunksRef.current.values()) {
        for (let i = 0; i < chunk.blocks.length; i++) {
          if (chunk.blocks[i] !== BlockType.AIR) blockCount++;
        }
      }

      // 3. Get Player Biome
      const px = Math.floor(playerPos.current.x);
      const pz = Math.floor(playerPos.current.z);
      const bType = generatorRef.current.getBiome(px, pz, settings);

      onUpdateStats(
        chunksRef.current.size,
        blockCount,
        {
          x: Math.round(playerPos.current.x),
          y: Math.round(playerPos.current.y),
          z: Math.round(playerPos.current.z),
        },
        bType,
        fps
      );
    }
  };

  return (
    <div
      ref={containerRef}
      id="viewport"
      onClick={lockPointer}
      className="w-full h-full cursor-crosshair relative outline-none select-none overflow-hidden bg-[#090b14]"
    >
      {/* Visual Reticle crosshair */}
      <div
        id="hud-crosshair"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/50 pointer-events-none select-none text-2xl font-light mix-blend-difference z-10"
      >
        ✚
      </div>
    </div>
  );
};
