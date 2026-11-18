#![allow(clippy::too_many_arguments)]

use wasm_bindgen::prelude::*;

const BND: usize = 1;

#[wasm_bindgen]
pub struct InkSim {
    w: usize,
    h: usize,
    u: Vec<f32>,
    u_prev: Vec<f32>,
    v: Vec<f32>,
    v_prev: Vec<f32>,
    d: Vec<f32>,
    d_prev: Vec<f32>,
    dr: Vec<f32>,
    dg: Vec<f32>,
    db: Vec<f32>,
    dry: Vec<f32>,
    obstacle: Vec<f32>,
    absorb: Vec<f32>,
    repel: Vec<f32>,
    fiber_u: Vec<f32>,
    fiber_v: Vec<f32>,
    viscosity: f32,
    diffusion: f32,
    drying: f32,
    vorticity: f32,
    dt: f32,
    iter: u32,
    frame: u64,
}

#[wasm_bindgen]
impl InkSim {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> InkSim {
        let w = width.max(32) as usize;
        let h = height.max(32) as usize;
        let n = (w + 2) * (h + 2);
        let mut sim = InkSim {
            w,
            h,
            u: vec![0.0; n],
            u_prev: vec![0.0; n],
            v: vec![0.0; n],
            v_prev: vec![0.0; n],
            d: vec![0.0; n],
            d_prev: vec![0.0; n],
            dr: vec![0.0; n],
            dg: vec![0.0; n],
            db: vec![0.0; n],
            dry: vec![0.0; n],
            obstacle: vec![0.0; n],
            absorb: vec![0.0; n],
            repel: vec![0.0; n],
            fiber_u: vec![0.0; n],
            fiber_v: vec![0.0; n],
            viscosity: 0.00015,
            diffusion: 0.0003,
            drying: 0.12,
            vorticity: 3.0,
            dt: 1.0 / 60.0,
            iter: 20,
            frame: 0,
        };
        sim.build_fibers();
        sim
    }

    #[wasm_bindgen]
    pub fn width(&self) -> u32 {
        self.w as u32
    }

    #[wasm_bindgen]
    pub fn height(&self) -> u32 {
        self.h as u32
    }

    #[wasm_bindgen]
    pub fn set_params(&mut self, viscosity: f32, diffusion: f32, drying: f32, vorticity: f32) {
        self.viscosity = viscosity.clamp(0.0, 0.01);
        self.diffusion = diffusion.clamp(0.0, 0.01);
        self.drying = drying.clamp(0.0, 1.0);
        self.vorticity = vorticity.clamp(0.0, 10.0);
    }

    #[wasm_bindgen]
    pub fn clear(&mut self) {
        self.u.fill(0.0);
        self.v.fill(0.0);
        self.d.fill(0.0);
        self.dr.fill(0.0);
        self.dg.fill(0.0);
        self.db.fill(0.0);
        self.dry.fill(0.0);
    }

    #[wasm_bindgen]
    pub fn dry_all(&mut self) {
        for v in self.dry.iter_mut() {
            *v = 1.0;
        }
    }

    #[wasm_bindgen]
    pub fn set_obstacle_mask(&mut self, data: &[f32]) {
        let inner = self.w * self.h;
        if data.len() != inner * 3 {
            return;
        }
        for j in 0..self.h {
            for i in 0..self.w {
                let gi = self.idx(i + 1, j + 1);
                let si = j * self.w + i;
                self.obstacle[gi] = data[si];
                self.absorb[gi] = data[inner + si];
                self.repel[gi] = data[inner * 2 + si];
            }
        }
    }

    #[wasm_bindgen]
    pub fn splat(
        &mut self,
        x: f32,
        y: f32,
        radius: f32,
        amount: f32,
        r: f32,
        g: f32,
        b: f32,
        vx: f32,
        vy: f32,
    ) {
        let cx = (x * self.w as f32).clamp(1.0, self.w as f32);
        let cy = (y * self.h as f32).clamp(1.0, self.h as f32);
        let rad = radius.max(1.0);
        let r2 = rad * rad;
        let vel_scale = amount * 120.0;
        let min_i = ((cx - rad).floor() as i32).max(1);
        let max_i = ((cx + rad).ceil() as i32).min(self.w as i32);
        let min_j = ((cy - rad).floor() as i32).max(1);
        let max_j = ((cy + rad).ceil() as i32).min(self.h as i32);
        for j in min_j..=max_j {
            for i in min_i..=max_i {
                let dx = i as f32 - cx;
                let dy = j as f32 - cy;
                let d2 = dx * dx + dy * dy;
                if d2 > r2 {
                    continue;
                }
                let k = (1.0 - (d2 / r2).sqrt()).powf(2.0);
                let idx = self.idx(i as usize, j as usize);
                if self.obstacle[idx] > 0.5 {
                    continue;
                }
                let damp = 1.0 - self.repel[idx] * 0.85;
                self.d[idx] += amount * k * damp;
                let add = amount * k * damp;
                self.dr[idx] = (self.dr[idx] + r * add * 4.0).min(12.0);
                self.dg[idx] = (self.dg[idx] + g * add * 4.0).min(12.0);
                self.db[idx] = (self.db[idx] + b * add * 4.0).min(12.0);
                self.u[idx] += vx * vel_scale * k;
                self.v[idx] += vy * vel_scale * k;
                if self.absorb[idx] > 0.3 {
                    let soak = self.absorb[idx] * k * 0.15;
                    self.d[idx] *= 1.0 - soak;
                }
            }
        }
    }

