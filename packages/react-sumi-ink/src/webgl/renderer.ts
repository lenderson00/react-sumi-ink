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
  private u8 = new Uint8Array(0);
  private locInk: WebGLUniformLocation | null;
  private locPaperA: WebGLUniformLocation | null;
  private locPaperB: WebGLUniformLocation | null;
  private locGrain: WebGLUniformLocation | null;
  private locWet: WebGLUniformLocation | null;
  private locTime: WebGLUniformLocation | null;
  private locTexel: WebGLUniformLocation | null;
  gw = 0;
  gh = 0;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    const ext = gl.getExtension('EXT_color_buffer_float');
    if (ext) gl.getExtension('OES_texture_float_linear');
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
    this.locPaperA = gl.getUniformLocation(p, 'uPaperA');
    this.locPaperB = gl.getUniformLocation(p, 'uPaperB');
    this.locGrain = gl.getUniformLocation(p, 'uGrain');
    this.locWet = gl.getUniformLocation(p, 'uWet');
    this.locTime = gl.getUniformLocation(p, 'uTime');
    this.locTexel = gl.getUniformLocation(p, 'uTexel');
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gw, gh, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.u8);
  }

  draw(paper: 'washi' | 'rice' | 'cloud', wet: number, time: number) {
    const gl = this.gl;
    const papers = {
      washi: { a: [0.94, 0.91, 0.84], b: [0.9, 0.86, 0.78] },
      rice: { a: [0.97, 0.95, 0.92], b: [0.94, 0.91, 0.87] },
      cloud: { a: [0.91, 0.92, 0.95], b: [0.86, 0.88, 0.93] },
    } as const;
    const p = papers[paper];
    gl.clearColor(p.a[0], p.a[1], p.a[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniform1i(this.locInk, 0);
    gl.uniform3fv(this.locPaperA, p.a);
    gl.uniform3fv(this.locPaperB, p.b);
    gl.uniform1f(this.locGrain, paper === 'washi' ? 0.85 : 0.45);
    gl.uniform1f(this.locWet, wet);
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