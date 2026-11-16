// render.js — everything the player sees: the warm soil cross-section,
// the glowing root network, grubs, particles, HUD, and every screen.
// One Renderer owns the canvas, the particles, the floating score text,
// and the screen shake. Clickable rects are recorded into g.ui each frame
// so main.js can route clicks to buttons.

import {
  W, H, SOIL_TOP, TOOLBAR_Y, SEED, ROOT_TYPES, ROOT_ORDER,
  COLORS, FLOAT_TIME, SHAKE_DECAY, SEASON_LEN, SEASONS,
} from './config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.floaters = [];
    this.shake = 0;
    this.time = 0;
  }

  addShake(amount) {
    this.shake = Math.min(14, this.shake + amount);
  }

  burst(x, y, count, color, speed = 90, life = 0.7, size = 3) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.9);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30,
        life: life * (0.6 + Math.random() * 0.7), maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color, grav: 160, shape: 'circle',
      });
    }
  }

  petals(x, y, count) {
    const colors = ['#f2a7c3', '#ffd94d', '#ffffff', '#e58bb1'];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 80;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60,
        life: 1.2 + Math.random() * 0.8, maxLife: 1.6,
        size: 4 + Math.random() * 4,
        color: colors[i % colors.length], grav: 60, shape: 'petal',
        rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 6,
      });
    }
  }

  float(x, y, text, color = '#fff3d6') {
    this.floaters.push({ x, y, text, color, life: FLOAT_TIME });
  }

  // -- main entry -----------------------------------------------------------
  render(g, input, dt) {
    this.time += dt;
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0.2) {
      const s = this.shake;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      this.shake = Math.max(0, this.shake - SHAKE_DECAY * dt);
    }
    g.ui = { buttons: [] };

    if (g.state === 'title') {
      this._drawWorld(g, true);
      this._drawTitle(g);
    } else if (g.state === 'win') {
      this._drawWorld(g, false);
      this._drawWin(g);
    } else if (g.state === 'lose') {
      this._drawWorld(g, false);
      this._drawLose(g);
    } else {
      // playing, paused, upgrade, howto: the live game underneath.
      this._drawWorld(g, false);
      this._drawHUD(g);
      this._drawToolbar(g, input);
      this._drawWinLoseLines(g);
      if (g.state === 'playing') this._drawPreview(g, input);
      if (g.banner && g.banner.t > 0) this._drawBanner(g);
      if (g.state === 'paused') this._drawPause(g);
      else if (g.state === 'howto') this._drawHowTo(g);
      else if (g.state === 'upgrade') this._drawUpgrade(g);
    }

    this._drawParticles(dt);
    this._drawFloaters(dt);
    ctx.restore();
  }

  // -- the world ------------------------------------------------------------
  _drawWorld(g, titleMode) {
    const ctx = this.ctx;
    const withered = g.state === 'lose';
    // Sky.
    const sky = ctx.createLinearGradient(0, 0, 0, SOIL_TOP);
    sky.addColorStop(0, withered ? '#cfc4b0' : COLORS.skyTop);
    sky.addColorStop(1, withered ? '#b8a88e' : COLORS.skyBot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, SOIL_TOP);
    // Sun.
    ctx.fillStyle = COLORS.sunGlow;
    ctx.beginPath(); ctx.arc(1090, 46, 44, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = withered ? '#d8cfae' : COLORS.sun;
    ctx.beginPath(); ctx.arc(1090, 46, 26, 0, Math.PI * 2); ctx.fill();
    // Distant hills.
    ctx.fillStyle = withered ? '#a89a80' : '#e8c88f';
    ctx.beginPath();
    ctx.moveTo(0, SOIL_TOP);
    ctx.quadraticCurveTo(200, SOIL_TOP - 34, 420, SOIL_TOP);
    ctx.quadraticCurveTo(760, SOIL_TOP - 44, 1080, SOIL_TOP);
    ctx.lineTo(W, SOIL_TOP);
    ctx.closePath();
    ctx.fill();

    // Soil strata.
    for (const band of g.soil.strata) {
      ctx.fillStyle = withered
        ? shade(COLORS.strata[band.index], -0.25)
        : COLORS.strata[band.index];
      ctx.fillRect(0, band.y0, W, band.y1 - band.y0 + 1);
    }
    // Speckles and pebbles.
    for (const d of g.soil.speckles) {
      ctx.fillStyle = d.light ? COLORS.speckleLight : COLORS.speckleDark;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
    }
    for (const p of g.soil.pebbles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = 'rgba(120, 95, 70, 0.55)';
      ctx.beginPath(); ctx.ellipse(0, 0, p.rx, p.ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    this._drawStones(g);
    this._drawPockets(g);
    this._drawRoots(g, withered);
    this._drawGrubs(g);
    this._drawGroundLine(g, withered);
    if (!titleMode) this._drawSeed(g, withered);
  }

  _drawGroundLine(g, withered) {
    const ctx = this.ctx;
    // Grass tufts along the surface.
    ctx.fillStyle = withered ? '#8a7a58' : COLORS.grassDark;
    ctx.fillRect(0, SOIL_TOP - 3, W, 5);
    ctx.fillStyle = withered ? '#9a8a62' : COLORS.grass;
    for (let x = 8; x < W; x += 18) {
      const h = 6 + ((x * 37) % 10);
      ctx.beginPath();
      ctx.moveTo(x, SOIL_TOP);
      ctx.lineTo(x + 3, SOIL_TOP - h);
      ctx.lineTo(x + 6, SOIL_TOP);
      ctx.closePath();
      ctx.fill();
    }
  }

  _drawSeed(g, withered) {
    const ctx = this.ctx;
    // The seed: a small glowing sprout above the soil, and the heart below.
    const pulse = 1 + Math.sin(this.time * 2.4) * 0.08;
    ctx.save();
    ctx.translate(SEED.x, SEED.y - 14);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = withered ? '#8a8a7a' : '#7ec850';
    ctx.beginPath(); ctx.ellipse(-7, -4, 8, 4.5, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, -4, 8, 4.5, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = withered ? '#6a6a58' : '#4e8a2f';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -8); ctx.stroke();
    ctx.restore();
    // Heart-root glow underground.
    const hg = ctx.createRadialGradient(SEED.x, SEED.y + 6, 2, SEED.x, SEED.y + 6, 26);
    hg.addColorStop(0, withered ? 'rgba(150,150,130,0.5)' : 'rgba(190, 240, 120, 0.55)');
    hg.addColorStop(1, 'rgba(190, 240, 120, 0)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(SEED.x, SEED.y + 6, 26, 0, Math.PI * 2); ctx.fill();
    // Heart health pips, in a small chip left of the seed — clear of the
    // root fan so they read as health, not as part of a root.
    ctx.fillStyle = 'rgba(43, 26, 12, 0.6)';
    roundRect(ctx, SEED.x - 108, SEED.y + 14, 96, 24, 8);
    ctx.fill();
    for (let i = 0; i < g.heartMax; i++) {
      ctx.fillStyle = i < g.heartHp ? '#ff8a7a' : 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(SEED.x - 96 + i * 17, SEED.y + 26, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawStones(g) {
    const ctx = this.ctx;
    for (const s of g.soil.stones) {
      if (s.broken) continue;
      ctx.fillStyle = COLORS.stoneDark;
      ctx.fillRect(s.x - 2, s.y + 3, s.w + 4, s.h);
      ctx.fillStyle = COLORS.stone;
      roundRect(ctx, s.x, s.y, s.w, s.h, 8);
      ctx.fill();
      ctx.fillStyle = COLORS.stoneLight;
      roundRect(ctx, s.x + 6, s.y + 4, s.w - 12, 7, 4);
      ctx.fill();
      // Crack line: a short zigzag, varied by the stone's own phase.
      ctx.strokeStyle = 'rgba(60, 45, 30, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const cx0 = s.x + s.w * (0.25 + 0.1 * Math.sin(s.crack));
      ctx.moveTo(cx0, s.y + 4);
      ctx.lineTo(cx0 + 14, s.y + s.h * 0.35);
      ctx.lineTo(cx0 + 4, s.y + s.h * 0.65);
      ctx.lineTo(cx0 + 18, s.y + s.h - 4);
      ctx.stroke();
    }
  }

  _drawPockets(g) {
    const ctx = this.ctx;
    for (const p of g.soil.pockets) {
      if (p.drunk) {
        // A drunk pocket leaves a damp hollow.
        ctx.fillStyle = 'rgba(30, 90, 120, 0.35)';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      const pulse = 1 + Math.sin(this.time * 2 + p.pulse) * 0.06;
      const r = p.r * pulse;
      const glow = ctx.createRadialGradient(p.x, p.y, r * 0.3, p.x, p.y, r * 2.1);
      glow.addColorStop(0, 'rgba(120, 210, 250, 0.5)');
      glow.addColorStop(1, 'rgba(120, 210, 250, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.waterDeep;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.82, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.water;
      ctx.beginPath(); ctx.ellipse(p.x, p.y - r * 0.12, r * 0.8, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath(); ctx.ellipse(p.x - r * 0.3, p.y - r * 0.3, r * 0.22, r * 0.12, -0.5, 0, Math.PI * 2); ctx.fill();
      if (p.deep) {
        ctx.strokeStyle = 'rgba(255, 217, 77, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 8, this.time * 0.5, this.time * 0.5 + Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  _drawRoots(g, withered) {
    const ctx = this.ctx;
    const pulse = 0.75 + Math.sin(this.time * 2.2) * 0.25;
    for (const root of g.roots.list) {
      if (!root.alive || root.grown < 2) continue;
      const poly = g.roots.grownPolyline(root);
      if (poly.length < 2) continue;
      const t = ROOT_TYPES[root.type];
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Glow halo.
      ctx.strokeStyle = withered ? 'rgba(140, 140, 130, 0.25)' : t.glow;
      ctx.lineWidth = t.width + 10;
      ctx.globalAlpha = 0.5 + 0.5 * pulse;
      strokePoly(ctx, poly);
      ctx.globalAlpha = 1;
      // Outer edge.
      ctx.strokeStyle = withered ? '#6e6e60' : t.edge;
      ctx.lineWidth = t.width + 2;
      strokePoly(ctx, poly);
      // Bright core.
      ctx.strokeStyle = withered ? '#8a8a7a' : t.core;
      ctx.lineWidth = Math.max(2.5, t.width - 3);
      strokePoly(ctx, poly);
      // Growing tip: a bright bead.
      if (!root.done && !root.blocked) {
        const tip = g.roots.tip(root);
        ctx.fillStyle = withered ? '#9a9a8a' : '#ffffff';
        ctx.beginPath(); ctx.arc(tip.x, tip.y, 3.5 + pulse, 0, Math.PI * 2); ctx.fill();
      }
      // Bloomroot flower at the tip.
      if (root.flower) {
        const tip = g.roots.tip(root);
        this._drawFlower(tip.x, tip.y, 1, withered);
      } else if (root.type === 'bloomroot' && root.done && root.flowerT > 0) {
        const tip = g.roots.tip(root);
        this._drawFlower(tip.x, tip.y, root.flowerT, withered);
      }
    }
    ctx.lineCap = 'butt';
  }

  _drawFlower(x, y, scale, withered) {
    const ctx = this.ctx;
    const r = 11 * scale;
    if (r < 2) return;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.fillStyle = withered ? '#8a8a7a' : COLORS.pink;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.62, r * 0.4, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = withered ? '#7a7a6a' : COLORS.gold;
    ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, Math.PI * 2); ctx.fill();
  }

  _drawGrubs(g) {
    const ctx = this.ctx;
    for (const grub of g.pests.grubs) {
      const squash = grub.squash > 0;
      const s = squash ? Math.max(0.3, 1 - grub.squash * 1.6) : 1;
      ctx.save();
      ctx.translate(grub.x, grub.y);
      ctx.scale(1, s);
      // Segmented body.
      ctx.fillStyle = COLORS.grub;
      for (let i = 0; i < 3; i++) {
        const off = (i - 1) * 7;
        const wob = Math.sin(grub.wiggle + i) * 1.5;
        ctx.beginPath();
        ctx.ellipse(off, wob, 8.5 - Math.abs(i - 1), 7.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = COLORS.grubDark;
      ctx.beginPath(); ctx.ellipse(-7, 0, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
      // Eyes and mandibles.
      ctx.fillStyle = COLORS.grubEye;
      ctx.beginPath(); ctx.arc(7, -3, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(7, 3, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (grub.mode === 'eat' && !squash) {
        // Bite marks: little puffs handled by particles; draw a red ring.
        ctx.strokeStyle = 'rgba(255, 90, 70, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(grub.x, grub.y, 15 + Math.sin(grub.wiggle * 2) * 2, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  _drawParticles(dt) {
    const ctx = this.ctx;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.shape === 'petal') p.rot += p.spin * dt;
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.shape === 'petal') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  _drawFloaters(dt) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      if (f.life <= 0) { this.floaters.splice(i, 1); continue; }
      f.y -= 34 * dt;
      ctx.globalAlpha = Math.min(1, f.life / 0.5);
      ctx.font = '700 20px Verdana, sans-serif';
      ctx.strokeStyle = 'rgba(50, 30, 10, 0.8)';
      ctx.lineWidth = 4;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  // -- HUD, toolbar, banners ------------------------------------------------
  _drawHUD(g) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.hud;
    ctx.fillRect(0, 0, W, 54);
    ctx.fillStyle = COLORS.hudLine;
    ctx.fillRect(0, 54, W, 2);

    ctx.textBaseline = 'middle';
    // Sap bar.
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 15px Verdana, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SAP', 16, 28);
    const sapW = 150;
    const sapFrac = Math.max(0, g.sap / g.sapMax);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, 58, 16, sapW, 22, 6); ctx.fill();
    const sapGrad = ctx.createLinearGradient(58, 0, 58 + sapW, 0);
    sapGrad.addColorStop(0, '#7ec850');
    sapGrad.addColorStop(1, '#c9f27a');
    ctx.fillStyle = sapFrac < 0.25 ? '#ff8a5c' : sapGrad;
    if (sapFrac > 0) { roundRect(ctx, 58, 16, sapW * sapFrac, 22, 6); ctx.fill(); }
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 14px Verdana, sans-serif';
    ctx.fillText(`${Math.ceil(g.sap)}`, 216, 28);

    // Water count.
    ctx.fillStyle = COLORS.waterLight;
    ctx.beginPath(); ctx.ellipse(272, 27, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`WATER ${g.pocketsDrunk}/${g.pocketsTotal}`, 286, 28);

    // Bloom meter: seven small flower dots.
    ctx.fillText('BLOOM', 430, 28);
    for (let i = 0; i < g.bloomMax; i++) {
      const cx = 500 + i * 20;
      ctx.fillStyle = i < g.bloom ? COLORS.pink : 'rgba(255,255,255,0.22)';
      ctx.beginPath(); ctx.arc(cx, 27, 7, 0, Math.PI * 2); ctx.fill();
      if (i < g.bloom) {
        ctx.fillStyle = COLORS.gold;
        ctx.beginPath(); ctx.arc(cx, 27, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Season + timer.
    const season = SEASONS[Math.min(g.season - 1, SEASONS.length - 1)];
    const t = Math.max(0, Math.ceil(g.seasonTime));
    const mm = Math.floor(t / 60);
    const ss = String(t % 60).padStart(2, '0');
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.font = '700 15px Verdana, sans-serif';
    ctx.fillText(`SEASON ${g.season}/7 — ${season.name}`, 800, 20);
    ctx.font = '400 13px Verdana, sans-serif';
    ctx.fillStyle = g.seasonTime < 10 ? '#ff9a7a' : COLORS.textDim;
    ctx.fillText(`${mm}:${ss}  ·  ${season.sub}`, 800, 40);

    // Score, best, combo.
    ctx.textAlign = 'right';
    ctx.font = '700 16px Verdana, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`SCORE ${g.score.toLocaleString('en-US')}`, 1170, 20);
    ctx.font = '400 12px Verdana, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`BEST ${g.best.toLocaleString('en-US')}`, 1170, 40);
    if (g.combo > 1) {
      ctx.font = '700 16px Verdana, sans-serif';
      ctx.fillStyle = COLORS.gold;
      ctx.fillText(`COMBO x${g.combo}`, 1040, 28);
    }
    // Mute state.
    ctx.font = '400 13px Verdana, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(g.audio.muted ? 'MUTED (M)' : 'M', 1252, 28);
  }

  _drawToolbar(g, input) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.hud;
    ctx.fillRect(0, TOOLBAR_Y, W, H - TOOLBAR_Y);
    ctx.fillStyle = COLORS.hudLine;
    ctx.fillRect(0, TOOLBAR_Y, W, 2);

    const bw = 250;
    const bh = 58;
    const gap = 16;
    const x0 = 24;
    const y0 = TOOLBAR_Y + 7;
    ROOT_ORDER.forEach((id, i) => {
      const t = ROOT_TYPES[id];
      const x = x0 + i * (bw + gap);
      const selected = g.rootType === id;
      ctx.fillStyle = selected ? 'rgba(255, 220, 140, 0.22)' : 'rgba(0,0,0,0.35)';
      roundRect(ctx, x, y0, bw, bh, 8); ctx.fill();
      ctx.strokeStyle = selected ? t.core : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = selected ? 2.5 : 1.5;
      roundRect(ctx, x, y0, bw, bh, 8); ctx.stroke();
      // Colour swatch.
      ctx.strokeStyle = t.core;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + 16, y0 + bh / 2 + 6); ctx.lineTo(x + 44, y0 + bh / 2 - 8); ctx.stroke();
      ctx.lineCap = 'butt';
      // Name, cost, and short description on three lines.
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.text;
      ctx.font = '700 15px Verdana, sans-serif';
      ctx.fillText(`[${t.key}] ${t.name}`, x + 56, y0 + 13);
      ctx.font = '400 12px Verdana, sans-serif';
      ctx.fillStyle = COLORS.gold;
      ctx.fillText(`${Math.round(t.cost * 100)} sap / 100px`, x + 56, y0 + 30);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '400 11px Verdana, sans-serif';
      ctx.fillText(t.desc, x + 56, y0 + 46);
      g.ui.buttons.push({ id: `root-${id}`, x, y: y0, w: bw, h: bh });
    });

    // Right side: hints.
    ctx.textAlign = 'right';
    ctx.font = '400 13px Verdana, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('Draw from the seed or a grown root', W - 24, TOOLBAR_Y + 22);
    ctx.fillText('Space pause · R restart · Esc menu', W - 24, TOOLBAR_Y + 44);

    // Hint line (fades).
    if (g.hint && g.hintT > 0) {
      ctx.textAlign = 'center';
      ctx.font = '700 15px Verdana, sans-serif';
      ctx.globalAlpha = Math.min(1, g.hintT);
      ctx.fillStyle = '#ffd9a0';
      ctx.fillText(g.hint, W / 2, TOOLBAR_Y - 34);
      ctx.globalAlpha = 1;
    }
  }

  // The win and lose conditions, printed on the play screen in plain words.
  _drawWinLoseLines(g) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(43, 26, 12, 0.6)';
    roundRect(ctx, 14, TOOLBAR_Y - 62, 560, 48, 8);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '700 13px Verdana, sans-serif';
    ctx.fillStyle = '#b7ec6d';
    ctx.fillText('WIN: drink 7 pockets & fill the bloom meter', 26, TOOLBAR_Y - 48);
    ctx.fillStyle = '#ff9a7a';
    ctx.fillText('LOSE: sap hits 0 or the heart-root is eaten', 26, TOOLBAR_Y - 28);
  }

  _drawPreview(g, input) {
    if (!input.isDrawing() || !g.drawAnchor) return;
    const ctx = this.ctx;
    const path = input.currentPath();
    if (path.length < 2) return;
    const t = ROOT_TYPES[g.rootType];
    const full = [g.drawAnchor, ...path.slice(1)];
    const len = g.roots.constructor.pathLength(full);
    const cost = g.roots.constructor.costOf(g.rootType, len);
    const afford = cost <= g.sap;
    const stoneBlock = !t.breaksStone && g.roots.constructor.pathCrossesStone(full, g.soil);

    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = !afford ? '#ff6a5c' : stoneBlock ? '#ffb84d' : t.core;
    ctx.lineWidth = t.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.8;
    strokePoly(ctx, full);
    ctx.restore();

    // Cost label near the cursor.
    const mx = input.mouse.x;
    const my = input.mouse.y - 18;
    const label = !afford
      ? `NEED ${Math.ceil(cost)} SAP`
      : stoneBlock
        ? `${Math.ceil(cost)} SAP — STONE! Taproot only`
        : `${Math.ceil(cost)} SAP`;
    ctx.font = '700 14px Verdana, sans-serif';
    const tw = ctx.measureText(label).width + 18;
    ctx.fillStyle = 'rgba(43, 26, 12, 0.85)';
    roundRect(ctx, mx - tw / 2, my - 24, tw, 24, 6);
    ctx.fill();
    ctx.fillStyle = !afford || stoneBlock ? '#ffb0a0' : COLORS.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, mx, my - 11);
  }

  _drawBanner(g) {
    const ctx = this.ctx;
    const b = g.banner;
    const a = Math.min(1, b.t / 0.6);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.textAlign = 'center';
    ctx.font = '700 44px Georgia, serif';
    ctx.strokeStyle = 'rgba(50, 30, 10, 0.85)';
    ctx.lineWidth = 8;
    ctx.strokeText(b.text, W / 2, 150);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(b.text, W / 2, 150);
    ctx.font = 'italic 20px Georgia, serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(b.sub, W / 2, 186);
    ctx.restore();
  }

  // -- screens ---------------------------------------------------------------
  _panel(x, y, w, h, alpha = 0.88) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(43, 26, 12, ${alpha})`;
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = COLORS.hudLine;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 14);
    ctx.stroke();
  }

  _button(id, x, y, w, h, label, accent = false) {
    const ctx = this.ctx;
    ctx.fillStyle = accent ? 'rgba(255, 217, 77, 0.9)' : 'rgba(255, 240, 200, 0.14)';
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = accent ? '#ffd94d' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 10);
    ctx.stroke();
    ctx.fillStyle = accent ? '#4a2f14' : COLORS.text;
    ctx.font = '700 18px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    this.ctx.canvas.style.cursor = 'pointer';
    return { id, x, y, w, h };
  }

  _drawTitle(g) {
    const ctx = this.ctx;
    // A soft dark veil so the title reads over the soil.
    const veil = ctx.createLinearGradient(0, 0, 0, H);
    veil.addColorStop(0, 'rgba(43, 26, 12, 0.25)');
    veil.addColorStop(0.55, 'rgba(43, 26, 12, 0.55)');
    veil.addColorStop(1, 'rgba(43, 26, 12, 0.75)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // The seed, glowing above the title.
    const pulse = 1 + Math.sin(this.time * 2) * 0.06;
    ctx.save();
    ctx.translate(W / 2, 118);
    ctx.scale(pulse, pulse);
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 60);
    glow.addColorStop(0, 'rgba(200, 245, 130, 0.7)');
    glow.addColorStop(1, 'rgba(200, 245, 130, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7ec850';
    ctx.beginPath(); ctx.ellipse(-16, -6, 20, 11, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(16, -6, 20, 11, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4e8a2f';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -12); ctx.stroke();
    ctx.restore();

    ctx.font = '700 92px Georgia, serif';
    ctx.strokeStyle = 'rgba(50, 30, 10, 0.9)';
    ctx.lineWidth = 10;
    ctx.strokeText('ROOTBOUND', W / 2, 220);
    const titleGrad = ctx.createLinearGradient(0, 170, 0, 270);
    titleGrad.addColorStop(0, '#fff3d6');
    titleGrad.addColorStop(1, '#ffd94d');
    ctx.fillStyle = titleGrad;
    ctx.fillText('ROOTBOUND', W / 2, 220);

    ctx.font = 'italic 26px Georgia, serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('grow the last Worldroot', W / 2, 282);

    // How it plays, in three short lines.
    ctx.font = '400 18px Verdana, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText('Draw roots through the soil with the mouse.', W / 2, 348);
    ctx.fillText('Drink from 7 water pockets to bloom the Worldroot.', W / 2, 378);
    ctx.fillText('Squash the grubs. Mind the drought and the frost.', W / 2, 408);

    // Blinking begin prompt (always on in shot mode, for the screenshot).
    if (g.shotMode || Math.floor(this.time * 1.6) % 2 === 0) {
      ctx.font = '700 26px Verdana, sans-serif';
      ctx.fillStyle = '#ffd94d';
      ctx.fillText('— Click to begin —', W / 2, 478);
    }
    ctx.font = '400 15px Verdana, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('1/2/3 root type · Space pause · R restart · M mute · Esc menu', W / 2, 522);
    if (g.best > 0) {
      ctx.fillStyle = COLORS.gold;
      ctx.font = '700 16px Verdana, sans-serif';
      ctx.fillText(`BEST SCORE ${g.best.toLocaleString('en-US')}`, W / 2, 556);
    }
    g.ui.buttons.push(this._button('begin', W / 2 - 130, 600, 260, 52, 'BEGIN', true));
  }

  _drawTree(g, x, groundY, scale, withered) {
    // A procedural tree: trunk, branches, and a blossom canopy.
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, groundY);
    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    const bark = withered ? '#6e6258' : '#7a5230';
    const leaf = withered ? '#8a8a7a' : '#6faf3f';
    const blossom = withered ? '#9a9a8a' : '#f2a7c3';
    // Trunk.
    ctx.strokeStyle = bark;
    ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-6, -60, 4, -110); ctx.stroke();
    // Branches.
    ctx.lineWidth = 9;
    const branches = [
      [-4, -70, -58, -120], [2, -80, 56, -128], [4, -100, -20, -150], [4, -100, 30, -155],
    ];
    for (const [x0, y0, x1, y1] of branches) {
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, y0 - 14, x1, y1); ctx.stroke();
    }
    // Canopy: clustered blossom circles.
    const blobs = [
      [-52, -128, 34], [52, -136, 36], [-16, -158, 38], [28, -164, 34],
      [0, -128, 42], [-70, -104, 24], [72, -110, 24],
    ];
    for (const [bx, by, br] of blobs) {
      ctx.fillStyle = leaf;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    }
    for (const [bx, by, br] of blobs) {
      ctx.fillStyle = blossom;
      ctx.beginPath(); ctx.arc(bx + br * 0.25, by - br * 0.25, br * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath(); ctx.arc(bx, by, br * 0.18, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  _drawWin(g) {
    const ctx = this.ctx;
    // Golden light over the world.
    const veil = ctx.createLinearGradient(0, 0, 0, H);
    veil.addColorStop(0, 'rgba(255, 230, 150, 0.12)');
    veil.addColorStop(1, 'rgba(43, 26, 12, 0.55)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, W, H);
    // The bloomed Worldroot rises above the soil — a grove of three,
    // sized to fit the sky strip so the canopies stay on screen.
    this._drawTree(g, 200, SOIL_TOP + 2, 0.36, false);
    this._drawTree(g, 1080, SOIL_TOP + 2, 0.36, false);
    this._drawTree(g, 640, SOIL_TOP + 2, 0.48, false);
    // Petals drifting over the grove (fixed positions, no wall clock).
    const petalColors = ['#f2a7c3', '#ffd94d', '#ffffff'];
    for (let i = 0; i < 22; i++) {
      const px = 60 + ((i * 173) % 1160);
      const py = 12 + ((i * 89) % 110);
      ctx.fillStyle = petalColors[i % 3];
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate((i * 0.7) % Math.PI);
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 54px Georgia, serif';
    ctx.strokeStyle = 'rgba(50, 30, 10, 0.9)';
    ctx.lineWidth = 8;
    ctx.strokeText('THE WORLDROOT BLOOMS', W / 2, 330);
    ctx.fillStyle = '#fff3d6';
    ctx.fillText('THE WORLDROOT BLOOMS', W / 2, 330);

    // Stars.
    const stars = g.stars || 1;
    for (let i = 0; i < 3; i++) {
      const sx = W / 2 + (i - 1) * 56;
      ctx.font = '44px Verdana, sans-serif';
      ctx.fillStyle = i < stars ? COLORS.gold : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', sx, 386);
    }

    // Stats panel.
    this._panel(W / 2 - 260, 420, 520, 168);
    const s = g.stats;
    const rows = [
      ['Score', s.score.toLocaleString('en-US')],
      ['Water pockets drunk', `${s.pockets}/7`],
      ['Grubs squashed', `${s.squashed}`],
      ['Flowers grown', `${s.flowers}`],
      ['Time', fmtTime(s.time)],
    ];
    ctx.font = '400 17px Verdana, sans-serif';
    rows.forEach(([label, value], i) => {
      const y = 448 + i * 28;
      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText(label, W / 2 - 230, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.text;
      ctx.fillText(value, W / 2 + 230, y);
    });

    g.ui.buttons.push(this._button('again', W / 2 - 130, 612, 260, 52, 'PLAY AGAIN (R)', true));
  }

  _drawLose(g) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(30, 22, 14, 0.55)';
    ctx.fillRect(0, 0, W, H);
    // The withered grove, grey and bare.
    this._drawTree(g, 200, SOIL_TOP + 2, 0.36, true);
    this._drawTree(g, 1080, SOIL_TOP + 2, 0.36, true);
    this._drawTree(g, 640, SOIL_TOP + 2, 0.48, true);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 54px Georgia, serif';
    ctx.strokeStyle = 'rgba(20, 14, 8, 0.9)';
    ctx.lineWidth = 8;
    ctx.strokeText('THE ROOT WITHERS', W / 2, 330);
    ctx.fillStyle = '#e8dcc2';
    ctx.fillText('THE ROOT WITHERS', W / 2, 330);
    ctx.font = 'italic 20px Georgia, serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(g.loseReason || 'The Worldroot fades…', W / 2, 372);

    this._panel(W / 2 - 260, 404, 520, 168);
    const s = g.stats;
    const rows = [
      ['Score', s.score.toLocaleString('en-US')],
      ['Water pockets drunk', `${s.pockets}/7`],
      ['Grubs squashed', `${s.squashed}`],
      ['Flowers grown', `${s.flowers}`],
      ['Season reached', `${s.season}/7`],
    ];
    ctx.font = '400 17px Verdana, sans-serif';
    rows.forEach(([label, value], i) => {
      const y = 432 + i * 28;
      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText(label, W / 2 - 230, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.text;
      ctx.fillText(value, W / 2 + 230, y);
    });

    g.ui.buttons.push(this._button('again', W / 2 - 130, 596, 260, 52, 'RESTART (R)', true));
  }

  _drawPause(g) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(30, 22, 14, 0.6)';
    ctx.fillRect(0, 0, W, H);
    this._panel(W / 2 - 220, 190, 440, 330);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 40px Georgia, serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText('PAUSED', W / 2, 240);
    g.ui.buttons.push(this._button('resume', W / 2 - 150, 290, 300, 52, 'RESUME (Space)', true));
    g.ui.buttons.push(this._button('restart', W / 2 - 150, 356, 300, 52, 'RESTART (R)'));
    g.ui.buttons.push(this._button('howto', W / 2 - 150, 422, 300, 52, 'HOW TO PLAY'));
    ctx.font = '400 14px Verdana, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('Esc closes this menu', W / 2, 494);
  }

  _drawHowTo(g) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(30, 22, 14, 0.72)';
    ctx.fillRect(0, 0, W, H);
    this._panel(W / 2 - 360, 80, 720, 540);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 34px Georgia, serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText('HOW TO PLAY', W / 2, 128);
    const lines = [
      ['Draw', 'Hold the mouse and drag from the seed (or a grown root) to lay a root path. Release to grow it. Roots cost sap per length.'],
      ['Drink', 'A root tip that reaches a water pocket drinks it: +sap, +score, +bloom. Taproots drink double.'],
      ['Bloom', 'Drink from all 7 pockets and fill the bloom meter to win.'],
      ['Grubs', 'Grubs crawl in and eat your roots. Click a grub to squash it. If they reach the heart, they eat it — 5 bites and the root withers.'],
      ['Seasons', '7 seasons of 45 seconds. Drought drains sap; frost halves growth; stone stops all but taproots. Between seasons, pick 1 of 3 upgrades.'],
      ['Roots', '[1] Feeder — fast, cheap.  [2] Taproot — slow, drinks double, breaks stone.  [3] Bloomroot — grows a flower: +1 combo.'],
      ['Lose', 'Sap hits 0, or the heart-root is fully eaten.'],
      ['Keys', 'Space pause · R restart · M mute · Esc menu · 1/2/3 root type'],
    ];
    ctx.textAlign = 'left';
    let y = 172;
    for (const [head, body] of lines) {
      ctx.font = '700 16px Verdana, sans-serif';
      ctx.fillStyle = COLORS.gold;
      ctx.fillText(head, W / 2 - 320, y);
      ctx.font = '400 15px Verdana, sans-serif';
      ctx.fillStyle = COLORS.text;
      wrapText(ctx, body, W / 2 - 220, y - 8, 540, 20);
      y += head === 'Seasons' || head === 'Grubs' ? 56 : 44;
    }
    g.ui.buttons.push(this._button('back', W / 2 - 130, 556, 260, 48, 'BACK (Esc)', true));
  }

  _drawUpgrade(g) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(30, 22, 14, 0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 38px Georgia, serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText('SEASON PASSED — CHOOSE ONE', W / 2, 150);
    ctx.font = 'italic 19px Georgia, serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`Season ${g.season} begins after you choose`, W / 2, 190);

    const cw = 300;
    const ch = 240;
    const gap = 28;
    const total = g.upgradeChoices.length * cw + (g.upgradeChoices.length - 1) * gap;
    let x = W / 2 - total / 2;
    const y = 250;
    g.upgradeChoices.forEach((u, i) => {
      this._panel(x, y, cw, ch, 0.92);
      ctx.fillStyle = COLORS.gold;
      ctx.font = '44px Verdana, sans-serif';
      ctx.fillText(u.glyph, x + cw / 2, y + 58);
      ctx.fillStyle = COLORS.text;
      ctx.font = '700 21px Verdana, sans-serif';
      ctx.fillText(u.name, x + cw / 2, y + 112);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '400 15px Verdana, sans-serif';
      wrapText(ctx, u.desc, x + 24, y + 140, cw - 48, 20, true);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '400 13px Verdana, sans-serif';
      ctx.fillText(`Press ${i + 1} or click`, x + cw / 2, y + ch - 22);
      g.ui.buttons.push({ id: `upgrade-${i}`, x, y, w: cw, h: ch });
      x += cw + gap;
    });
  }
}

// -- small drawing helpers ---------------------------------------------------
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function strokePoly(ctx, poly) {
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.stroke();
}

// Darken a hex colour by `amt` (0..1) — for the withered look.
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const f = 1 + amt;
  r = Math.max(0, Math.min(255, Math.round(r * f)));
  g = Math.max(0, Math.min(255, Math.round(g * f)));
  b = Math.max(0, Math.min(255, Math.round(b * f)));
  return `rgb(${r},${g},${b})`;
}

// Wrap `text` into lines of at most `maxWidth`, drawn from (x, y) downward.
// When `center` is true the text is centered on x + maxWidth / 2.
export function wrapText(ctx, text, x, y, maxWidth, lineHeight, center = false) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const prevAlign = ctx.textAlign;
  if (center) ctx.textAlign = 'center';
  lines.forEach((l, i) => {
    ctx.fillText(l, center ? x + maxWidth / 2 : x, y + i * lineHeight);
  });
  ctx.textAlign = prevAlign;
}

// Seconds as m:ss.
export function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
