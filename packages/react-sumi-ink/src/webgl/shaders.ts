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
out vec4 outColor;

float hash(vec2 p){
  return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);
}

void main(){
  vec4 ink = texture(uInk, vUv);
  float dens = ink.a;
  float grain = hash(vUv * 420.0 + uTime * 0.01);
  grain = mix(1.0, grain, uGrain);
  vec3 paper = mix(uPaperA, uPaperB, vUv.y) * (0.97 + 0.03 * grain);
  float k = clamp(dens, 0.0, 1.0);
  float wetSheen = uWet * (1.0 - ink.w) * k;
  vec3 pigment = ink.rgb;
  float km = 1.0 - exp(-k * 2.4);
  vec3 col = mix(paper, pigment * 0.15 + vec3(0.02, 0.02, 0.03), km);
  col += wetSheen * 0.08;
  float alpha = clamp(k * 0.75 + wetSheen * 0.2, 0.0, 0.92);
  outColor = vec4(col, alpha);
}`;