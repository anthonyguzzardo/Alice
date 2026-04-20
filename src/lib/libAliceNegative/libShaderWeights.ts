// ─── Shader Weight Derivation ───────────────────────────────────────
// Translates 26 witness traits into strategy blend weights for v5 shaders.
// Called every frame from lerped trait values. Pure arithmetic, no allocations.

import type { WitnessTraits } from './libTypes.js';

export interface ShaderWeights {
  // Shape strategies (vertex deformation)
  shapeLiquid: number;
  shapeCrystal: number;
  shapeOrganic: number;
  shapeShatter: number;
  shapeVapor: number;

  // Material strategies (fragment lighting model)
  matStone: number;
  matLiquid: number;
  matCrystal: number;
  matMetal: number;
  matGas: number;
  matEmber: number;
}

export const WEIGHT_KEYS: (keyof ShaderWeights)[] = [
  'shapeLiquid', 'shapeCrystal', 'shapeOrganic', 'shapeShatter', 'shapeVapor',
  'matStone', 'matLiquid', 'matCrystal', 'matMetal', 'matGas', 'matEmber',
];

export function weightUniformName(key: keyof ShaderWeights): string {
  return 'u' + key.charAt(0).toUpperCase() + key.slice(1);
}

export function deriveShaderWeights(traits: WitnessTraits): ShaderWeights {
  const {
    topology, faceting, stretch, hollowness, symmetry,
    scaleVariation, multiplicity, fragility,
    density, translucency, surface,
    internalLight, colorDepth, iridescence, lightResponse,
    flow, rhythm, rotation,
    edgeCharacter, atmosphere, magnetism, reactivity,
    temperature, flexibility, storedEnergy, creationCost,
  } = traits;

  // ─── Shape strategy weights ──────────────────────────────────
  // Each captures a fundamentally different geometric archetype.
  // "Sphere" is implicit: (1 - sum) retains the undisplaced sphere.

  // Liquid: flowing sine-wave displacement. High flow, not faceted, warm helps.
  const shapeLiquid = flow * (1.0 - faceting) * (0.4 + temperature * 0.6)
                    * (0.3 + flexibility * 0.7);

  // Crystal: hard planar facets via voronoi quantization. High faceting, low flow, dense.
  const shapeCrystal = faceting * (1.0 - flow * 0.8) * (0.3 + density * 0.7)
                     * (1.0 - flexibility * 0.5);

  // Organic: smooth large-scale topology deformation (geological layer).
  const shapeOrganic = topology * (1.0 - faceting * 0.7) * (1.0 - multiplicity * 0.6)
                     + creationCost * 0.3 * topology;

  // Shatter: cluster separation + crack displacement. Multiplicity + fragility.
  const shapeShatter = Math.max(multiplicity, fragility * 0.7)
                     * (1.0 - flow * 0.5) * (1.0 - flexibility * 0.4);

  // Vapor: edge dissolution + hollowing. Edge character + low density + atmosphere.
  const shapeVapor = edgeCharacter * (1.0 - density * 0.7) * (0.3 + atmosphere * 0.5)
                   + hollowness * 0.3 * (1.0 - density);

  // Normalize so total shape weight <= 1.0 (sphere is the remainder)
  const shapeSum = shapeLiquid + shapeCrystal + shapeOrganic + shapeShatter + shapeVapor;
  const shapeScale = shapeSum > 1.0 ? 1.0 / shapeSum : 1.0;

  // ─── Material strategy weights ───────────────────────────────

  // Stone: rough, dense, opaque, not hot.
  const matStone = surface * density * (1.0 - translucency * 0.7) * (1.0 - temperature * 0.5);

  // Liquid: translucent + flowing, like water or glass.
  const matLiquid = translucency * (0.3 + flow * 0.7) * lightResponse
                  * (1.0 - surface * 0.6);

  // Crystal: faceted + translucent + light-catching, hard.
  const matCrystal = faceting * (0.4 + translucency * 0.6) * lightResponse
                   * (1.0 - flexibility * 0.5);

  // Metal: dense + reflective + smooth. Chrome/mercury.
  const matMetal = density * lightResponse * (1.0 - surface) * (1.0 - translucency * 0.6)
                 * (0.3 + iridescence * 0.4 + flow * 0.3);

  // Gas: low density + atmospheric. Volumetric scatter.
  const matGas = (1.0 - density) * (0.3 + edgeCharacter * 0.4 + atmosphere * 0.3)
               * (1.0 - surface * 0.5);

  // Ember: hot + glowing + energetic. Molten/incandescent.
  const matEmber = temperature * (0.3 + internalLight * 0.4 + storedEnergy * 0.3)
                 * (0.5 + fragility * 0.3 + density * 0.2);

  const matSum = matStone + matLiquid + matCrystal + matMetal + matGas + matEmber;
  const matScale = matSum > 1.0 ? 1.0 / matSum : 1.0;

  return {
    shapeLiquid: shapeLiquid * shapeScale,
    shapeCrystal: shapeCrystal * shapeScale,
    shapeOrganic: shapeOrganic * shapeScale,
    shapeShatter: shapeShatter * shapeScale,
    shapeVapor: shapeVapor * shapeScale,
    matStone: matStone * matScale,
    matLiquid: matLiquid * matScale,
    matCrystal: matCrystal * matScale,
    matMetal: matMetal * matScale,
    matGas: matGas * matScale,
    matEmber: matEmber * matScale,
  };
}
