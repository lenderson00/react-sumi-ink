#![allow(clippy::too_many_arguments)]

use wasm_bindgen::prelude::*;

/// Dual-resolution sumi sim.
/// Velocity lives on a coarse grid. Pigment (crisp mark, flowing ink, wash, wetness)
/// lives on a 2x to 4x grid and is advected with MacCormack so edges stay sharp.
#[wasm_bindgen]
pub struct InkSim {
    vw: usize,
    vh: usize,
    pw: usize,
    ph: usize,
    scale: usize,
    u: Vec<f32>,
    v: Vec<f32>,
    mark: Vec<f32>,
    flow: Vec<f32>,
    flow_tmp: Vec<f32>,
    wash: Vec<f32>,
    wash_tmp: Vec<f32>,
    wet: Vec<f32>,
    settled: Vec<f32>,
    obs: Vec<f32>,
    absorb: Vec<f32>,
    fu: Vec<f32>,
    fv: Vec<f32>,
    viscosity: f32,
    diffusion: f32,
    drying: f32,
    vorticity: f32,
    frame: u32,
}

#[wasm_bindgen]
impl InkSim {
    #[wasm_bindgen(constructor)]
    pub fn new(vw: u32, vh: u32, scale: u32) -> InkSim {
        let vw = vw.max(24) as usize;
        let vh = vh.max(24) as usize;
        let scale = scale.clamp(2, 4) as usize;
        let pw = vw * scale;
        let ph = vh * scale;
        let vn = (vw + 2) * (vh + 2);
        let pn = pw * ph;
        let mut sim = InkSim {
            vw,
            vh,
            pw,
            ph,
            scale,
            u: vec![0.0; vn],
            v: vec![0.0; vn],
            mark: vec![0.0; pn],
            flow: vec![0.0; pn],
            flow_tmp: vec![0.0; pn],
            wash: vec![0.0; pn],
            wash_tmp: vec![0.0; pn],
            wet: vec![0.0; pn],
            settled: vec![0.0; pn],
            obs: vec![0.0; pn],
            absorb: vec![0.0; pn],
            fu: vec![0.0; pn],
            fv: vec![0.0; pn],
            viscosity: 0.00015,
            diffusion: 0.0003,
            drying: 0.12,
            vorticity: 3.0,
            frame: 0,
        };
        sim.build_fibers();
        sim
    }

    #[wasm_bindgen]
    pub fn width(&self) -> u32 {
        self.pw as u32
    }

    #[wasm_bindgen]
    pub fn height(&self) -> u32 {
        self.ph as u32
    }

    #[wasm_bindgen]
    pub fn set_params(&mut self, viscosity: f32, diffusion: f32, drying: f32, vorticity: f32) {
        self.viscosity = viscosity.clamp(0.0, 0.01);
        self.diffusion = diffusion.clamp(0.0, 0.01);
        self.drying = drying.clamp(0.0, 1.0);
        self.vorticity = vorticity.clamp(0.0, 12.0);
    }

    #[wasm_bindgen]
    pub fn clear(&mut self) {
        self.u.fill(0.0);
        self.v.fill(0.0);
        self.mark.fill(0.0);
        self.flow.fill(0.0);
        self.wash.fill(0.0);
        self.wet.fill(0.0);
        self.settled.fill(0.0);
    }

    #[wasm_bindgen]
    pub fn dry_all(&mut self) {
        for i in 0..self.mark.len() {
            self.settled[i] = (self.settled[i] + self.mark[i]).min(1.0);
            self.wet[i] = 0.0;
        }
        self.u.fill(0.0);
        self.v.fill(0.0);
    }

    /// Packed mask, length `width * height * 3`: obstacle, absorb, repel.
    #[wasm_bindgen]
    pub fn set_obstacle_mask(&mut self, data: &[f32]) {
        let n = self.pw * self.ph;
        if data.len() < n * 3 {
            return;
        }
        for i in 0..n {
            self.obs[i] = if data[i] > 0.35 { 1.0 } else { 0.0 };
            self.absorb[i] = data[n + i].clamp(0.0, 1.0);
            if self.obs[i] > 0.5 {
                self.mark[i] = 0.0;
                self.flow[i] = 0.0;
                self.wash[i] = 0.0;
            }
        }
    }

