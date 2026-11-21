(function (ns) {
  'use strict';

  const Config = ns.Config;

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  /*
   * BotController menghasilkan intent yang sama dengan pemain:
   * arah gerak, titik bidik, dan tembak. Bot memakai senjata dari
   * bola yang dipegangnya. Tingkat kesulitan diatur lewat
   * Config.difficulties.
   *
   * Cara menghindar sengaja dibuat tidak sempurna supaya tembakan
   * pemain masih bisa kena: bot butuh waktu bereaksi, tidak bisa
   * menghindar terus-menerus, dan hanya sekali per rentetan tembakan.
   */
  class BotController {
    constructor(difficultyKey) {
      this.config = Config.difficulties[difficultyKey] || Config.difficulties.normal;

      this.strafe = Math.random() < 0.5 ? 1 : -1;
      this.strafeTimer = randomBetween(0.8, 1.8);
      this.readyWait = randomBetween(0.4, 0.9);
      this.aimOffset = this.rollAimOffset();

      this.dodgeTimer = 0;
      this.dodgeX = 0;
      this.dodgeY = 0;
      this.dodgeCooldown = 0;
      this.pendingDodge = null;
      this.lastThreatTime = -10;

      // Bot hanya memutuskan menghindar satu kali untuk tiap ancaman
      this.seenProjectiles = new WeakSet();
      this.seenLasers = new WeakSet();
      this.seenHoles = new WeakSet();
      this.seenStorms = new WeakSet();
      this.seenBeams = new WeakSet();

      // Berapa lama bot menahan tombol saat memakai Sinar Penghancur
      this.beamHold = 1;
    }

    flush() {
      // Bot tidak punya antrian input
    }

    rollAimOffset() {
      return (Math.random() * 2 - 1) * this.config.aimError;
    }

    getIntent(match, self) {
      const cfg = this.config;
      const dt = match.dt;
      const foe = match.getOpponent(self);
      const dx = foe.x - self.x;
      const dy = foe.y - self.y;
      const distance = Math.hypot(dx, dy) || 1;
      const toX = dx / distance;
      const toY = dy / distance;

      this.updateTimers(dt);
      this.checkProjectiles(match, self);
      this.checkLasers(match, self);
      this.checkHoles(match, self);
      this.checkStorms(match, self);
      this.checkBeams(match, foe, self);
      this.runPendingDodge();

      // Gerak: jaga jarak lalu berputar mengitari lawan
      let moveX;
      let moveY;

      if (this.dodgeTimer > 0) {
        moveX = this.dodgeX;
        moveY = this.dodgeY;
      } else {
        const gap = distance - self.weapon.botRange;
        const radial = Math.max(-1, Math.min(1, gap / 150));

        moveX = toX * radial - toY * this.strafe * 0.9;
        moveY = toY * radial + toX * this.strafe * 0.9;
      }

      const wall = this.wallPush(match, self);

      moveX += wall.x;
      moveY += wall.y;

      const length = Math.hypot(moveX, moveY);

      if (length > 0) {
        const factor = (Math.min(1, length) * cfg.moveScale) / length;

        moveX *= factor;
        moveY *= factor;
      }

      // Bidik (dengan sedikit meleset) dan tembak saat senjata siap
      const aimPoint = match.leadPoint(self, foe, cfg.lead);
      const aimDistance = Math.hypot(aimPoint.x - self.x, aimPoint.y - self.y);
      const aimAngle = Math.atan2(aimPoint.y - self.y, aimPoint.x - self.x) + this.aimOffset;
      const busy = self.charging || Boolean(self.burst);
      let fire = false;

      if (self.beam) {
        // Sinar Penghancur: tahan tombol sampai cukup lama, lalu lepas
        fire = self.beam.charge < this.beamHold;
      } else if (self.cd <= 0 && !busy) {
        this.readyWait -= dt;

        if (this.readyWait <= 0) {
          fire = true;
          this.readyWait = cfg.fireDelay * randomBetween(0.7, 1.3);
          this.aimOffset = this.rollAimOffset();

          if (self.weapon.kind === 'beam') {
            this.beamHold = randomBetween(self.weapon.minCharge + 0.2, self.weapon.maxCharge);
          }
        }
      }

      return {
        moveX: moveX,
        moveY: moveY,
        aimX: self.x + Math.cos(aimAngle) * aimDistance,
        aimY: self.y + Math.sin(aimAngle) * aimDistance,
        fire: fire
      };
    }

    updateTimers(dt) {
      this.dodgeTimer -= dt;
      this.dodgeCooldown -= dt;
      this.strafeTimer -= dt;

      if (this.pendingDodge) {
        this.pendingDodge.delay -= dt;
      }

      if (this.strafeTimer <= 0) {
        if (Math.random() < 0.6) {
          this.strafe *= -1;
        }

        this.strafeTimer = randomBetween(0.8, 2);
      }
    }

    /* Jalankan rencana menghindar setelah waktu reaksi bot habis */
    runPendingDodge() {
      const pending = this.pendingDodge;

      if (!pending || pending.delay > 0) {
        return;
      }

      this.pendingDodge = null;

      if (this.dodgeCooldown <= 0) {
        this.dodgeX = pending.x;
        this.dodgeY = pending.y;
        this.dodgeTimer = pending.duration;
        this.dodgeCooldown = this.config.dodgeCooldown;
      }
    }

    planDodge(x, y, duration) {
      if (this.pendingDodge) {
        return;
      }

      this.pendingDodge = {
        x: x,
        y: y,
        duration: duration,
        delay: this.config.reaction * randomBetween(0.8, 1.2)
      };
    }

    /* Menghindar dari peluru yang diperkirakan mengenai bot */
    checkProjectiles(match, self) {
      for (const bullet of match.projectiles) {
        if (bullet.owner.side === self.side || this.seenProjectiles.has(bullet)) {
          continue;
        }

        this.seenProjectiles.add(bullet);

        // Satu kali menimbang untuk satu rentetan tembakan
        if (match.elapsed - this.lastThreatTime < 0.6) {
          continue;
        }

        const speed = Math.hypot(bullet.vx, bullet.vy);
        const relX = bullet.x - self.x;
        const relY = bullet.y - self.y;
        const time = -(relX * bullet.vx + relY * bullet.vy) / (speed * speed);

        if (time <= 0 || time > 0.9) {
          continue;
        }

        const closeX = relX + bullet.vx * time;
        const closeY = relY + bullet.vy * time;
        const danger = self.r + bullet.r + (bullet.kind === 'bomb' ? bullet.splash * 0.7 : 14);

        if (Math.hypot(closeX, closeY) > danger) {
          continue;
        }

        this.lastThreatTime = match.elapsed;

        if (Math.random() > this.config.dodge) {
          continue;
        }

        // Menghindar tegak lurus lintasan peluru, menjauhi titik terdekat
        const normalX = -bullet.vy / speed;
        const normalY = bullet.vx / speed;
        const side = closeX * normalX + closeY * normalY > 0 ? -1 : 1;

        this.planDodge(normalX * side, normalY * side, 0.4);
      }
    }

    /* Keluar dari garis laser yang sedang dicas lawan */
    checkLasers(match, self) {
      for (const laser of match.lasers) {
        if (laser.owner.side === self.side || laser.state !== 'charge' || this.seenLasers.has(laser)) {
          continue;
        }

        this.seenLasers.add(laser);

        if (Math.random() > Math.min(1, this.config.dodge + 0.15)) {
          continue;
        }

        const width = laser.owner.weapon.width;
        const dirX = Math.cos(laser.angle);
        const dirY = Math.sin(laser.angle);
        const relX = self.x - laser.owner.x;
        const relY = self.y - laser.owner.y;
        const along = relX * dirX + relY * dirY;
        const side = -relX * dirY + relY * dirX;

        if (along <= 0 || Math.abs(side) > self.r + width / 2 + 10) {
          continue;
        }

        const sign = side >= 0 ? 1 : -1;

        this.planDodge(-dirY * sign, dirX * sign, 0.7);
      }
    }

    /* Menjauh dari pusat (x, y) dengan arah tetap selama duration detik */
    fleeFrom(self, x, y, duration, chance) {
      if (Math.random() > chance) {
        return;
      }

      const dx = self.x - x;
      const dy = self.y - y;
      const length = Math.hypot(dx, dy) || 1;

      this.planDodge(dx / length, dy / length, duration);
    }

    /* Keluar dari jangkauan sedot lubang hitam lawan */
    checkHoles(match, self) {
      for (const hole of match.holes) {
        if (hole.owner.side === self.side || this.seenHoles.has(hole)) {
          continue;
        }

        this.seenHoles.add(hole);

        const weapon = hole.owner.weapon;

        if (Math.hypot(self.x - hole.x, self.y - hole.y) < weapon.pullRadius + 50) {
          this.fleeFrom(self, hole.x, hole.y, 1.4, Math.min(1, this.config.dodge + 0.4));
        }
      }
    }

    /* Keluar dari lingkaran awan petir sebelum sambaran pertama */
    checkStorms(match, self) {
      for (const storm of match.storms) {
        if (storm.owner.side === self.side || storm.struck || this.seenStorms.has(storm)) {
          continue;
        }

        this.seenStorms.add(storm);

        if (Math.hypot(self.x - storm.x, self.y - storm.y) < storm.r + 30) {
          this.fleeFrom(self, storm.x, storm.y, 1.1, Math.min(1, this.config.dodge + 0.4));
        }
      }
    }

    /* Menyingkir ke samping saat sinar lawan hampir penuh dan mengarah ke bot */
    checkBeams(match, foe, self) {
      const beam = foe.beam;

      if (!beam || this.seenBeams.has(beam) || beam.charge < foe.weapon.minCharge) {
        return;
      }

      this.seenBeams.add(beam);

      if (Math.random() > Math.min(1, this.config.dodge + 0.2)) {
        return;
      }

      // Tiga sinar: lurus dan miring kiri-kanan. Cari apakah salah satunya mengenai kita.
      const fan = foe.weapon.fan || 0;
      const relX = self.x - foe.x;
      const relY = self.y - foe.y;
      const reach = self.r + foe.weapon.maxWidth / 2 + 20;
      let inDanger = false;

      [-fan, 0, fan].forEach(function (offset) {
        const side = -relX * Math.sin(foe.aim + offset) + relY * Math.cos(foe.aim + offset);

        if (Math.abs(side) <= reach) {
          inDanger = true;
        }
      });

      if (!inDanger) {
        return;
      }

      // Geser mengitari penembak menuju celah aman terdekat (di antara sinar atau di luar kipas)
      const phi = Math.atan2(relY, relX);
      let delta = phi - foe.aim;

      delta = Math.atan2(Math.sin(delta), Math.cos(delta));

      const safe = [-fan * 2, -fan / 2, fan / 2, fan * 2];
      let target = safe[0];

      safe.forEach(function (angle) {
        if (Math.abs(angle - delta) < Math.abs(target - delta)) {
          target = angle;
        }
      });

      const sign = target >= delta ? 1 : -1;

      this.planDodge(-Math.sin(phi) * sign, Math.cos(phi) * sign, 0.6);
    }

    /* Dorongan halus menjauhi dinding arena */
    wallPush(match, self) {
      const margin = 70;
      const limitX = match.width - margin;
      const limitY = match.height - margin;
      let x = 0;
      let y = 0;

      if (self.x < margin) {
        x += (margin - self.x) / margin;
      } else if (self.x > limitX) {
        x -= (self.x - limitX) / margin;
      }

      if (self.y < margin) {
        y += (margin - self.y) / margin;
      } else if (self.y > limitY) {
        y -= (self.y - limitY) / margin;
      }

      return { x: x * 1.6, y: y * 1.6 };
    }
  }

  ns.BotController = BotController;
})(window.OrbitArena = window.OrbitArena || {});
