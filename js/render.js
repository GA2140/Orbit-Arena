(function (ns) {
  'use strict';

  const Config = ns.Config;
  const MAX_PIXELS = 1280;
  const MARGIN = 20;
  const DISPLAY_FONT = '"Chakra Petch", "Trebuchet MS", sans-serif';

  /*
   * Renderer hanya menggambar. Semua logika pertandingan ada di Match.
   * Koordinat gambar memakai satuan arena (0 sampai Config.arena.width / height),
   * lalu diskalakan ke ukuran canvas yang sebenarnya.
   */
  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.width = Config.arena.width;
      this.height = Config.arena.height;
      this.scale = 1;
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const pixels = Math.max(1, Math.min(MAX_PIXELS, Math.round(rect.width * ratio)));

      if (this.canvas.width !== pixels) {
        this.canvas.width = pixels;
        this.canvas.height = Math.round(pixels * this.height / this.width);
      }

      this.scale = this.canvas.width / this.width;
    }

    draw(match, view) {
      const ctx = this.ctx;
      const shake = match.shake;
      const offsetX = shake ? (Math.random() * 2 - 1) * shake : 0;
      const offsetY = shake ? (Math.random() * 2 - 1) * shake : 0;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(this.scale, 0, 0, this.scale, offsetX * this.scale, offsetY * this.scale);

      this.drawArena(ctx);
      this.drawHoles(ctx, match);
      this.drawLasers(ctx, match);
      this.drawProjectiles(ctx, match);
      this.drawAimGuide(ctx, match, view);
      this.drawOrbs(ctx, match);
      this.drawStorms(ctx, match);
      this.drawEffects(ctx, match);
      this.drawBanner(ctx, match);
    }

    /* ---------- Arena ---------- */

    /*
     * Latar arena tidak pernah berubah, jadi digambar sekali ke canvas
     * cadangan lalu ditempel tiap frame. Dibuat ulang hanya saat
     * ukuran canvas berubah.
     */
    drawArena(ctx) {
      const pixels = this.canvas.width;

      if (!this.arenaCache || this.arenaCacheWidth !== pixels) {
        const cache = document.createElement('canvas');
        const cacheCtx = cache.getContext('2d');

        cache.width = Math.ceil((this.width + MARGIN * 2) * this.scale);
        cache.height = Math.ceil((this.height + MARGIN * 2) * this.scale);
        cacheCtx.setTransform(this.scale, 0, 0, this.scale, MARGIN * this.scale, MARGIN * this.scale);
        this.paintArena(cacheCtx);

        this.arenaCache = cache;
        this.arenaCacheWidth = pixels;
      }

      ctx.drawImage(this.arenaCache, -MARGIN, -MARGIN, this.width + MARGIN * 2, this.height + MARGIN * 2);
    }

    /* Tema arena campaign; null = arena putih biasa. Mengganti tema membuat cache dibuang. */
    setTheme(key) {
      const next = key && ns.Arenas && ns.Arenas.has(key) ? key : null;

      if (next !== this.theme) {
        this.theme = next;
        this.arenaCache = null;
      }
    }

    paintArena(ctx) {
      const width = this.width;
      const height = this.height;

      if (this.theme) {
        ns.Arenas.paint(ctx, this.theme, width, height);

        return;
      }

      const gradient = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, width * 0.62);

      gradient.addColorStop(0, '#e6f2f3');
      gradient.addColorStop(1, '#a8c7ca');
      ctx.fillStyle = gradient;
      ctx.fillRect(-20, -20, width + 40, height + 40);

      ctx.strokeStyle = 'rgba(46, 107, 110, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let line = 40; line < width; line += 40) {
        ctx.moveTo(line, 0);
        ctx.lineTo(line, height);
      }

      for (let line = 40; line < height; line += 40) {
        ctx.moveTo(0, line);
        ctx.lineTo(width, line);
      }

      ctx.stroke();

      ctx.strokeStyle = 'rgba(46, 107, 110, 0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 120, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.strokeStyle = 'rgba(120, 130, 200, 0.3)';
      ctx.stroke();

      this.paintDecor(ctx);
    }

    /* Hiasan peta: area awal tiap pemain, siku sudut berwarna-warni, dan lingkaran tengah. Ikut di-cache. */
    paintDecor(ctx) {
      const width = this.width;
      const height = this.height;
      const sides = [
        { x: width * 0.15, rgb: '16, 185, 166' },
        { x: width * 0.85, rgb: '242, 69, 122' }
      ];

      // Area awal pemain dan bot
      sides.forEach(function (side) {
        const y = height / 2;

        ctx.fillStyle = 'rgba(' + side.rgb + ', 0.1)';
        ctx.beginPath();
        ctx.arc(side.x, y, 62, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(' + side.rgb + ', 0.55)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.arc(side.x, y, 62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Lingkaran dalam di tengah dan belah ketupat
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 56, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(245, 179, 1, 0.9)';
      ctx.beginPath();
      ctx.moveTo(width / 2, height / 2 - 12);
      ctx.lineTo(width / 2 + 12, height / 2);
      ctx.lineTo(width / 2, height / 2 + 12);
      ctx.lineTo(width / 2 - 12, height / 2);
      ctx.closePath();
      ctx.fill();

      // Tanda garis tengah
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();

      for (let y = 40; y < height; y += 80) {
        if (Math.abs(y - height / 2) > 130) {
          ctx.moveTo(width / 2 - 8, y);
          ctx.lineTo(width / 2 + 8, y);
        }
      }

      ctx.stroke();

      // Bingkai tipis dan empat titik planet kecil di sudut, tiap sudut warnanya beda
      ctx.strokeStyle = 'rgba(160, 170, 215, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(8, 8, width - 16, height - 16, 18);
      ctx.stroke();

      const dots = [
        { x: 8, y: 8, color: '#ec4899' },
        { x: width - 8, y: 8, color: '#f59e0b' },
        { x: 8, y: height - 8, color: '#06b6d4' },
        { x: width - 8, y: height - 8, color: '#8b5cf6' }
      ];

      dots.forEach(function (dot) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = dot.color;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 6, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    /* ---------- Laser dan Sinar Penghancur ---------- */

    drawLasers(ctx, match) {
      const length = this.width * 1.6;

      match.lasers.forEach((laser) => {
        const owner = laser.owner;
        const skill = owner.weapon;
        const endX = owner.x + Math.cos(laser.angle) * length;
        const endY = owner.y + Math.sin(laser.angle) * length;

        ctx.save();
        ctx.lineCap = 'round';

        if (laser.state === 'charge') {
          const progress = 1 - laser.t / skill.chargeTime;

          ctx.globalAlpha = 0.3 + progress * 0.6;
          ctx.strokeStyle = owner.color;
          ctx.lineWidth = 2 + progress * 6;
          ctx.setLineDash([14, 12]);
          ctx.beginPath();
          ctx.moveTo(owner.x, owner.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        } else {
          const fade = laser.t / skill.fireTime;
          const width = laser.width || skill.width;

          ctx.globalAlpha = Math.min(1, fade * 1.5);
          ctx.shadowColor = owner.color;
          ctx.shadowBlur = laser.beam ? 46 : 30;
          ctx.strokeStyle = owner.color;
          ctx.lineWidth = width * (0.6 + fade * 0.4);
          ctx.beginPath();
          ctx.moveTo(owner.x, owner.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          if (laser.beam) {
            ctx.shadowBlur = 0;
            ctx.strokeStyle = owner.accent;
            ctx.lineWidth = width * 0.62 * fade;
            ctx.beginPath();
            ctx.moveTo(owner.x, owner.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
          }

          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = width * 0.3 * fade;
          ctx.beginPath();
          ctx.moveTo(owner.x, owner.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }

        ctx.restore();
      });

      match.orbs.forEach((orb) => {
        if (orb.beam && orb.hp > 0) {
          this.drawBeamCharge(ctx, orb, length);
        }
      });
    }

    /* Sinar yang sedang diisi: garis bidik menebal, cincin energi menyempit ke moncong */
    drawBeamCharge(ctx, orb, length) {
      const weapon = orb.weapon;
      const progress = Math.min(1, orb.beam.charge / weapon.maxCharge);
      const ready = orb.beam.charge >= weapon.minCharge;
      const flicker = 0.75 + 0.25 * Math.sin(orb.beam.charge * 40);
      const muzzleX = orb.x + Math.cos(orb.aim) * (orb.r + 20);
      const muzzleY = orb.y + Math.sin(orb.aim) * (orb.r + 20);

      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = orb.color;
      ctx.lineWidth = 3 + progress * (weapon.maxWidth * 0.5);
      ctx.setLineDash([16, 12]);

      // Garis bidik ke tiga arah: lurus di tengah, dua lainnya miring dan sedikit lebih samar
      [-weapon.fan, 0, weapon.fan].forEach(function (offset) {
        const angle = orb.aim + offset;

        ctx.globalAlpha = (ready ? (offset ? 0.34 : 0.5) : (offset ? 0.18 : 0.28)) * flicker;
        ctx.beginPath();
        ctx.moveTo(muzzleX, muzzleY);
        ctx.lineTo(orb.x + Math.cos(angle) * length, orb.y + Math.sin(angle) * length);
        ctx.stroke();
      });

      ctx.setLineDash([]);

      ctx.globalAlpha = 1;
      ctx.shadowColor = orb.color;
      ctx.shadowBlur = 20 + progress * 30;

      for (let ring = 0; ring < 3; ring += 1) {
        const phase = (progress * 2 + ring / 3) % 1;

        ctx.globalAlpha = 0.9 * (1 - phase);
        ctx.strokeStyle = ring % 2 ? orb.accent : orb.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(muzzleX, muzzleY, 10 + (1 - phase) * (30 + progress * 22), 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = orb.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(muzzleX, muzzleY, 8 + progress * 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    /* ---------- Proyektil ---------- */

    drawProjectiles(ctx, match) {
      match.projectiles.forEach((bullet) => {
        if (bullet.kind === 'bomb') {
          this.drawBomb(ctx, bullet, match);
        } else if (bullet.kind === 'bounce') {
          this.drawBouncer(ctx, bullet, match);
        } else if (bullet.kind === 'hole') {
          this.drawSingularity(ctx, bullet, match);
        } else {
          this.drawBullet(ctx, bullet);
        }
      });
    }

    drawBullet(ctx, bullet) {
      const color = bullet.owner.color;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = color;
      ctx.lineWidth = bullet.r * 1.6;
      ctx.beginPath();
      ctx.moveTo(bullet.x - bullet.vx * 0.045, bullet.y - bullet.vy * 0.045);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = bullet.owner.dark;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bullet.x - bullet.r * 0.25, bullet.y - bullet.r * 0.25, bullet.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* Bom: bola besar yang berdenyut, dengan lingkaran area ledakan di titik tujuan */
    drawBomb(ctx, bullet, match) {
      const color = bullet.owner.color;
      const pulse = 1 + Math.sin(match.elapsed * 22) * 0.12;
      const speed = Math.hypot(bullet.vx, bullet.vy);
      const targetX = bullet.x + (bullet.vx / speed) * Math.max(0, bullet.fuse);
      const targetY = bullet.y + (bullet.vy / speed) * Math.max(0, bullet.fuse);

      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(targetX, targetY, bullet.splash, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.globalAlpha = 1;
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#2d1a13';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.r * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = bullet.owner.accent;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.r * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* Peluru pantul: belah ketupat yang berputar, ekornya mengikuti arah gerak */
    drawBouncer(ctx, bullet, match) {
      const color = bullet.owner.color;
      const spin = match.elapsed * 9;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = color;
      ctx.lineWidth = bullet.r * 1.2;
      ctx.beginPath();
      ctx.moveTo(bullet.x - bullet.vx * 0.06, bullet.y - bullet.vy * 0.06);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(spin);
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = color;
      ctx.strokeStyle = bullet.owner.dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -bullet.r * 1.5);
      ctx.lineTo(bullet.r * 1.5, 0);
      ctx.lineTo(0, bullet.r * 1.5);
      ctx.lineTo(-bullet.r * 1.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.stroke();

      ctx.fillStyle = bullet.owner.accent;
      ctx.beginPath();
      ctx.arc(0, 0, bullet.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* Peluru singularitas: bola hitam berpusar dengan lingkaran tujuan lubang hitam */
    drawSingularity(ctx, bullet, match) {
      const owner = bullet.owner;
      const weapon = owner.weapon;
      const speed = Math.hypot(bullet.vx, bullet.vy) || 1;
      const targetX = bullet.x + (bullet.vx / speed) * Math.max(0, bullet.fuse);
      const targetY = bullet.y + (bullet.vy / speed) * Math.max(0, bullet.fuse);
      const spin = match.elapsed * 8;

      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = owner.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(targetX, targetY, weapon.pullRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.globalAlpha = 1;
      ctx.shadowColor = owner.accent;
      ctx.shadowBlur = 22;
      ctx.fillStyle = '#160a33';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.r * 1.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = owner.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.r * 1.5, spin, spin + 4);
      ctx.stroke();
      ctx.strokeStyle = owner.color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.r * 1.9, -spin, -spin + 3);
      ctx.stroke();
      ctx.restore();
    }

    /* ---------- Lubang hitam dan awan petir di arena ---------- */

    drawHoles(ctx, match) {
      match.holes.forEach((hole) => {
        const owner = hole.owner;
        const weapon = owner.weapon;
        const open = Math.min(1, hole.age / 0.3);
        const closing = Math.min(1, (hole.life - hole.age) / 0.35);
        const scale = open * Math.min(1, closing + 0.2);
        const time = match.elapsed;

        ctx.save();
        ctx.translate(hole.x, hole.y);

        // Jangkauan sedot
        ctx.globalAlpha = 0.5 * scale;
        ctx.strokeStyle = owner.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.lineDashOffset = -time * 40;
        ctx.beginPath();
        ctx.arc(0, 0, weapon.pullRadius * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        const halo = ctx.createRadialGradient(0, 0, weapon.coreRadius * 0.4, 0, 0, weapon.pullRadius * scale);

        halo.addColorStop(0, 'rgba(122, 69, 240, 0.55)');
        halo.addColorStop(1, 'rgba(122, 69, 240, 0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, 0, weapon.pullRadius * scale, 0, Math.PI * 2);
        ctx.fill();

        // Lengan pusaran yang berputar ke dalam
        ctx.lineCap = 'round';

        for (let arm = 0; arm < 4; arm += 1) {
          ctx.strokeStyle = arm % 2 ? owner.accent : owner.color;
          ctx.globalAlpha = 0.75 * scale;
          ctx.lineWidth = 4;
          ctx.beginPath();

          for (let step = 0; step <= 22; step += 1) {
            const t = step / 22;
            const radius = weapon.coreRadius * 1.9 * scale * (1 - t * 0.85);
            const angle = time * 3 + arm * (Math.PI / 2) + t * 4.2;

            if (step === 0) {
              ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            } else {
              ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            }
          }

          ctx.stroke();
        }

        // Inti hitam
        const core = ctx.createRadialGradient(0, 0, 0, 0, 0, weapon.coreRadius * 0.75 * scale);

        core.addColorStop(0, '#000000');
        core.addColorStop(0.7, '#14082e');
        core.addColorStop(1, 'rgba(20, 8, 46, 0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(0, 0, weapon.coreRadius * 0.75 * scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = owner.accent;
        ctx.lineWidth = 3;
        ctx.shadowColor = owner.accent;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(0, 0, weapon.coreRadius * 0.45 * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
    }

    drawStorms(ctx, match) {
      match.storms.forEach((storm) => {
        const owner = storm.owner;
        const weapon = owner.weapon;
        const progress = Math.min(1, storm.age / weapon.delay);
        const time = match.elapsed;
        const warn = 0.5 + 0.5 * Math.sin(time * (8 + progress * 22));
        const grow = Math.min(1, storm.age / 0.35);

        ctx.save();
        ctx.translate(storm.x, storm.y);

        // Lingkaran bahaya: makin mendekati sambaran makin menyala
        ctx.globalAlpha = 0.14 + progress * 0.16;
        ctx.fillStyle = storm.struck ? owner.accent : owner.color;
        ctx.beginPath();
        ctx.arc(0, 0, storm.r * grow, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = storm.struck ? 0.35 : 0.5 + warn * 0.45;
        ctx.strokeStyle = progress > 0.55 && !storm.struck ? '#ff3b4e' : owner.color;
        ctx.lineWidth = 3 + progress * 3;
        ctx.setLineDash([14, 10]);
        ctx.lineDashOffset = -time * 50;
        ctx.beginPath();
        ctx.arc(0, 0, storm.r * grow, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Awan badai melayang di tengah
        const bob = Math.sin(time * 2) * 4;
        const puffs = [[-70, 6, 42], [-26, -14, 54], [28, -10, 58], [72, 8, 40], [0, 14, 52]];

        ctx.globalAlpha = Math.min(1, storm.age / 0.3) * (storm.struck && storm.aftershocks >= weapon.afterCount ? 0.6 : 1);

        puffs.forEach(function (puff) {
          ctx.fillStyle = '#4a4f86';
          ctx.strokeStyle = '#1b2178';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(puff[0], puff[1] + bob, puff[2] * 0.6 * grow, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });

        puffs.forEach(function (puff) {
          ctx.fillStyle = '#7f86d6';
          ctx.beginPath();
          ctx.arc(puff[0] - 6, puff[1] + bob - 8, puff[2] * 0.36 * grow, 0, Math.PI * 2);
          ctx.fill();
        });

        // Kilat kecil di dalam awan, makin sering menjelang sambaran
        if (!storm.struck && Math.sin(time * 31) > 0.55 - progress * 0.9) {
          ctx.strokeStyle = owner.accent;
          ctx.lineWidth = 3;
          ctx.shadowColor = owner.accent;
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.moveTo(-30 + Math.sin(time * 13) * 30, bob);
          ctx.lineTo(-10, 14 + bob);
          ctx.lineTo(-24, 22 + bob);
          ctx.lineTo(4, 46 + bob);
          ctx.stroke();
        }

        ctx.restore();
      });
    }

    /* ---------- Bidikan pemain ---------- */

    drawAimGuide(ctx, match, view) {
      if (match.state !== 'running') {
        return;
      }

      const player = match.orbs[0];

      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = player.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 10]);
      ctx.beginPath();
      ctx.moveTo(
        player.x + Math.cos(player.aim) * (player.r + 14),
        player.y + Math.sin(player.aim) * (player.r + 14)
      );
      ctx.lineTo(
        player.x + Math.cos(player.aim) * 170,
        player.y + Math.sin(player.aim) * 170
      );
      ctx.stroke();
      ctx.restore();

      if (view.lock) {
        this.drawLockReticle(ctx, match.orbs[1], view.time);
      }
    }

    drawLockReticle(ctx, target, time) {
      if (target.hp <= 0) {
        return;
      }

      const spin = (time / 1000) * 1.4;

      ctx.save();
      ctx.strokeStyle = Config.colors.gold;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';

      for (let i = 0; i < 4; i++) {
        const start = spin + (i * Math.PI) / 2;

        ctx.beginPath();
        ctx.arc(target.x, target.y, target.r + 15, start, start + 0.55);
        ctx.stroke();
      }

      ctx.restore();
    }

    /* ---------- Orb ---------- */

    drawOrbs(ctx, match) {
      match.orbs.forEach((orb) => {
        if (orb.hp > 0) {
          this.drawOrb(ctx, orb, match);
        }
      });
    }

    drawOrb(ctx, orb, match) {
      const skill = orb.weapon;

      // Cincin pengisian laser
      if (orb.charging) {
        const laser = this.findLaser(orb, match);
        const progress = laser ? 1 - laser.t / skill.chargeTime : 0;

        ctx.save();
        ctx.strokeStyle = orb.color;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r + 22 - progress * 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Cincin tim di bawah planet: tosca untuk pemain, mawar untuk bot
      const team = orb.team || Config.colors.player;
      const isPlayer = team === Config.colors.player;

      ctx.save();
      ctx.strokeStyle = team.main;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.r + 7, 0, Math.PI * 2);
      ctx.stroke();

      // Bot: cincin luar putus-putus supaya beda bentuk dengan bola pemain
      if (!isPlayer) {
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 6]);
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r + 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      ns.Skins.draw(ctx, {
        x: orb.x,
        y: orb.y,
        r: orb.r,
        kind: skill.kind,
        time: match.elapsed,
        level: this.weaponLevel(orb)
      });

      if (orb.hitFlash > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, ' + (orb.hitFlash / 0.15) * 0.75 + ')';
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.fill();
      }

      this.drawMuzzle(ctx, orb);

      // Angka HP: putih dengan kontur gelap supaya terbaca di semua tekstur planet
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(20, 24, 56, 0.85)';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, orb.r * 0.16);
      ctx.font = '700 ' + Math.round(orb.r * (orb.hp >= 100 ? 0.62 : 0.8)) + 'px ' + DISPLAY_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(String(Math.ceil(orb.hp)), orb.x, orb.y + 1);
      ctx.fillText(String(Math.ceil(orb.hp)), orb.x, orb.y + 1);

      this.drawNameTag(ctx, orb, team, isPlayer);
    }

    /* Penanda di atas bola: "KAMU" (tosca) dan "BOT" (mawar) supaya tidak tertukar */
    drawNameTag(ctx, orb, team, isPlayer) {
      const text = orb.tag || (isPlayer ? 'KAMU' : 'BOT');
      const width = text.length * 8 + 16;
      const height = 18;
      const above = orb.y - orb.r - 38 > 2;
      const top = above ? orb.y - orb.r - 38 : orb.y + orb.r + 20;
      const pointY = above ? top + height : top;
      const pointTip = above ? top + height + 7 : top - 7;
      const left = Math.max(2, Math.min(this.width - width - 2, orb.x - width / 2));

      ctx.save();
      ctx.fillStyle = team.main;
      ctx.beginPath();
      ctx.roundRect(left, top, width, height, 9);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(orb.x - 6, pointY);
      ctx.lineTo(orb.x + 6, pointY);
      ctx.lineTo(orb.x, pointTip);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11px ' + DISPLAY_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, left + width / 2, top + height / 2 + 1);
      ctx.restore();
    }

    /* Seberapa siap senjata bola (0 sampai 1), dipakai skin untuk menyalakan hiasan */
    weaponLevel(orb) {
      const weapon = orb.weapon;

      if (orb.beam) {
        return Math.min(1, orb.beam.charge / weapon.maxCharge);
      }

      if (orb.charging) {
        return 1;
      }

      if (orb.burst) {
        return orb.burst.left / weapon.count;
      }

      return orb.cd <= 0 ? 1 : 1 - orb.cd / weapon.cooldown;
    }

    /* Moncong tiap bola dibuat beda supaya jenis senjatanya terlihat dari jauh */
    drawMuzzle(ctx, orb) {
      const kind = orb.weapon.kind;
      const reach = orb.r * 1.78;

      ctx.save();
      ctx.translate(orb.x + Math.cos(orb.aim) * reach, orb.y + Math.sin(orb.aim) * reach);
      ctx.rotate(orb.aim);
      ctx.fillStyle = orb.color;
      ctx.strokeStyle = orb.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();

      if (kind === 'laser') {
        ctx.moveTo(-14, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(4, -5);
        ctx.lineTo(4, 5);
        ctx.closePath();
        ctx.fill();
      } else if (kind === 'pistol') {
        ctx.moveTo(-8, 0);
        ctx.lineTo(10, 0);
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.fillStyle = orb.accent;
        ctx.beginPath();
        ctx.arc(11, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === 'burst') {
        for (let i = -1; i <= 1; i++) {
          ctx.moveTo(-6 + Math.abs(i) * 2, i * 6 - 3);
          ctx.lineTo(4, i * 6);
          ctx.lineTo(-6 + Math.abs(i) * 2, i * 6 + 3);
        }

        ctx.stroke();
      } else if (kind === 'bomb') {
        ctx.arc(3, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(3, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === 'blackhole') {
        ctx.fillStyle = '#160a33';
        ctx.arc(3, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = orb.accent;
        ctx.beginPath();
        ctx.arc(3, 0, 11, -2.4, 2.4);
        ctx.stroke();
      } else if (kind === 'beam') {
        ctx.moveTo(-10, -8);
        ctx.lineTo(12, -4);
        ctx.lineTo(12, 4);
        ctx.lineTo(-10, 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = orb.accent;
        ctx.beginPath();
        ctx.arc(12, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === 'thunder') {
        ctx.fillStyle = orb.accent;
        ctx.moveTo(10, -9);
        ctx.lineTo(-2, 1);
        ctx.lineTo(4, 2);
        ctx.lineTo(-8, 10);
        ctx.lineTo(0, -1);
        ctx.lineTo(-5, -2);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.moveTo(10, 0);
        ctx.lineTo(0, -8);
        ctx.lineTo(-8, 0);
        ctx.lineTo(0, 8);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    findLaser(orb, match) {
      if (!match) {
        return null;
      }

      return match.lasers.find((laser) => laser.owner === orb && laser.state === 'charge') || null;
    }

    /* ---------- Efek ---------- */

    drawEffects(ctx, match) {
      match.fx.forEach((fx) => {
        const alpha = Math.max(0, fx.life / fx.maxLife);

        ctx.save();
        ctx.globalAlpha = alpha;

        if (fx.type === 'spark') {
          ctx.fillStyle = fx.color;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, fx.size * (0.4 + alpha * 0.6), 0, Math.PI * 2);
          ctx.fill();
        } else if (fx.type === 'blast') {
          const reach = fx.r * (1.05 - alpha * 0.25);
          const glow = ctx.createRadialGradient(fx.x, fx.y, 0, fx.x, fx.y, reach);

          glow.addColorStop(0, '#ffffff');
          glow.addColorStop(0.45, fx.color);
          glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.globalAlpha = alpha * 0.8;
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, reach, 0, Math.PI * 2);
          ctx.fill();

          ctx.globalAlpha = alpha;
          ctx.strokeStyle = fx.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI * 2);
          ctx.stroke();
        } else if (fx.type === 'ring') {
          ctx.strokeStyle = fx.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, fx.r + (1 - alpha) * 46, 0, Math.PI * 2);
          ctx.stroke();
        } else if (fx.type === 'bolt') {
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.shadowColor = fx.color;
          ctx.shadowBlur = 24;
          ctx.strokeStyle = fx.color;
          ctx.lineWidth = 12 * alpha + 2;
          ctx.beginPath();
          fx.points.forEach(function (point, index) {
            if (index === 0) {
              ctx.moveTo(point.x, point.y);
            } else {
              ctx.lineTo(point.x, point.y);
            }
          });
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4 * alpha + 1;
          ctx.stroke();
        } else if (fx.type === 'flash') {
          ctx.fillStyle = fx.color;
          ctx.globalAlpha = alpha * 0.3;
          ctx.fillRect(-20, -20, this.width + 40, this.height + 40);
        } else if (fx.type === 'text') {
          ctx.fillStyle = fx.color;
          ctx.font = '700 20px ' + DISPLAY_FONT;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.strokeText(fx.text, fx.x, fx.y);
          ctx.fillText(fx.text, fx.x, fx.y);
        }

        ctx.restore();
      });
    }

    /* ---------- Hitung mundur dan K.O. ---------- */

    drawBanner(ctx, match) {
      const centerX = this.width / 2;
      const centerY = this.height / 2;
      let text = '';
      let alpha = 1;
      let scale = 1;
      let color = '#ffffff';

      if (match.state === 'countdown') {
        const number = Math.ceil(match.countdownLeft);
        const progress = number - match.countdownLeft;

        text = String(number);
        alpha = 1 - progress * 0.6;
        scale = 1.35 - progress * 0.35;
      } else if (match.state === 'running' && match.elapsed < 0.7) {
        text = 'MULAI!';
        alpha = 1 - match.elapsed / 0.7;
        color = Config.colors.gold;
      } else if (match.state === 'finishing' || match.state === 'finished') {
        text = match.result.reason === 'ko' ? 'K.O.' : 'WAKTU HABIS';
        color = Config.colors.gold;
      }

      if (!text) {
        return;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);
      ctx.fillStyle = color;
      ctx.font = '700 84px ' + DISPLAY_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(27, 33, 64, 0.9)';
      ctx.strokeText(text, 0, 0);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }

  ns.Renderer = Renderer;
})(window.OrbitArena = window.OrbitArena || {});