    #[wasm_bindgen]
    pub fn step(&mut self, dt: f32) {
        self.dt = dt.clamp(1.0 / 240.0, 1.0 / 15.0);
        self.frame += 1;
        self.project_obstacles();
        self.add_vorticity();
        self.diffuse(self.viscosity, BND);
        self.project();
        self.advect_velocity();
        self.diffuse_scalar(self.diffusion);
        self.advect_density();
        self.apply_drying();
        self.clamp_density();
    }

    #[wasm_bindgen]
    pub fn density_ptr(&self) -> *const f32 {
        self.d.as_ptr()
    }

    #[wasm_bindgen]
    pub fn pigment_ptr(&self) -> *const f32 {
        self.dr.as_ptr()
    }

    #[wasm_bindgen]
    pub fn dry_ptr(&self) -> *const f32 {
        self.dry.as_ptr()
    }

    #[wasm_bindgen]
    pub fn density_len(&self) -> usize {
        self.d.len()
    }

    #[wasm_bindgen]
    pub fn copy_density_rgba(&self, out: &mut [f32]) {
        let n = self.w * self.h;
        if out.len() < n * 4 {
            return;
        }
        for j in 0..self.h {
            for i in 0..self.w {
                let gi = self.idx(i + 1, j + 1);
                let si = (j * self.w + i) * 4;
                let dens = self.d[gi].clamp(0.0, 16.0);
                let dry = self.dry[gi];
                let edge = self.edge_darken(gi) * 1.8;
                let ink_amt = (dens * 0.38 + edge).min(1.35);
                let fade = 1.0 - dry * 0.65;
                let pr = (self.dr[gi] / 3.5).clamp(0.02, 1.0);
                let pg = (self.dg[gi] / 3.5).clamp(0.02, 1.0);
                let pb = (self.db[gi] / 3.5).clamp(0.02, 1.0);
                out[si] = pr;
                out[si + 1] = pg;
                out[si + 2] = pb;
                out[si + 3] = (ink_amt * fade).clamp(0.0, 1.0);
            }
        }
    }
}

fn grid_idx(w: usize, i: usize, j: usize) -> usize {
    i + j * (w + 2)
}

fn set_bnd(w: usize, h: usize, b: usize, x: &mut [f32]) {
    for i in 1..=w {
        x[grid_idx(w, i, 0)] = if b == 2 {
            -x[grid_idx(w, i, 1)]
        } else {
            x[grid_idx(w, i, 1)]
        };
        x[grid_idx(w, i, h + 1)] = if b == 2 {
            -x[grid_idx(w, i, h)]
        } else {
            x[grid_idx(w, i, h)]
        };
    }
    for j in 1..=h {
        x[grid_idx(w, 0, j)] = if b == 1 {
            -x[grid_idx(w, 1, j)]
        } else {
            x[grid_idx(w, 1, j)]
        };
        x[grid_idx(w, w + 1, j)] = if b == 1 {
            -x[grid_idx(w, w, j)]
        } else {
            x[grid_idx(w, w, j)]
        };
    }
    x[grid_idx(w, 0, 0)] = 0.5 * (x[grid_idx(w, 1, 0)] + x[grid_idx(w, 0, 1)]);
    x[grid_idx(w, 0, h + 1)] = 0.5 * (x[grid_idx(w, 1, h + 1)] + x[grid_idx(w, 0, h)]);
    x[grid_idx(w, w + 1, 0)] = 0.5 * (x[grid_idx(w, w, 0)] + x[grid_idx(w, w + 1, 1)]);
    x[grid_idx(w, w + 1, h + 1)] = 0.5 * (x[grid_idx(w, w, h + 1)] + x[grid_idx(w, w + 1, h)]);
}