    /// Legacy round deposit. Radius is in pigment pixels. Prefer `stroke_segment`.
    #[wasm_bindgen]
    pub fn splat(
        &mut self,
        x: f32,
        y: f32,
        radius: f32,
        amount: f32,
        _r: f32,
        _g: f32,
        _b: f32,
        vx: f32,
        vy: f32,
    ) {
        let sp = (vx * vx + vy * vy).sqrt();
        let (dx, dy) = if sp > 0.01 {
            (vx / sp, vy / sp)
        } else {
            (1.0, 0.0)
        };
        let nudge = 0.012;
        self.stroke_segment(
            x - dx * nudge,
            y - dy * nudge,
            x + dx * nudge,
            y + dy * nudge,
            radius.max(2.0),
            amount.clamp(0.2, 1.0),
            0.9,
            (sp * 0.15).clamp(0.05, 0.7),
            0.15,
        );
    }

    /// One polyline segment. Coordinates are normalized 0..1.
    /// `radius` is pigment pixels. `speed` and `wash_bias` are 0..1.
    #[wasm_bindgen]
    pub fn stroke_segment(
        &mut self,
        x0: f32,
        y0: f32,
        x1: f32,
        y1: f32,
        radius: f32,
        pressure: f32,
        load: f32,
        speed: f32,
        wash_bias: f32,
    ) {
        let ax = x0.clamp(0.0, 1.0) * self.pw as f32;
        let ay = y0.clamp(0.0, 1.0) * self.ph as f32;
        let bx = x1.clamp(0.0, 1.0) * self.pw as f32;
        let by = y1.clamp(0.0, 1.0) * self.ph as f32;
        let dx = bx - ax;
        let dy = by - ay;
        let len = (dx * dx + dy * dy).sqrt().max(0.001);
        let dirx = dx / len;
        let diry = dy / len;
        let px = -diry;
        let py = dirx;
        let pressure = pressure.clamp(0.05, 1.0);
        let load = load.clamp(0.0, 1.0);
        let speed = speed.clamp(0.0, 1.0);
        let wash_bias = wash_bias.clamp(0.0, 1.0);
        let width = (radius.max(1.0) * (0.35 + pressure * 0.45)).clamp(1.0, 18.0);
        let spacing = 2.4_f32;
        let steps = ((len / spacing).ceil() as i32).clamp(1, 80);
        let bristles = 5;
        let mark_amt = load * (1.0 - wash_bias * 0.82);
        let wash_amt = load * (0.15 + wash_bias * 0.7);

        for s in 0..=steps {
            let t = s as f32 / steps as f32;
            let fade = 1.0 - t * 0.22 * speed;
            let cx = ax + dx * t;
            let cy = ay + dy * t;
            let skip_base = (speed * 0.55 + (1.0 - load) * 0.45).clamp(0.0, 0.9);
            for b in 0..bristles {
                let bf = b as f32 - (bristles as f32 - 1.0) * 0.5;
                let h = hash4(cx, cy + bf, b, s);
                if h < skip_base * (0.35 + bf.abs() * 0.15) {
                    continue;
                }
                let off = bf * width * 0.22 + (h - 0.5) * 1.4;
                let dep = mark_amt * fade;
                if dep > 0.04 {
                    let rad = if wash_bias < 0.2 { 3.8 } else { 1.15 };
                    self.stamp(cx + px * off, cy + py * off, rad, dep, true);
                }
                if wash_amt > 0.05 && b % 2 == 0 {
                    self.stamp(
                        cx + px * off * 1.8,
                        cy + py * off * 1.8,
                        1.05,
                        wash_amt * fade * 0.55,
                        false,
                    );
                }
            }
            if speed > 0.55 {
                let h = hash4(cx, cy, 3, s);
                if h > 0.62 {
                    let dist = 4.0 + h * (8.0 + speed * 18.0);
                    let side = (hash4(cy, cx, s, 2) - 0.5) * 10.0;
                    self.stamp(
                        cx + dirx * dist + px * side,
                        cy + diry * dist + py * side,
                        0.8 + h * 1.1,
                        mark_amt * fade * 0.7,
                        true,
                    );
                }
            }
            let impulse = (28.0 + speed * 80.0) * (0.4 + pressure);
            self.add_vel(cx, cy, dirx * impulse, diry * impulse, 5.5);
            let spin = if (s + (cx as i32)) % 2 == 0 { 1.0 } else { -1.0 };
            self.add_vel(cx, cy, -diry * impulse * 0.55 * spin, dirx * impulse * 0.55 * spin, 7.0);
        }
    }

