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

export type PaperName = 'washi' | 'rice' | 'cloud';

export class InkRenderer {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private tex: WebGLTexture;
  private maskTex: WebGLTexture;
  private u8 = new Uint8Array(0);
  private maskU8 = new Uint8Array(1);
  private locInk: WebGLUniformLocation | null;
  private locMask: WebGLUniformLocation | null;
  private locPaperA: WebGLUniformLocation | null;
  private locPaperB: WebGLUniformLocation | null;
  private locGrain: WebGLUniformLocation | null;
  private locTime: WebGLUniformLocation | null;
  private locTexel: WebGLUniformLocation | null;
  gw = 1;
  gh = 1;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
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
    this.locInk = gl.getUniformLocation(p, 'uInk');
    this.locMask = gl.getUniformLocation(p, 'uMask');
    this.locPaperA = gl.getUniformLocation(p, 'uPaperA');
    this.locPaperB = gl.getUniformLocation(p, 'uPaperB');
    this.locGrain = gl.getUniformLocation(p, 'uGrain');
    this.locTime = gl.getUniformLocation(p, 'uTime');
    this.locTexel = gl.getUniformLocation(p, 'uTexel');
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    this.maskTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([0]));
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
    const n = gw * gh * 4;
    if (this.u8.length !== n) this.u8 = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const v = rgba[i];
      this.u8[i] = v <= 0 ? 0 : v >= 1 ? 255 : (v * 255) | 0;
    }
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gw, gh, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.u8);
  }

  uploadMask(mask: Float32Array, gw: number, gh: number) {
    const n = gw * gh;
    if (mask.length < n) return;
    if (this.maskU8.length !== n) this.maskU8 = new Uint8Array(n);
    for (let i = 0; i < n; i++) this.maskU8[i] = mask[i] > 0.35 ? 255 : 0;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gw, gh, 0, gl.RED, gl.UNSIGNED_BYTE, this.maskU8);
  }

  draw(paper: PaperName, _wet: number, time: number) {
    const gl = this.gl;
    const papers = {
      washi: { a: [0.965, 0.949, 0.918], b: [0.918, 0.894, 0.848] },
      rice: { a: [0.98, 0.968, 0.945], b: [0.94, 0.92, 0.88] },
      cloud: { a: [0.9, 0.91, 0.94], b: [0.84, 0.86, 0.91] },
    } as const;
    const p = papers[paper];
    gl.disable(gl.BLEND);
    gl.clearColor(p.a[0], p.a[1], p.a[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.uniform1i(this.locInk, 0);
    gl.uniform1i(this.locMask, 1);
    gl.uniform3fv(this.locPaperA, p.a);
    gl.uniform3fv(this.locPaperB, p.b);
    gl.uniform1f(this.locGrain, paper === 'washi' ? 1.0 : 0.55);
    gl.uniform1f(this.locTime, time);
    gl.uniform2f(this.locTexel, 1 / Math.max(1, this.gw), 1 / Math.max(1, this.gh));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  readInkPixel(nx: number, ny: number): [number, number, number, number] {
    const gl = this.gl;
    const x = Math.floor(nx * (gl.drawingBufferWidth - 1));
    const y = Math.floor((1 - ny) * (gl.drawingBufferHeight - 1));
    const out = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return [out[0], out[1], out[2], out[3]];
  }

  snapshot(): string | null {
    const gl = this.gl;
    const c = gl.canvas as HTMLCanvasElement;
    if (!('toDataURL' in c)) return null;
    return c.toDataURL('image/png');
  }
}