fn lin_solve(w: usize, h: usize, iter: u32, x: &mut [f32], x0: &[f32], a: f32, b: usize) {
    let c = 1.0 + 4.0 * a;
    for _ in 0..iter {
        for j in 1..=h {
            for i in 1..=w {
                let idx = grid_idx(w, i, j);
                x[idx] = (x0[idx]
                    + a
                        * (x[grid_idx(w, i - 1, j)]
                            + x[grid_idx(w, i + 1, j)]
                            + x[grid_idx(w, i, j - 1)]
                            + x[grid_idx(w, i, j + 1)]))
                    / c;
            }
        }
        set_bnd(w, h, b, x);
    }
}

fn advect_field(
    w: usize,
    h: usize,
    dt: f32,
    d: &mut [f32],
    d0: &[f32],
    u: &[f32],
    v: &[f32],
    b: usize,
) {
    let dt0 = dt * (w as f32).min(h as f32);
    for j in 1..=h {
        for i in 1..=w {
            let idx = grid_idx(w, i, j);
            let mut x = i as f32 - dt0 * u[idx];
            let mut y = j as f32 - dt0 * v[idx];
            x = x.clamp(0.5, w as f32 + 0.5);
            y = y.clamp(0.5, h as f32 + 0.5);
            let i0 = x.floor() as usize;
            let i1 = i0 + 1;
            let j0 = y.floor() as usize;
            let j1 = j0 + 1;
            let s1 = x - i0 as f32;
            let s0 = 1.0 - s1;
            let t1 = y - j0 as f32;
            let t0 = 1.0 - t1;
            d[idx] = s0 * (t0 * d0[grid_idx(w, i0, j0)] + t1 * d0[grid_idx(w, i0, j1)])
                + s1 * (t0 * d0[grid_idx(w, i1, j0)] + t1 * d0[grid_idx(w, i1, j1)]);
        }
    }
    set_bnd(w, h, b, d);
}

impl InkSim {
    fn idx(&self, i: usize, j: usize) -> usize {
        grid_idx(self.w, i, j)
    }

    fn build_fibers(&mut self) {
        for j in 0..self.h + 2 {
            for i in 0..self.w + 2 {
                let gi = self.idx(i, j);
                let fx = (i as f32 * 12.9898 + j as f32 * 78.233).sin() * 43758.545;
                let fy = (i as f32 * 93.9898 + j as f32 * 67.345).sin() * 23_421.63;
                let a = (fx.fract() * std::f32::consts::TAU).cos();
                let b = (fy.fract() * std::f32::consts::TAU).sin();
                let len = (a * a + b * b).sqrt().max(0.001);
                self.fiber_u[gi] = a / len;
                self.fiber_v[gi] = b / len;
            }
        }
    }

    fn edge_darken(&self, gi: usize) -> f32 {
        let d = self.d[gi];
        if d < 0.02 {
            return 0.0;
        }
        let lap = self.laplacian_d(gi);
        (lap.max(0.0) * 0.08 * self.dry[gi]).min(0.35)
    }

    fn laplacian_d(&self, gi: usize) -> f32 {
        let i = gi % (self.w + 2);
        let j = gi / (self.w + 2);
        self.d[self.idx(i + 1, j)]
            + self.d[self.idx(i - 1, j)]
            + self.d[self.idx(i, j + 1)]
            + self.d[self.idx(i, j - 1)]
            - self.d[gi] * 4.0
    }

    fn diffuse(&mut self, visc: f32, _b: usize) {
        let a = self.dt * visc * (self.w * self.h) as f32;
        std::mem::swap(&mut self.u, &mut self.u_prev);
        lin_solve(self.w, self.h, self.iter, &mut self.u, &self.u_prev, a, 1);
        std::mem::swap(&mut self.v, &mut self.v_prev);
        lin_solve(self.w, self.h, self.iter, &mut self.v, &self.v_prev, a, 2);
    }

    fn diffuse_scalar(&mut self, diff: f32) {
        let a = self.dt * diff * (self.w * self.h) as f32;
        std::mem::swap(&mut self.d, &mut self.d_prev);
        lin_solve(self.w, self.h, self.iter, &mut self.d, &self.d_prev, a, 0);
    }