    #[allow(clippy::manual_is_multiple_of)]
    #[wasm_bindgen]
    pub fn step(&mut self, dt: f32) {
        let dt = dt.clamp(1.0 / 240.0, 1.0 / 20.0);
        self.frame = self.frame.wrapping_add(1);
        self.damp_velocity();
        self.stir_curl();
        self.confine_vorticity();
        self.slide_obstacles();
        self.advect_velocity(dt);
        self.flow_tmp.copy_from_slice(&self.flow);
        advect_scalar(
            self.pw,
            self.ph,
            self.vw,
            self.vh,
            &self.flow_tmp,
            &mut self.flow,
            &self.u,
            &self.v,
            &self.wet,
            &self.obs,
            dt,
            0.82,
        );
        if self.frame % 2 == 0 {
            self.wash_tmp.copy_from_slice(&self.wash);
            advect_scalar(
                self.pw,
                self.ph,
                self.vw,
                self.vh,
                &self.wash_tmp,
                &mut self.wash,
                &self.u,
                &self.v,
                &self.wet,
                &self.obs,
                dt * 2.0,
                1.0,
            );
            let wash_rate = (self.diffusion * 420.0).clamp(0.02, 0.35);
            self.aniso_diffuse_wash(wash_rate);
        }
        if self.frame % 6 == 0 {
            self.sprout_tendrils();
        }
        self.dry_and_freeze(dt);
        self.knockout_obstacles();
    }

    #[wasm_bindgen]
    pub fn copy_density_rgba(&self, out: &mut [f32]) {
        let n = self.pw * self.ph;
        if out.len() < n * 4 {
            return;
        }
        for i in 0..n {
            let core = self.mark[i].max(self.flow[i]).clamp(0.0, 1.0);
            let wash = self.wash[i].clamp(0.0, 1.0);
            let settled = self.settled[i].clamp(0.0, 1.0);
            let wet = self.wet[i].clamp(0.0, 1.0);
            let o = i * 4;
            out[o] = core;
            out[o + 1] = wash;
            out[o + 2] = settled;
            out[o + 3] = wet;
        }
    }
}

impl InkSim {
    fn pidx(&self, i: usize, j: usize) -> usize {
        i + j * self.pw
    }

    fn vidx(&self, i: usize, j: usize) -> usize {
        i + j * (self.vw + 2)
    }

    fn build_fibers(&mut self) {
        for j in 0..self.ph {
            for i in 0..self.pw {
                let id = self.pidx(i, j);
                let n = hash4(i as f32 * 0.17, j as f32 * 0.05, 1, 0);
                let slow = (i as f32 * 0.004).sin() * 0.35 + (j as f32 * 0.02).cos() * 0.12;
                let ang = (n - 0.5) * 0.55 + slow;
                self.fu[id] = ang.cos();
                self.fv[id] = ang.sin();
            }
        }
    }

    fn sample(&self, field: &[f32], x: f32, y: f32) -> f32 {
        let x = x.clamp(0.0, (self.pw - 1) as f32);
        let y = y.clamp(0.0, (self.ph - 1) as f32);
        let i0 = x.floor() as usize;
        let j0 = y.floor() as usize;
        let i1 = (i0 + 1).min(self.pw - 1);
        let j1 = (j0 + 1).min(self.ph - 1);
        let tx = x - i0 as f32;
        let ty = y - j0 as f32;
        let a = field[self.pidx(i0, j0)];
        let b = field[self.pidx(i1, j0)];
        let c = field[self.pidx(i0, j1)];
        let d = field[self.pidx(i1, j1)];
        let ab = a + (b - a) * tx;
        let cd = c + (d - c) * tx;
        ab + (cd - ab) * ty
    }

