(function (ns) {
  'use strict';

  const Config = ns.Config;
  const TAU = Math.PI * 2;

  /*
   * Arenas: latar peta bertema untuk mode Campaign, satu tema per bos.
   * Setiap tema digambar sekali ke canvas cadangan oleh Renderer,
   * jadi tidak membebani frame saat bermain.
   *
   * Tema:
   *   laser     Aqualis, samudra dengan pulau-pulau kecil
   *   burst     Ignara, gurun merah penuh kawah
   *   bomb      Magmora, sungai lava di antara batu basalt
   *   bounce    Jadis, kolam giok dengan cincin dan teratai
   *   blackhole Umbra, ruang angkasa dengan piringan lubang hitam
   *   beam      Nova, nebula merah muda dengan gelombang kejut
   *   thunder   Tempestra, langit badai dengan awan dan hujan
   */

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

  function blob(ctx, x, y, radius, color, alpha) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);

    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function fillBackground(ctx, w, h, stops) {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);

    stops.forEach(function (stop, index) {
      gradient.addColorStop(index / (stops.length - 1), stop);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(-20, -20, w + 40, h + 40);
  }

  function stars(ctx, w, h, random, count, colors) {
    for (let i = 0; i < count; i += 1) {
      const x = random() * w;
      const y = random() * h;
      const size = 0.6 + random() * 1.8;

      ctx.globalAlpha = 0.35 + random() * 0.65;
      ctx.fillStyle = colors[Math.floor(random() * colors.length)];
      ctx.beginPath();
      ctx.arc(x, y, size, 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  /* ---------- Tema ---------- */

  const THEMES = {
    /* Aqualis: laut biru dengan gelombang dan pulau */
    laser: {
      light: true,
      accent: '#ffffff',
      paint(ctx, w, h, random) {
        fillBackground(ctx, w, h, ['#6cc7ff', '#2f8cff', '#1a5fd6']);

        // Pita gelombang
        for (let row = 0; row < 16; row += 1) {
          const y = 20 + row * 40;

          ctx.beginPath();
          ctx.moveTo(0, y);

          for (let x = 0; x <= w; x += 16) {
            ctx.lineTo(x, y + Math.sin(x / 55 + row * 1.7) * 7);
          }

          ctx.strokeStyle = row % 2 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(10, 60, 150, 0.16)';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Cahaya yang menembus air
        for (let i = 0; i < 9; i += 1) {
          blob(ctx, random() * w, random() * h, 70 + random() * 80, '#c4f1ff', 0.35);
        }

        // Pulau kecil di antara dua kubu
        [[w * 0.5, h * 0.2, 46], [w * 0.5, h * 0.8, 46], [w * 0.34, h * 0.5, 26], [w * 0.66, h * 0.5, 26]].forEach(function (isle) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.beginPath();
          ctx.ellipse(isle[0], isle[1], isle[2] + 12, isle[2] * 0.62 + 10, 0, 0, TAU);
          ctx.fill();

          ctx.fillStyle = '#7ee2b8';
          ctx.beginPath();
          ctx.ellipse(isle[0], isle[1], isle[2], isle[2] * 0.62, 0, 0, TAU);
          ctx.fill();

          ctx.fillStyle = '#c8ffe6';
          ctx.beginPath();
          ctx.ellipse(isle[0] - isle[2] * 0.2, isle[1] - isle[2] * 0.14, isle[2] * 0.5, isle[2] * 0.24, 0, 0, TAU);
          ctx.fill();
        });

        // Buih
        for (let i = 0; i < 60; i += 1) {
          ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.3 + random() * 0.4) + ')';
          ctx.beginPath();
          ctx.arc(random() * w, random() * h, 1.5 + random() * 3, 0, TAU);
          ctx.fill();
        }
      }
    },

    /* Ignara: gurun merah berkawah */
    burst: {
      light: true,
      accent: '#fff1d6',
      paint(ctx, w, h, random) {
        fillBackground(ctx, w, h, ['#ffb199', '#ff7f6e', '#d4443f']);

        for (let i = 0; i < 12; i += 1) {
          blob(ctx, random() * w, random() * h, 90 + random() * 90, '#ffd9b8', 0.3);
        }

        // Kawah: bayangan di sisi atas, tepi terang di sisi bawah
        for (let i = 0; i < 16; i += 1) {
          const x = 60 + random() * (w - 120);
          const y = 50 + random() * (h - 100);
          const size = 20 + random() * 42;

          if (Math.abs(x - w * 0.15) < 90 || Math.abs(x - w * 0.85) < 90) {
            continue;
          }

          ctx.fillStyle = 'rgba(255, 226, 200, 0.45)';
          ctx.beginPath();
          ctx.ellipse(x, y + 4, size + 6, size * 0.66 + 5, 0, 0, TAU);
          ctx.fill();

          ctx.fillStyle = '#a82c33';
          ctx.beginPath();
          ctx.ellipse(x, y, size, size * 0.62, 0, 0, TAU);
          ctx.fill();

          ctx.fillStyle = '#e0605a';
          ctx.beginPath();
          ctx.ellipse(x, y + size * 0.14, size * 0.78, size * 0.42, 0, 0, TAU);
          ctx.fill();
        }

        // Batu kecil dan debu
        for (let i = 0; i < 70; i += 1) {
          ctx.fillStyle = random() > 0.5 ? 'rgba(120, 30, 40, 0.4)' : 'rgba(255, 235, 210, 0.5)';
          ctx.beginPath();
          ctx.arc(random() * w, random() * h, 1.5 + random() * 3.5, 0, TAU);
          ctx.fill();
        }
      }
    },

    /* Magmora: batu basalt dengan sungai lava */
    bomb: {
      light: false,
      accent: '#ffd23f',
      paint(ctx, w, h, random) {
        fillBackground(ctx, w, h, ['#3a1d12', '#2a130d', '#1d0c08']);

        // Retakan lava berpendar
        for (let river = 0; river < 5; river += 1) {
          const baseY = 70 + river * 120;
          const points = [];

          for (let x = -20; x <= w + 20; x += 60) {
            points.push({ x: x, y: baseY + (random() - 0.5) * 90 });
          }

          [[26, 'rgba(255, 90, 20, 0.18)'], [14, 'rgba(255, 130, 20, 0.45)'], [6, '#ffb23a']].forEach(function (pass) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);

            for (let i = 1; i < points.length - 1; i += 1) {
              const mx = (points[i].x + points[i + 1].x) / 2;
              const my = (points[i].y + points[i + 1].y) / 2;

              ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
            }

            ctx.strokeStyle = pass[1];
            ctx.lineWidth = pass[0];
            ctx.lineCap = 'round';
            ctx.stroke();
          });
        }

        // Kolam lava dan batu dingin
        for (let i = 0; i < 6; i += 1) {
          blob(ctx, random() * w, random() * h, 60 + random() * 50, '#ff7a1a', 0.45);
        }

        for (let i = 0; i < 18; i += 1) {
          const x = random() * w;
          const y = random() * h;
          const size = 14 + random() * 26;

          ctx.fillStyle = '#4a2a1c';
          ctx.beginPath();
          ctx.ellipse(x, y, size, size * 0.7, random() * 3, 0, TAU);
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 190, 120, 0.18)';
          ctx.beginPath();
          ctx.ellipse(x - size * 0.2, y - size * 0.2, size * 0.5, size * 0.28, 0, 0, TAU);
          ctx.fill();
        }

        // Bara beterbangan
        for (let i = 0; i < 70; i += 1) {
          ctx.fillStyle = 'rgba(255, ' + Math.round(150 + random() * 90) + ', 60, ' + (0.4 + random() * 0.6) + ')';
          ctx.beginPath();
          ctx.arc(random() * w, random() * h, 1 + random() * 2.2, 0, TAU);
          ctx.fill();
        }
      }
    },

    /* Jadis: kolam giok dengan cincin dan daun teratai */
    bounce: {
      light: true,
      accent: '#eafff2',
      paint(ctx, w, h, random) {
        fillBackground(ctx, w, h, ['#7fe3b0', '#27c47d', '#0f8f5d']);

        // Cincin air
        for (let i = 0; i < 7; i += 1) {
          const x = random() * w;
          const y = random() * h;

          for (let ring = 1; ring <= 4; ring += 1) {
            ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.28 - ring * 0.05) + ')';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(x, y, ring * 22, ring * 13, 0, 0, TAU);
            ctx.stroke();
          }
        }

        // Daun teratai
        for (let i = 0; i < 14; i += 1) {
          const x = random() * w;
          const y = random() * h;
          const size = 18 + random() * 20;

          ctx.fillStyle = '#0f7a4e';
          ctx.beginPath();
          ctx.ellipse(x + 2, y + 4, size, size * 0.62, 0, 0, TAU);
          ctx.fill();

          ctx.fillStyle = '#5fe39c';
          ctx.beginPath();
          ctx.ellipse(x, y, size, size * 0.62, 0, 0.35, TAU - 0.35);
          ctx.lineTo(x, y);
          ctx.fill();

          if (i % 3 === 0) {
            ctx.fillStyle = '#ff9ec4';
            ctx.beginPath();
            ctx.arc(x, y - 2, size * 0.26, 0, TAU);
            ctx.fill();

            ctx.fillStyle = '#fff3a8';
            ctx.beginPath();
            ctx.arc(x, y - 2, size * 0.11, 0, TAU);
            ctx.fill();
          }
        }

        // Kilau
        for (let i = 0; i < 40; i += 1) {
          ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.3 + random() * 0.5) + ')';
          ctx.beginPath();
          ctx.arc(random() * w, random() * h, 1 + random() * 2.5, 0, TAU);
          ctx.fill();
        }
      }
    },

    /* Umbra: lubang hitam dengan piringan akresi di tengah */
    blackhole: {
      light: false,
      accent: '#d8c6ff',
      paint(ctx, w, h, random) {
        const cx = w / 2;
        const cy = h / 2;

        fillBackground(ctx, w, h, ['#0c0620', '#150a33', '#08031a']);
        stars(ctx, w, h, random, 150, ['#ffffff', '#d8c6ff', '#ff9ee8']);

        blob(ctx, cx, cy, 300, '#7a45f0', 0.35);
        blob(ctx, cx, cy, 190, '#ff4fd8', 0.3);

        // Lengan pusaran
        for (let arm = 0; arm < 3; arm += 1) {
          ctx.beginPath();

          for (let step = 0; step <= 60; step += 1) {
            const t = step / 60;
            const angle = arm * (TAU / 3) + t * 4.2;
            const radius = 40 + t * 300;
            const px = cx + Math.cos(angle) * radius;
            const py = cy + Math.sin(angle) * radius * 0.72;

            if (step === 0) {
              ctx.moveTo(px, py);
            } else {
              ctx.lineTo(px, py);
            }
          }

          ctx.strokeStyle = 'rgba(190, 140, 255, 0.28)';
          ctx.lineWidth = 16;
          ctx.lineCap = 'round';
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255, 140, 235, 0.35)';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Piringan dan inti hitam
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, 0.6);

        [[120, '#ff4fd8', 0.55], [96, '#ffb86b', 0.7], [74, '#fff2c2', 0.8]].forEach(function (disc) {
          ctx.strokeStyle = disc[1];
          ctx.globalAlpha = disc[2];
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.arc(0, 0, disc[0], 0, TAU);
          ctx.stroke();
        });

        ctx.restore();
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(cx, cy, 52, 0, TAU);
        ctx.fill();

        // Cincin gravitasi
        for (let ring = 1; ring <= 4; ring += 1) {
          ctx.strokeStyle = 'rgba(216, 198, 255, ' + (0.22 - ring * 0.04) + ')';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 10]);
          ctx.beginPath();
          ctx.arc(cx, cy, 130 + ring * 50, 0, TAU);
          ctx.stroke();
        }

        ctx.setLineDash([]);
      }
    },

    /* Nova: nebula merah muda dengan gelombang kejut dari ledakan bintang */
    beam: {
      light: false,
      accent: '#ffe27a',
      paint(ctx, w, h, random) {
        const cx = w / 2;
        const cy = h / 2;

        fillBackground(ctx, w, h, ['#2a0a3a', '#4a0f4f', '#1c0733']);

        for (let i = 0; i < 10; i += 1) {
          blob(ctx, random() * w, random() * h, 120 + random() * 120, i % 2 ? '#ff3d9a' : '#8c4bff', 0.3);
        }

        // Sinar ledakan dari pusat
        for (let ray = 0; ray < 16; ray += 1) {
          const angle = (ray / 16) * TAU + 0.1;

          ctx.fillStyle = 'rgba(255, 200, 235, 0.1)';
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, 620, angle, angle + 0.09);
          ctx.closePath();
          ctx.fill();
        }

        // Gelombang kejut
        for (let ring = 1; ring <= 5; ring += 1) {
          ctx.strokeStyle = 'rgba(255, 140, 210, ' + (0.5 - ring * 0.08) + ')';
          ctx.lineWidth = 6 - ring;
          ctx.beginPath();
          ctx.arc(cx, cy, ring * 62, 0, TAU);
          ctx.stroke();
        }

        blob(ctx, cx, cy, 110, '#ffffff', 0.9);
        blob(ctx, cx, cy, 70, '#ffe27a', 0.9);
        stars(ctx, w, h, random, 110, ['#ffffff', '#ffd3ec', '#ffe27a']);
      }
    },

    /* Tempestra: langit badai dengan awan gelap dan hujan */
    thunder: {
      light: false,
      accent: '#ffe14d',
      paint(ctx, w, h, random) {
        fillBackground(ctx, w, h, ['#161a52', '#2b3190', '#101440']);

        // Awan bergumpal dari atas
        for (let layer = 0; layer < 3; layer += 1) {
          for (let i = 0; i < 12; i += 1) {
            const x = (i / 11) * (w + 160) - 80 + (random() - 0.5) * 60;
            const y = 20 + layer * 38 + (random() - 0.5) * 24;

            blob(ctx, x, y, 90 + random() * 70, layer === 0 ? '#0b0e33' : '#3a43b8', layer === 0 ? 0.8 : 0.55);
          }
        }

        // Kilat samar di kejauhan
        for (let i = 0; i < 4; i += 1) {
          let x = 120 + random() * (w - 240);
          let y = 60;

          ctx.beginPath();
          ctx.moveTo(x, y);

          while (y < h * 0.8) {
            x += (random() - 0.5) * 50;
            y += 30 + random() * 28;
            ctx.lineTo(x, y);
          }

          ctx.strokeStyle = 'rgba(255, 225, 77, 0.28)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Hujan miring
        ctx.strokeStyle = 'rgba(190, 205, 255, 0.28)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();

        for (let i = 0; i < 260; i += 1) {
          const x = random() * (w + 60);
          const y = random() * h;

          ctx.moveTo(x, y);
          ctx.lineTo(x - 9, y + 22);
        }

        ctx.stroke();

        // Genangan di bawah
        blob(ctx, w * 0.5, h + 20, 420, '#5b6bff', 0.35);
      }
    }
  };

  /* Area awal tiap pihak, lingkaran tengah, dan bingkai: sama di semua tema */
  function paintMarks(ctx, w, h, theme) {
    const sides = [
      { x: w * 0.15, rgb: '16, 185, 166' },
      { x: w * 0.85, rgb: '242, 69, 122' }
    ];

    sides.forEach(function (side) {
      ctx.fillStyle = 'rgba(' + side.rgb + ', 0.22)';
      ctx.beginPath();
      ctx.arc(side.x, h / 2, 62, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(side.x, h / 2, 62, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    ctx.strokeStyle = theme.accent;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 120, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = theme.light ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, h - 16, 18);
    ctx.stroke();
  }

  ns.Arenas = {
    themes: THEMES,

    has(key) {
      return Boolean(THEMES[key]);
    },

    /* Gambar tema ke ctx yang sudah diskalakan ke satuan arena */
    paint(ctx, key, w, h) {
      const theme = THEMES[key];
      const seed = key.split('').reduce(function (sum, letter) {
        return (sum * 31 + letter.charCodeAt(0)) >>> 0;
      }, 7);

      ctx.save();
      ctx.beginPath();
      ctx.rect(-20, -20, w + 40, h + 40);
      ctx.clip();
      theme.paint(ctx, w, h, makeRandom(seed));
      ctx.restore();

      paintMarks(ctx, w, h, theme);
    },

    /* Nama tema yang dipakai bola tertentu, untuk pratinjau di peta campaign */
    previewKeys() {
      return Object.keys(THEMES);
    }
  };

  void Config;
})(window.OrbitArena = window.OrbitArena || {});
