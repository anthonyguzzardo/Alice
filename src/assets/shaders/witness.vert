// ─── Witness Vertex Shader v3 ───────────────────────────────────────
// 26-trait witness form. Geological + crystalline + ferrofluid + structural.
// Large-scale deformation, medium flow, fine crystal detail.

uniform float uTime;
uniform float uReveal;
uniform float uMass;

// Form
uniform float uTopology;
uniform float uFaceting;
uniform float uStretch;
uniform float uHollowness;
uniform float uSymmetry;
uniform float uScaleVariation;
uniform float uMultiplicity;
uniform float uFragility;

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
uniform float uRotation;

// Space
uniform float uEdgeCharacter;
uniform float uAtmosphere;
uniform float uMagnetism;
uniform float uReactivity;
uniform float uTemperature;
uniform float uFlexibility;
uniform float uStoredEnergy;
uniform float uCreationCost;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vObjectPos;
varying float vDisplacement;
varying float vThickness;
varying float vFaceting;
varying float vTemperature;

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

// Fractional Brownian Motion for richer noise
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

void main() {
  vec3 pos = position;
  vec3 norm = normal;
  float t = uTime;

  // ─── Rotation (actual mesh rotation via vertex transform) ─────
  // At 1.0 this is violently fast — approaching visual blur
  float rotAngle = t * uRotation * 8.0;
  float cosR = cos(rotAngle);
  float sinR = sin(rotAngle);
  // Secondary axis rotation for tumble effect
  float rotAngle2 = t * uRotation * 4.96;
  float cosR2 = cos(rotAngle2);
  float sinR2 = sin(rotAngle2);
  // Y-axis rotation
  vec3 rotPos = vec3(
    pos.x * cosR + pos.z * sinR,
    pos.y,
    -pos.x * sinR + pos.z * cosR
  );
  // X-axis tumble (scaled by rotation intensity)
  vec3 tumblePos = vec3(
    rotPos.x,
    rotPos.y * cosR2 - rotPos.z * sinR2,
    rotPos.y * sinR2 + rotPos.z * cosR2
  );
  pos = mix(pos, tumblePos, uRotation);
  // Also rotate the normal
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

  // ─── Breathing / Rhythm ─────────────────────────────────────
  float breathRate = 4.0 + (1.0 - uRhythm) * 25.0; // 4s at max rhythm, 29s at zero
  float breathDepth = 0.01 + uRhythm * 0.45; // violent pulsing at 1.0
  // Flexibility makes breathing more elastic (overshoot)
  float breathPhase = t / breathRate * 6.2831853;
  float breathRaw = sin(breathPhase);
  float breathElastic = breathRaw + uFlexibility * 0.8 * sin(breathPhase * 2.3) * breathRaw;
  float breath = breathElastic * breathDepth;
  pos *= 1.0 + breath;

  // ─── Stretch: genuine elongation ────────────────────────────
  // Elongate along a direction (primarily Y, with noise-driven tilt)
  float stretchDir = snoise3(pos * 0.3 + 200.0) * 0.3;
  vec3 stretchAxis = normalize(vec3(stretchDir, 1.0, stretchDir * 0.5));
  float stretchAmount = uStretch * 5.0; // extreme elongation at 1.0
  float axisProjection = dot(pos, stretchAxis);
  // Elongate: move vertices further from center along the stretch axis
  pos += stretchAxis * axisProjection * stretchAmount;
  // Compress perpendicular to maintain volume
  vec3 perpComponent = pos - stretchAxis * dot(pos, stretchAxis);
  pos -= perpComponent * stretchAmount * 0.3;

  // ─── Layer 1: Large-scale geological deformation (topology) ─
  // Breaks the sphere into something unrecognizable at high topology
  float geoFreq = 0.6 + uTopology * 0.4;
  float geo1 = snoise3(pos * geoFreq + t * 0.003);
  float geo2 = snoise3(pos * (geoFreq * 0.6) + vec3(50.0) + t * 0.002);
  float geo3 = snoise3(pos * (geoFreq * 1.4) + vec3(100.0) + t * 0.001);
  // Topology controls intensity -- from gentle undulation to total shattering
  float geoIntensity = 0.05 + uTopology * 2.5; // total destruction at 1.0
  // At high topology, sharpen the noise into hard ridges/shards
  float geoNoise = geo1 * 0.5 + geo2 * 0.3 + geo3 * 0.2;
  float geological = mix(geoNoise, sign(geoNoise) * pow(abs(geoNoise), 0.3), uTopology * 0.7);
  geological *= geoIntensity;

  // ─── Scale variation: different regions at different sizes ───
  float scaleRegion = snoise3(pos * 0.5 + 150.0);
  float localScale = 1.0 + uScaleVariation * 1.8 * scaleRegion; // wild size differences
  pos *= localScale;

  // ─── Layer 2: Ferrofluid flow ───────────────────────────────
  float flowSpeed = 0.005 + uFlow * 0.4; // violent churning at 1.0
  float flowAmp = 0.02 + uFlow * 1.5;  // massive surface movement
  float flow1 = snoise3(pos * 1.8 + vec3(t * flowSpeed, t * flowSpeed * 0.7, 0.0));
  float flow2 = snoise3(pos * 2.5 + vec3(0.0, t * flowSpeed * 1.3, t * flowSpeed * 0.5) + 30.0);
  float ferrofluid = (flow1 * 0.6 + flow2 * 0.4) * flowAmp;
  // Reactivity adds surface shimmer/instability
  float reactiveJitter = snoise3(pos * 8.0 + t * uReactivity * 6.0) * uReactivity * 0.3;
  ferrofluid += reactiveJitter;

  // ─── Layer 3: Crystalline faceting ──────────────────────────
  float crystalFreq = 4.0 + uFaceting * 12.0 + uCreationCost * 6.0;
  float crystal = snoise3(pos * crystalFreq + 100.0);
  // Sharpen into hard crystal planes at high faceting
  float faceted = mix(crystal, sign(crystal) * pow(abs(crystal), 0.2), uFaceting);
  // creationCost adds more octaves of detail
  float detailNoise = fbm3(pos * crystalFreq * 1.5 + 300.0, int(2.0 + uCreationCost * 4.0));
  float crystalline = (faceted * 0.7 + detailNoise * 0.3 * uCreationCost) * 0.15 * (0.2 + uFaceting * 0.8);

  // ─── Symmetry breaking: structural asymmetry ────────────────
  // Not noise -- actual hemispheric/regional displacement
  float asymLeft = smoothstep(-0.3, 0.4, pos.x);
  float asymTop = smoothstep(-0.2, 0.5, pos.y);
  float asymFront = smoothstep(-0.1, 0.6, pos.z);
  float asymDisp = uSymmetry * 1.5 * (
    (asymLeft - 0.5) * (1.0 + geo1 * 0.8) +
    (asymTop - 0.5) * 0.6 * geo2 +
    (asymFront - 0.5) * 0.4
  );

  // ─── Hollowness: collapse inward ───────────────────────────
  float cavityRegion = snoise3(pos * 0.7 + 80.0);
  float cavityMask = smoothstep(0.1, 0.4, cavityRegion) * smoothstep(0.7, 0.4, cavityRegion);
  float cavityDisp = -uHollowness * 1.5 * cavityMask; // deep collapse
  // Central hollow pull — at 1.0 it nearly inverts
  float centerDist = length(pos);
  float centralHollow = -uHollowness * 0.8 * smoothstep(0.8, 0.2, centerDist);
  cavityDisp += centralHollow;

  // ─── Multiplicity: separate regions apart (gaps) ────────────
  // Identify cluster regions and push them apart
  float clusterID = snoise3(pos * 1.2 + 170.0);
  float clusterBoundary = 1.0 - smoothstep(0.0, 0.15, abs(clusterID));
  // At boundaries between clusters, pull inward to create gaps
  float multiplicityDisp = -uMultiplicity * 1.5 * clusterBoundary; // wide gaps
  // Push clusters outward — at 1.0 they fly apart
  float clusterPush = uMultiplicity * 1.0 * sign(clusterID) * (1.0 - clusterBoundary);
  multiplicityDisp += clusterPush;

  // ─── Fragility: crack lines (displacement discontinuities) ──
  // Create sharp ridges along crack paths
  float crackNoise1 = snoise3(pos * 3.0 + 250.0);
  float crackNoise2 = snoise3(pos * 5.0 + 280.0);
  // Crack lines where noise crosses zero -- very narrow
  float crackLine1 = 1.0 - smoothstep(0.0, 0.04 + (1.0 - uFragility) * 0.1, abs(crackNoise1));
  float crackLine2 = 1.0 - smoothstep(0.0, 0.03 + (1.0 - uFragility) * 0.08, abs(crackNoise2));
  float cracks = max(crackLine1, crackLine2);
  // Displace sharply along cracks
  float crackDisp = uFragility * 0.6 * cracks * sign(snoise3(pos * 7.0 + 300.0));

  // ─── Edge dissolution ───────────────────────────────────────
  float edgeNoise = snoise3(pos * 2.0 + 60.0 + t * 0.005);
  float edgeMask = smoothstep(-0.3, 0.3, edgeNoise);
  float edgeDisp = -uEdgeCharacter * 0.9 * edgeMask; // dissolve into nothing

  // ─── Temperature: hot = smoother/liquid, cold = harder/brittle
  float tempMod = mix(1.0, 0.7, uTemperature); // hot damps high-freq displacement
  crystalline *= tempMod;

  // ─── Stored energy: compressed, tighter containment ─────────
  float energyCompress = 1.0 - uStoredEnergy * 0.35; // visibly compressed when charged
  // High-frequency pressure tremors — about to explode at 1.0
  float energyTremor = snoise3(pos * 12.0 + t * 3.0) * uStoredEnergy * 0.2;

  // ─── Compose displacement ─────────────────────────────────
  float totalDisp = geological * (0.3 + uMass * 0.5)
                  + ferrofluid
                  + crystalline
                  + asymDisp
                  + cavityDisp
                  + multiplicityDisp
                  + crackDisp
                  + edgeDisp
                  + energyTremor;

  // Density: high density suppresses displacement — surface becomes flat, heavy, still
  float densityDamp = 1.0 - uDensity * 0.7;
  totalDisp *= densityDamp;

  // Flexibility: elastic overshoot on displacement
  float elasticBounce = 1.0 + uFlexibility * 0.5 * sin(t * 3.0 + totalDisp * 10.0);
  totalDisp *= elasticBounce;

  // Scale by mass
  float scale = (0.3 + uMass * 0.7) * energyCompress;
  pos *= scale;

  // Apply displacement along normal
  pos += norm * totalDisp * scale;

  // Reveal threshold
  pos *= uReveal;

  // ─── Outputs ──────────────────────────────────────────────
  vDisplacement = totalDisp;
  vObjectPos = pos;
  vTemperature = uTemperature;

  // Thickness for SSS: thin at edges/hollows, thick at dense regions
  vThickness = (1.0 - uHollowness * cavityMask) * (0.3 + uDensity * 0.7)
             * (1.0 - uEdgeCharacter * edgeMask * 0.5);

  // Faceting: how crystalline vs smooth
  vFaceting = abs(faceted) * (0.2 + uFaceting * 0.8) + cracks * uFragility;

  // Approximate displaced normal via finite differences
  float eps = 0.01;
  vec3 tangent1 = normalize(cross(norm, vec3(0.0, 1.0, 0.001)));
  vec3 tangent2 = cross(norm, tangent1);
  float d1 = snoise3((position + tangent1 * eps) * geoFreq + t * 0.003) * geoIntensity * 0.5
           + snoise3((position + tangent1 * eps) * 1.8 + vec3(t * flowSpeed, t * flowSpeed * 0.7, 0.0)) * flowAmp * 0.6;
  float d2 = snoise3((position + tangent2 * eps) * geoFreq + t * 0.003) * geoIntensity * 0.5
           + snoise3((position + tangent2 * eps) * 1.8 + vec3(t * flowSpeed, t * flowSpeed * 0.7, 0.0)) * flowAmp * 0.6;
  vec3 displacedNorm = normalize(norm + (totalDisp - d1) / eps * tangent1 + (totalDisp - d2) / eps * tangent2);

  vNormal = normalize(normalMatrix * displacedNorm);
  vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