    fn vel_at(&self, x: f32, y: f32) -> (f32, f32) {
        let sx = self.pw as f32 / self.vw as f32;
        let sy = self.ph as f32 / self.vh as f32;
        let cx = (x / sx).clamp(0.0, (self.vw - 1) as f32);
        let cy = (y / sy).clamp(0.0, (self.vh - 1) as f32);
        let i0 = cx.floor() as usize;
        let j0 = cy.floor() as usize;
        let i1 = (i0 + 1).min(self.vw - 1);
        let j1 = (j0 + 1).min(self.vh - 1);
        let tx = cx - i0 as f32;
        let ty = cy - j0 as f32;
        let grab = |field: &[f32], i: usize, j: usize| field[self.vidx(i + 1, j + 1)];
        let lerp = |field: &[f32]| {
            let a = grab(field, i0, j0);
            let b = grab(field, i1, j0);
            let c = grab(field, i0, j1);
            let d = grab(field, i1, j1);
            let ab = a + (b - a) * tx;
            let cd = c + (d - c) * tx;
            ab + (cd - ab) * ty
        };
        (lerp(&self.u), lerp(&self.v))
    }

    fn stamp(&mut self, x: f32, y: f32, rad: f32, amount: f32, core: bool) {
        if amount <= 0.0 || rad <= 0.2 {
            return;
        }
        let rad = rad.max(0.8);
        let min_i = ((x - rad).floor() as i32).max(0);
        let max_i = ((x + rad).ceil() as i32).min(self.pw as i32 - 1);
        let min_j = ((y - rad).floor() as i32).max(0);
        let max_j = ((y + rad).ceil() as i32).min(self.ph as i32 - 1);
        let r2 = rad * rad;
        let hard = if core { 0.78 } else { 0.42 };
        for j in min_j..=max_j {
            for i in min_i..=max_i {
                let dx = i as f32 + 0.5 - x;
                let dy = j as f32 + 0.5 - y;
                let d2 = dx * dx + dy * dy;
                if d2 > r2 {
                    continue;
                }
                let d = d2.sqrt() / rad;
                let k = if d < hard {
                    1.0
                } else {
                    (1.0 - (d - hard) / (1.0 - hard)).clamp(0.0, 1.0)
                };
                let id = self.pidx(i as usize, j as usize);
                if self.obs[id] > 0.5 {
                    continue;
                }
                let soak = 1.0 - self.absorb[id] * 0.35;
                if core {
                    let add = amount * k * soak;
                    self.flow[id] = (self.flow[id] + add).min(1.0);
                    self.mark[id] = (self.mark[id] + add * 0.22).min(0.55);
                    self.wet[id] = (self.wet[id] + add).min(1.0);
                } else {
                    let add = amount * k * soak;
                    self.wash[id] = (self.wash[id] + add).min(1.0);
                    self.wet[id] = (self.wet[id] + add * 0.55).min(1.0);
                }
            }
        }
    }

    fn add_vel(&mut self, px: f32, py: f32, vx: f32, vy: f32, rad: f32) {
        let sx = self.pw as f32 / self.vw as f32;
        let sy = self.ph as f32 / self.vh as f32;
        let cx = px / sx;
        let cy = py / sy;
        let cr = (rad / sx).max(1.0);
        let min_i = ((cx - cr).floor() as i32).max(0);
        let max_i = ((cx + cr).ceil() as i32).min(self.vw as i32 - 1);
        let min_j = ((cy - cr).floor() as i32).max(0);
        let max_j = ((cy + cr).ceil() as i32).min(self.vh as i32 - 1);
        let r2 = cr * cr;
        for j in min_j..=max_j {
            for i in min_i..=max_i {
                let dx = i as f32 + 0.5 - cx;
                let dy = j as f32 + 0.5 - cy;
                let d2 = dx * dx + dy * dy;
                if d2 > r2 {
                    continue;
                }
                let k = 1.0 - (d2 / r2).sqrt();
                let id = self.vidx(i as usize + 1, j as usize + 1);
                self.u[id] += vx * k;
                self.v[id] += vy * k;
            }
        }
    }

