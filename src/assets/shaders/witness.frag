// ─── Witness Fragment Shader v3 ─────────────────────────────────────
// 26-trait witness form rendering.
// Subsurface scattering, internal glow, temperature color, iridescence.
// Visible against void through edge light and internal radiance, not ambient.

precision highp float;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vObjectPos;
varying float vDisplacement;
varying float vThickness;
varying float vFaceting;
varying float vTemperature;

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
  vec3 coldColor = vec3(0.05, 0.08, 0.18);     // deep glacial blue
  vec3 neutralColor = vec3(0.04, 0.04, 0.045);  // near-black gray
  vec3 hotColor = vec3(0.2, 0.04, 0.02);        // deep ember red

  vec3 tempColor;
  if (vTemperature < 0.5) {
    tempColor = mix(coldColor, neutralColor, vTemperature * 2.0);
  } else {
    tempColor = mix(neutralColor, hotColor, (vTemperature - 0.5) * 2.0);
  }

  // ─── Color depth: hue variation across surface ────────────
  float surfaceHueShift = snoise3(vObjectPos * 2.0 + uTime * 0.01) * 0.15;
  float depthHueShift = snoise3(vObjectPos * 0.8 + 50.0) * 0.1;
  float totalHueShift = (surfaceHueShift + depthHueShift) * uColorDepth;

  // Apply hue shift in a way that preserves the temperature palette
  vec3 hueShiftColor;
  if (vTemperature < 0.5) {
    // Cold range: shift between blues and teals
    hueShiftColor = hsl2rgb(0.6 + totalHueShift, 0.4 * uColorDepth, 0.08);
  } else {
    // Hot range: shift between reds, oranges, magentas
    hueShiftColor = hsl2rgb(0.02 + totalHueShift * 0.5, 0.5 * uColorDepth, 0.1);
  }
  vec3 baseColor = mix(tempColor, hueShiftColor, uColorDepth * 0.6);

  // ─── Surface roughness ────────────────────────────────────
  // Polished(0) = sharp reflections, Eroded(1) = diffuse, rough
  float roughness = 0.3 + uSurface * 0.6;
  float specPower = mix(80.0, 5.0, roughness);

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
  float sssStrength = (1.0 - vThickness) * pow(fresnel, 0.8) * 0.7;
  sssStrength *= (0.3 + uTranslucency * 0.7);

  // SSS color follows temperature
  vec3 sssCold = vec3(0.1, 0.15, 0.35);   // icy blue bleed
  vec3 sssNeutral = vec3(0.15, 0.08, 0.06); // warm amber
  vec3 sssHot = vec3(0.4, 0.08, 0.02);     // molten red bleed
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
  float internalGlow = glowDepth * uInternalLight * 0.5 * glowPulse * rhythmPulse;

  // Stored energy intensifies the internal glow
  internalGlow += glowDepth * uStoredEnergy * 0.4 * (0.8 + 0.2 * sin(uTime * 0.8));

  // Internal glow color follows temperature with more saturation
  vec3 glowCold = vec3(0.08, 0.12, 0.4);
  vec3 glowNeutral = vec3(0.15, 0.1, 0.08);
  vec3 glowHot = vec3(0.5, 0.1, 0.02);
  vec3 glowBaseColor;
  if (vTemperature < 0.5) {
    glowBaseColor = mix(glowCold, glowNeutral, vTemperature * 2.0);
  } else {
    glowBaseColor = mix(glowNeutral, glowHot, (vTemperature - 0.5) * 2.0);
  }
  vec3 glowColor = glowBaseColor * internalGlow;

  // ─── Edge light ───────────────────────────────────────────
  // Makes the form visible in the void without ambient light
  float edgeLight = fresnelPow * (0.15 + uDensity * 0.2 + uLightResponse * 0.15);

  // Edge dissolution softens the edge
  float edgeSoften = 1.0 - uEdgeCharacter * 0.5;
  edgeLight *= edgeSoften;

  vec3 edgeColor;
  if (vTemperature < 0.5) {
    edgeColor = mix(vec3(0.15, 0.2, 0.35), vec3(0.12, 0.12, 0.14), vTemperature * 2.0);
  } else {
    edgeColor = mix(vec3(0.12, 0.12, 0.14), vec3(0.35, 0.1, 0.05), (vTemperature - 0.5) * 2.0);
  }
  edgeColor *= edgeLight;

  // ─── Atmosphere: soft halo extending into space ───────────
  // Glow that extends beyond the form's surface
  float haloFresnel = pow(fresnel, 1.5);
  float haloIntensity = haloFresnel * uAtmosphere * 0.35;
  // Broader, softer than edge light
  vec3 haloColor = mix(vec3(0.06, 0.06, 0.08), glowBaseColor * 0.3, uInternalLight);
  haloColor *= haloIntensity;

  // ─── Magnetism: gravitational lensing distortion ──────────
  // Visible as light bending near edges
  float lensing = pow(fresnel, 1.2) * uMagnetism;
  // Shift the view-dependent effects to simulate spatial warping
  float lensingShift = snoise3(vWorldPos * 3.0 + viewDir * 2.0 + uTime * 0.05) * lensing * 0.15;
  // Manifests as color aberration at edges
  vec3 magnetismColor = vec3(
    lensingShift * 0.3,
    0.0,
    -lensingShift * 0.2
  ) * uMagnetism;

  // ─── Stored energy: pressure containment glow ─────────────
  // Brighter interior, tighter containment — like something is about to burst
  float pressureGlow = smoothstep(0.5, 0.1, NdotV) * uStoredEnergy * 0.3;
  vec3 pressureColor = glowBaseColor * pressureGlow * (1.0 + sin(uTime * 1.2) * 0.2);

  // ─── Fragility: glowing crack lines ───────────────────────
  // vFaceting contains crack information from vertex shader
  float crackGlow = vFaceting * uFragility * 0.6;
  // Cracks glow with temperature-appropriate color
  vec3 crackCold = vec3(0.2, 0.3, 0.6);
  vec3 crackHot = vec3(0.8, 0.15, 0.02);
  vec3 crackColor = mix(crackCold, crackHot, vTemperature) * crackGlow;
  // Stress fracture pulsing
  crackColor *= (0.7 + 0.3 * sin(uTime * 0.6 + vObjectPos.x * 5.0));

  // ─── Reactivity: surface shimmer/instability ──────────────
  float shimmer = snoise3(vWorldPos * 6.0 + uTime * uReactivity * 3.0);
  float reactiveShimmer = shimmer * shimmer * uReactivity * 0.15;
  vec3 shimmerColor = baseColor * reactiveShimmer * 2.0;

  // ─── Iridescence: angle-dependent color shifts ────────────
  float iriAngle = NdotV * 6.2831853 + vDisplacement * 4.0;
  vec3 iriColor = vec3(
    sin(iriAngle) * 0.5 + 0.5,
    sin(iriAngle + 2.094) * 0.5 + 0.5,
    sin(iriAngle + 4.189) * 0.5 + 0.5
  );
  iriColor = mix(vec3(0.0), iriColor * 0.08, uIridescence);

  // ─── Creation cost: visual weight and layered complexity ──
  // More dense detail, more visual layers
  float complexityNoise = snoise3(vObjectPos * 8.0 + 400.0) * snoise3(vObjectPos * 12.0 + 500.0);
  float complexityDetail = abs(complexityNoise) * uCreationCost * 0.08;

  // ─── Compose final color ──────────────────────────────────
  vec3 surfaceColor = baseColor * (0.02 + diffuse + specIntensity) * absorb;
  surfaceColor += complexityDetail * baseColor * 3.0;

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

  // ─── Alpha ────────────────────────────────────────────────
  float baseAlpha = 0.25 + uDensity * 0.4 + fresnelPow * 0.25;
  // Translucency reduces opacity
  baseAlpha *= (1.0 - uTranslucency * 0.4);
  // Hollowness makes thin regions more transparent
  baseAlpha *= (0.5 + vThickness * 0.5);
  // Edge character dissolves edges
  baseAlpha *= (1.0 - uEdgeCharacter * fresnel * 0.6);
  // Atmosphere extends alpha at edges
  baseAlpha += uAtmosphere * haloFresnel * 0.15;
  // Stored energy tightens containment (slightly more opaque)
  baseAlpha += uStoredEnergy * 0.08 * (1.0 - fresnel);
  // Crack lines are more visible
  baseAlpha += crackGlow * 0.2;

  baseAlpha *= uReveal;
  float alpha = clamp(baseAlpha, 0.0, 0.95);

  gl_FragColor = vec4(finalColor, alpha);
}
