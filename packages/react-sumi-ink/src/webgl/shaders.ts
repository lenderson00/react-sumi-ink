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
uniform vec3 uPaperA;
uniform vec3 uPaperB;
uniform float uGrain;
uniform float uWet;
uniform float uTime;
uniform vec2 uTexel;
out vec4 outColor;

float hash(vec2 p){
  return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.545);
}

float fiber(vec2 uv){
  float f1 = sin(uv.x * 920.0 + uv.y * 40.0);
  float f2 = sin(uv.y * 780.0 - uv.x * 22.0);
  return abs(f1 * 0.55 + f2 * 0.45) * 0.5 + 0.5;
}

void main(){
  vec4 ink = texture(uInk, vUv);
  vec3 pigment = ink.rgb;
  float cover = ink.a;
  float dry = 1.0 - clamp(cover * 1.1, 0.0, 1.0);

  float grain = hash(vUv * 512.0);
  float fib = fiber(vUv);
  vec3 basePaper = mix(uPaperA, uPaperB, vUv.y);
  basePaper *= 0.985 + 0.02 * fib + 0.015 * (grain - 0.5);

  float gran = hash(vUv * 1800.0 + uTime * 0.02);
  gran = mix(1.0, 0.75 + gran * 0.35, smoothstep(0.15, 0.85, cover));

  vec3 sumi = mix(vec3(0.04, 0.04, 0.045), pigment, 0.85);
  sumi *= gran;

  float km = 1.0 - exp(-cover * 5.2);
  vec3 col = mix(basePaper, sumi, km);

  float edge = 0.0;
  float d0 = texture(uInk, vUv - vec2(uTexel.x, 0.)).a;
  float d1 = texture(uInk, vUv + vec2(uTexel.x, 0.)).a;
  float d2 = texture(uInk, vUv - vec2(0., uTexel.y)).a;
  float d3 = texture(uInk, vUv + vec2(0., uTexel.y)).a;
  edge = max(0.0, (d0 + d1 + d2 + d3) * 0.25 - cover) * 2.2;
  col = mix(col, sumi * 0.65, edge * dry);

  float wetSheen = uWet * cover * (0.4 + fib * 0.2);
  col += wetSheen * 0.06;

  outColor = vec4(col, 1.0);
}`;