export const VERT = `#version 300 es
precision highp float;
const vec2 pos[4] = vec2[4](vec2(-1.,-1.),vec2(1.,-1.),vec2(-1.,1.),vec2(1.,1.));
const vec2 uv[4] = vec2[4](vec2(0.,0.),vec2(1.,0.),vec2(0.,1.),vec2(1.,1.));
out vec2 vUv;
void main(){
  vUv = uv[gl_VertexID];
  gl_Position = vec4(pos[gl_VertexID],0.,1.);
}`;

export const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uInk;
uniform sampler2D uMask;
uniform vec3 uPaperA;
uniform vec3 uPaperB;
uniform float uGrain;
uniform float uTime;
uniform vec2 uTexel;
out vec4 outColor;

float hash(vec2 p){
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main(){
  vec2 texel = max(uTexel, vec2(0.0008));
  float n1 = fbm(vUv * vec2(90.0, 55.0));
  float n2 = fbm(vUv * vec2(90.0, 55.0) + 4.2);
  vec2 warp = (vec2(n1, n2) - 0.5) * texel * 5.5;

  vec4 ink = texture(uInk, vUv);
  vec4 inkE = texture(uInk, vUv + warp);
  float blur = (
    texture(uInk, vUv + vec2(texel.x, 0.0)).r +
    texture(uInk, vUv - vec2(texel.x, 0.0)).r +
    texture(uInk, vUv + vec2(0.0, texel.y)).r +
    texture(uInk, vUv - vec2(0.0, texel.y)).r
  ) * 0.25;
  float core = clamp(ink.r + (ink.r - blur) * 0.85, 0.0, 1.0);
  float coreE = clamp(inkE.r + (inkE.r - blur) * 0.45, 0.0, 1.0);
  float wash = max(ink.g, inkE.g * 0.85);
  float settled = ink.b;
  float wet = ink.a;

  float gran = hash(vUv * vec2(740.0, 610.0));
  float fine = hash(vUv * vec2(1680.0, 1320.0));
  float edgeN = fbm(vUv * vec2(70.0, 42.0) + vec2(n1, n2) * 0.8);
  float thresh = mix(0.38, 0.66, edgeN) + (gran - 0.5) * 0.12;

  float solid = smoothstep(0.42, 0.62, core);
  float torn = fbm(vUv * vec2(95.0, 48.0) + vec2(n1, n2));
  float fall = smoothstep(thresh - 0.12, thresh, coreE) * (1.0 - solid);
  vec2 flowDir = normalize(vec2(0.9, -0.18 + 0.5 * sin(vUv.x * 8.0 + n1)));
  vec2 across = vec2(-flowDir.y, flowDir.x);
  float halo = 0.0;
  halo += texture(uInk, vUv + across * texel * 8.0).r;
  halo += texture(uInk, vUv - across * texel * 8.0).r;
  halo += texture(uInk, vUv + across * texel * 18.0).r;
  halo += texture(uInk, vUv - across * texel * 18.0).r;
  halo += texture(uInk, vUv + flowDir * texel * 10.0).r;
  halo = halo * 0.2;
  float streak = smoothstep(0.42, 0.78, noise(vec2(dot(vUv, flowDir) * 6.0, dot(vUv, across) * 36.0)));
  float speckle = step(0.9, hash(vUv * vec2(900.0, 700.0))) * smoothstep(0.02, 0.12, max(core, halo));
  float washA = smoothstep(0.02, 0.14, max(max(halo, fall), wash)) * (0.35 + 0.65 * streak) * (0.55 + 0.45 * torn);
  washA += speckle * 0.45;
  washA *= 1.0 - solid * 0.9;
  float coreA = solid;

  float threads = smoothstep(0.68, 0.92, noise(vec2(dot(vUv, flowDir) * 14.0, dot(vUv, across) * 55.0)));
  float boundary = smoothstep(0.08, 0.22, core) * (1.0 - smoothstep(0.45, 0.75, core));
  float tendril = boundary * threads;

  float l = texture(uInk, vUv - vec2(texel.x, 0.0)).r;
  float rgt = texture(uInk, vUv + vec2(texel.x, 0.0)).r;
  float up = texture(uInk, vUv + vec2(0.0, texel.y)).r;
  float dn = texture(uInk, vUv - vec2(0.0, texel.y)).r;
  float grad = length(vec2(rgt - l, up - dn));
  float rim = smoothstep(0.12, 0.42, grad) * (0.45 + settled * 0.9);

  float m0 = texture(uMask, vUv).r;
  float m1 = texture(uMask, vUv + vec2(texel.x * 2.2, 0.0)).r;
  float m2 = texture(uMask, vUv - vec2(texel.x * 2.2, 0.0)).r;
  float m3 = texture(uMask, vUv + vec2(0.0, texel.y * 2.2)).r;
  float m4 = texture(uMask, vUv - vec2(0.0, texel.y * 2.2)).r;
  float block = max(m0, max(max(m1, m2), max(m3, m4)));
  float keep = 1.0 - smoothstep(0.12, 0.48, block);

  float grain = fbm(vUv * vec2(140.0, 90.0));
  float along = vUv.x * 520.0 + sin(vUv.y * 18.0) * 6.0 + fbm(vUv * 24.0) * 8.0;
  float fiber = abs(sin(along)) * 0.65 + abs(sin(vUv.y * 260.0 + vUv.x * 30.0)) * 0.35;
  float tooth = hash(vUv * vec2(980.0, 760.0));
  vec3 paper = mix(uPaperA, uPaperB, 0.25 + grain * 0.2);
  paper *= 0.93 + 0.08 * fiber + 0.035 * (tooth - 0.5);

  vec3 sumi = vec3(0.012, 0.011, 0.01);
  vec3 washCol = vec3(0.34, 0.33, 0.31);
  vec3 col = paper;
  col = mix(col, washCol, clamp(washA, 0.0, 0.62) * keep);
  float inkMask = clamp(coreA + tendril * 0.9, 0.0, 1.0) * keep;
  col = mix(col, sumi, inkMask);
  col = mix(col, sumi * 0.42, rim * inkMask);
  col += wet * coreA * keep * 0.012;
  col *= 1.0 - uTime * 0.0;

  outColor = vec4(col, 1.0);
}`;