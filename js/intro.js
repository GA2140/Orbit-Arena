(function (ns) {
  'use strict';

  const Config = ns.Config;
  const TAU = Math.PI * 2;

  /*
   * Intro: animasi pembuka saat game dibuka.
   *
   *   1. Logo orbit muncul disapu cahaya diagonal
   *   2. Logo melebur, empat bola melesat dari sudut layar
   *   3. Bola bertabrakan di tengah: kilatan, gelombang kejut, percikan,
   *      layar bergetar, lalu judul menghantam huruf per huruf
   *   4. Bola mengorbit judul, tagline muncul, kilau menyapu huruf
   *   5. Judul membesar dan memudar, menu tersingkap
   *
   * Bisa dilewati kapan saja dengan klik, ketuk, atau tombol apa pun.
   * Bola, warna, dan fonnya sama dengan yang dipakai di dalam game.
   */

  /* Jadwal dalam milidetik sejak intro mulai */
  const TIME = {
    emblemIn: 350,
    sweepEnd: 1350,
    launch: 1950,
    impact: 2800,
    tagline: 3750,
    outro: 5800
  };

  const FADE_OUT = 900;
  const FADE_OUT_SKIP = 450;
  const REDUCED_HOLD = 1600;

  /* Tilt garis kilat penyapu logo (radian) */
  const SWEEP_TILT = 0.32;

  const ORBS = [
    { kind: 'laser', team: 'player', corner: [-1, -1], angle: -2.356, side: 1 },
    { kind: 'bomb', team: 'player', corner: [-1, 1], angle: 2.356, side: -1 },
    { kind: 'burst', team: 'enemy', corner: [1, -1], angle: -0.785, side: -1 },
    { kind: 'bounce', team: 'enemy', corner: [1, 1], angle: 0.785, side: 1 }
  ];

  const SPARK_COLORS = ['#10b9a6', '#2f8cff', '#7a45f0', '#ff3d9a', '#ff9a1f', '#f5b301'];
  const TRAIL_LENGTH = 16;
  const DUST_COUNT = 70;

  const { clamp, rand, easeOut, reducedMotion } = ns.Util;

  function easeIn(t) {
    return t * t * t;
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeOutBack(t) {
    const c1 = 1.9;
    const c3 = c1 + 1;

    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  /* Bola polos bercahaya (dipakai untuk logo awal) */
  function glowOrb(ctx, x, y, r, palette) {
    const gradient = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);

    gradient.addColorStop(0, palette.light);
    gradient.addColorStop(0.55, palette.main);
    gradient.addColorStop(1, palette.dark);

    ctx.save();
    ctx.shadowColor = palette.main;
    ctx.shadowBlur = r * 1.2;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  const Intro = {
    root: null,
    app: null,
    canvas: null,
    ctx: null,
    emblem: null,
    emblemCtx: null,

    width: 0,
    height: 0,
    ratio: 1,
    emblemRadius: 80,

    // Pusat dan ukuran judul, dipakai sebagai titik tabrakan dan orbit
    target: { x: 0, y: 0, rx: 200, ry: 120 },

    start: 0,
    last: 0,
    frame: 0,
    leaving: false,
    fired: {},

    dust: [],
    sparks: [],
    rings: [],
    trails: [[], [], [], []],

    onSkip: null,
    onResize: null,

    /* ---------- Mulai ---------- */

    play() {
      this.root = document.getElementById('intro');

      if (!this.root) {
        return;
      }

      this.app = document.querySelector('.app');
      this.canvas = document.getElementById('intro-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.emblem = document.createElement('canvas');
      this.emblemCtx = this.emblem.getContext('2d');

      this.splitTitle();

      this.app.classList.add('is-intro');
      this.app.inert = true;

      ns.Sfx.hold(true);
      ns.Sfx.unlock();

      this.onSkip = (event) => {
        ns.Sfx.unlock();

        if (event.type === 'keydown' && (event.metaKey || event.ctrlKey || event.altKey)) {
          return;
        }

        this.leave(true);
      };

      this.onResize = () => this.resize();

      this.root.addEventListener('pointerdown', this.onSkip);
      document.addEventListener('keydown', this.onSkip);
      window.addEventListener('resize', this.onResize);

      this.resize();

      if (reducedMotion()) {
        this.root.classList.add('is-lit', 'is-title', 'is-tagline');
        window.setTimeout(() => this.leave(false), REDUCED_HOLD);

        return;
      }

      this.seedDust();
      this.start = performance.now();
      this.last = this.start;
      this.frame = requestAnimationFrame((now) => this.tick(now));
    },

    /* Judul dipecah per huruf supaya tiap huruf bisa menghantam bergantian */
    splitTitle() {
      let index = 0;

      this.root.querySelectorAll('.intro-word').forEach(function (word) {
        const letters = word.textContent.trim().split('');

        word.textContent = '';

        letters.forEach(function (letter) {
          const node = document.createElement('i');

          node.className = 'ch';
          node.textContent = letter;
          node.dataset.c = letter;
          node.style.setProperty('--i', index);
          index += 1;
          word.appendChild(node);
        });
      });
    },

    /* ---------- Ukuran ---------- */

    resize() {
      this.ratio = Math.min(window.devicePixelRatio || 1, 2);
      this.width = window.innerWidth;
      this.height = window.innerHeight;

      this.canvas.width = Math.round(this.width * this.ratio);
      this.canvas.height = Math.round(this.height * this.ratio);

      this.emblemRadius = clamp(Math.min(this.width, this.height) * 0.15, 56, 130);

      const size = Math.ceil(this.emblemRadius * 4 * this.ratio);

      this.emblem.width = size;
      this.emblem.height = size;

      this.measureTitle();
    },

    /* Orbit dibuat sedikit lebih lebar dari judul supaya bola tidak menutupi huruf */
    measureTitle() {
      const title = this.root.querySelector('.intro-title');
      const box = title.getBoundingClientRect();

      this.target.x = box.left + box.width / 2;
      this.target.y = box.top + box.height / 2;
      this.target.rx = Math.min(box.width * 0.75 + 14, this.width / 2 - 32);
      this.target.ry = box.height * 0.75 + 10;
    },

    seedDust() {
      this.dust = [];

      for (let i = 0; i < DUST_COUNT; i += 1) {
        this.dust.push({
          x: Math.random(),
          y: Math.random(),
          size: rand(0.6, 1.9),
          speed: rand(0.004, 0.018),
          phase: rand(0, TAU)
        });
      }
    },

    /* ---------- Putaran animasi ---------- */

    tick(now) {
      const t = now - this.start;
      const dt = Math.min((now - this.last) / 1000, 0.05);

      this.last = now;

      this.cue(t);
      this.draw(t, dt);

      this.frame = requestAnimationFrame((next) => this.tick(next));
    },

    /* Hal-hal yang terjadi sekali pada waktu tertentu */
    cue(t) {
      const root = this.root;

      if (this.leaving) {
        return;
      }

      if (t >= TIME.emblemIn && !this.fired.sweep) {
        this.fired.sweep = true;
        ns.Sfx.play('introSweep');
      }

      if (t >= TIME.launch - 250 && !this.fired.lit) {
        this.fired.lit = true;
        root.classList.add('is-lit');
      }

      if (t >= TIME.launch && !this.fired.launch) {
        this.fired.launch = true;
        ns.Sfx.play('introWhoosh');
      }

      if (t >= TIME.impact && !this.fired.impact) {
        this.fired.impact = true;
        this.measureTitle();
        this.impact();
      }

      if (t >= TIME.tagline && !this.fired.tagline) {
        this.fired.tagline = true;
        root.classList.add('is-tagline');
        ns.Sfx.play('introChime');
      }

      if (t >= TIME.outro) {
        this.leave(false);
      }
    },

    /* Tabrakan: huruf menghantam, percikan, gelombang kejut, getar */
    impact() {
      const target = this.target;

      this.root.classList.add('is-title', 'is-shake');

      ns.Sfx.play('introImpact');
      ns.Sfx.play('introChime');

      for (let i = 0; i < 110; i += 1) {
        const angle = rand(0, TAU);
        const speed = rand(260, 1100);

        this.sparks.push({
          x: target.x,
          y: target.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: rand(1.2, 3.4),
          life: rand(0.6, 1.3),
          max: 1,
          color: SPARK_COLORS[i % SPARK_COLORS.length]
        });
      }

      this.sparks.forEach(function (spark) {
        spark.max = spark.life;
      });

      this.rings.push({ at: TIME.impact, color: '#10b9a6', width: 10 });
      this.rings.push({ at: TIME.impact + 110, color: '#ff3d9a', width: 7 });
    },

    /* ---------- Gambar ---------- */

    draw(t, dt) {
      const ctx = this.ctx;

      ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);

      this.drawDust(ctx, t, dt);
      this.drawEmblem(ctx, t);
      this.drawBuildUp(ctx, t);
      this.drawRays(ctx, t);
      this.drawOrbitGuide(ctx, t);
      this.drawRings(ctx, t);
      this.drawOrbs(ctx, t);
      this.drawSparks(ctx, dt);
      this.drawFlash(ctx, t);
    },

    /* Debu cahaya yang melayang pelan sepanjang intro */
    drawDust(ctx, t, dt) {
      const fade = clamp(t / 600, 0, 1);

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';

      this.dust.forEach((mote) => {
        mote.y -= mote.speed * dt;

        if (mote.y < -0.02) {
          mote.y = 1.02;
        }

        const twinkle = 0.5 + 0.5 * Math.sin(t / 600 + mote.phase);

        ctx.globalAlpha = fade * twinkle * 0.7;
        ctx.fillStyle = '#9aa6e8';
        ctx.beginPath();
        ctx.arc(mote.x * this.width, mote.y * this.height, mote.size, 0, TAU);
        ctx.fill();
      });

      ctx.restore();
    },

    /* ---------- 1. Logo orbit disapu cahaya ---------- */

    drawEmblem(ctx, t) {
      const age = t - TIME.emblemIn;

      if (age < 0) {
        return;
      }

      const R = this.emblemRadius;
      const reveal = clamp(age / (TIME.sweepEnd - TIME.emblemIn), 0, 1);
      const out = easeIn(clamp((t - TIME.launch + 150) / 500, 0, 1));
      const alpha = 1 - out;

      if (alpha <= 0.01) {
        return;
      }

      const size = R * 4;
      const mid = size / 2;
      const em = this.emblemCtx;
      const spin = -0.9 + age * 0.0016 + out * out * 5;
      const tilt = SWEEP_TILT;
      const nx = Math.cos(tilt);
      const ny = Math.sin(tilt);
      const front = -0.08 + 1.2 * easeInOut(reveal);
      const cx = this.width / 2;
      const cy = this.height / 2;
      const player = Config.colors.player;
      const enemy = Config.colors.enemy;

      // Gambar logo ke kanvas kecil dulu supaya bisa disingkap bertahap
      em.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      em.clearRect(0, 0, size, size);
      em.globalCompositeOperation = 'source-over';

      em.save();
      em.strokeStyle = 'rgba(122, 130, 220, 0.85)';
      em.lineWidth = Math.max(2, R * 0.035);
      em.setLineDash([R * 0.07, R * 0.1]);
      em.lineDashOffset = -age * 0.03;
      em.beginPath();
      em.arc(mid, mid, R, 0, TAU);
      em.stroke();

      em.setLineDash([]);
      em.globalAlpha = 0.35;
      em.lineWidth = Math.max(1, R * 0.015);
      em.beginPath();
      em.arc(mid, mid, R * 0.55, 0, TAU);
      em.stroke();
      em.restore();

      glowOrb(em, mid + Math.cos(spin) * R, mid + Math.sin(spin) * R, R * 0.3, player);
      glowOrb(em, mid - Math.cos(spin) * R, mid - Math.sin(spin) * R, R * 0.3, enemy);

      em.save();
      em.shadowColor = '#f5b301';
      em.shadowBlur = R * 0.3;
      em.fillStyle = '#f5b301';
      em.beginPath();
      em.arc(mid, mid, R * 0.07, 0, TAU);
      em.fill();
      em.restore();

      // Topeng: hanya bagian di belakang garis kilat yang terlihat
      const mask = em.createLinearGradient(
        mid - nx * R * 1.7,
        mid - ny * R * 1.7,
        mid + nx * R * 1.7,
        mid + ny * R * 1.7
      );
      const edgeStart = clamp(front - 0.06, 0, 1);
      const edgeEnd = clamp(front, 0, 1);

      mask.addColorStop(0, 'rgba(0, 0, 0, 1)');
      mask.addColorStop(edgeStart, 'rgba(0, 0, 0, 1)');
      mask.addColorStop(edgeEnd, 'rgba(0, 0, 0, 0)');
      mask.addColorStop(1, 'rgba(0, 0, 0, 0)');

      em.globalCompositeOperation = 'destination-in';
      em.fillStyle = mask;
      em.fillRect(0, 0, size, size);
      em.globalCompositeOperation = 'source-over';

      // Cahaya lembut di belakang logo
      ctx.save();
      ctx.globalAlpha = alpha * reveal * 0.3;

      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.2);

      glow.addColorStop(0, 'rgba(122, 69, 240, 0.55)');
      glow.addColorStop(1, 'rgba(122, 69, 240, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - R * 2.2, cy - R * 2.2, R * 4.4, R * 4.4);
      ctx.restore();

      // Logo (membesar dan memudar saat bola dilepas)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1 + out * 0.9, 1 + out * 0.9);
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.emblem, -size / 2, -size / 2, size, size);
      ctx.restore();

      // Garis kilat yang menyapu
      const streak = Math.pow(Math.sin(Math.PI * reveal), 0.6) * alpha;

      if (streak > 0.01) {
        const along = (-1.7 + 3.4 * front) * R;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.translate(cx + nx * along, cy + ny * along);
        ctx.rotate(tilt);

        [[R * 0.5, 0.16], [R * 0.14, 0.95]].forEach(function (band) {
          const width = band[0];
          const gradient = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);

          gradient.addColorStop(0, 'rgba(47, 140, 255, 0)');
          gradient.addColorStop(0.5, 'rgba(47, 140, 255, ' + (band[1] * streak).toFixed(3) + ')');
          gradient.addColorStop(1, 'rgba(47, 140, 255, 0)');

          ctx.fillStyle = gradient;
          ctx.fillRect(-width / 2, -R * 3, width, R * 6);
        });

        ctx.restore();
      }
    },

    /* Cahaya di tengah membesar saat bola mendekat */
    drawBuildUp(ctx, t) {
      const p = clamp((t - TIME.launch) / (TIME.impact - TIME.launch), 0, 1);

      if (p <= 0 || t >= TIME.impact + 200) {
        return;
      }

      const target = this.target;
      const radius = Math.max(this.width, this.height) * 0.25 * p;
      const fade = t < TIME.impact ? 1 : 1 - (t - TIME.impact) / 200;
      const gradient = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, radius);

      gradient.addColorStop(0, 'rgba(245, 179, 1, 0.7)');
      gradient.addColorStop(0.4, 'rgba(255, 61, 154, 0.25)');
      gradient.addColorStop(1, 'rgba(255, 61, 154, 0)');

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.pow(p, 2.5) * fade;
      ctx.fillStyle = gradient;
      ctx.fillRect(target.x - radius, target.y - radius, radius * 2, radius * 2);
      ctx.restore();
    },

    /* ---------- 2 dan 3. Bola melesat, bertabrakan, lalu mengorbit ---------- */

    orbPosition(orb, t) {
      const target = this.target;
      const startX = this.width / 2 + orb.corner[0] * this.width * 0.62;
      const startY = this.height / 2 + orb.corner[1] * this.height * 0.62;

      if (t < TIME.impact) {
        const p = clamp((t - TIME.launch) / (TIME.impact - TIME.launch), 0, 1);
        const e = Math.pow(p, 2.2);

        // Lintasan melengkung, bola berputar masuk seperti pusaran
        const ctrlX = (startX + target.x) / 2 - (target.y - startY) * 0.45 * orb.side;
        const ctrlY = (startY + target.y) / 2 + (target.x - startX) * 0.45 * orb.side;
        const inv = 1 - e;

        return {
          x: inv * inv * startX + 2 * inv * e * ctrlX + e * e * target.x,
          y: inv * inv * startY + 2 * inv * e * ctrlY + e * e * target.y,
          scale: 0.55 + 0.45 * p,
          alpha: clamp(p * 4, 0, 1)
        };
      }

      // Setelah tabrakan: terpental keluar ke jalur orbit lalu berputar
      const age = t - TIME.impact;
      const q = easeOutBack(clamp(age / 700, 0, 1));
      const angle = orb.angle + age * 0.00085;

      return {
        x: target.x + Math.cos(angle) * target.rx * q,
        y: target.y + Math.sin(angle) * target.ry * q,
        scale: 1 + 0.3 * (1 - clamp(age / 700, 0, 1)),
        alpha: 1
      };
    },

    drawOrbs(ctx, t) {
      if (t < TIME.launch) {
        return;
      }

      const baseRadius = clamp(Math.min(this.width, this.height) * 0.04, 15, 28);

      ORBS.forEach((orb, index) => {
        const state = this.orbPosition(orb, t);
        const trail = this.trails[index];
        const palette = Config.colors[orb.team];
        const radius = baseRadius * state.scale;

        trail.push({ x: state.x, y: state.y });

        if (trail.length > TRAIL_LENGTH) {
          trail.shift();
        }

        // Ekor komet
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = palette.main;

        trail.forEach(function (point, step) {
          const k = step / trail.length;

          ctx.globalAlpha = k * 0.4 * state.alpha;
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius * k * 0.85, 0, TAU);
          ctx.fill();
        });

        ctx.restore();

        ctx.save();
        ctx.globalAlpha = state.alpha;

        ns.Skins.draw(ctx, {
          x: state.x,
          y: state.y,
          r: radius,
          kind: orb.kind,
          time: t / 1000,
          level: 1
        });

        ctx.restore();
      });
    },

    /* Garis orbit tipis di sekeliling judul */
    drawOrbitGuide(ctx, t) {
      const age = t - TIME.impact;

      if (age < 0) {
        return;
      }

      const target = this.target;

      ctx.save();
      ctx.globalAlpha = clamp(age / 800, 0, 1) * 0.28;
      ctx.strokeStyle = '#7a82dc';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = -age * 0.02;
      ctx.beginPath();
      ctx.ellipse(target.x, target.y, target.rx, target.ry, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    },

    /* Sinar berputar di belakang judul */
    drawRays(ctx, t) {
      const age = t - TIME.impact;

      if (age < 0) {
        return;
      }

      const target = this.target;
      const reach = Math.max(this.width, this.height) * 0.8;
      const rotation = age * 0.00012;
      const count = 16;
      const gradient = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, reach);

      gradient.addColorStop(0, 'rgba(122, 69, 240, 1)');
      gradient.addColorStop(1, 'rgba(47, 140, 255, 0)');

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = clamp(age / 700, 0, 1) * 0.14;
      ctx.fillStyle = gradient;
      ctx.beginPath();

      for (let i = 0; i < count; i += 1) {
        const from = rotation + (i * TAU) / count;
        const to = from + TAU / (count * 2);

        ctx.moveTo(target.x, target.y);
        ctx.lineTo(target.x + Math.cos(from) * reach, target.y + Math.sin(from) * reach);
        ctx.lineTo(target.x + Math.cos(to) * reach, target.y + Math.sin(to) * reach);
        ctx.closePath();
      }

      ctx.fill();
      ctx.restore();
    },

    /* Gelombang kejut dari titik tabrakan */
    drawRings(ctx, t) {
      const target = this.target;
      const maxRadius = Math.max(this.width, this.height) * 0.7;

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';

      this.rings.forEach(function (ring) {
        const p = clamp((t - ring.at) / 950, 0, 1);

        if (p <= 0 || p >= 1) {
          return;
        }

        ctx.globalAlpha = Math.pow(1 - p, 1.5);
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = ring.width * (1 - p) + 1;
        ctx.beginPath();
        ctx.arc(target.x, target.y, easeOut(p) * maxRadius, 0, TAU);
        ctx.stroke();
      });

      ctx.restore();
    },

    drawSparks(ctx, dt) {
      if (!this.sparks.length) {
        return;
      }

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'round';

      this.sparks = this.sparks.filter(function (spark) {
        spark.life -= dt;

        if (spark.life <= 0) {
          return false;
        }

        const drag = 1 - 2.2 * dt;
        const k = spark.life / spark.max;

        spark.vx *= drag;
        spark.vy *= drag;
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;

        ctx.globalAlpha = k;
        ctx.strokeStyle = spark.color;
        ctx.lineWidth = spark.size * k + 0.4;
        ctx.beginPath();
        ctx.moveTo(spark.x - spark.vx * 0.04, spark.y - spark.vy * 0.04);
        ctx.lineTo(spark.x, spark.y);
        ctx.stroke();

        return true;
      });

      ctx.restore();
    },

    /* Kilatan putih dan garis lensa horizontal saat tabrakan */
    drawFlash(ctx, t) {
      const p = (t - TIME.impact) / 500;

      if (p < 0 || p > 1) {
        return;
      }

      const target = this.target;
      const radius = Math.max(this.width, this.height) * 0.6;
      const gradient = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, radius);
      const flare = ctx.createLinearGradient(0, 0, this.width, 0);

      gradient.addColorStop(0, 'rgba(255, 244, 190, 1)');
      gradient.addColorStop(0.3, 'rgba(255, 190, 120, 0.4)');
      gradient.addColorStop(1, 'rgba(255, 190, 120, 0)');

      flare.addColorStop(0, 'rgba(255, 61, 154, 0)');
      flare.addColorStop(0.5, 'rgba(255, 61, 154, 1)');
      flare.addColorStop(1, 'rgba(255, 61, 154, 0)');

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';

      ctx.globalAlpha = Math.pow(1 - p, 2) * 0.85;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = flare;
      ctx.fillRect(
        this.width * 0.5 * (1 - easeOut(p)),
        target.y - 3 * (1 - p),
        this.width * easeOut(p),
        6 * (1 - p) + 1
      );

      ctx.restore();
    },

    /* ---------- 5. Keluar ---------- */

    leave(fast) {
      if (this.leaving) {
        return;
      }

      this.leaving = true;
      ns.Sfx.hold(false);

      this.root.classList.toggle('is-skip', fast);
      this.root.classList.add('is-out');

      // Menu mulai beranimasi di balik lapisan yang memudar
      this.app.classList.remove('is-intro');
      this.app.inert = false;

      const title = document.querySelector('.screen-menu .lobby-title');

      if (title) {
        title.focus({ preventScroll: true });
      }

      this.root.removeEventListener('pointerdown', this.onSkip);
      document.removeEventListener('keydown', this.onSkip);

      window.setTimeout(() => this.finish(), fast ? FADE_OUT_SKIP : FADE_OUT);
    },

    finish() {
      cancelAnimationFrame(this.frame);
      window.removeEventListener('resize', this.onResize);

      if (this.root) {
        this.root.remove();
        this.root = null;
      }
    }
  };

  ns.Intro = Intro;
})(window.OrbitArena = window.OrbitArena || {});
