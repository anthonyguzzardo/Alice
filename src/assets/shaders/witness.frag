// ─── Witness Fragment Shader ────────────────────────────────────────
// Dark form against dark void. Barely visible. Edge-light only.
// The presence absorbs rather than emits.

precision highp float;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vDisplacement;

uniform float uDensity;
uniform float uCoherence;
uniform float uErosion;
uniform float uReveal;
uniform vec3 uCameraPos;

void main() {
  // View direction
  vec3 viewDir = normalize(uCameraPos - vWorldPos);

  // Fresnel: edges catch more light than faces
  float fresnel = 1.0 - abs(dot(vNormal, viewDir));
  fresnel = pow(fresnel, 3.0);

  // Edge luminance: the only way the form is visible
  // Density controls how bright the edges get
  float edgeLight = fresnel * uDensity * 0.35;

  // Subtle surface variation from displacement
  float surfaceDetail = abs(vDisplacement) * uDensity * 0.08;

  // Coherence affects how smooth vs noisy the surface reads
  float noiseBreakup = (1.0 - uCoherence) * fresnel * 0.05;

  // Total luminance — very low. The form is dark.
  float luminance = edgeLight + surfaceDetail + noiseBreakup;

  // Erosion makes parts transparent
  float alpha = uReveal * (1.0 - uErosion * 0.6);
  // Edges slightly more opaque
  alpha *= 0.4 + fresnel * 0.6;

  // Color: near-black with the faintest warm shift in dense regions,
  // cool shift in eroded regions
  vec3 baseColor = vec3(luminance);
  baseColor.r += uDensity * 0.015;      // warm where dense
  baseColor.b += uErosion * 0.01;       // cool where eroded

  gl_FragColor = vec4(baseColor, alpha);
}
