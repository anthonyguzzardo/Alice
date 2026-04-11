// ─── Witness Vertex Shader v5 ───────────────────────────────────────
// Strategy-based deformation: 5 shape strategies blended by weights
// derived from 26 traits. Each strategy uses categorically different
// math — not just different noise parameters.
// Target: 12-14 snoise3 per vertex.

uniform float uTime;
uniform float uReveal;
uniform float uMass;

// 26 trait uniforms (modulators within strategies)
uniform float uTopology;
uniform float uFaceting;
uniform float uStretch;
uniform float uHollowness;
uniform float uSymmetry;
uniform float uScaleVariation;
uniform float uMultiplicity;
uniform float uFragility;
uniform float uDensity;
uniform float uTranslucency;
uniform float uSurface;
uniform float uInternalLight;
uniform float uColorDepth;
uniform float uIridescence;
uniform float uLightResponse;
uniform float uFlow;
uniform float uRhythm;
uniform float uRotation;
uniform float uEdgeCharacter;
uniform float uAtmosphere;
uniform float uMagnetism;
uniform float uReactivity;
uniform float uTemperature;
uniform float uFlexibility;
uniform float uStoredEnergy;
uniform float uCreationCost;

// Strategy blend weights (derived in JS from traits)
uniform float uShapeLiquid;
uniform float uShapeCrystal;
uniform float uShapeOrganic;
uniform float uShapeShatter;
uniform float uShapeVapor;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vObjectPos;
varying float vDisplacement;
varying float vThickness;
varying float vFaceting;
varying float vTemperature;
varying float vScaleRegion;

// ─── 3D Simplex Noise ──────────────────────────────────────────────

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

// ─── Shape Strategy Functions ──────────────────────────────────────

// LIQUID: overlapping sine waves at irrational frequency ratios
// Produces smooth, flowing, wave-like surface — water, ferrofluid, blob
float liquidDisp(vec3 p, float t) {
  float flowSpeed = 0.05 + uFlow * 0.4;
  // 3 sine waves at irrational ratios — no noise needed for base
  float wave1 = sin(p.x * 3.17 + p.y * 2.73 + t * flowSpeed * 3.0) * 0.4;
  float wave2 = sin(p.y * 4.31 + p.z * 1.87 + t * flowSpeed * 2.1) * 0.3;
  float wave3 = sin(p.z * 2.53 + p.x * 3.91 + t * flowSpeed * 3.9) * 0.3;
  // 1 noise call for organic modulation envelope                [noise: 1]
  float envelope = snoise3(p * 0.8 + t * flowSpeed * 0.1);
  return (wave1 + wave2 + wave3) * (0.5 + envelope * 0.5) * 0.35;
}

// CRYSTAL: pseudo-voronoi plane quantization
// Snaps displacement to discrete levels — flat faceted planes with sharp edges
float crystalDisp(vec3 p) {
  float facetFreq = 2.0 + uFaceting * 6.0;
  // Cell regions                                                [noise: 2]
  float cell = snoise3(p * facetFreq * 0.5 + 100.0);
  float detail = snoise3(p * facetFreq * 1.5 + 200.0);
  // Quantize to discrete planes (floor creates flat regions)
  float quantized = floor(cell * 4.0 + 0.5) / 4.0;
  float subFacet = floor(detail * 8.0 + 0.5) / 8.0;
  // Sharp boundary between planes
  float edge = 1.0 - smoothstep(0.0, 0.02, abs(cell - quantized));
  return (quantized * 0.25 + subFacet * 0.08) - edge * 0.05;
}

// ORGANIC: 2-octave simplex noise for geological deformation
// Large-scale reshaping — mountains, valleys, bulges
float organicDisp(vec3 p, float t) {
  float geoFreq = 0.6 + uTopology * 0.4;
  // 2-octave noise                                              [noise: 2]
  float n1 = snoise3(p * geoFreq + t * 0.003);
  float n2 = snoise3(p * (geoFreq * 1.4) + vec3(50.0) + t * 0.002);
  float geo = n1 * 0.65 + n2 * 0.35;
  // At high topology, sharpen into ridges
  float shaped = mix(geo, sign(geo) * pow(abs(geo), 0.3), uTopology * 0.7);
  return shaped * (0.05 + uTopology * 0.6);
}

