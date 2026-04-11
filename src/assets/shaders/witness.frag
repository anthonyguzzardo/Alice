// ─── Witness Fragment Shader v5 ─────────────────────────────────────
// Strategy-based materials: 6 material strategies blended by weights
// derived from 26 traits. Each strategy uses a different lighting model.
// Target: 5-7 snoise3 per pixel.

precision highp float;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vObjectPos;
varying float vDisplacement;
varying float vThickness;
varying float vFaceting;
varying float vTemperature;
varying float vScaleRegion;

uniform float uTime;
uniform float uReveal;
uniform float uMass;
uniform vec3 uCameraPos;

// 26 trait uniforms
uniform float uTopology;
uniform float uFaceting;
uniform float uHollowness;
uniform float uFragility;
uniform float uMultiplicity;
uniform float uScaleVariation;
uniform float uDensity;
uniform float uTranslucency;
uniform float uSurface;
uniform float uInternalLight;
uniform float uColorDepth;
uniform float uIridescence;
uniform float uLightResponse;
uniform float uFlow;
uniform float uRhythm;
uniform float uEdgeCharacter;
uniform float uAtmosphere;
uniform float uMagnetism;
uniform float uReactivity;
uniform float uTemperature;
uniform float uFlexibility;
uniform float uStoredEnergy;
uniform float uCreationCost;

// Material strategy weights (derived in JS from traits)
uniform float uMatStone;
uniform float uMatLiquid;
uniform float uMatCrystal;
uniform float uMatMetal;
uniform float uMatGas;
uniform float uMatEmber;

// ─── Simplex noise ─────────────────────────────────────────────────