    fn stir_curl(&mut self) {
        let t = self.frame as f32 * 0.02;
        let amp = 16.0 + self.vorticity.clamp(0.0, 6.0) * 3.5;
        for j in 0..self.vh {
            for i in 0..self.vw {
                let nx = i as f32 / self.vw as f32;
                let ny = j as f32 / self.vh as f32;
                let band = smoothstep(0.18, 0.34, ny);
                let top = 1.0 - smoothstep(0.16, 0.28, ny) * (1.0 - smoothstep(0.34, 0.46, ny)) * smoothstep(0.22, 0.38, nx) * (1.0 - smoothstep(0.62, 0.78, nx));
                let e = 0.018;
                let dpy = river_potential(nx, ny + e, t) - river_potential(nx, ny - e, t);
                let dpx = river_potential(nx + e, ny, t) - river_potential(nx - e, ny, t);
                let id = self.vidx(i + 1, j + 1);
                self.u[id] += (dpy / (2.0 * e)) * amp * band * top;
                self.v[id] += (-dpx / (2.0 * e)) * amp * band * top;
            }
        }
    }

    fn confine_vorticity(&mut self) {
        let eps = 0.35 * self.vorticity.clamp(0.4, 8.0);
        let stride = self.vw + 2;
        let mut curl = vec![0.0_f32; stride * (self.vh + 2)];
        for j in 1..=self.vh {
            for i in 1..=self.vw {
                let du_dy = self.u[i + (j + 1) * stride] - self.u[i + (j - 1) * stride];
                let dv_dx = self.v[(i + 1) + j * stride] - self.v[(i - 1) + j * stride];
                curl[i + j * stride] = 0.5 * (dv_dx - du_dy);
            }
        }
        for j in 1..=self.vh {
            for i in 1..=self.vw {
                let id = i + j * stride;
                let w = curl[id];
                let dx = curl[(i + 1) + j * stride].abs() - curl[(i - 1) + j * stride].abs();
                let dy = curl[i + (j + 1) * stride].abs() - curl[i + (j - 1) * stride].abs();
                let mag = (dx * dx + dy * dy).sqrt();
                if mag < 1.0e-3 {
                    continue;
                }
                let nx = dx / mag;
                let ny = dy / mag;
                let push = eps * w.clamp(-12.0, 12.0);
                self.u[id] += ny * push;
                self.v[id] -= nx * push;
            }
        }
    }

    fn damp_velocity(&mut self) {
        let damp = (1.0 - self.viscosity * 280.0).clamp(0.9, 0.985);
        for q in self.u.iter_mut() {
            *q = (*q * damp).clamp(-70.0, 70.0);
        }
        for q in self.v.iter_mut() {
            *q = (*q * damp).clamp(-70.0, 70.0);
        }
    }

    fn slide_obstacles(&mut self) {
        let sx = self.scale;
        let sy = self.scale;
        for j in 0..self.vh {
            for i in 0..self.vw {
                let id = self.vidx(i + 1, j + 1);
                let pi = (i * sx + sx / 2).min(self.pw - 1);
                let pj = (j * sy + sy / 2).min(self.ph - 1);
                if self.obs[self.pidx(pi, pj)] > 0.5 {
                    self.u[id] = 0.0;
                    self.v[id] = 0.0;
                    continue;
                }
                let i1 = (pi + sx).min(self.pw - 1);
                let i0 = pi.saturating_sub(sx);
                let j1 = (pj + sy).min(self.ph - 1);
                let j0 = pj.saturating_sub(sy);
                let gx = self.obs[self.pidx(i1, pj)] - self.obs[self.pidx(i0, pj)];
                let gy = self.obs[self.pidx(pi, j1)] - self.obs[self.pidx(pi, j0)];
                let gl = (gx * gx + gy * gy).sqrt();
                if gl < 0.05 {
                    continue;
                }
                let nx = gx / gl;
                let ny = gy / gl;
                let vn = self.u[id] * nx + self.v[id] * ny;
                if vn > 0.0 {
                    self.u[id] -= vn * nx;
                    self.v[id] -= vn * ny;
                    let slide = vn * 0.35 * self.vorticity.min(4.0);
                    self.u[id] += -ny * slide;
                    self.v[id] += nx * slide;
                }
            }
        }
    }