// SHATTER: cluster separation + crack discontinuities
// Identifies regions and creates gaps/cracks between them
float shatterDisp(vec3 p) {
  // Cluster region identification                               [noise: 1]
  float clusterID = snoise3(p * 1.2 + 170.0);
  // Crack boundary detection (mathematical, from noise)
  float boundary = 1.0 - smoothstep(0.0, 0.08, abs(clusterID));
  // Gaps at boundaries, push clusters apart
  float gapDisp = -uMultiplicity * 0.5 * boundary;
  float pushDisp = uMultiplicity * 0.35 * sign(clusterID) * (1.0 - boundary);
  // Crack detail within clusters                                [noise: 2]
  float crackNoise = snoise3(p * 4.0 + 250.0);
  float crackLine = 1.0 - smoothstep(0.0, 0.03 + (1.0 - uFragility) * 0.08, abs(crackNoise));
  float crackDisp = uFragility * 0.2 * crackLine * sign(clusterID);
  return gapDisp + pushDisp + crackDisp;
}

// VAPOR: edge dissolution + hollowing
// Dissolves geometry — some vertices collapse, others wisp outward
float vaporDisp(vec3 p, float t) {
  // Dissolution mask                                            [noise: 1]
  float mask = snoise3(p * 1.5 + t * 0.02 + 60.0);
  float dissolved = smoothstep(-0.2, 0.3, mask);
  // Inward collapse for hollowness (mathematical — distance from center)
  float centerDist = length(p);
  float collapse = -uHollowness * 0.5 * smoothstep(0.8, 0.2, centerDist);
  // Edge dissolution
  float edgeDisp = -uEdgeCharacter * 0.3 * dissolved;
  return edgeDisp + collapse;
}

// ─── Main ──────────────────────────────────────────────────────────

