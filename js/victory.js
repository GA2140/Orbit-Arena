(function (ns) {
  'use strict';

  const TAU = Math.PI * 2;

  /*
   * Victory: perayaan layar penuh saat pemain menang, pasangan dari
   * js/defeat.js. Digambar di kanvas #result-confetti.
   *
   *   - Gelombang kejut emas dari judul
   *   - Dua meriam konfeti dari sudut bawah, lalu hujan konfeti
   *   - Kembang api warna-warni di bagian atas layar
   *   - Percikan bintang di setiap bintang yang menyala
   *
   * Sinar berputar, judul berkilau, dan lompatan bola ada di css/victory.css.
   */
  const PALETTE = ['#10b9a6', '#2f8cff', '#7a45f0', '#ff3d9a', '#ff9a1f', '#f5b301', '#27c47d', '#f2457a'];
  /* Jumlah partikel sengaja kecil supaya tetap lancar di PC sederhana */
  const CANNON_COUNT = 34;
  const RAIN_SECONDS = 3;
  const RAIN_RATE = 12;
  const FIREWORKS = [0.5, 1.1, 1.8, 2.6];
  const TOTAL_SECONDS = 6;
  const SPARK_MIN = 16;
  const SPARK_MAX = 24;
  const SLOW_FRAME = 0.034;

  const { rand, easeOut } = ns.Util;

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  /* ---------- Pembuat partikel ---------- */

  function makePaper(x, y, vx, vy, width, height) {
    const kind = Math.random();

    return {
      type: kind < 0.55 ? 'rect' : (kind < 0.8 ? 'dot' : 'streamer'),
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      size: rand(6, 12),
      tilt: rand(0, TAU),
      spin: rand(-12, 12),
      flip: rand(0, TAU),
      flipSpeed: rand(4, 12),
      color: pick(PALETTE),
      age: 0,
      max: rand(3.4, 5.4),
      width: width,
      height: height
    };
  }

  function makeCannon(width, height) {
    const papers = [];

    for (let i = 0; i < CANNON_COUNT; i += 1) {
      const side = i % 2 === 0 ? 0 : width;
      const direction = side === 0 ? 1 : -1;
      const angle = rand(0.2, 0.95);
      const speed = rand(620, 1280);

      papers.push(makePaper(
        side,
        height + 6,
        Math.sin(angle) * speed * direction,
        -Math.cos(angle) * speed,
        width,
        height
      ));
    }

    return papers;
  }

  function makeFirework(width, height) {
    const x = rand(width * 0.15, width * 0.85);
    const y = rand(height * 0.12, height * 0.42);
    const colors = [pick(PALETTE), pick(PALETTE)];
    const sparks = [];
    const count = Math.round(rand(SPARK_MIN, SPARK_MAX));

    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * TAU + rand(-0.08, 0.08);
      const speed = rand(150, 340) * (i % 2 ? 0.7 : 1);

      sparks.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[i % 2],
        size: rand(2, 3.6),
        age: 0,
        max: rand(0.9, 1.5)
      });
    }

    return { x: x, y: y, sparks: sparks, color: colors[0] };
  }

  /* ---------- Gambar ---------- */

  function drawPaper(ctx, paper) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, (paper.max - paper.age) / 0.6));
    ctx.translate(paper.x, paper.y);
    ctx.rotate(paper.tilt);
    ctx.fillStyle = paper.color;
    ctx.strokeStyle = paper.color;

    if (paper.type === 'dot') {
      ctx.beginPath();
      ctx.arc(0, 0, paper.size * 0.45, 0, TAU);
      ctx.fill();
    } else if (paper.type === 'streamer') {
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-paper.size, 0);
      ctx.quadraticCurveTo(-paper.size / 2, Math.sin(paper.flip) * paper.size, 0, 0);
      ctx.quadraticCurveTo(paper.size / 2, -Math.sin(paper.flip) * paper.size, paper.size, 0);
      ctx.stroke();
    } else {
      // Kertas berputar di sumbunya: lebarnya mengecil-membesar
      ctx.scale(1, Math.cos(paper.flip));
      ctx.fillRect(-paper.size / 2, -paper.size / 4, paper.size, paper.size / 2);
    }

    ctx.restore();
  }

  function drawStarBurst(ctx, burst, age) {
    const p = age / burst.max;

    ctx.save();
    ctx.translate(burst.x, burst.y);
    ctx.globalAlpha = 1 - p;
    ctx.rotate(p * 1.2);

    // Bintang empat sudut yang melebar lalu memudar
    const reach = 10 + easeOut(p) * 46;

    ctx.fillStyle = burst.color;
    ctx.beginPath();

    for (let i = 0; i < 8; i += 1) {
      const radius = i % 2 === 0 ? reach : reach * 0.22;
      const angle = (i / 8) * TAU - Math.PI / 2;

      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }

    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 5 * (1 - p), 0, TAU);
    ctx.fill();
    ctx.restore();

    burst.bits.forEach(function (bit) {
      bit.x += bit.vx * 0.016;
      bit.y += bit.vy * 0.016;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = bit.color;
      ctx.beginPath();
      ctx.arc(bit.x, bit.y, bit.size * (1 - p * 0.6), 0, TAU);
      ctx.fill();
      ctx.restore();
    });
  }

  const Victory = {
    frame: 0,

    /*
     * canvas  kanvas layar penuh milik layar hasil
     * layout  { title: {x, y}, stars: [{x, y}, ...] } titik-titik di layar
     */
    play(canvas, layout) {
      this.stop();

      const ctx = canvas.getContext('2d');
      const ratio = 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const begin = performance.now();
      const papers = [];
      const works = [];
      const bursts = [];
      const rings = [];
      const queue = FIREWORKS.slice();
      const starQueue = (layout.stars || []).map(function (star, index) {
        return { x: star.x, y: star.y, at: 0.75 + index * 0.26 };
      });

      let last = begin;
      let cannon = false;
      let rained = 0;
      let slow = 0;

      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);

      const step = (now) => {
        const dt = Math.min((now - last) / 1000, 0.05);
        const age = (now - begin) / 1000;

        // Kalau perangkat tersendat, buang separuh konfeti dan jadwal kembang api sisa
        slow = (now - last) / 1000 > SLOW_FRAME ? slow + 1 : Math.max(0, slow - 1);
        last = now;

        if (slow >= 6) {
          slow = 0;
          queue.length = Math.min(queue.length, 1);
          papers.splice(0, Math.floor(papers.length / 2));
        }

        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, width, height);

        // Dua meriam konfeti meletus bersamaan dengan judul
        if (!cannon && age >= 0.2) {
          cannon = true;
          makeCannon(width, height).forEach(function (paper) {
            papers.push(paper);
          });

          rings.push({ x: layout.title.x, y: layout.title.y, age: 0, max: 0.9, color: '#f5b301' });
          rings.push({ x: layout.title.x, y: layout.title.y, age: -0.12, max: 0.9, color: '#ff3d9a' });
        }

        // Hujan konfeti ringan dari atas
        if (age > 0.9 && age < RAIN_SECONDS) {
          const due = Math.floor((age - 0.9) * RAIN_RATE);

          while (rained < due) {
            papers.push(makePaper(rand(0, width), -12, rand(-60, 60), rand(60, 180), width, height));
            rained += 1;
          }
        }

        // Kembang api sesuai jadwal
        while (queue.length && age >= queue[0]) {
          queue.shift();
          works.push(makeFirework(width, height));
          ns.Sfx.play('winFirework');
        }

        // Percikan bintang
        while (starQueue.length && age >= starQueue[0].at) {
          const star = starQueue.shift();
          const bits = [];

          for (let i = 0; i < 6; i += 1) {
            const angle = rand(0, TAU);
            const speed = rand(60, 220);

            bits.push({
              x: star.x,
              y: star.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              size: rand(2, 4.5),
              color: pick(PALETTE)
            });
          }

          bursts.push({ x: star.x, y: star.y, age: 0, max: 0.8, color: pick(['#f5b301', '#ff9a1f', '#ff3d9a']), bits: bits });
          ns.Sfx.play('winSparkle');
        }

        this.drawRings(ctx, rings, dt);
        this.drawFireworks(ctx, works, dt);
        this.drawPapers(ctx, papers, dt, height);

        for (let i = bursts.length - 1; i >= 0; i -= 1) {
          bursts[i].age += dt;

          if (bursts[i].age >= bursts[i].max) {
            bursts.splice(i, 1);
          } else {
            drawStarBurst(ctx, bursts[i], bursts[i].age);
          }
        }

        const busy = papers.length || works.length || bursts.length || rings.length || queue.length || starQueue.length;

        if (age < TOTAL_SECONDS && busy) {
          this.frame = requestAnimationFrame(step);
        } else {
          ctx.clearRect(0, 0, width, height);
          this.frame = 0;
        }
      };

      this.frame = requestAnimationFrame(step);
    },

    /* Gelombang kejut dari judul */
    drawRings(ctx, rings, dt) {
      for (let i = rings.length - 1; i >= 0; i -= 1) {
        const ring = rings[i];

        ring.age += dt;

        if (ring.age >= ring.max) {
          rings.splice(i, 1);
          continue;
        }

        if (ring.age < 0) {
          continue;
        }

        const p = ring.age / ring.max;

        ctx.save();
        ctx.globalAlpha = Math.pow(1 - p, 1.3) * 0.85;
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 10 * (1 - p) + 1;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, easeOut(p) * Math.min(window.innerWidth, 900) * 0.5, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    },

    drawPapers(ctx, papers, dt, height) {
      for (let i = papers.length - 1; i >= 0; i -= 1) {
        const paper = papers[i];

        paper.age += dt;

        if (paper.age >= paper.max || paper.y > height + 30) {
          papers.splice(i, 1);
          continue;
        }

        paper.vy += 760 * dt;
        paper.vx *= 1 - 1.1 * dt;
        paper.vy *= 1 - 0.35 * dt;
        paper.x += paper.vx * dt + Math.sin(paper.age * 3 + paper.tilt) * 18 * dt;
        paper.y += paper.vy * dt;
        paper.tilt += paper.spin * dt * 0.3;
        paper.flip += paper.flipSpeed * dt;

        drawPaper(ctx, paper);
      }
    },

    drawFireworks(ctx, works, dt) {
      for (let i = works.length - 1; i >= 0; i -= 1) {
        const work = works[i];
        let alive = 0;

        ctx.lineCap = 'round';

        work.sparks.forEach(function (spark) {
          spark.age += dt;

          if (spark.age >= spark.max) {
            return;
          }

          alive += 1;

          const fromX = spark.x;
          const fromY = spark.y;
          const fade = 1 - spark.age / spark.max;

          spark.vy += 260 * dt;
          spark.vx *= 1 - 1.4 * dt;
          spark.vy *= 1 - 1.4 * dt;
          spark.x += spark.vx * dt;
          spark.y += spark.vy * dt;

          // Satu garis pendek dari posisi sebelumnya sebagai ekor, tanpa save/restore
          ctx.globalAlpha = fade;
          ctx.strokeStyle = spark.color;
          ctx.lineWidth = spark.size * (0.6 + fade * 0.6);
          ctx.beginPath();
          ctx.moveTo(fromX - spark.vx * 0.03, fromY - spark.vy * 0.03);
          ctx.lineTo(spark.x, spark.y);
          ctx.stroke();
        });

        ctx.globalAlpha = 1;

        // Kilatan putih di titik ledakan
        const first = work.sparks[0];

        if (first && first.age < 0.18) {
          ctx.save();
          ctx.globalAlpha = 1 - first.age / 0.18;
          ctx.fillStyle = work.color;
          ctx.beginPath();
          ctx.arc(work.x, work.y, 28 * (first.age / 0.18) + 6, 0, TAU);
          ctx.fill();
          ctx.restore();
        }

        if (!alive) {
          works.splice(i, 1);
        }
      }
    },

    stop() {
      if (this.frame) {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
      }
    }
  };

  ns.Victory = Victory;
})(window.OrbitArena = window.OrbitArena || {});