    fn advect_velocity(&mut self, dt: f32) {
        let u0 = self.u.clone();
        let v0 = self.v.clone();
        let stride = self.vw + 2;
        let vw = self.vw;
        let vh = self.vh;
        let sx = self.scale as f32;
        for j in 1..=vh {
            for i in 1..=vw {
                let id = i + j * stride;
                let mut x = i as f32 - dt * u0[id] / sx;
                let mut y = j as f32 - dt * v0[id] / sx;
                x = x.clamp(0.5, vw as f32 + 0.5);
                y = y.clamp(0.5, vh as f32 + 0.5);
                let i0 = x.floor() as usize;
                let j0 = y.floor() as usize;
                let i1 = (i0 + 1).min(vw + 1);
                let j1 = (j0 + 1).min(vh + 1);
                let tx = x - i0 as f32;
                let ty = y - j0 as f32;
                let at = |field: &[f32], ii: usize, jj: usize| field[ii + jj * stride];
                let lerp = |field: &[f32]| {
                    let a = at(field, i0, j0);
                    let b = at(field, i1, j0);
                    let c = at(field, i0, j1);
                    let d = at(field, i1, j1);
                    let ab = a + (b - a) * tx;
                    let cd = c + (d - c) * tx;
                    ab + (cd - ab) * ty
                };
                self.u[id] = lerp(&u0);
                self.v[id] = lerp(&v0);
            }
        }
    }

    #[allow(dead_code)]
    fn maccormack(&self, src: &[f32], dt: f32, wet_follow: f32) -> Vec<f32> {
        let n = self.pw * self.ph;
        let mut hat = vec![0.0_f32; n];
        for j in 0..self.ph {
            for i in 0..self.pw {
                let id = self.pidx(i, j);
                let (u, v) = self.vel_at(i as f32, j as f32);
                let x = i as f32 - u * dt;
                let y = j as f32 - v * dt;
                hat[id] = self.sample(src, x, y);
            }
        }
        let mut dst = vec![0.0_f32; n];
        for j in 0..self.ph {
            for i in 0..self.pw {
                let id = self.pidx(i, j);
                if self.obs[id] > 0.5 {
                    continue;
                }
                let (u, v) = self.vel_at(i as f32, j as f32);
                let x = i as f32 - u * dt;
                let y = j as f32 - v * dt;
                let back = self.sample(&hat, x, y);
                let fwd = self.sample(&hat, i as f32 + u * dt, j as f32 + v * dt);
                let mut corrected = back + 0.5 * (src[id] - fwd);
                let i0 = (x.floor() as i32).clamp(0, self.pw as i32 - 1) as usize;
                let j0 = (y.floor() as i32).clamp(0, self.ph as i32 - 1) as usize;
                let i1 = (i0 + 1).min(self.pw - 1);
                let j1 = (j0 + 1).min(self.ph - 1);
                let mut nmin = src[self.pidx(i0, j0)];
                let mut nmax = nmin;
                for (ii, jj) in [(i0, j0), (i1, j0), (i0, j1), (i1, j1)] {
                    let s = src[self.pidx(ii, jj)];
                    nmin = nmin.min(s);
                    nmax = nmax.max(s);
                }
                corrected = corrected.clamp(nmin, nmax).clamp(0.0, 1.0);
                let wet = self.wet[id].clamp(0.0, 1.0) * wet_follow;
                let follow = wet.clamp(0.0, 1.0);
                dst[id] = src[id] * (1.0 - follow) + corrected * follow;
            }
        }
        dst
    }

    fn aniso_diffuse_wash(&mut self, rate: f32) {
        self.wash_tmp.copy_from_slice(&self.wash);
        for j in 0..self.ph {
            for i in 0..self.pw {
                let id = self.pidx(i, j);
                if self.obs[id] > 0.5 || self.wet[id] < 0.05 {
                    continue;
                }
                let fu = self.fu[id];
                let fv = self.fv[id];
                let a = self.sample(&self.wash_tmp, i as f32 + fu * 1.7, j as f32 + fv * 1.7);
                let b = self.sample(&self.wash_tmp, i as f32 - fu * 1.7, j as f32 - fv * 1.7);
                let along = 0.5 * (a + b);
                let cur = self.wash_tmp[id];
                let mut pull = (along - cur) * rate * self.wet[id];
                if cur < 0.22 && along > cur + 0.04 {
                    pull *= 1.65;
                }
                self.wash[id] = (cur + pull).clamp(0.0, 1.0);
            }
        }
    }

