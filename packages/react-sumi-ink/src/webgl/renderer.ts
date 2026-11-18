import { FRAG, VERT } from './shaders';

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || 'shader');
  }
  return sh;
};

export class InkRenderer {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private tex: WebGLTexture;
  private locInk = 0;
  private locPaperA: WebGLUniformLocation | null;
  private locPaperB: WebGLUniformLocation | null;
  private locGrain: WebGLUniformLocation | null;
  private locWet: WebGLUniformLocation | null;
  private locTime: WebGLUniformLocation | null;
  gw = 0;
  gh = 0;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p) || 'program');
    }
    this.prog = p;
    this.locPaperA = gl.getUniformLocation(p, 'uPaperA');
    this.locPaperB = gl.getUniformLocation(p, 'uPaperB');
    this.locGrain = gl.getUniformLocation(p, 'uGrain');
    this.locWet = gl.getUniformLocation(p, 'uWet');
    this.locTime = gl.getUniformLocation(p, 'uTime');
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  resize(w: number, h: number, dpr: number) {
    const gl = this.gl;
    const pw = Math.max(1, Math.round(w * dpr));
    const ph = Math.max(1, Math.round(h * dpr));
    gl.canvas.width = pw;
    gl.canvas.height = ph;
    gl.viewport(0, 0, pw, ph);
  }

  uploadRGBA(rgba: Float32Array, gw: number, gh: number) {
    this.gw = gw;
    this.gh = gh;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      gw,
      gh,
      0,
      gl.RGBA,
      gl.FLOAT,
      rgba,
    );
  }

  draw(paper: 'washi' | 'rice' | 'cloud', wet: number, time: number) {
    const gl = this.gl;
    const papers = {
      washi: { a: [0.96, 0.94, 0.9], b: [0.93, 0.9, 0.84] },
      rice: { a: [0.98, 0.97, 0.95], b: [0.95, 0.93, 0.9] },
      cloud: { a: [0.92, 0.93, 0.96], b: [0.88, 0.9, 0.94] },
    } as const;
    const p = papers[paper];
    gl.clearColor(p.a[0], p.a[1], p.a[2], 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniform1i(this.locInk, 0);
    gl.uniform3fv(this.locPaperA, p.a);
    gl.uniform3fv(this.locPaperB, p.b);
    gl.uniform1f(this.locGrain, paper === 'washi' ? 0.55 : 0.25);
    gl.uniform1f(this.locWet, wet);
    gl.uniform1f(this.locTime, time);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  snapshot(): string | null {
    const gl = this.gl;
    const c = gl.canvas as HTMLCanvasElement;
    if (!('toDataURL' in c)) return null;
    return c.toDataURL('image/png');
  }
}