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
  float thresh = mix(0.46, 0.74, edgeN);
  thresh += (gran - 0.5) * 0.18;

  float solid = smoothstep(0.58, 0.66, core);
  float body = smoothstep(thresh, thresh + 0.03, coreE);
  float edgeBand = smoothstep(0.18, 0.4, coreE) * (1.0 - smoothstep(0.7, 0.9, core));
  body *= mix(1.0, mix(0.25, 1.0, fine), edgeBand * uGrain);
  float coreA = max(solid, body * 0.92);

  float washN = fbm(vUv * vec2(22.0, 14.0) + 2.0);
  float washA = smoothstep(0.16, 0.4, wash);
  washA *= mix(0.22, 0.62, washN);
  washA *= 1.0 - coreA;

  vec2 fib = normalize(vec2(0.96, 0.18 + 0.22 * sin(vUv.y * 18.0 + n1)));
  vec2 perp = vec2(-fib.y, fib.x);
  float phase = dot(vUv, perp) / max(texel.x, 0.001) * 0.55 + fbm(vUv * 10.0) * 6.0;
  float threads = pow(abs(sin(phase)), 14.0);
  float boundary = smoothstep(0.06, 0.2, core) * (1.0 - smoothstep(0.34, 0.62, core));
  float tendril = boundary * threads * smoothstep(0.45, 0.75, noise(vUv * vec2(220.0, 40.0)));

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

  float grain = fbm(vUv * vec2(220.0, 160.0));
  float fiber = fbm(vUv * vec2(640.0, 90.0) + vec2(grain * 2.0, 1.7));
  float tooth = hash(vUv * vec2(1100.0, 860.0));
  vec3 paper = mix(uPaperA, uPaperB, 0.4 + (grain - 0.5) * 0.12);
  paper *= 0.94 + 0.07 * fiber + 0.05 * (tooth - 0.5);

  vec3 sumi = vec3(0.012, 0.011, 0.01);
  vec3 washCol = vec3(0.16, 0.155, 0.145);
  vec3 col = paper;
  col = mix(col, washCol, clamp(washA, 0.0, 0.78) * keep);
  float inkMask = clamp(coreA + tendril * 0.9, 0.0, 1.0) * keep;
  col = mix(col, sumi, inkMask);
  col = mix(col, sumi * 0.42, rim * inkMask);
  col += wet * coreA * keep * 0.012;
  col *= 1.0 - uTime * 0.0;

  outColor = vec4(col, 1.0);
}`;