    #[allow(dead_code)]
    fn aniso_diffuse_flow(&mut self, rate: f32) {
        if rate <= 0.0 {
            return;
        }
        self.flow_tmp.copy_from_slice(&self.flow);
        for j in 0..self.ph {
            for i in 0..self.pw {
                let id = self.pidx(i, j);
                if self.obs[id] > 0.5 || self.wet[id] < 0.08 {
                    continue;
                }
                let fu = self.fu[id];
                let fv = self.fv[id];
                let a = self.sample(&self.flow_tmp, i as f32 + fu * 1.25, j as f32 + fv * 1.25);
                let b = self.sample(&self.flow_tmp, i as f32 - fu * 1.25, j as f32 - fv * 1.25);
                let along = 0.5 * (a + b);
                let cur = self.flow_tmp[id];
                self.flow[id] = (cur + (along - cur) * rate * self.wet[id]).clamp(0.0, 1.0);
            }
        }
    }

    fn sprout_tendrils(&mut self) {
        let src = self.flow.clone();
        for j in 2..self.ph - 2 {
            if j % 2 == 1 {
                continue;
            }
            for i in 2..self.pw - 2 {
                if i % 2 == 1 {
                    continue;
                }
                let id = self.pidx(i, j);
                if self.obs[id] > 0.5 {
                    continue;
                }
                let c = src[id];
                if !(0.28..0.82).contains(&c) {
                    continue;
                }
                let fu = self.fu[id];
                let fv = self.fv[id];
                let ahead = self.sample(&src, i as f32 + fu * 3.0, j as f32 + fv * 3.0);
                if ahead > 0.18 {
                    continue;
                }
                let h = hash4(i as f32, j as f32, self.frame as i32, 4);
                if h < 0.9 {
                    continue;
                }
                let len = 5.0 + h * 16.0;
                let steps = len as i32;
                for s in 1..=steps {
                    let f = s as f32 / steps as f32;
                    let x = i as f32 + fu * s as f32 * 1.15;
                    let y = j as f32 + fv * s as f32 * 1.15;
                    let ii = x.round() as i32;
                    let jj = y.round() as i32;
                    if ii < 0 || jj < 0 || ii >= self.pw as i32 || jj >= self.ph as i32 {
                        break;
                    }
                    let pid = self.pidx(ii as usize, jj as usize);
                    if self.obs[pid] > 0.5 {
                        break;
                    }
                    let dep = (1.0 - f) * 0.72 * c;
                    self.flow[pid] = self.flow[pid].max(dep);
                    self.wash[pid] = (self.wash[pid] + dep * 0.35).min(1.0);
                }
            }
        }
    }

    fn dry_and_freeze(&mut self, dt: f32) {
        let decay = (1.0 - self.drying * dt * 1.15).clamp(0.985, 0.999);
        for i in 0..self.mark.len() {
            if self.absorb[i] > 0.45 {
                self.wet[i] *= 0.94;
                self.wash[i] = (self.wash[i] + self.mark[i] * 0.04).min(1.0);
            }
            let w = self.wet[i];
            if w < 0.35 {
                self.settled[i] = (self.settled[i] + self.mark[i] * (0.35 - w) * 0.08).min(1.0);
            }
            self.wet[i] = (w * decay).clamp(0.0, 1.0);
        }
    }

    fn knockout_obstacles(&mut self) {
        for i in 0..self.obs.len() {
            if self.obs[i] > 0.5 {
                self.mark[i] = 0.0;
                self.flow[i] = 0.0;
                self.wash[i] = 0.0;
            }
        }
    }
}

