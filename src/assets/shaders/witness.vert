// ─── Witness Vertex Shader ──────────────────────────────────────────
// Displaces a sphere mesh into the witness-form based on data state.

uniform float uTime;
uniform float uDensity;
uniform float uCoherence;
uniform float uAsymmetry;
uniform float uConcavity;
uniform float uErosion;
uniform float uMass;
uniform float uBreathRate;
uniform float uBreathDepth;
uniform float uReveal;       // 0-1, threshold animation

varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vDisplacement;

// Simplex noise (3D)
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

float fbm(vec3 p, int octaves) {
  float val = 0.0;
  float amp = 1.0;
  float freq = 1.0;
  float maxAmp = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    val += amp * snoise3(p * freq);
    maxAmp += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return val / maxAmp;
}

void main() {
  vec3 pos = position;
  vec3 norm = normal;

  // Breathing — slow scale oscillation
  float breath = sin(uTime / uBreathRate * 6.2831853) * uBreathDepth;
  pos *= 1.0 + breath;

  // Base displacement: noise-driven surface detail
  // More density = more octaves = more defined surface
  int octaves = 2 + int(uDensity * 4.0); // 2-6 octaves
  float noiseScale = 1.5 + uErosion * 2.0; // more erosion = higher freq noise = more breakup
  float baseDisp = fbm(pos * noiseScale + uTime * 0.008, octaves);

  // Erosion: dissolve edges by pushing vertices inward in noisy regions
  float erosionMask = smoothstep(0.0, 0.5, baseDisp + 0.3);
  float erosionDisp = -uErosion * 0.3 * erosionMask;

  // Asymmetry: shift one side outward, other inward
  float asymDisp = uAsymmetry * 0.2 * pos.x * snoise3(pos * 2.0 + 10.0);

  // Concavity: inward depressions in specific regions
  float cavityNoise = snoise3(pos * 1.2 + 50.0);
  float cavityMask = smoothstep(0.3, 0.6, cavityNoise);
  float cavityDisp = -uConcavity * 0.25 * cavityMask;

  // Coherence: when low, add high-freq jitter
  float incoherence = (1.0 - uCoherence) * 0.1;
  float jitter = snoise3(pos * 8.0 + uTime * 0.05) * incoherence;

  // Total displacement along normal
  float totalDisp = baseDisp * 0.15 * uDensity + erosionDisp + asymDisp + cavityDisp + jitter;

  // Scale by mass
  pos *= 0.3 + uMass * 0.7;

  // Apply displacement
  pos += norm * totalDisp;

  // Reveal: during threshold, scale from zero
  pos *= uReveal;

  vDisplacement = totalDisp;
  vNormal = normalize(normalMatrix * norm);
  vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