    fn project(&mut self) {
        let w = self.w;
        let h = self.h;
        let mut p = vec![0.0; (w + 2) * (h + 2)];
        let mut div = vec![0.0; (w + 2) * (h + 2)];
        let h_inv = -0.5 / w as f32;
        for j in 1..=h {
            for i in 1..=w {
                let idx = self.idx(i, j);
                div[idx] = h_inv
                    * (self.u[self.idx(i + 1, j)] - self.u[self.idx(i - 1, j)]
                        + self.v[self.idx(i, j + 1)] - self.v[self.idx(i, j - 1)]);
                p[idx] = 0.0;
            }
        }
        set_bnd(w, h, 0, &mut div);
        set_bnd(w, h, 0, &mut p);
        lin_solve(w, h, self.iter, &mut p, &div, 1.0, 0);
        for j in 1..=h {
            for i in 1..=w {
                let idx = self.idx(i, j);
                self.u[idx] -= 0.5 * w as f32 * (p[self.idx(i + 1, j)] - p[self.idx(i - 1, j)]);
                self.v[idx] -= 0.5 * h as f32 * (p[self.idx(i, j + 1)] - p[self.idx(i, j - 1)]);
            }
        }
        set_bnd(w, h, 1, &mut self.u);
        set_bnd(w, h, 2, &mut self.v);
    }

    fn advect_velocity(&mut self) {
        let u = self.u.clone();
        let v = self.v.clone();
        advect_field(self.w, self.h, self.dt, &mut self.u, &u, &u, &v, 1);
        advect_field(self.w, self.h, self.dt, &mut self.v, &v, &u, &v, 2);
    }

    fn advect_density(&mut self) {
        let d0 = self.d.clone();
        let u = self.u.clone();
        let v = self.v.clone();
        advect_field(self.w, self.h, self.dt, &mut self.d, &d0, &u, &v, 0);
        for j in 1..=self.h {
            for i in 1..=self.w {
                let gi = self.idx(i, j);
                let fu = self.fiber_u[gi];
                let fv = self.fiber_v[gi];
                let bleed = 0.015 * self.dt * 60.0;
                self.d[gi] += bleed
                    * (fu * (self.d[self.idx(i + 1, j)] - self.d[self.idx(i - 1, j)])
                        + fv * (self.d[self.idx(i, j + 1)] - self.d[self.idx(i, j - 1)]));
            }
        }
    }

    fn project_obstacles(&mut self) {
        for j in 1..=self.h {
            for i in 1..=self.w {
                let gi = self.idx(i, j);
                if self.obstacle[gi] > 0.5 {
                    self.u[gi] = 0.0;
                    self.v[gi] = 0.0;
                    continue;
                }
                if self.repel[gi] > 0.1 {
                    let nx = self.repel[gi];
                    self.u[gi] *= 1.0 - nx;
                    self.v[gi] *= 1.0 - nx;
                }
            }
        }
    }

    fn add_vorticity(&mut self) {
        let eps = self.vorticity * 0.0001;
        let mut curl = vec![0.0; (self.w + 2) * (self.h + 2)];
        for j in 2..self.h {
            for i in 2..self.w {
                let gi = self.idx(i, j);
                curl[gi] = 0.5
                    * ((self.v[self.idx(i + 1, j)] - self.v[self.idx(i - 1, j)])
                        - (self.u[self.idx(i, j + 1)] - self.u[self.idx(i, j - 1)]));
            }
        }
        for j in 2..self.h {
            for i in 2..self.w {
                let gi = self.idx(i, j);
                let a = (curl[self.idx(i + 1, j)].abs()
                    + curl[self.idx(i - 1, j)].abs()
                    + curl[self.idx(i, j + 1)].abs()
                    + curl[self.idx(i, j - 1)].abs())
                    * 0.25
                    + 1e-5;
                let cx = (curl[self.idx(i, j + 1)] - curl[self.idx(i, j - 1)]) / a;
                let cy = (curl[self.idx(i + 1, j)] - curl[self.idx(i - 1, j)]) / a;
                self.u[gi] += eps * cy;
                self.v[gi] -= eps * cx;
            }
        }
    }

    fn apply_drying(&mut self) {
        let rate = self.drying * self.dt * 0.35;
        for j in 1..=self.h {
            for i in 1..=self.w {
                let gi = self.idx(i, j);
                let d = self.d[gi];
                if d < 0.001 {
                    continue;
                }
                let edge = self.laplacian_d(gi).abs();
                self.dry[gi] = (self.dry[gi] + rate * (1.0 + edge * 2.0)).min(1.0);
                let fade = 1.0 - rate * (0.04 + self.dry[gi] * 0.12);
                self.d[gi] *= fade.max(0.997);
            }
        }
    }

    fn clamp_density(&mut self) {
        for v in self.d.iter_mut() {
            *v = v.clamp(0.0, 12.0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splat_increases_density() {
        let mut sim = InkSim::new(64, 64);
        sim.splat(0.5, 0.5, 4.0, 1.0, 0.05, 0.05, 0.08, 0.0, 0.0);
        let gi = sim.idx(32, 32);
        assert!(sim.d[gi] > 0.0);
    }
}