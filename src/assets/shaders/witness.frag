// ─── Witness Fragment Shader v4 ─────────────────────────────────────
// 26-trait witness form rendering.
// Subsurface scattering, internal glow, temperature color, iridescence.
// Visible against void through edge light and internal radiance, not ambient.
// v4: High-leverage rework — every trait produces categorical visual differences.

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

// Form
uniform float uTopology;
uniform float uFaceting;
uniform float uHollowness;
uniform float uFragility;
uniform float uMultiplicity;
uniform float uScaleVariation;

// Material
uniform float uDensity;
uniform float uTranslucency;
uniform float uSurface;

// Light
uniform float uInternalLight;
uniform float uColorDepth;
uniform float uIridescence;
uniform float uLightResponse;

// Movement
uniform float uFlow;
uniform float uRhythm;

// Space
uniform float uEdgeCharacter;
uniform float uAtmosphere;
uniform float uMagnetism;
uniform float uReactivity;
uniform float uTemperature;
uniform float uFlexibility;
uniform float uStoredEnergy;
uniform float uCreationCost;

// ─── Simplex noise for fragment effects ──────────────────────────

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

// FBM for fragment use
float fbm3(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise3(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// ─── HSL to RGB ─────────────────────────────────────────────────────

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

void main() {
  vec3 viewDir = normalize(uCameraPos - vWorldPos);
  float NdotV = abs(dot(vNormal, viewDir));

  // ─── Fresnel ──────────────────────────────────────────────
  float fresnel = 1.0 - NdotV;
  float fresnelPow = pow(fresnel, 2.5);

  // ─── Temperature-driven base color ────────────────────────
  // cold(0) = deep blues/frost, neutral(0.5) = dark grays, hot(1) = deep reds/embers
  // ─── Density: extreme range from ethereal bright to black-hole heavy ──
  // At 0.0: ethereal, ambient-glowing, bright
  // At 1.0: impossibly dense, near-black, absorbs almost all light
  float densityDarken = mix(1.4, 0.08, uDensity * uDensity); // quadratic for dramatic dark end
  float densityBright = (1.0 - uDensity) * 0.3; // ethereal ambient glow at low density

  vec3 coldColor = vec3(0.06, 0.1, 0.25) * densityDarken;
  vec3 neutralColor = vec3(0.05, 0.05, 0.055) * densityDarken;
  vec3 hotColor = vec3(0.35, 0.06, 0.02) * densityDarken;

  vec3 tempColor;
  if (vTemperature < 0.5) {
    tempColor = mix(coldColor, neutralColor, vTemperature * 2.0);
  } else {
    tempColor = mix(neutralColor, hotColor, (vTemperature - 0.5) * 2.0);
  }

  // Ethereal glow at low density — the form glows from ambient light
  tempColor += vec3(densityBright);

  // ─── Scale variation: color shift for different sized regions ──
  float scaleColorShift = vScaleRegion * uScaleVariation * 0.15;
  // Larger regions (positive vScaleRegion) get warmer/brighter, smaller get cooler/darker
  vec3 scaleWarm = tempColor * (1.0 + scaleColorShift * 2.0);
  vec3 scaleCool = tempColor * (1.0 - abs(scaleColorShift) * 1.5);
  float scaleSelect = step(0.0, vScaleRegion); // 1.0 if positive, 0.0 if negative
  vec3 scaleTarget = mix(scaleCool, scaleWarm, scaleSelect);
  tempColor = mix(tempColor, scaleTarget, uScaleVariation * 0.7);

  // ─── Flexibility: surface softness / organic vs mineral ───────
  // High flex = soft, organic, slightly translucent surface appearance
  // Low flex = hard, mineral, crisp specular
  float flexSoften = uFlexibility * 0.5;
  // Soft organic subsurface tint at high flexibility
  vec3 organicTint = vec3(0.08, 0.04, 0.02) * uFlexibility; // warm organic undertone
  tempColor += organicTint;

  // ─── Color depth: hue variation across surface ────────────
  float surfaceHueShift = snoise3(vObjectPos * 2.0 + uTime * 0.01) * 0.15;
  float depthHueShift = snoise3(vObjectPos * 0.8 + 50.0) * 0.1;
  float totalHueShift = (surfaceHueShift + depthHueShift) * uColorDepth;

  // Apply hue shift in a way that preserves the temperature palette
  vec3 hueShiftColor;
  if (vTemperature < 0.5) {
    // Cold range: shift between blues and teals
    hueShiftColor = hsl2rgb(0.6 + totalHueShift, 0.5 * uColorDepth, 0.06 + uInternalLight * 0.08);
  } else {
    // Hot range: shift between reds, oranges, magentas
    hueShiftColor = hsl2rgb(0.02 + totalHueShift * 0.5, 0.6 * uColorDepth, 0.08 + uInternalLight * 0.1);
  }
  vec3 baseColor = mix(tempColor, hueShiftColor, uColorDepth * 0.6);

  // ─── Surface roughness ────────────────────────────────────
  // Polished(0) = sharp reflections, Eroded(1) = diffuse, rough
  // Flexibility softens surface — high flex = more diffuse/matte
  float roughness = 0.3 + uSurface * 0.6 + flexSoften * 0.3;
  roughness = min(roughness, 1.0);
  float specPower = mix(80.0, 3.0, roughness); // lower min for more dramatic soft

  // ─── Light response ───────────────────────────────────────
  // Low = absorbs (matte black hole), High = refracts/scatters (crystal catching light)
  vec3 lightDir = normalize(vec3(0.3, 1.0, 0.5));
  float NdotL = max(0.0, dot(vNormal, lightDir));
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(0.0, dot(vNormal, halfDir)), specPower);

  // Specular strength scales with light response
  float specIntensity = spec * uLightResponse * 0.6 * (1.0 - roughness * 0.5);
  // Crystal facets get extra specular
  specIntensity += spec * vFaceting * uLightResponse * 0.4;

  // Diffuse light (very subtle -- this is a void)
  float diffuse = NdotL * uLightResponse * 0.08;

  // At low lightResponse, absorb all light (darker)
  float absorb = 1.0 - (1.0 - uLightResponse) * 0.7;

  // ─── Subsurface scattering ────────────────────────────────
  // Light bleeding through thin regions
  float sssStrength = (1.0 - vThickness) * pow(fresnel, 0.8) * 1.2;
  sssStrength *= (0.3 + uTranslucency * 0.7);
  // Flexibility increases SSS — soft/organic things scatter more light
  sssStrength *= (1.0 + uFlexibility * 0.6);

  // SSS color follows temperature
  vec3 sssCold = vec3(0.15, 0.25, 0.6);   // icy blue bleed
  vec3 sssNeutral = vec3(0.25, 0.12, 0.08); // warm amber
  vec3 sssHot = vec3(0.7, 0.12, 0.03);     // molten red bleed
  vec3 sssBaseColor;
  if (vTemperature < 0.5) {
    sssBaseColor = mix(sssCold, sssNeutral, vTemperature * 2.0);
  } else {
    sssBaseColor = mix(sssNeutral, sssHot, (vTemperature - 0.5) * 2.0);
  }
  vec3 sssColor = sssBaseColor * sssStrength;

  // ─── Internal glow ────────────────────────────────────────
  // Deep light from within, controlled by internalLight trait
  float glowDepth = smoothstep(0.4, 0.0, NdotV); // strongest when looking through
  float glowPulse = sin(uTime * 0.12 + vObjectPos.y * 2.0) * 0.3 + 0.7;
  float rhythmPulse = 1.0 + uRhythm * 0.5 * sin(uTime * 0.4 + length(vObjectPos) * 3.0);
  float internalGlow = glowDepth * uInternalLight * 1.0 * glowPulse * rhythmPulse;

  // Internal glow color follows temperature with more saturation
  vec3 glowCold = vec3(0.1, 0.2, 0.7);
  vec3 glowNeutral = vec3(0.25, 0.15, 0.1);
  vec3 glowHot = vec3(0.9, 0.15, 0.03);
  vec3 glowBaseColor;
  if (vTemperature < 0.5) {
    glowBaseColor = mix(glowCold, glowNeutral, vTemperature * 2.0);
  } else {
    glowBaseColor = mix(glowNeutral, glowHot, (vTemperature - 0.5) * 2.0);
  }
  vec3 glowColor = glowBaseColor * internalGlow;

  // ─── Stored energy: BLINDING internal pressure ────────────
  // At 1.0 the form contains a sun — light overpowers everything
  float eSq = uStoredEnergy * uStoredEnergy;
  float eCube = eSq * uStoredEnergy; // cubic for truly explosive high end

  // Deep pressure glow — gets exponentially brighter
  float pressureGlow = smoothstep(0.5, 0.0, NdotV) * eCube * 3.0;
  // Pulsing intensifies with stored energy
  float pressurePulse = 1.0 + eSq * 0.8 * sin(uTime * 1.2 + vObjectPos.x * 3.0);
  pressurePulse *= 1.0 + eSq * 0.4 * sin(uTime * 3.7 + vObjectPos.y * 5.0);
  vec3 pressureColor = glowBaseColor * pressureGlow * pressurePulse;

  // At very high energy, white-hot core bleeds through everywhere
  float coreBleed = smoothstep(0.6, 1.0, uStoredEnergy) * (1.0 - NdotV * 0.5);
  vec3 whiteHot = vec3(1.0, 0.95, 0.8) * coreBleed * eCube * 2.0;
  pressureColor += whiteHot;

  // Energy also boosts internal glow massively
  internalGlow += glowDepth * eCube * 2.5 * (0.6 + 0.4 * sin(uTime * 0.8));
  glowColor = glowBaseColor * internalGlow;

  // ─── Edge light ───────────────────────────────────────────
  // Makes the form visible in the void without ambient light
  float edgeLight = fresnelPow * (0.15 + uDensity * 0.2 + uLightResponse * 0.15);

  // Edge dissolution softens the edge
  float edgeSoften = 1.0 - uEdgeCharacter * 0.5;
  edgeLight *= edgeSoften;

  // Density at extremes: at 0.0 edges glow bright, at 1.0 edges are barely visible
  float densityEdgeMod = mix(2.0, 0.15, uDensity);
  edgeLight *= densityEdgeMod;

  vec3 edgeColor;
  if (vTemperature < 0.5) {
    edgeColor = mix(vec3(0.15, 0.2, 0.35), vec3(0.12, 0.12, 0.14), vTemperature * 2.0);
  } else {
    edgeColor = mix(vec3(0.12, 0.12, 0.14), vec3(0.35, 0.1, 0.05), (vTemperature - 0.5) * 2.0);
  }
  edgeColor *= edgeLight;

  // ─── Atmosphere: dramatic multi-layer halo / corona ───────
  // Inner halo: tight glow near the surface
  float haloFresnel = pow(fresnel, 1.5);
  float haloIntensity = haloFresnel * uAtmosphere * 1.2;
  // Outer atmosphere: very wide, softer corona that extends far
  float outerFresnel = pow(fresnel, 0.8); // catches much more area
  float outerHaloIntensity = outerFresnel * uAtmosphere * uAtmosphere * 0.6;
  // Particle noise in the atmosphere — breaks it up into wisps
  float atmosNoise1 = snoise3(vWorldPos * 4.0 + uTime * 0.15 + vec3(500.0));
  float atmosNoise2 = snoise3(vWorldPos * 8.0 + uTime * 0.3 + vec3(550.0));
  float particlePattern = abs(atmosNoise1) * 0.6 + abs(atmosNoise2) * 0.4;
  // Inner halo color
  vec3 innerHaloColor = mix(vec3(0.06, 0.06, 0.08), glowBaseColor * 0.4, uInternalLight);
  innerHaloColor *= haloIntensity;
  // Outer corona — more diffuse, slightly different color
  vec3 outerHaloColor = mix(vec3(0.03, 0.04, 0.06), glowBaseColor * 0.2, uInternalLight + uStoredEnergy * 0.3);
  outerHaloColor *= outerHaloIntensity * (0.4 + particlePattern * 0.6);
  // Combine
  vec3 haloColor = innerHaloColor + outerHaloColor;
  // At high atmosphere, add shimmering distortion
  float atmosShimmer = snoise3(vWorldPos * 12.0 + uTime * uAtmosphere * 2.0) * uAtmosphere * uAtmosphere * 0.1;
  haloColor += vec3(abs(atmosShimmer)) * glowBaseColor;

  // ─── Magnetism: heavy chromatic aberration + gravitational lensing ──
  float magSq = uMagnetism * uMagnetism;
  float lensFresnel = pow(fresnel, 1.0); // very broad effect

  // Heavy chromatic aberration — dramatically split RGB at edges
  float lensBase = lensFresnel * magSq;
  // Sample noise at offset positions to simulate spatial distortion
  float magNoise1 = snoise3(vWorldPos * 3.0 + viewDir * 2.0 + uTime * 0.05);
  float magNoise2 = snoise3(vWorldPos * 3.0 + viewDir * 2.0 + uTime * 0.05 + vec3(10.0));
  float magNoise3 = snoise3(vWorldPos * 3.0 + viewDir * 2.0 + uTime * 0.05 + vec3(20.0));

  // RGB channels split in different directions — extreme at 1.0
  vec3 magnetismColor = vec3(
    magNoise1 * lensBase * 1.5,
    magNoise2 * lensBase * 0.4,
    magNoise3 * lensBase * -1.2
  );

  // Gravitational lensing: warp/brighten edges as if bending background light
  float lensWarp = pow(fresnel, 0.6) * magSq;
  float lensPattern = snoise3(vWorldPos * 5.0 + viewDir * 4.0 + uTime * 0.08);
  // Lensing creates bright arcs near the silhouette
  float lensArc = smoothstep(0.3, 0.9, fresnel) * magSq;
  vec3 lensingGlow = vec3(0.08, 0.06, 0.12) * lensArc * 2.0 * (0.5 + abs(lensPattern) * 0.5);
  magnetismColor += lensingGlow;

  // Space distortion: warp the surface colors themselves
  float magDistort = lensWarp * 0.3;
  baseColor = mix(baseColor, baseColor.gbr, magDistort); // color channel rotation near edges

  // ─── Reactivity: boiling phase-change surface ─────────────
  float reactSq = uReactivity * uReactivity;
  // Multiple fast-moving noise layers — surface looks like it's boiling
  float reactShimmer1 = snoise3(vWorldPos * 6.0 + uTime * uReactivity * 8.0);
  float reactShimmer2 = snoise3(vWorldPos * 12.0 + uTime * uReactivity * 12.0 + 40.0);
  float reactShimmer3 = snoise3(vWorldPos * 20.0 + uTime * uReactivity * 18.0 + 80.0);
  // Phase-change color flipping: colors abruptly shift
  float phaseNoise = snoise3(vWorldPos * 3.0 + uTime * uReactivity * 5.0 + 120.0);
  float phaseFlip = smoothstep(-0.1, 0.1, phaseNoise); // sharp transition
  // Combine into intense surface instability
  float reactiveIntensity = (reactShimmer1 * 0.5 + reactShimmer2 * 0.3 + reactShimmer3 * 0.2);
  float reactiveShimmer = reactiveIntensity * reactiveIntensity * reactSq * 2.0;
  // Color shifts during phase change — hue rotates chaotically
  vec3 shimmerColor = baseColor * reactiveShimmer * 3.0;
  // Phase flip creates abrupt color inversions at high reactivity
  vec3 phaseColor = mix(baseColor, baseColor.brg * 1.5, phaseFlip * reactSq);
  shimmerColor += (phaseColor - baseColor) * reactSq * 0.8;

  // ─── Creation cost: dense layered visual texture ──────────
  float ccSq = uCreationCost * uCreationCost;
  // Multiple overlapping pattern systems at different scales and orientations
  float ccPattern1 = snoise3(vObjectPos * 8.0 + 400.0) * snoise3(vObjectPos * 12.0 + 410.0);
  float ccPattern2 = snoise3(vObjectPos * 16.0 + 420.0) * snoise3(vObjectPos * 20.0 + 430.0);
  float ccPattern3 = snoise3(vObjectPos * 30.0 + 440.0) * snoise3(vObjectPos * 25.0 + 450.0);
  // Wood-grain / fingerprint concentric patterns
  float ccRing = sin(length(vObjectPos.xy) * 40.0 + snoise3(vObjectPos * 3.0 + 460.0) * 4.0);
  // Geological strata — horizontal bands warped by noise
  float ccStrata = sin(vObjectPos.y * 30.0 + snoise3(vObjectPos * 2.0 + 470.0) * 6.0);
  // FBM for organic complexity
  float ccFBM = fbm3(vObjectPos * 6.0 + 480.0, 6);

  // Combine all patterns into layered visual density
  float complexityDetail = (abs(ccPattern1) * 0.25 + abs(ccPattern2) * 0.2 + abs(ccPattern3) * 0.15
                          + abs(ccRing) * 0.15 + abs(ccStrata) * 0.1 + abs(ccFBM) * 0.15) * ccSq;
  // Color variation within the complexity layers
  vec3 complexityColor = baseColor * complexityDetail * 4.0;
  // Different layers contribute slightly different hues
  float ccHueVar = (ccPattern1 - ccPattern2 + ccRing * 0.5) * ccSq * 0.08;
  complexityColor += vec3(ccHueVar, -ccHueVar * 0.5, ccHueVar * 0.3);

  // ─── Fragility: glowing crack lines ───────────────────────
  // vFaceting contains crack information from vertex shader
  float crackGlow = vFaceting * uFragility * 1.2; // bright stress fractures
  // Cracks glow with temperature-appropriate color
  vec3 crackCold = vec3(0.3, 0.5, 0.9);
  vec3 crackHot = vec3(1.0, 0.2, 0.03);
  vec3 crackColor = mix(crackCold, crackHot, vTemperature) * crackGlow;
  // Stress fracture pulsing
  crackColor *= (0.7 + 0.3 * sin(uTime * 0.6 + vObjectPos.x * 5.0));

  // ─── Iridescence: angle-dependent color shifts ────────────
  float iriAngle = NdotV * 6.2831853 + vDisplacement * 4.0;
  vec3 iriColor = vec3(
    sin(iriAngle) * 0.5 + 0.5,
    sin(iriAngle + 2.094) * 0.5 + 0.5,
    sin(iriAngle + 4.189) * 0.5 + 0.5
  );
  iriColor = mix(vec3(0.0), iriColor * 0.2, uIridescence); // vivid prismatic at 1.0

  // ─── Compose final color ──────────────────────────────────
  vec3 surfaceColor = baseColor * (0.02 + diffuse + specIntensity) * absorb;
  surfaceColor += complexityColor;

  vec3 finalColor = surfaceColor
                  + sssColor
                  + glowColor
                  + edgeColor
                  + haloColor
                  + magnetismColor
                  + pressureColor
                  + crackColor
                  + shimmerColor
                  + iriColor;

  // ─── Density post-processing: at 1.0, absorb nearly everything ──
  // This is a final pass that crushes light at high density
  float densityAbsorb = mix(1.0, 0.06, uDensity * uDensity * uDensity); // cubic = dramatic
  finalColor *= densityAbsorb;
  // At max density, only the faintest edge definition survives
  float densityEdgeSurvive = fresnelPow * uDensity * uDensity * 0.04;
  finalColor += vec3(densityEdgeSurvive);

  // ─── Alpha ────────────────────────────────────────────────
  float baseAlpha = 0.25 + uDensity * 0.4 + fresnelPow * 0.25;
  // Translucency reduces opacity
  baseAlpha *= (1.0 - uTranslucency * 0.4);
  // Hollowness makes thin regions more transparent
  baseAlpha *= (0.5 + vThickness * 0.5);
  // Edge character dissolves edges
  baseAlpha *= (1.0 - uEdgeCharacter * fresnel * 0.6);
  // Atmosphere extends alpha at edges — more aggressive
  baseAlpha += uAtmosphere * haloFresnel * 0.25;
  baseAlpha += uAtmosphere * uAtmosphere * outerFresnel * 0.15; // outer atmosphere alpha
  // Stored energy tightens containment (more opaque at high energy)
  baseAlpha += eSq * 0.2 * (1.0 - fresnel);
  // At max energy, core is fully opaque — containing a sun
  baseAlpha += eCube * 0.3 * smoothstep(0.5, 0.0, fresnel);
  // Crack lines are more visible
  baseAlpha += crackGlow * 0.2;
  // Flexibility: soft forms are slightly more translucent at edges
  baseAlpha -= uFlexibility * fresnel * 0.1;
  // Density at extremes: low density is more transparent, high is more opaque
  baseAlpha = mix(baseAlpha * 0.7, min(baseAlpha + 0.3, 1.0), uDensity);

  baseAlpha *= uReveal;
  float alpha = clamp(baseAlpha, 0.0, 0.95);

  gl_FragColor = vec4(finalColor, alpha);
}