fn advect_scalar(
    pw: usize,
    ph: usize,
    vw: usize,
    vh: usize,
    src: &[f32],
    dst: &mut [f32],
    u: &[f32],
    v: &[f32],
    wet: &[f32],
    obs: &[f32],
    dt: f32,
    follow: f32,
) {
    let sx = pw as f32 / vw as f32;
    let sy = ph as f32 / vh as f32;
    let stride = vw + 2;
    for j in 0..ph {
        for i in 0..pw {
            let id = i + j * pw;
            if obs[id] > 0.5 {
                dst[id] = 0.0;
                continue;
            }
            let w = (wet[id] * follow).clamp(0.0, 1.0);
            if w < 0.04 {
                dst[id] = src[id];
                continue;
            }
            let cx = (i as f32 / sx).clamp(0.0, (vw - 1) as f32);
            let cy = (j as f32 / sy).clamp(0.0, (vh - 1) as f32);
            let i0 = cx.floor() as usize;
            let j0 = cy.floor() as usize;
            let i1 = (i0 + 1).min(vw - 1);
            let j1 = (j0 + 1).min(vh - 1);
            let tx = cx - i0 as f32;
            let ty = cy - j0 as f32;
            let at = |field: &[f32], ii: usize, jj: usize| field[(ii + 1) + (jj + 1) * stride];
            let lerp = |field: &[f32]| {
                let a = at(field, i0, j0);
                let b = at(field, i1, j0);
                let c = at(field, i0, j1);
                let d = at(field, i1, j1);
                let ab = a + (b - a) * tx;
                let cd = c + (d - c) * tx;
                ab + (cd - ab) * ty
            };
            let vx = lerp(u);
            let vy = lerp(v);
            let x = (i as f32 - vx * dt).clamp(0.0, (pw - 1) as f32);
            let y = (j as f32 - vy * dt).clamp(0.0, (ph - 1) as f32);
            let xi = x.floor() as usize;
            let yi = y.floor() as usize;
            let xi1 = (xi + 1).min(pw - 1);
            let yi1 = (yi + 1).min(ph - 1);
            let fx = x - xi as f32;
            let fy = y - yi as f32;
            let s00 = src[xi + yi * pw];
            let s10 = src[xi1 + yi * pw];
            let s01 = src[xi + yi1 * pw];
            let s11 = src[xi1 + yi1 * pw];
            let sample = s00 + (s10 - s00) * fx + (s01 - s00) * fy + (s00 - s10 - s01 + s11) * fx * fy;
            dst[id] = src[id] * (1.0 - w) + sample * w;
        }
    }
}

fn smoothstep(e0: f32, e1: f32, x: f32) -> f32 {
    let t = ((x - e0) / (e1 - e0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

fn river_potential(x: f32, y: f32, t: f32) -> f32 {
    let mut p = (x * 5.5 + t).sin() * (y * 4.2 - t * 0.6).cos();
    p += 0.55 * (x * 12.0 - y * 3.5 + t * 1.1).sin();
    p += 0.32 * (x * 22.0 + y * 16.0).sin() * (y * 14.0 - t).cos();
    p += 0.16 * (x * 41.0 - t * 1.7).sin() * (y * 33.0).cos();
    p
}

fn hash4(a: f32, b: f32, c: i32, d: i32) -> f32 {
    let n = a * 12.9898 + b * 78.233 + c as f32 * 37.719 + d as f32 * 19.13;
    let s = (n.sin() * 43_758.5).fract();
    if s < 0.0 {
        s + 1.0
    } else {
        s
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stroke_deposits_sharp_core() {
        let mut sim = InkSim::new(48, 32, 4);
        sim.stroke_segment(0.15, 0.5, 0.85, 0.52, 7.0, 0.95, 1.0, 0.15, 0.05);
        let n = sim.width() as usize * sim.height() as usize;
        let mut out = vec![0.0; n * 4];
        sim.copy_density_rgba(&mut out);
        let mut dark = 0;
        let mut mid = 0;
        for i in 0..n {
            let c = out[i * 4];
            if c > 0.72 {
                dark += 1;
            } else if c > 0.15 {
                mid += 1;
            }
        }
        assert!(dark > 30, "expected a dense core, dark={dark} mid={mid}");
        assert!(dark > mid / 4, "core should not be a soft halo, dark={dark} mid={mid}");
    }

    #[test]
    fn obstacle_rejects_ink() {
        let mut sim = InkSim::new(32, 24, 2);
        let n = (sim.width() * sim.height()) as usize;
        let mut mask = vec![0.0; n * 3];
        for j in 8..16 {
            for i in 20..44 {
                if i < sim.width() as usize {
                    mask[j * sim.width() as usize + i] = 1.0;
                }
            }
        }
        sim.set_obstacle_mask(&mask);
        sim.stroke_segment(0.05, 0.5, 0.95, 0.5, 5.0, 1.0, 1.0, 0.1, 0.0);
        let w = sim.width() as usize;
        let mut blocked = 0.0;
        let mut count = 0.0;
        for j in 8..16 {
            for i in 20..44 {
                if i >= w {
                    continue;
                }
                blocked += sim.mark[j * w + i];
                count += 1.0;
            }
        }
        assert!(count > 0.0);
        assert!(blocked == 0.0, "ink leaked into obstacle");
    }
}
