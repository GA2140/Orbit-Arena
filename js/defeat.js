(function (ns) {
  'use strict';

  const TAU = Math.PI * 2;

  /*
   * Defeat: efek layar penuh saat pemain kalah, pasangan dari konfeti
   * saat menang. Digambar di kanvas #result-confetti.
   *
   *   - Judul "Kalah" menghantam, layar retak dari titik hantaman
   *   - Gelombang kejut merah dan serpihan beterbangan
   *   - Abu dan bara jatuh pelan sampai beberapa detik
   *
   * Bagian CSS-nya (vinyet merah, judul jatuh, bola meredup, bintang
   * retak) ada di css/defeat.css.
   */
  const IMPACT = 470;
  const CRACK_GROW = 560;
  const CRACK_HOLD = 1000;
  const CRACK_FADE = 1300;
  const ASH_SECONDS = 4;
  const ASH_RATE = 7;
  const SHARD_COUNT = 18;

  const { rand, clamp, easeOut } = ns.Util;

  /* ---------- Retakan ---------- */

  /*
   * Satu retakan = garis patah dengan titik-titik. delay adalah jarak
   * (piksel) yang harus ditempuh induknya dulu sebelum cabang ini mulai.
   */
  function addCrack(list, x, y, angle, length, delay, depth) {
    const points = [{ x: x, y: y }];
    let walked = 0;
    let px = x;
    let py = y;
    let heading = angle;

    while (walked < length) {
      const step = rand(26, 60);

      heading += rand(-0.38, 0.38);
      px += Math.cos(heading) * step;
      py += Math.sin(heading) * step;
      walked += step;
      points.push({ x: px, y: py });

      if (depth < 2 && Math.random() < 0.28) {
        const side = Math.random() < 0.5 ? -1 : 1;

        addCrack(list, px, py, heading + side * rand(0.5, 0.9), (length - walked) * 0.55 + 30, delay + walked, depth + 1);
      }
    }

    list.push({
      points: points,
      delay: delay,
      total: walked,
      width: depth ? 1.2 : 2.4
    });
  }

  function makeCracks(x, y, reach) {
    const cracks = [];
    const mains = 11;

    for (let i = 0; i < mains; i += 1) {
      addCrack(cracks, x, y, (i / mains) * TAU + rand(-0.25, 0.25), reach * rand(0.55, 1), 0, 0);
    }

    return cracks;
  }

  /* Gambar sebagian retakan sepanjang "grown" piksel (sudah dikurangi delay) */
  function traceCrack(ctx, crack, grown) {
    let left = grown;

    ctx.beginPath();
    ctx.moveTo(crack.points[0].x, crack.points[0].y);

    for (let i = 1; i < crack.points.length; i += 1) {
      const from = crack.points[i - 1];
      const to = crack.points[i];
      const length = Math.hypot(to.x - from.x, to.y - from.y);

      if (left >= length) {
        ctx.lineTo(to.x, to.y);
        left -= length;
      } else {
        const k = left / length;

        ctx.lineTo(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
        break;
      }
    }

    ctx.stroke();
  }

  /* ---------- Abu dan bara ---------- */

  function makeAsh(width, height, seeded) {
    const ember = Math.random() < 0.25;

    return {
      x: rand(0, width),
      y: seeded ? rand(-10, height * 0.6) : rand(-30, -4),
      speed: rand(35, 95),
      sway: rand(8, 26),
      swaySpeed: rand(0.6, 1.6),
      phase: rand(0, TAU),
      size: ember ? rand(1.6, 3.2) : rand(1.5, 4.2),
      spin: rand(0, TAU),
      ember: ember,
      age: 0,
      max: rand(5, 7)
    };
  }

  const Defeat = {
    frame: 0,

    /*
     * canvas  kanvas layar penuh milik layar hasil
     * origin  titik hantaman judul {x, y} dalam piksel layar
     */
    play(canvas, origin) {
      this.stop();

      const ctx = canvas.getContext('2d');
      const ratio = 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const reach = Math.min(width, height) * 0.58;
      const cracks = makeCracks(origin.x, origin.y, reach);
      const colors = ['#3a4166', '#59628f', '#8d96bf', '#f2457a'];
      const shards = [];
      const ash = [];
      const begin = performance.now();

      let last = begin;
      let spawned = 0;
      let burst = false;

      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);

      // Sebagian abu sudah ada di layar sejak awal
      for (let i = 0; i < 26; i += 1) {
        ash.push(makeAsh(width, height, true));
      }

      const step = (now) => {
        const dt = Math.min((now - last) / 1000, 0.05);
        const age = now - begin;

        last = now;

        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, width, height);

        // Serpihan meledak tepat saat judul mendarat
        if (!burst && age >= IMPACT) {
          burst = true;

          for (let i = 0; i < SHARD_COUNT; i += 1) {
            const angle = rand(0, TAU);
            const speed = rand(220, 760);

            shards.push({
              x: origin.x,
              y: origin.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 320,
              spin: rand(0, TAU),
              spinSpeed: rand(-10, 10),
              size: rand(6, 16),
              color: colors[i % colors.length],
              age: 0,
              max: rand(1.4, 2.2)
            });
          }
        }

        this.drawCracks(ctx, cracks, age);
        this.drawRing(ctx, origin, age, reach);
        this.drawShards(ctx, shards, dt);

        // Abu baru terus turun selama beberapa detik
        if (age / 1000 < ASH_SECONDS && age > 250) {
          const due = Math.floor(((age - 250) / 1000) * ASH_RATE);

          while (spawned < due) {
            ash.push(makeAsh(width, height, false));
            spawned += 1;
          }
        }

        this.drawAsh(ctx, ash, dt, height);

        if (age / 1000 < ASH_SECONDS + 7 && (ash.length || shards.length || age < CRACK_HOLD + CRACK_FADE)) {
          this.frame = requestAnimationFrame(step);
        } else {
          ctx.clearRect(0, 0, width, height);
          this.frame = 0;
        }
      };

      this.frame = requestAnimationFrame(step);
    },

    drawCracks(ctx, cracks, age) {
      if (age < IMPACT) {
        return;
      }

      const growth = easeOut(clamp((age - IMPACT) / CRACK_GROW, 0, 1));
      const alpha = 1 - clamp((age - IMPACT - CRACK_HOLD) / CRACK_FADE, 0, 1);

      if (alpha <= 0) {
        return;
      }

      const reach = cracks.reduce(function (max, crack) {
        return Math.max(max, crack.delay + crack.total);
      }, 0);

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(120, 14, 44, 0.85)';

      cracks.forEach(function (crack) {
        const grown = clamp(reach * growth - crack.delay, 0, crack.total);

        if (grown <= 0) {
          return;
        }

        ctx.lineWidth = crack.width;
        traceCrack(ctx, crack, grown);
      });

      ctx.restore();
    },

    /* Gelombang kejut merah dari titik hantaman */
    drawRing(ctx, origin, age, reach) {
      const p = clamp((age - IMPACT) / 750, 0, 1);

      if (p <= 0 || p >= 1) {
        return;
      }

      ctx.save();
      ctx.globalAlpha = Math.pow(1 - p, 1.4) * 0.8;
      ctx.strokeStyle = '#e5384f';
      ctx.lineWidth = 9 * (1 - p) + 1;
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, easeOut(p) * reach * 0.8, 0, TAU);
      ctx.stroke();
      ctx.restore();
    },

    drawShards(ctx, shards, dt) {
      for (let i = shards.length - 1; i >= 0; i -= 1) {
        const shard = shards[i];

        shard.age += dt;

        if (shard.age >= shard.max) {
          shards.splice(i, 1);
          continue;
        }

        shard.vy += 1600 * dt;
        shard.vx *= 1 - 0.6 * dt;
        shard.x += shard.vx * dt;
        shard.y += shard.vy * dt;
        shard.spin += shard.spinSpeed * dt;

        ctx.save();
        ctx.globalAlpha = Math.min(1, (shard.max - shard.age) / 0.5);
        ctx.translate(shard.x, shard.y);
        ctx.rotate(shard.spin);
        ctx.fillStyle = shard.color;
        ctx.beginPath();
        ctx.moveTo(0, -shard.size);
        ctx.lineTo(shard.size * 0.7, shard.size * 0.6);
        ctx.lineTo(-shard.size * 0.5, shard.size * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    },

    drawAsh(ctx, ash, dt, height) {
      for (let i = ash.length - 1; i >= 0; i -= 1) {
        const flake = ash[i];

        flake.age += dt;

        if (flake.age >= flake.max || flake.y > height + 20) {
          ash.splice(i, 1);
          continue;
        }

        flake.y += flake.speed * dt;
        flake.spin += dt * 2;

        const x = flake.x + Math.sin(flake.age * flake.swaySpeed + flake.phase) * flake.sway;
        const fade = Math.min(flake.age / 0.6, 1) * Math.min((flake.max - flake.age) / 1.2, 1);

        ctx.save();

        if (flake.ember) {
          const flicker = 0.7 + 0.3 * Math.sin(flake.age * 9 + flake.phase);

          ctx.globalAlpha = fade * flicker * 0.9;
          ctx.fillStyle = '#ff7a2f';
          ctx.beginPath();
          ctx.arc(x, flake.y, flake.size, 0, TAU);
          ctx.fill();
        } else {
          ctx.globalAlpha = fade * 0.55;
          ctx.fillStyle = '#7d86b0';
          ctx.translate(x, flake.y);
          ctx.rotate(flake.spin);
          ctx.beginPath();
          ctx.ellipse(0, 0, flake.size, flake.size * 0.55, 0, 0, TAU);
          ctx.fill();
        }

        ctx.restore();
      }
    },

    stop() {
      if (this.frame) {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
      }
    }
  };

  ns.Defeat = Defeat;
})(window.OrbitArena = window.OrbitArena || {});