vec4 permute(vec4 x) { return mod(((x * 34.0) + 10.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise3(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// ─── HSL to RGB ────────────────────────────────────────────────────

vec3 hsl2rgb(float h, float s, float l) {
  h = fract(h);
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
  float m = l - c * 0.5;
  vec3 rgb;
  float hh = h * 6.0;
  if (hh < 1.0) rgb = vec3(c, x, 0.0);
  else if (hh < 2.0) rgb = vec3(x, c, 0.0);
  else if (hh < 3.0) rgb = vec3(0.0, c, x);
  else if (hh < 4.0) rgb = vec3(0.0, x, c);
  else if (hh < 5.0) rgb = vec3(x, 0.0, c);
  else rgb = vec3(c, 0.0, x);
  return rgb + m;
}

// ─── Temperature-based color palette ───────────────────────────────

vec3 tempBaseColor(float temp, float density) {
  float darken = mix(1.2, 0.12, density * density);
  vec3 cold    = vec3(0.06, 0.1, 0.25) * darken;
  vec3 neutral = vec3(0.05, 0.05, 0.055) * darken;
  vec3 hot     = vec3(0.35, 0.06, 0.02) * darken;
  if (temp < 0.5) return mix(cold, neutral, temp * 2.0);
  else return mix(neutral, hot, (temp - 0.5) * 2.0);
}

vec3 tempGlowColor(float temp) {
  vec3 cold    = vec3(0.1, 0.2, 0.7);
  vec3 neutral = vec3(0.25, 0.15, 0.1);
  vec3 hot     = vec3(0.9, 0.15, 0.03);
  if (temp < 0.5) return mix(cold, neutral, temp * 2.0);
  else return mix(neutral, hot, (temp - 0.5) * 2.0);
}

vec3 tempEdgeColor(float temp) {
  vec3 cold    = vec3(0.15, 0.2, 0.35);
  vec3 neutral = vec3(0.12, 0.12, 0.14);
  vec3 hot     = vec3(0.35, 0.1, 0.05);
  if (temp < 0.5) return mix(cold, neutral, temp * 2.0);
  else return mix(neutral, hot, (temp - 0.5) * 2.0);
}

// ─── Material Strategy Functions ───────────────────────────────────

// STONE: Lambertian diffuse + subtle warm subsurface. Rough, matte.
vec3 stoneColor(vec3 base, float NdotL, float NdotV) {
  // Oren-Nayar approximation for rough diffuse
  float rough = 0.3 + uSurface * 0.6;
  float diffuse = NdotL * (1.0 - rough * 0.5 * (1.0 - NdotL));
  // Subtle subsurface for organic warmth
  float sss = pow(max(0.0, 1.0 - NdotL), 2.0) * 0.08;
  return base * (0.03 + diffuse * 0.15 + sss);
}

// LIQUID: Schlick fresnel + tight specular + caustic pattern. Water/glass.
vec3 liquidColor(vec3 base, vec3 halfDir, float NdotV, float fresnel) {
  // Tight specular (water-like)
  float spec = pow(max(0.0, dot(vNormal, halfDir)), 120.0);
  // Schlick fresnel
  float reflectivity = 0.04 + 0.96 * pow(1.0 - NdotV, 5.0);
  // Caustic pattern                                             [noise: 1]
  float caustic = snoise3(vWorldPos * 6.0 + uTime * 0.2);
  float causticPattern = pow(abs(caustic), 3.0) * 0.3;
  // Deep subsurface color
  vec3 deepColor = base * 1.5 + vec3(0.0, 0.02, 0.04);
  vec3 surfaceReflect = vec3(spec * reflectivity * 0.6);
  return mix(deepColor * 0.08, surfaceReflect, reflectivity * 0.5)
       + vec3(causticPattern) * base;
}

// CRYSTAL: Multi-lobe specular + thin-film iridescence. Faceted sparkle.
vec3 crystalColor(vec3 base, vec3 halfDir, float NdotV) {
  // Multiple specular lobes for sparkle
  float spec1 = pow(max(0.0, dot(vNormal, halfDir)), 200.0) * 0.8;
  float spec2 = pow(max(0.0, dot(vNormal, halfDir + vec3(0.02, -0.01, 0.015))), 150.0) * 0.4;
  // Iridescence: thin-film interference
  float iriAngle = NdotV * 6.2831853 + vDisplacement * 4.0;
  vec3 iriColor = vec3(
    sin(iriAngle) * 0.5 + 0.5,
    sin(iriAngle + 2.094) * 0.5 + 0.5,
    sin(iriAngle + 4.189) * 0.5 + 0.5
  ) * uIridescence;
  return base * 0.03 + vec3(spec1 + spec2) * 0.3 + iriColor * 0.15;
}

// METAL: Colored specular reflections + anisotropic streaks. Chrome/mercury.
vec3 metalColor(vec3 base, vec3 halfDir, float NdotV, float NdotL) {
  // Metals have colored specular (reflection tinted by base)
  float spec = pow(max(0.0, dot(vNormal, halfDir)), 60.0);
  float fresnelMetal = 0.5 + 0.5 * pow(1.0 - NdotV, 3.0);
  // Colored reflection
  vec3 reflColor = base * 2.0 + vec3(0.1);
  // Anisotropic streak (no noise — world position)
  float streak = pow(abs(sin(vWorldPos.y * 20.0 + vWorldPos.x * 5.0)), 8.0) * 0.15;
  return reflColor * spec * fresnelMetal * 0.4
       + base * NdotL * 0.05
       + vec3(streak) * base;
}

// GAS: Forward scattering + wispy structure. Volumetric/vapor.
vec3 gasColor(vec3 base, float NdotV) {
  // Wispy internal structure                                    [noise: 1]
  float wisps = snoise3(vWorldPos * 3.0 + uTime * 0.1 + 500.0);
  float wispPattern = abs(wisps) * 0.6 + 0.4;
  // Forward scattering (brighter when looking through)
  float scatter = pow(max(0.0, 1.0 - NdotV), 1.5) * 0.4;
  float localDensity = wispPattern * 0.3;
  return base * (scatter + localDensity * 0.1) + vec3(scatter * 0.03);
}

// EMBER: Emissive cracks + blackbody glow. Molten/incandescent.
vec3 emberColor(vec3 base, float NdotV) {
  // Crack/vein pattern                                          [noise: 1]
  float crackNoise = snoise3(vObjectPos * 5.0 + 300.0);
  float crackLine = 1.0 - smoothstep(0.0, 0.04, abs(crackNoise));
  // Blackbody glow color
  vec3 coolEmber = vec3(0.6, 0.1, 0.02);
  vec3 hotEmber = vec3(1.0, 0.4, 0.05);
  vec3 whiteHot = vec3(1.0, 0.9, 0.7);
  vec3 glowColor = mix(coolEmber, mix(hotEmber, whiteHot, uStoredEnergy), uTemperature);
  // Emissive from cracks
  float crackGlow = crackLine * 1.5;
  // Core glow (depth-dependent)
  float coreGlow = smoothstep(0.5, 0.0, NdotV) * uStoredEnergy * 2.0;
  // Pulse
  float pulse = 0.7 + 0.3 * sin(uTime * 0.8 + vObjectPos.y * 3.0);
  return glowColor * (crackGlow + coreGlow) * pulse;
}

// ─── Main ──────────────────────────────────────────────────────────

void main() {
  vec3 viewDir = normalize(uCameraPos - vWorldPos);
  float NdotV = abs(dot(vNormal, viewDir));

  // ─── Common lighting setup ────────────────────────────────
  float fresnel = 1.0 - NdotV;
  float fresnelPow = pow(fresnel, 2.5);

  vec3 lightDir = normalize(vec3(0.3, 1.0, 0.5));
  float NdotL = max(0.0, dot(vNormal, lightDir));
  vec3 halfDir = normalize(lightDir + viewDir);

  // ─── Base color from temperature + density ────────────────
  vec3 baseColor = tempBaseColor(vTemperature, uDensity);
  vec3 glowBaseColor = tempGlowColor(vTemperature);

  // Ethereal glow at low density
  float densityBright = (1.0 - uDensity) * 0.25;
  baseColor += vec3(densityBright);

  // Scale variation color shift
  float scaleShift = vScaleRegion * uScaleVariation * 0.1;
  baseColor *= (1.0 + scaleShift);

  // ─── Color depth hue variation (1 noise) ──────────────────  [noise: 1]
  float hueNoise = snoise3(vObjectPos * 1.5 + uTime * 0.01) * 0.15;
  float totalHueShift = hueNoise * uColorDepth;
  if (uColorDepth > 0.1) {
    vec3 hueShiftColor;
    if (vTemperature < 0.5) {
      hueShiftColor = hsl2rgb(0.6 + totalHueShift, 0.5 * uColorDepth, 0.06 + uInternalLight * 0.08);
    } else {
      hueShiftColor = hsl2rgb(0.02 + totalHueShift * 0.5, 0.6 * uColorDepth, 0.08 + uInternalLight * 0.1);
    }
    baseColor = mix(baseColor, hueShiftColor, uColorDepth * 0.5);
  }

  // ─── Blend material strategies ────────────────────────────
  // Sum of weights may be < 1.0; remainder is "neutral" base lighting
  float matWeightSum = uMatStone + uMatLiquid + uMatCrystal + uMatMetal + uMatGas + uMatEmber;
  float neutralWeight = max(0.0, 1.0 - matWeightSum);

  // Neutral base: simple diffuse + slight specular
  float neutralSpec = pow(max(0.0, dot(vNormal, halfDir)), 30.0) * 0.2;
  vec3 neutralColor = baseColor * (0.02 + NdotL * 0.1 + neutralSpec * uLightResponse);

  vec3 materialColor = neutralColor * neutralWeight
                     + stoneColor(baseColor, NdotL, NdotV)      * uMatStone
                     + liquidColor(baseColor, halfDir, NdotV, fresnel) * uMatLiquid
                     + crystalColor(baseColor, halfDir, NdotV)   * uMatCrystal
                     + metalColor(baseColor, halfDir, NdotV, NdotL) * uMatMetal
                     + gasColor(baseColor, NdotV)                * uMatGas
                     + emberColor(baseColor, NdotV)              * uMatEmber;

  // ─── Universal overlays ───────────────────────────────────

  // Internal glow (pure math)
  float glowDepth = smoothstep(0.4, 0.0, NdotV);
  float glowPulse = sin(uTime * 0.12 + vObjectPos.y * 2.0) * 0.3 + 0.7;
  float rhythmMod = 1.0 + uRhythm * 0.5 * sin(uTime * 0.4 + length(vObjectPos) * 3.0);
  vec3 glowColor = glowBaseColor * glowDepth * uInternalLight * glowPulse * rhythmMod;

  // Edge light (pure math) — always on for void visibility
  float edgeLight = fresnelPow * (0.15 + uDensity * 0.2 + uLightResponse * 0.15);
  float densityEdgeMod = mix(2.0, 0.15, uDensity);
  edgeLight *= densityEdgeMod;
  float edgeSoften = 1.0 - uEdgeCharacter * 0.5;
  edgeLight *= edgeSoften;
  vec3 edgeColor = tempEdgeColor(vTemperature) * edgeLight;

  // Atmosphere halo (1 noise)                                   [noise: 1]
  float atmosNoise = snoise3(vWorldPos * 5.0 + uTime * 0.2 + 500.0);
  float haloIntensity = pow(fresnel, 1.5) * uAtmosphere;
  float outerHalo = pow(fresnel, 0.8) * uAtmosphere * uAtmosphere * 0.5;
  vec3 haloColor = mix(vec3(0.04, 0.04, 0.06), glowBaseColor * 0.3, uInternalLight)
                 * (haloIntensity + outerHalo * (0.4 + abs(atmosNoise) * 0.6));

  // Magnetism chromatic aberration (1 gated noise)              [noise: 0-1]
  vec3 magColor = vec3(0.0);
  if (uMagnetism > 0.1) {
    float magN = snoise3(vWorldPos * 3.0 + viewDir * 2.0 + uTime * 0.05);
    float lensBase = fresnel * uMagnetism * uMagnetism;
    magColor = vec3(magN * 1.5, magN * 0.3, -magN * 1.0) * lensBase;
    // Color channel rotation at edges
    materialColor = mix(materialColor, materialColor.gbr, lensBase * 0.25);
  }

  // Stored energy pressure glow (pure math)
  float eSq = uStoredEnergy * uStoredEnergy;
  float eCube = eSq * uStoredEnergy;
  float pressureGlow = smoothstep(0.5, 0.0, NdotV) * eCube * 3.0;
  float pressurePulse = 1.0 + eSq * 0.6 * sin(uTime * 1.2 + vObjectPos.x * 3.0);
  vec3 pressureColor = glowBaseColor * pressureGlow * pressurePulse;
  // White-hot core at extreme energy
  vec3 whiteHot = vec3(1.0, 0.95, 0.8) * smoothstep(0.6, 1.0, uStoredEnergy)
                * (1.0 - NdotV * 0.5) * eCube * 2.0;
  pressureColor += whiteHot;

  // Reactivity shimmer (1 gated noise)                          [noise: 0-1]
  vec3 shimmerColor = vec3(0.0);
  if (uReactivity > 0.15) {
    float reactN = snoise3(vWorldPos * 8.0 + uTime * uReactivity * 8.0);
    float phaseFlip = smoothstep(-0.1, 0.1, reactN);
    shimmerColor = mix(vec3(0.0), baseColor.brg * 1.5 - baseColor, phaseFlip)
                 * uReactivity * uReactivity;
  }

  // Subsurface scattering
  float sssStrength = (1.0 - vThickness) * pow(fresnel, 0.8) * 0.8;
  sssStrength *= (0.3 + uTranslucency * 0.7);
  sssStrength *= (1.0 + uFlexibility * 0.4);
  vec3 sssCold    = vec3(0.15, 0.25, 0.6);
  vec3 sssNeutral = vec3(0.25, 0.12, 0.08);
  vec3 sssHot     = vec3(0.7, 0.12, 0.03);
  vec3 sssBaseColor;
  if (vTemperature < 0.5) {
    sssBaseColor = mix(sssCold, sssNeutral, vTemperature * 2.0);
  } else {
    sssBaseColor = mix(sssNeutral, sssHot, (vTemperature - 0.5) * 2.0);
  }
  vec3 sssColor = sssBaseColor * sssStrength;

  // Fragility crack glow (uses vFaceting from vertex shader)
  float crackGlow = vFaceting * uFragility * 0.8;
  vec3 crackCold = vec3(0.3, 0.5, 0.9);
  vec3 crackHot = vec3(1.0, 0.2, 0.03);
  vec3 crackColor = mix(crackCold, crackHot, vTemperature) * crackGlow;
  crackColor *= (0.7 + 0.3 * sin(uTime * 0.6 + vObjectPos.x * 5.0));

  // ─── Compose final color ──────────────────────────────────
  vec3 finalColor = materialColor
                  + sssColor
                  + glowColor
                  + edgeColor
                  + haloColor
                  + magColor
                  + pressureColor
                  + shimmerColor
                  + crackColor;

  // Density post-processing: at 1.0, absorb nearly everything
  float densityAbsorb = mix(1.0, 0.08, uDensity * uDensity * uDensity);
  finalColor *= densityAbsorb;
  // At max density, faintest edge survives
  float densityEdgeSurvive = fresnelPow * uDensity * uDensity * 0.04;
  finalColor += vec3(densityEdgeSurvive);

  // ─── Alpha ────────────────────────────────────────────────
  float baseAlpha = 0.25 + uDensity * 0.4 + fresnelPow * 0.25;
  baseAlpha *= (1.0 - uTranslucency * 0.4);
  baseAlpha *= (0.5 + vThickness * 0.5);
  baseAlpha *= (1.0 - uEdgeCharacter * fresnel * 0.6);
  // Atmosphere extends alpha at edges
  baseAlpha += uAtmosphere * pow(fresnel, 1.5) * 0.25;
  baseAlpha += uAtmosphere * uAtmosphere * pow(fresnel, 0.8) * 0.15;
  // Stored energy tightens containment
  baseAlpha += eSq * 0.2 * (1.0 - fresnel);
  baseAlpha += eCube * 0.3 * smoothstep(0.5, 0.0, fresnel);
  // Crack visibility
  baseAlpha += crackGlow * 0.2;
  // Flexibility: soft forms more translucent at edges
  baseAlpha -= uFlexibility * fresnel * 0.1;
  // Density extremes
  baseAlpha = mix(baseAlpha * 0.7, min(baseAlpha + 0.3, 1.0), uDensity);
  // Gas strategy makes things more transparent
  baseAlpha *= (1.0 - uMatGas * 0.3);

  baseAlpha *= uReveal;
  float alpha = clamp(baseAlpha, 0.0, 0.95);

  gl_FragColor = vec4(finalColor, alpha);
}