void main() {
  vec3 pos = position;
  vec3 norm = normal;
  float t = uTime;

  // ─── Rotation (pure trig, 0 noise) ──────────────────────────
  float rotAngle = t * uRotation * 8.0;
  float cosR = cos(rotAngle);
  float sinR = sin(rotAngle);
  float rotAngle2 = t * uRotation * 4.96;
  float cosR2 = cos(rotAngle2);
  float sinR2 = sin(rotAngle2);
  // Y-axis rotation
  vec3 rotPos = vec3(
    pos.x * cosR + pos.z * sinR,
    pos.y,
    -pos.x * sinR + pos.z * cosR
  );
  // X-axis tumble
  vec3 tumblePos = vec3(
    rotPos.x,
    rotPos.y * cosR2 - rotPos.z * sinR2,
    rotPos.y * sinR2 + rotPos.z * cosR2
  );
  pos = mix(pos, tumblePos, uRotation);
  // Rotate normal to match
  vec3 rotNorm = vec3(
    norm.x * cosR + norm.z * sinR,
    norm.y,
    -norm.x * sinR + norm.z * cosR
  );
  vec3 tumbleNorm = vec3(
    rotNorm.x,
    rotNorm.y * cosR2 - rotNorm.z * sinR2,
    rotNorm.y * sinR2 + rotNorm.z * cosR2
  );
  norm = normalize(mix(norm, tumbleNorm, uRotation));

  // ─── Breathing / Rhythm (pure sin, 0 noise) ─────────────────
  float breathRate = 4.0 + (1.0 - uRhythm) * 25.0;
  float breathDepth = 0.01 + uRhythm * 0.45;
  float breathPhase = t / breathRate * 6.2831853;
  float breathRaw = sin(breathPhase);
  // Flexibility adds harmonic overtone
  float flexOvertone = sin(breathPhase * 2.3) * 0.5;
  float breathElastic = breathRaw + uFlexibility * flexOvertone * breathRaw;
  float breath = breathElastic * breathDepth;
  pos *= 1.0 + breath;

  // ─── Stretch (pure math, 0 noise) ───────────────────────────
  vec3 stretchAxis = normalize(vec3(uSymmetry * 0.3, 1.0, uSymmetry * 0.15));
  float axisProjection = dot(pos, stretchAxis);
  pos += stretchAxis * axisProjection * uStretch * 1.5;
  vec3 perpComponent = pos - stretchAxis * dot(pos, stretchAxis);
  pos -= perpComponent * uStretch * 0.3;

  // ─── Scale variation (1 noise for region ID) ────────────────  [noise: 1]
  float scaleRegion = snoise3(pos * 0.25 + 150.0);
  float localScale = 1.0 + uScaleVariation * 0.6
                   * sign(scaleRegion) * pow(abs(scaleRegion), 0.7);
  localScale = max(localScale, 0.2);
  pos *= localScale;
  vScaleRegion = scaleRegion;

  // ─── Blend deformation strategies ───────────────────────────
  float dispLiquid  = liquidDisp(pos, t);                       // 1 noise
  float dispCrystal = crystalDisp(pos);                         // 2 noise
  float dispOrganic = organicDisp(pos, t);                      // 2 noise
  float dispShatter = shatterDisp(pos);                         // 2 noise
  float dispVapor   = vaporDisp(pos, t);                        // 1 noise

  float totalDisp = uShapeLiquid  * dispLiquid
                  + uShapeCrystal * dispCrystal
                  + uShapeOrganic * dispOrganic
                  + uShapeShatter * dispShatter
                  + uShapeVapor   * dispVapor;

  // ─── Energy tremor (1 gated noise) ──────────────────────────
  float energyCompress = 1.0 - uStoredEnergy * 0.35;
  float energyTremor = 0.0;
  float eSq = uStoredEnergy * uStoredEnergy;
  if (uStoredEnergy > 0.2) {                                    // [noise: 0-1]
    energyTremor = snoise3(pos * 15.0 + t * 8.0) * eSq * 0.3;
  }
  totalDisp += energyTremor;

  // ─── Density dampening ──────────────────────────────────────
  // High density suppresses displacement — surface becomes heavy, still
  float densityDamp = 1.0 - uDensity * 0.5;
  totalDisp *= densityDamp;

  // ─── Flexibility elastic bounce (pure sin, 0 noise) ─────────
  float flexPhase = t * 3.0 + totalDisp * 8.0;
  float flexBounce = sin(flexPhase) + sin(flexPhase * 2.3 + 0.5) * 0.5;
  float elasticBounce = 1.0 + uFlexibility * 0.4 * flexBounce / 1.5;
  totalDisp *= elasticBounce;

  // ─── Reactivity jitter (adds temporal instability to displacement)
  // Uses sin at high frequency to approximate noise cheaply
  float reactJitter = sin(t * uReactivity * 20.0 + pos.x * 12.0 + pos.y * 9.0)
                    * sin(t * uReactivity * 14.0 + pos.z * 11.0)
                    * uReactivity * uReactivity * 0.15;
  totalDisp += reactJitter;

  // ─── Scale by mass ──────────────────────────────────────────
  float scale = (0.3 + uMass * 0.7) * energyCompress;
  pos *= scale;

  // Apply displacement along normal
  pos += norm * totalDisp * scale;

  // ─── Atmosphere vertex push (pure math, 0 noise) ────────────
  float edgeness = 1.0 - abs(norm.z);
  float atmospherePush = edgeness * edgeness * uAtmosphere * 0.5;
  pos += norm * atmospherePush * scale;

  // ─── Magnetism tangential warp (1 gated noise) ──────────────
  if (uMagnetism > 0.15) {                                      // [noise: 0-1]
    float magN = snoise3(pos * 2.0 + 600.0 + t * 0.05);
    float magEdge = 1.0 - abs(norm.z);
    float magSq = uMagnetism * uMagnetism;
    vec3 magDisp = norm * magN * magEdge * magSq * 0.4;
    pos += magDisp * scale;
  }

  // Reveal
  pos *= uReveal;

  // ─── Outputs ────────────────────────────────────────────────
  vDisplacement = totalDisp;
  vObjectPos = pos;
  vTemperature = uTemperature;

  // Thickness for SSS
  float cavityMask = smoothstep(0.1, 0.4, snoise3(pos * 0.7 + 80.0)); // reuses existing noise context
  vThickness = (1.0 - uHollowness * cavityMask) * (0.3 + uDensity * 0.7);

  // Faceting info for fragment shader
  vFaceting = abs(dispCrystal) * uShapeCrystal
            + abs(dispShatter) * uShapeShatter * uFragility;

  // ─── Normal estimation (2 noise) ────────────────────────────  [noise: 2]
  float eps = 0.01;
  vec3 tangent1 = normalize(cross(norm, vec3(0.0, 1.0, 0.001)));
  vec3 tangent2 = cross(norm, tangent1);
  float geoFreq = 0.6 + uTopology * 0.4;
  float flowSpeed = 0.05 + uFlow * 0.4;
  float d1 = snoise3((position + tangent1 * eps) * geoFreq + t * 0.003) * 0.4
           + sin((position.x + tangent1.x * eps) * 3.17 + position.y * 2.73 + t * flowSpeed * 3.0) * 0.15;
  float d2 = snoise3((position + tangent2 * eps) * geoFreq + t * 0.003) * 0.4
           + sin((position.x + tangent2.x * eps) * 3.17 + position.y * 2.73 + t * flowSpeed * 3.0) * 0.15;
  vec3 displacedNorm = normalize(norm
    + (totalDisp - d1) / eps * tangent1
    + (totalDisp - d2) / eps * tangent2);

  vNormal = normalize(normalMatrix * displacedNorm);
  vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
