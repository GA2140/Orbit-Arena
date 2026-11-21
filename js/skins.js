(function (ns) {
  'use strict';

  const Config = ns.Config;
  const TAU = Math.PI * 2;

  const TEX_W = 512;
  const TEX_H = 256;
  const SHADE = 256;

  /*
   * Skins: tampilan bola sebagai planet bertekstur.
   *
   * Tiap bola adalah satu planet. Permukaannya digambar sekali ke canvas
   * cadangan (tekstur 512x256 yang bisa diulang), lalu setiap frame hanya
   * digeser supaya planet tampak berputar, ditutup lapisan bayangan dan
   * cahaya atmosfer, dan dilengkapi hiasan yang bergerak (cincin, bulan,
   * cakram lubang hitam, petir, dan sebagainya). Satu fungsi gambar dipakai
   * di arena dan di semua preview, jadi bentuknya selalu sama.
   *
   * Opsi draw:
   *   x, y, r      posisi dan jari-jari
   *   kind         jenis bola (kunci di Config.orbs)
   *   time         detik, untuk animasi
   *   level        0 sampai 1, seberapa siap senjatanya (dipakai untuk nyala)
   *   shadow       false untuk mematikan bayangan di bawah planet
   */

  /* ---------- Alat bantu ---------- */

  function makeRandom(seed) {
    let state = seed >>> 0;

    return function () {
      state = (state + 0x6d2b79f5) >>> 0;

      let t = state;

      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    return canvas;
  }

  function lineWidth(r, factor) {
    return Math.max(1.2, r * factor);
  }

  /* Menggambar ulang di kiri dan kanan supaya tekstur menyambung saat diulang */
  function wrapped(ctx, callback) {
    [-TEX_W, 0, TEX_W].forEach(function (shift) {
      ctx.save();
      ctx.translate(shift, 0);
      callback();
      ctx.restore();
    });
  }

  /* Bercak lembut berbentuk elips (awan, noda, cahaya) */
  function softBlob(ctx, x, y, rx, ry, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);

    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /* Benda tak beraturan (daratan, batu) */
  function rock(ctx, cx, cy, radius, random, points) {
    ctx.beginPath();

    for (let i = 0; i < points; i += 1) {
      const angle = (i / points) * TAU;
      const reach = radius * (0.65 + random() * 0.55);
      const px = cx + Math.cos(angle) * reach;
      const py = cy + Math.sin(angle) * reach * 0.75;

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.closePath();
  }

  /* Jalur berliku untuk retakan dan pusaran */
  function wander(ctx, random, x, y, steps, stride) {
    let angle = random() * TAU;

    ctx.beginPath();
    ctx.moveTo(x, y);

    for (let i = 0; i < steps; i += 1) {
      angle += (random() - 0.5) * 1.5;
      x += Math.cos(angle) * stride * (0.6 + random() * 0.8);
      y += Math.sin(angle) * stride * (0.6 + random() * 0.8);
      ctx.lineTo(x, y);
    }
  }

  /* ---------- Tekstur permukaan tiap planet ---------- */

  const PAINTERS = {
    /* Lunara: bulan perak berkawah dengan kilau emas */
    pistol(ctx, random) {
      const base = ctx.createLinearGradient(0, 0, TEX_W, TEX_H);

      base.addColorStop(0, '#aab3d3');
      base.addColorStop(0.5, '#d4dbf0');
      base.addColorStop(1, '#8a94b8');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, TEX_W, TEX_H);

      for (let i = 0; i < 40; i += 1) {
        const cx = random() * TEX_W;
        const cy = 20 + random() * (TEX_H - 40);
        const size = 6 + random() * 22;

        wrapped(ctx, function () {
          ctx.fillStyle = 'rgba(61, 70, 112, 0.35)';
          ctx.beginPath();
          ctx.arc(cx, cy, size, 0, TAU);
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.beginPath();
          ctx.arc(cx - size * 0.16, cy - size * 0.16, size * 0.82, 0, TAU);
          ctx.fill();

          ctx.fillStyle = 'rgba(138, 148, 184, 0.7)';
          ctx.beginPath();
          ctx.arc(cx + size * 0.1, cy + size * 0.1, size * 0.7, 0, TAU);
          ctx.fill();
        });
      }

      for (let i = 0; i < 10; i += 1) {
        const cx = random() * TEX_W;
        const cy = random() * TEX_H;

        wrapped(ctx, function () {
          softBlob(ctx, cx, cy, 8 + random() * 10, 4 + random() * 4, '#ffd23f', 0.75);
        });
      }
    },

    /* Aqualis: samudra, daratan mint, awan putih, kutub es */
    laser(ctx, random) {
      const sea = ctx.createLinearGradient(0, 0, 0, TEX_H);

      sea.addColorStop(0, '#1a5fd6');
      sea.addColorStop(0.5, '#41a6ff');
      sea.addColorStop(1, '#1a5fd6');
      ctx.fillStyle = sea;
      ctx.fillRect(0, 0, TEX_W, TEX_H);

      for (let i = 0; i < 9; i += 1) {
        const cx = random() * TEX_W;
        const cy = 60 + random() * 140;
        const size = 18 + random() * 34;

        wrapped(ctx, function () {
          rock(ctx, cx, cy, size, makeRandom(i * 77 + 3), 14);
          ctx.fillStyle = '#7ee2b8';
          ctx.fill();
          ctx.strokeStyle = '#d9fff0';
          ctx.lineWidth = 3;
          ctx.stroke();
          softBlob(ctx, cx - size * 0.2, cy - size * 0.2, size * 0.6, size * 0.4, '#f6ffcf', 0.55);
        });
      }

      for (let i = 0; i < 38; i += 1) {
        const cx = random() * TEX_W;
        const cy = random() * TEX_H;

        wrapped(ctx, function () {
          softBlob(ctx, cx, cy, 24 + random() * 44, 5 + random() * 9, '#ffffff', 0.5 + random() * 0.35);
        });
      }

      softBlob(ctx, TEX_W / 2, -10, TEX_W, 46, '#ffffff', 0.95);
      softBlob(ctx, TEX_W / 2, TEX_H + 10, TEX_W, 46, '#ffffff', 0.95);
    },

    /* Ignara: merah berdebu dengan banyak kawah */
    burst(ctx, random) {
      const sky = ctx.createLinearGradient(0, 0, 0, TEX_H);

      sky.addColorStop(0, '#ff7e76');
      sky.addColorStop(0.5, '#f0485a');
      sky.addColorStop(1, '#d62f45');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, TEX_W, TEX_H);

      for (let band = 0; band < 8; band += 1) {
        const y = (band / 8) * TEX_H + random() * 12;

        ctx.beginPath();
        ctx.moveTo(0, y);

        for (let x = 0; x <= TEX_W; x += 16) {
          ctx.lineTo(x, y + Math.sin((x / TEX_W) * TAU * 2 + band) * 7);
        }

        ctx.strokeStyle = band % 2 ? 'rgba(255, 235, 200, 0.2)' : 'rgba(110, 10, 30, 0.2)';
        ctx.lineWidth = 8 + random() * 10;
        ctx.stroke();
      }

      for (let i = 0; i < 18; i += 1) {
        const cx = random() * TEX_W;
        const cy = 24 + random() * (TEX_H - 48);
        const size = 6 + random() * 20;

        wrapped(ctx, function () {
          ctx.fillStyle = 'rgba(150, 20, 40, 0.75)';
          ctx.beginPath();
          ctx.ellipse(cx, cy, size, size * 0.8, 0, 0, TAU);
          ctx.fill();

          ctx.strokeStyle = 'rgba(255, 225, 205, 0.85)';
          ctx.lineWidth = Math.max(1.5, size * 0.16);
          ctx.beginPath();
          ctx.ellipse(cx, cy, size, size * 0.8, 0, Math.PI * 0.75, Math.PI * 1.75);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(70, 0, 15, 0.5)';
          ctx.beginPath();
          ctx.ellipse(cx, cy, size, size * 0.8, 0, -Math.PI * 0.25, Math.PI * 0.75);
          ctx.stroke();
        });
      }
    },

    /* Magmora: batu basal hitam dengan retakan lava menyala */
    bomb(ctx, random) {
      ctx.fillStyle = '#2d1a13';
      ctx.fillRect(0, 0, TEX_W, TEX_H);

      for (let i = 0; i < 420; i += 1) {
        ctx.fillStyle = random() > 0.5 ? 'rgba(255, 190, 120, 0.08)' : 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        ctx.arc(random() * TEX_W, random() * TEX_H, 1 + random() * 5, 0, TAU);
        ctx.fill();
      }

      for (let i = 0; i < 7; i += 1) {
        const cx = random() * TEX_W;
        const cy = 20 + random() * (TEX_H - 40);

        wrapped(ctx, function () {
          softBlob(ctx, cx, cy, 22 + random() * 16, 14 + random() * 10, '#ff8a1c', 0.8);
          softBlob(ctx, cx, cy, 10, 7, '#ffe27a', 0.9);
        });
      }

      for (let i = 0; i < 11; i += 1) {
        const sx = random() * TEX_W;
        const sy = random() * TEX_H;
        const seed = i * 131 + 7;

        wrapped(ctx, function () {
          const passes = [
            ['rgba(255, 90, 0, 0.3)', 12],
            ['#ff9a1f', 5],
            ['#ffe27a', 2]
          ];

          passes.forEach(function (pass) {
            wander(ctx, makeRandom(seed), sx, sy, 16, 14);
            ctx.strokeStyle = pass[0];
            ctx.lineWidth = pass[1];
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
          });
        });
      }
    },

    /* Jadis: giok bergaris dengan gelembung */
    bounce(ctx, random) {
      ctx.fillStyle = '#1fb372';
      ctx.fillRect(0, 0, TEX_W, TEX_H);

      for (let band = 0; band < 10; band += 1) {
        const y = (band / 10) * TEX_H;

        ctx.beginPath();
        ctx.moveTo(0, y);

        for (let x = 0; x <= TEX_W; x += 12) {
          ctx.lineTo(x, y + Math.sin((x / TEX_W) * TAU * 3 + band * 1.3) * 8);
        }

        for (let x = TEX_W; x >= 0; x -= 12) {
          ctx.lineTo(x, y + TEX_H / 10 + Math.sin((x / TEX_W) * TAU * 3 + band * 1.3) * 8);
        }

        ctx.closePath();
        ctx.fillStyle = band % 2 ? 'rgba(130, 255, 190, 0.5)' : 'rgba(5, 90, 55, 0.35)';
        ctx.fill();
      }

      for (let i = 0; i < 34; i += 1) {
        const cx = random() * TEX_W;
        const cy = random() * TEX_H;
        const size = 4 + random() * 11;

        wrapped(ctx, function () {
          ctx.fillStyle = 'rgba(210, 255, 170, 0.45)';
          ctx.beginPath();
          ctx.arc(cx, cy, size, 0, TAU);
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.beginPath();
          ctx.arc(cx - size * 0.3, cy - size * 0.3, size * 0.3, 0, TAU);
          ctx.fill();
        });
      }
    },

    /* Umbra: bola gelap berpusaran dengan bintang kecil */
    blackhole(ctx, random) {
      const space = ctx.createLinearGradient(0, 0, TEX_W, TEX_H);

      space.addColorStop(0, '#2a1262');
      space.addColorStop(0.5, '#100624');
      space.addColorStop(1, '#2a1262');
      ctx.fillStyle = space;
      ctx.fillRect(0, 0, TEX_W, TEX_H);

      for (let i = 0; i < 16; i += 1) {
        const cx = random() * TEX_W;
        const cy = random() * TEX_H;
        const radius = 24 + random() * 50;
        const start = random() * TAU;

        wrapped(ctx, function () {
          ctx.strokeStyle = i % 3 ? 'rgba(150, 100, 255, 0.4)' : 'rgba(255, 90, 220, 0.32)';
          ctx.lineWidth = 3 + random() * 6;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, start, start + 1.6 + random());
          ctx.stroke();
        });
      }

      for (let i = 0; i < 70; i += 1) {
        ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.3 + random() * 0.6) + ')';
        ctx.beginPath();
        ctx.arc(random() * TEX_W, random() * TEX_H, 0.6 + random() * 1.6, 0, TAU);
        ctx.fill();
      }
    },

    /* Nova: plasma merah muda berpendar */
    beam(ctx, random) {
      const glow = ctx.createLinearGradient(0, 0, 0, TEX_H);

      glow.addColorStop(0, '#ff5fb0');
      glow.addColorStop(0.5, '#ff2f8e');
      glow.addColorStop(1, '#e01c78');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, TEX_W, TEX_H);

      for (let i = 0; i < 64; i += 1) {
        const cx = random() * TEX_W;
        const cy = random() * TEX_H;
        const size = 8 + random() * 26;
        const light = i % 2 === 0;

        wrapped(ctx, function () {
          softBlob(ctx, cx, cy, size, size * 0.7, light ? '#ffe0f0' : '#a80e63', light ? 0.55 : 0.4);
        });
      }

      for (let i = 0; i < 12; i += 1) {
        const sx = random() * TEX_W;
        const sy = random() * TEX_H;

        wrapped(ctx, function () {
          wander(ctx, makeRandom(i * 17 + 5), sx, sy, 7, 12);
          ctx.strokeStyle = 'rgba(255, 245, 190, 0.8)';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.stroke();
        });
      }
    },

    /* Tempestra: raksasa gas nila dengan pita badai dan mata badai */
    thunder(ctx, random) {
      const sky = ctx.createLinearGradient(0, 0, 0, TEX_H);

      sky.addColorStop(0, '#2b34bd');
      sky.addColorStop(0.5, '#4553e8');
      sky.addColorStop(1, '#232a9e');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, TEX_W, TEX_H);

      for (let band = 0; band < 10; band += 1) {
        const y = (band / 10) * TEX_H;

        ctx.beginPath();
        ctx.moveTo(0, y);

        for (let x = 0; x <= TEX_W; x += 12) {
          ctx.lineTo(x, y + Math.sin((x / TEX_W) * TAU * 2 + band) * 9);
        }

        ctx.strokeStyle = band % 2 ? 'rgba(160, 172, 255, 0.4)' : 'rgba(10, 14, 90, 0.35)';
        ctx.lineWidth = 12 + random() * 10;
        ctx.stroke();
      }

      for (let ring = 0; ring < 6; ring += 1) {
        ctx.strokeStyle = 'rgba(215, 220, 255, ' + (0.6 - ring * 0.08) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(150, 120, 52 - ring * 8, 30 - ring * 5, 0.2 + ring * 0.25, 0, TAU * 0.8);
        ctx.stroke();
      }

      for (let i = 0; i < 30; i += 1) {
        const cx = random() * TEX_W;
        const cy = random() * TEX_H;

        wrapped(ctx, function () {
          softBlob(ctx, cx, cy, 20 + random() * 34, 6 + random() * 9, '#e1e4ff', 0.35);
        });
      }
    }
  };

  /* ---------- Sprite per planet (dibuat sekali) ---------- */

  const sprites = {};

  function seedFor(kind) {
    let seed = 17;

    for (let i = 0; i < kind.length; i += 1) {
      seed = (seed * 31 + kind.charCodeAt(i)) >>> 0;
    }

    return seed;
  }

  /* Bayangan sisi gelap, cahaya atmosfer di tepi, dan kilau */
  function paintShade(ctx, palette) {
    const mid = SHADE / 2;
    const dark = palette.dark;

    const body = ctx.createRadialGradient(SHADE * 0.36, SHADE * 0.32, SHADE * 0.04, mid, mid, SHADE * 0.54);

    body.addColorStop(0, 'rgba(255, 255, 255, 0.34)');
    body.addColorStop(0.35, 'rgba(255, 255, 255, 0)');
    body.addColorStop(0.7, 'rgba(0, 0, 0, 0.12)');
    body.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = body;
    ctx.fillRect(0, 0, SHADE, SHADE);

    const rim = ctx.createRadialGradient(mid, mid, SHADE * 0.38, mid, mid, mid);

    rim.addColorStop(0, 'rgba(255, 255, 255, 0)');
    rim.addColorStop(1, dark);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, SHADE, SHADE);
    ctx.globalAlpha = 1;

    const atmosphere = ctx.createRadialGradient(mid, mid, mid * 0.86, mid, mid, mid);

    atmosphere.addColorStop(0, 'rgba(255, 255, 255, 0)');
    atmosphere.addColorStop(1, palette.light);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = atmosphere;
    ctx.fillRect(0, 0, SHADE, SHADE);
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(SHADE * 0.33, SHADE * 0.27, SHADE * 0.13, SHADE * 0.06, -0.62, 0, TAU);
    ctx.fill();
  }

  function paintShadow(ctx) {
    const gradient = ctx.createRadialGradient(SHADE / 2, SHADE / 2, 0, SHADE / 2, SHADE / 2, SHADE / 2);

    gradient.addColorStop(0, 'rgba(27, 33, 64, 0.34)');
    gradient.addColorStop(1, 'rgba(27, 33, 64, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SHADE, SHADE);
  }

  function spriteFor(kind) {
    if (sprites[kind]) {
      return sprites[kind];
    }

    const orb = Config.orbs[kind] || Config.orbs.laser;
    const surface = makeCanvas(TEX_W, TEX_H);
    const shade = makeCanvas(SHADE, SHADE);
    const shadow = makeCanvas(SHADE, SHADE);

    (PAINTERS[kind] || PAINTERS.laser)(surface.getContext('2d'), makeRandom(seedFor(kind)));
    paintShade(shade.getContext('2d'), orb.palette);
    paintShadow(shadow.getContext('2d'));

    sprites[kind] = { surface: surface, shade: shade, shadow: shadow };

    return sprites[kind];
  }

  /* ---------- Hiasan yang bergerak ---------- */

  /* Setengah cincin: 'back' di belakang planet, 'front' di depannya */
  function ringHalf(ctx, o, ring) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(ring.tilt);
    ctx.lineCap = 'round';
    ctx.globalAlpha = ring.alpha === undefined ? 1 : ring.alpha;

    ctx.beginPath();

    if (ring.pass === 'back') {
      ctx.ellipse(0, 0, o.r * ring.rx, o.r * ring.ry, 0, Math.PI, TAU);
    } else {
      ctx.ellipse(0, 0, o.r * ring.rx, o.r * ring.ry, 0, 0, Math.PI);
    }

    ctx.strokeStyle = ring.edge;
    ctx.lineWidth = lineWidth(o.r, ring.width + 0.07);
    ctx.stroke();

    ctx.strokeStyle = ring.color;
    ctx.lineWidth = lineWidth(o.r, ring.width);
    ctx.stroke();
    ctx.restore();
  }

  function drawMoon(ctx, x, y, radius, lit, palette) {
    const gradient = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.35, radius * 0.1, x, y, radius);

    gradient.addColorStop(0, lit ? '#ffffff' : '#e6e8f2');
    gradient.addColorStop(1, lit ? palette.accent : '#aab0c8');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = lit ? palette.dark : '#7c829e';
    ctx.lineWidth = Math.max(1, radius * 0.18);
    ctx.stroke();
  }

  /* Cakram lubang hitam yang miring, dengan titik panas berputar */
  function accretionDisc(ctx, o, pass) {
    const R = o.r;

    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(-0.28);
    ctx.scale(1, 0.3);
    ctx.beginPath();

    if (pass === 'back') {
      ctx.rect(-R * 3, -R * 3, R * 6, R * 3);
    } else {
      ctx.rect(-R * 3, 0, R * 6, R * 3);
    }

    ctx.clip();

    const disc = ctx.createRadialGradient(0, 0, R * 1.02, 0, 0, R * 2.4);

    disc.addColorStop(0, 'rgba(255, 215, 250, 0.95)');
    disc.addColorStop(0.16, 'rgba(255, 130, 230, 0.92)');
    disc.addColorStop(0.5, 'rgba(150, 80, 255, 0.78)');
    disc.addColorStop(1, 'rgba(90, 40, 200, 0)');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(0, 0, R * 2.4, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = R * 0.12;
    ctx.setLineDash([R * 0.4, R * 1.1]);
    ctx.lineDashOffset = -o.time * R * 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.45, 0, TAU);
    ctx.stroke();

    ctx.globalAlpha = 0.55;
    ctx.lineDashOffset = o.time * R * 1.1;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.95, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /* Petir kecil di tepi planet badai, menyala sebentar lalu hilang */
  function stormBolt(ctx, o) {
    const cycle = o.time * 0.9;
    const phase = cycle - Math.floor(cycle);

    if (phase > 0.16) {
      return;
    }

    const random = makeRandom(Math.floor(cycle) * 977 + 11);
    const fade = 1 - phase / 0.16;
    const angle = random() * TAU;
    const startX = o.x + Math.cos(angle) * o.r * 1.5;
    const startY = o.y + Math.sin(angle) * o.r * 1.5;
    const endX = o.x + (random() - 0.5) * o.r * 0.7;
    const endY = o.y + (random() - 0.5) * o.r * 0.7;

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = '#ffe14d';
    ctx.shadowBlur = o.r * 0.6;

    [['#ffe14d', lineWidth(o.r, 0.12)], ['#ffffff', lineWidth(o.r, 0.05)]].forEach(function (pass) {
      const bolt = makeRandom(Math.floor(cycle) * 977 + 31);

      ctx.strokeStyle = pass[0];
      ctx.lineWidth = pass[1];
      ctx.beginPath();
      ctx.moveTo(startX, startY);

      for (let i = 1; i <= 5; i += 1) {
        const t = i / 5;
        const jitter = (1 - t) * o.r * 0.34;

        ctx.lineTo(
          startX + (endX - startX) * t + (bolt() - 0.5) * jitter,
          startY + (endY - startY) * t + (bolt() - 0.5) * jitter
        );
      }

      ctx.stroke();
    });

    ctx.restore();
  }

  /*
   * Hiasan tiap planet. pass:
   *   under  sebelum planet (cahaya, mahkota)
   *   back   bagian yang berada di belakang planet
   *   front  bagian yang berada di depan planet
   */
  const DECOR = {
    pistol(ctx, o, pass) {
      if (pass === 'under') {
        return;
      }

      ringHalf(ctx, o, {
        pass: pass,
        rx: 1.5,
        ry: 0.42,
        tilt: 0.3,
        width: 0.05,
        color: '#ffffff',
        edge: o.palette.dark,
        alpha: 0.75
      });
    },

    laser(ctx, o, pass) {
      const palette = o.palette;

      if (pass === 'under') {
        return;
      }

      ringHalf(ctx, o, {
        pass: pass,
        rx: 1.68,
        ry: 0.5,
        tilt: -0.38,
        width: 0.13,
        color: palette.accent,
        edge: palette.dark,
        alpha: 0.5 + o.level * 0.5
      });

      ringHalf(ctx, o, {
        pass: pass,
        rx: 1.4,
        ry: 0.42,
        tilt: -0.38,
        width: 0.04,
        color: '#ffffff',
        edge: palette.accent,
        alpha: 0.4 + o.level * 0.55
      });
    },

    burst(ctx, o, pass) {
      const count = Config.orbs.burst.count;
      const lit = Math.round(o.level * count);

      if (pass === 'under') {
        return;
      }

      for (let i = 0; i < count; i += 1) {
        const angle = o.time * 1.2 + (i * TAU) / count;
        const depth = Math.sin(angle);

        if ((pass === 'back') !== (depth < 0)) {
          continue;
        }

        drawMoon(
          ctx,
          o.x + Math.cos(angle) * o.r * 1.62,
          o.y + depth * o.r * 0.62 - o.r * 0.12,
          o.r * (0.17 + depth * 0.025),
          i < lit,
          o.palette
        );
      }
    },

    bomb(ctx, o, pass) {
      const pulse = 0.6 + 0.4 * Math.sin(o.time * 4);

      if (pass === 'under') {
        const glow = ctx.createRadialGradient(o.x, o.y, o.r * 0.8, o.x, o.y, o.r * (1.6 + pulse * 0.25));

        glow.addColorStop(0, 'rgba(255, 140, 20, ' + (0.18 + o.level * 0.4) + ')');
        glow.addColorStop(1, 'rgba(255, 140, 20, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r * 2, 0, TAU);
        ctx.fill();

        return;
      }

      // Serpihan batu panas yang mengorbit
      for (let i = 0; i < 4; i += 1) {
        const angle = -o.time * 0.9 + (i * TAU) / 4;
        const depth = Math.sin(angle);

        if ((pass === 'back') !== (depth < 0)) {
          continue;
        }

        const x = o.x + Math.cos(angle) * o.r * 1.5;
        const y = o.y + depth * o.r * 0.5;
        const size = o.r * 0.13;

        ctx.fillStyle = '#3b2417';
        ctx.strokeStyle = o.level > 0.99 ? '#ffd23f' : '#ff8a1c';
        ctx.lineWidth = Math.max(1, size * 0.5);
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y + size * 0.4);
        ctx.lineTo(x - size * 0.8, y + size * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    },

    bounce(ctx, o, pass) {
      const squash = 1 + 0.18 * Math.sin(o.time * 6);
      const palette = o.palette;

      if (pass === 'under') {
        return;
      }

      [
        { tilt: 0.5, rx: 1.58, ry: 0.5 * squash },
        { tilt: -0.5, rx: 1.58, ry: 0.5 / squash }
      ].forEach(function (ring, index) {
        ringHalf(ctx, o, {
          pass: pass,
          rx: ring.rx,
          ry: ring.ry,
          tilt: ring.tilt,
          width: 0.1,
          color: index ? palette.accent : '#ffffff',
          edge: palette.dark,
          alpha: 0.55 + o.level * 0.45
        });
      });
    },

    blackhole(ctx, o, pass) {
      if (pass === 'under') {
        const halo = ctx.createRadialGradient(o.x, o.y, o.r * 0.9, o.x, o.y, o.r * 2.3);

        halo.addColorStop(0, 'rgba(160, 90, 255, ' + (0.3 + o.level * 0.25) + ')');
        halo.addColorStop(1, 'rgba(160, 90, 255, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r * 2.3, 0, TAU);
        ctx.fill();

        return;
      }

      if (pass === 'front') {
        // Cincin tepi lubang hitam
        ctx.strokeStyle = 'rgba(255, 180, 245, 0.9)';
        ctx.lineWidth = lineWidth(o.r, 0.06);
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r * 1.01, 0, TAU);
        ctx.stroke();
      }

      accretionDisc(ctx, o, pass);
    },

    beam(ctx, o, pass) {
      const palette = o.palette;

      if (pass !== 'under') {
        return;
      }

      const halo = ctx.createRadialGradient(o.x, o.y, o.r * 0.8, o.x, o.y, o.r * 2.3);

      halo.addColorStop(0, 'rgba(255, 90, 170, ' + (0.28 + o.level * 0.3) + ')');
      halo.addColorStop(1, 'rgba(255, 90, 170, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r * 2.3, 0, TAU);
      ctx.fill();

      // Mahkota sinar yang berputar pelan
      const spikes = 14;

      for (let i = 0; i < spikes; i += 1) {
        const angle = o.time * 0.5 + (i * TAU) / spikes;
        const length = o.r * (0.5 + (i % 2) * 0.38) * (0.7 + o.level * 0.45);
        const base = o.r * 0.94;

        ctx.fillStyle = i % 2 ? palette.accent : palette.main;
        ctx.strokeStyle = palette.dark;
        ctx.lineWidth = Math.max(1, o.r * 0.04);
        ctx.beginPath();
        ctx.moveTo(o.x + Math.cos(angle - 0.12) * base, o.y + Math.sin(angle - 0.12) * base);
        ctx.lineTo(o.x + Math.cos(angle) * (base + length), o.y + Math.sin(angle) * (base + length));
        ctx.lineTo(o.x + Math.cos(angle + 0.12) * base, o.y + Math.sin(angle + 0.12) * base);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    },

    thunder(ctx, o, pass) {
      if (pass === 'under') {
        const halo = ctx.createRadialGradient(o.x, o.y, o.r * 0.9, o.x, o.y, o.r * 2);

        halo.addColorStop(0, 'rgba(90, 100, 255, ' + (0.18 + o.level * 0.22) + ')');
        halo.addColorStop(1, 'rgba(90, 100, 255, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r * 2, 0, TAU);
        ctx.fill();

        return;
      }

      // Tiga gumpalan awan badai yang mengorbit
      for (let i = 0; i < 3; i += 1) {
        const angle = o.time * 0.6 + (i * TAU) / 3;
        const depth = Math.sin(angle);

        if ((pass === 'back') !== (depth < 0)) {
          continue;
        }

        const cx = o.x + Math.cos(angle) * o.r * 1.5;
        const cy = o.y + depth * o.r * 0.5;
        const size = o.r * 0.2;

        [[-0.8, 0.2, 0.9], [0, -0.3, 1.1], [0.8, 0.2, 0.9]].forEach(function (puff) {
          ctx.fillStyle = '#8f98ff';
          ctx.strokeStyle = '#1b2178';
          ctx.lineWidth = Math.max(1, size * 0.22);
          ctx.beginPath();
          ctx.arc(cx + puff[0] * size, cy + puff[1] * size, size * puff[2], 0, TAU);
          ctx.fill();
          ctx.stroke();
        });

        ctx.fillStyle = '#d9ddff';
        ctx.beginPath();
        ctx.arc(cx, cy - size * 0.4, size * 0.7, 0, TAU);
        ctx.fill();
      }

      if (pass === 'front') {
        stormBolt(ctx, o);
      }
    }
  };

  /* ---------- Badan planet ---------- */

  function drawBody(ctx, o) {
    const sprite = spriteFor(o.kind);
    const width = o.r * 4;
    const shift = ((o.time * 0.045) % 1) * width;
    const left = o.x - o.r - shift;

    ctx.save();
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, TAU);
    ctx.clip();
    ctx.drawImage(sprite.surface, left, o.y - o.r, width, o.r * 2);
    ctx.drawImage(sprite.surface, left + width, o.y - o.r, width, o.r * 2);
    ctx.drawImage(sprite.shade, o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = o.palette.dark;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = lineWidth(o.r, 0.05);
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- API publik ---------- */

  function draw(ctx, options) {
    const kind = Config.orbs[options.kind] ? options.kind : 'laser';
    const o = {
      x: options.x,
      y: options.y,
      r: options.r,
      kind: kind,
      palette: Config.orbs[kind].palette,
      time: options.time || 0,
      level: options.level === undefined ? 1 : options.level
    };
    const decor = DECOR[kind];

    if (options.shadow !== false) {
      ctx.drawImage(spriteFor(kind).shadow, o.x - o.r * 1.15, o.y + o.r * 0.62, o.r * 2.3, o.r * 0.8);
    }

    decor(ctx, o, 'under');
    decor(ctx, o, 'back');
    drawBody(ctx, o);
    decor(ctx, o, 'front');
  }

  /* ---------- Preview animasi di menu (canvas.orb-preview) ---------- */

  const Previews = {
    running: false,
    still: false,

    start() {
      if (this.running) {
        return;
      }

      try {
        this.still = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      } catch (error) {
        this.still = false;
      }

      this.running = true;
      requestAnimationFrame((now) => this.frame(now));
    },

    frame(now) {
      document.querySelectorAll('canvas.orb-preview').forEach((canvas) => {
        // Canvas yang sedang tidak tampil tidak perlu digambar
        if (canvas.offsetParent !== null) {
          this.paint(canvas, this.still ? 0 : now / 1000);
        }
      });

      requestAnimationFrame((next) => this.frame(next));
    },

    paint(canvas, time) {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const box = canvas.clientWidth;

      if (!box) {
        return;
      }

      if (canvas.width !== Math.round(box * ratio)) {
        canvas.width = Math.round(box * ratio);
        canvas.height = canvas.width;
      }

      const ctx = canvas.getContext('2d');

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, box, box);

      draw(ctx, {
        x: box / 2,
        y: box / 2,
        r: box * 0.21,
        kind: canvas.dataset.kind,
        time: time,
        level: 1,
        shadow: canvas.dataset.shadow !== 'off'
      });
    }
  };

  ns.Skins = {
    draw: draw,
    palette(kind) {
      return (Config.orbs[kind] || Config.orbs.laser).palette;
    },
    startPreviews() {
      Previews.start();
    }
  };
})(window.OrbitArena = window.OrbitArena || {});
