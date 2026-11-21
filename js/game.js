(function (ns) {
  'use strict';

  const Config = ns.Config;

  function formatTime(seconds) {
    const total = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(total / 60);
    const rest = total % 60;

    return minutes + ':' + String(rest).padStart(2, '0');
  }

  /* ==========================================================
     Match: logika satu pertandingan (tanpa DOM, tanpa gambar)
     ========================================================== */

  class Match {
    constructor(options) {
      this.width = Config.arena.width;
      this.height = Config.arena.height;
      this.difficulty = options.difficulty;
      this.controllers = options.controllers;
      this.listener = options.listener || null;
      this.onFinish = options.onFinish || null;

      const orbKeys = options.orbKeys || [Config.defaults.orb, Config.defaults.orb];

      this.orbs = [
        this.createOrb('p1', options.names[0], Config.colors.player, this.width * 0.15, this.height * 0.5, 0, orbKeys[0], options.playerSetup),
        this.createOrb('p2', options.names[1], Config.colors.enemy, this.width * 0.85, this.height * 0.5, Math.PI, orbKeys[1], options.enemySetup)
      ];

      // Pengawal (campaign tingkat 2): bola kecil di pihak lawan, boleh lebih dari satu
      (options.guards || []).forEach((guard, index, list) => {
        const spread = list.length > 1 ? (index / (list.length - 1) - 0.5) * 0.56 : 0;

        this.orbs.push(this.createOrb(
          'g' + (index + 1),
          guard.name || 'Pengawal',
          Config.colors.enemy,
          this.width * 0.72,
          this.height * (0.5 + spread),
          Math.PI,
          guard.key,
          { hp: guard.hp, radius: guard.radius, tag: 'PENGAWAL', speed: guard.speed, guard: true }
        ));
      });

      this.projectiles = [];
      this.lasers = [];
      this.holes = [];
      this.storms = [];
      this.fx = [];

      this.state = 'countdown';
      this.countdownLeft = Config.match.countdown;
      this.lastTick = null;
      this.elapsed = 0;
      this.timeLeft = Config.match.duration;
      this.endTimer = 0;
      this.shake = 0;
      this.dt = 0;
      this.result = null;
    }

    /* team = warna tim (cincin penanda). Warna bola mengikuti planetnya. */
    createOrb(id, name, team, x, y, aim, weaponKey, setup) {
      const weapon = Config.orbs[weaponKey] || Config.orbs[Config.defaults.orb];
      const extra = setup || {};
      const hp = extra.hp || weapon.hp || Config.orb.maxHp;

      return {
        id: id,
        name: name,
        weaponKey: Config.orbs[weaponKey] ? weaponKey : Config.defaults.orb,
        weapon: weapon,
        team: team,
        side: team === Config.colors.player ? 'player' : 'enemy',
        tag: extra.tag || null,
        guard: Boolean(extra.guard),
        color: weapon.palette.main,
        light: weapon.palette.light,
        dark: weapon.palette.dark,
        accent: weapon.palette.accent,
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        r: extra.radius || weapon.bodyRadius || Config.orb.radius,
        speed: extra.speed || Config.orb.speed,
        hp: hp,
        maxHp: hp,
        aim: aim,
        aimDistance: 200,
        cd: 0.8,
        charging: false,
        beam: null,
        burst: null,
        hitFlash: 0,
        stats: { shots: 0, hits: 0, damage: 0 }
      };
    }

    /* Semua lawan yang masih hidup (pihak lain). Duel biasa: satu orang. */
    foesOf(orb) {
      return this.orbs.filter(function (other) {
        return other.side !== orb.side && other.hp > 0;
      });
    }

    /* Lawan terdekat yang masih hidup; kalau semua kalah, lawan utama */
    getOpponent(orb) {
      const foes = this.foesOf(orb);

      if (!foes.length) {
        return orb.side === 'player' ? this.orbs[1] : this.orbs[0];
      }

      return foes.reduce(function (best, other) {
        return Math.hypot(other.x - orb.x, other.y - orb.y) < Math.hypot(best.x - orb.x, best.y - orb.y) ? other : best;
      });
    }

    emit(name, data) {
      if (this.listener) {
        this.listener(name, data);
      }
    }

    /* ---------- Loop utama ---------- */

    update(dt) {
      if (this.state === 'finished') {
        return;
      }

      this.dt = dt;
      this.shake = Math.max(0, this.shake - dt * 40);
      this.updateEffects(dt);

      this.orbs.forEach(function (orb) {
        orb.hitFlash = Math.max(0, orb.hitFlash - dt);
      });

      if (this.state === 'countdown') {
        this.updateCountdown(dt);
      } else if (this.state === 'running') {
        this.updateRunning(dt);
      } else if (this.state === 'finishing') {
        this.endTimer -= dt;

        if (this.endTimer <= 0) {
          this.state = 'finished';

          if (this.onFinish) {
            this.onFinish(this.result);
          }
        }
      }
    }

    updateCountdown(dt) {
      const number = Math.ceil(this.countdownLeft);

      if (number !== this.lastTick) {
        this.lastTick = number;
        this.emit('tick', number);
      }

      this.controllers.forEach(function (controller) {
        if (controller.flush) {
          controller.flush();
        }
      });

      this.countdownLeft -= dt;

      if (this.countdownLeft <= 0) {
        this.state = 'running';
        this.emit('start');
      }
    }

    updateRunning(dt) {
      this.elapsed += dt;
      this.timeLeft = Math.max(0, Config.match.duration - this.elapsed);

      this.orbs.forEach((orb, index) => {
        if (orb.hp <= 0) {
          return;
        }

        const intent = this.controllers[index].getIntent(this, orb);

        this.applyIntent(orb, intent, dt);
      });

      this.separateOrbs();
      this.updateLasers(dt);
      this.updateHoles(dt);
      this.updateStorms(dt);
      this.updateProjectiles(dt);
      this.checkEnd();
    }

    /* ---------- Gerak, bidik, serang ---------- */

    applyIntent(orb, intent, dt) {
      let moveX = intent.moveX;
      let moveY = intent.moveY;
      const length = Math.hypot(moveX, moveY);

      if (length > 1) {
        moveX /= length;
        moveY /= length;
      }

      const slow = orb.charging ? (orb.weapon.chargeSlow || 1) : 1;
      const blend = Math.min(1, Config.orb.acceleration * dt);

      orb.vx += (moveX * orb.speed * slow - orb.vx) * blend;
      orb.vy += (moveY * orb.speed * slow - orb.vy) * blend;
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      this.keepInside(orb);

      orb.aim = Math.atan2(intent.aimY - orb.y, intent.aimX - orb.x);
      orb.aimDistance = Math.hypot(intent.aimX - orb.x, intent.aimY - orb.y);
      orb.cd = Math.max(0, orb.cd - dt);

      this.updateBurst(orb, dt);
      this.updateBeam(orb, intent, dt);

      if (intent.fire && orb.cd <= 0 && !orb.charging && !orb.burst) {
        this.useWeapon(orb);
      }
    }

    /* ---------- Senjata: satu bola, satu jenis tembakan ---------- */

    useWeapon(orb) {
      const weapon = orb.weapon;

      orb.cd = weapon.cooldown;

      if (weapon.kind === 'laser') {
        this.startLaser(orb);
      } else if (weapon.kind === 'burst') {
        orb.burst = { left: weapon.count, timer: 0 };
      } else if (weapon.kind === 'bomb') {
        this.fireBomb(orb);
      } else if (weapon.kind === 'blackhole') {
        this.fireBlackhole(orb);
      } else if (weapon.kind === 'beam') {
        this.startBeam(orb);
      } else if (weapon.kind === 'thunder') {
        this.castStorm(orb);
      } else if (weapon.kind === 'pistol') {
        this.fireBullet(orb, 'bullet');
      } else {
        this.fireBounce(orb);
      }
    }

    /* Waktu yang dibutuhkan tembakan sampai ke jarak tertentu (untuk prediksi bidikan) */
    flightTime(orb, distance) {
      const weapon = orb.weapon;

      if (weapon.kind === 'laser') {
        return weapon.chargeTime;
      }

      if (weapon.kind === 'beam') {
        return weapon.minCharge;
      }

      if (weapon.kind === 'thunder') {
        return weapon.delay;
      }

      return distance / weapon.speed;
    }

    /* Titik bidik yang sudah memperhitungkan gerak lawan. lead 0 sampai 1 */
    leadPoint(orb, foe, lead) {
      const time = this.flightTime(orb, Math.hypot(foe.x - orb.x, foe.y - orb.y));

      return {
        x: Math.min(this.width, Math.max(0, foe.x + foe.vx * time * lead)),
        y: Math.min(this.height, Math.max(0, foe.y + foe.vy * time * lead))
      };
    }

    updateBurst(orb, dt) {
      const burst = orb.burst;

      if (!burst) {
        return;
      }

      burst.timer -= dt;

      while (burst.timer <= 0 && burst.left > 0) {
        this.fireBullet(orb, 'bullet');
        burst.left -= 1;
        burst.timer += orb.weapon.interval;
      }

      if (burst.left <= 0) {
        orb.burst = null;
      }
    }

    keepInside(orb) {
      const min = orb.r;
      const maxX = this.width - orb.r;
      const maxY = this.height - orb.r;

      if (orb.x < min) {
        orb.x = min;
        orb.vx = 0;
      } else if (orb.x > maxX) {
        orb.x = maxX;
        orb.vx = 0;
      }

      if (orb.y < min) {
        orb.y = min;
        orb.vy = 0;
      } else if (orb.y > maxY) {
        orb.y = maxY;
        orb.vy = 0;
      }
    }

    /* Bola yang bertumpuk saling dorong; berlaku untuk semua pasangan yang masih hidup */
    separateOrbs() {
      const live = this.orbs.filter(function (orb) {
        return orb.hp > 0;
      });

      for (let i = 0; i < live.length; i += 1) {
        for (let j = i + 1; j < live.length; j += 1) {
          this.pushApart(live[i], live[j]);
        }
      }
    }

    pushApart(a, b) {
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distance = Math.hypot(dx, dy);
      const minimum = a.r + b.r;

      if (distance >= minimum) {
        return;
      }

      if (distance === 0) {
        dx = 1;
        dy = 0;
        distance = 1;
      }

      const push = (minimum - distance) / 2;
      const nx = dx / distance;
      const ny = dy / distance;

      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      this.keepInside(a);
      this.keepInside(b);
    }

    /* ---------- Peluru: beruntun, bom, dan pantul ---------- */

    /* kind: 'bullet' (lurus), 'bomb' (meledak), atau 'bounce' (memantul) */
    spawnProjectile(orb, kind, angle, weapon) {
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);

      orb.stats.shots += 1;
      orb.vx -= dirX * weapon.recoil;
      orb.vy -= dirY * weapon.recoil;

      const bullet = {
        kind: kind,
        owner: orb,
        x: orb.x + dirX * (orb.r + 4),
        y: orb.y + dirY * (orb.r + 4),
        vx: dirX * weapon.speed,
        vy: dirY * weapon.speed,
        r: weapon.radius,
        damage: weapon.damage,
        // Peluru pantul tidak punya batas waktu: habis hanya setelah pantulan terakhir
        life: kind === 'bounce' ? Infinity : (weapon.life || 2),
        bounces: weapon.bounces || 0,
        splash: weapon.splash || 0,
        fuse: 0
      };

      this.projectiles.push(bullet);
      this.emit('shoot', orb);

      return bullet;
    }

    fireBullet(orb, kind) {
      const weapon = orb.weapon;
      const spread = (Math.random() * 2 - 1) * (weapon.spread || 0);

      this.spawnProjectile(orb, kind, orb.aim + spread, weapon);
    }

    fireBomb(orb) {
      const weapon = orb.weapon;
      const bullet = this.spawnProjectile(orb, 'bomb', orb.aim, weapon);

      // Bom meledak di titik bidik, tidak lebih dekat atau lebih jauh dari batas
      bullet.fuse = Math.min(weapon.maxRange, Math.max(weapon.minRange, orb.aimDistance));
    }

    fireBounce(orb) {
      this.spawnProjectile(orb, 'bounce', orb.aim, orb.weapon);
    }

    updateProjectiles(dt) {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const bullet = this.projectiles[i];
        const foes = this.foesOf(bullet.owner);
        let remove = false;

        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        bullet.life -= dt;

        if (bullet.kind === 'bomb' || bullet.kind === 'hole') {
          bullet.fuse -= Math.hypot(bullet.vx, bullet.vy) * dt;
        }

        const foe = foes.find(function (other) {
          return Math.hypot(bullet.x - other.x, bullet.y - other.y) <= other.r + bullet.r;
        });
        const touching = Boolean(foe);

        if (bullet.kind === 'bounce') {
          this.bounceOffWalls(bullet);
        }

        if (bullet.kind === 'hole' && (touching || bullet.fuse <= 0 || this.isOutside(bullet))) {
          this.openHole(bullet);
          remove = true;
        } else if (bullet.kind === 'bomb' && (touching || bullet.fuse <= 0 || this.isOutside(bullet))) {
          this.explode(bullet);
          remove = true;
        } else if (bullet.kind !== 'bomb' && bullet.kind !== 'hole' && touching) {
          bullet.owner.stats.hits += 1;
          this.damage(foe, bullet.damage, bullet.owner, bullet.x, bullet.y);
          remove = true;
        } else if (bullet.kind === 'bullet' && this.isOutside(bullet)) {
          this.spawnSparks(
            Math.min(this.width, Math.max(0, bullet.x)),
            Math.min(this.height, Math.max(0, bullet.y)),
            bullet.owner.color,
            5,
            120
          );
          remove = true;
        } else if (bullet.life <= 0 || bullet.bounces < 0) {
          remove = true;
        }

        if (remove) {
          this.projectiles.splice(i, 1);
        }
      }
    }

    /* Peluru pantul: memantul di dinding, habis setelah pantulan terakhir */
    bounceOffWalls(bullet) {
      const width = this.width;
      const height = this.height;
      let bounced = false;

      if (bullet.x < 0 || bullet.x > width) {
        bullet.x = bullet.x < 0 ? -bullet.x : 2 * width - bullet.x;
        bullet.vx = -bullet.vx;
        bounced = true;
      }

      if (bullet.y < 0 || bullet.y > height) {
        bullet.y = bullet.y < 0 ? -bullet.y : 2 * height - bullet.y;
        bullet.vy = -bullet.vy;
        bounced = true;
      }

      if (bounced) {
        bullet.bounces -= 1;
        this.spawnSparks(bullet.x, bullet.y, bullet.owner.color, 6, 140);
        this.emit('bounce', bullet.owner);
      }
    }

    /* Ledakan bom: damage penuh di inti, makin ke tepi makin kecil */
    explode(bullet) {
      const owner = bullet.owner;
      const x = Math.min(this.width, Math.max(0, bullet.x));
      const y = Math.min(this.height, Math.max(0, bullet.y));

      this.spawnBlast(x, y, owner.color, bullet.splash);
      this.spawnSparks(x, y, owner.color, 18, 300);
      this.shake = Math.min(12, this.shake + 4);
      this.emit('explode', owner);

      this.foesOf(owner).forEach((foe) => {
        const reach = Math.hypot(foe.x - x, foe.y - y) - foe.r;

        if (reach <= bullet.splash) {
          const core = bullet.splash * 0.35;
          const falloff = reach <= core ? 1 : 1 - 0.5 * ((reach - core) / (bullet.splash - core));

          owner.stats.hits += 1;
          this.damage(foe, Math.round(bullet.damage * falloff), owner, x, y);
        }
      });
    }

    isOutside(bullet) {
      return bullet.x < 0 || bullet.y < 0 || bullet.x > this.width || bullet.y > this.height;
    }

    /* ---------- Senjata Laser ---------- */

    startLaser(orb) {
      orb.charging = true;
      orb.stats.shots += 1;

      this.lasers.push({
        owner: orb,
        angle: orb.aim,
        state: 'charge',
        t: orb.weapon.chargeTime
      });

      this.emit('laserCharge', orb);
    }

    updateLasers(dt) {
      for (let i = this.lasers.length - 1; i >= 0; i--) {
        const laser = this.lasers[i];

        laser.t -= dt;

        if (laser.state === 'charge' && laser.t <= 0) {
          laser.state = 'fire';
          laser.t = laser.owner.weapon.fireTime;
          laser.owner.charging = false;
          this.shake = Math.min(12, this.shake + 5);
          this.resolveLaser(laser);
          this.emit('laserFire', laser.owner);
        } else if (laser.state === 'fire' && laser.t <= 0) {
          this.lasers.splice(i, 1);
        }
      }
    }

    resolveLaser(laser) {
      const owner = laser.owner;
      const weapon = owner.weapon;

      if (laser.volley && laser.volley.hit) {
        return;
      }

      const dirX = Math.cos(laser.angle);
      const dirY = Math.sin(laser.angle);
      const width = laser.width || weapon.width;

      // Sinar mengenai satu sasaran saja per tembakan: yang paling dekat di jalurnya
      const hit = this.foesOf(owner)
        .map(function (foe) {
          const relX = foe.x - owner.x;
          const relY = foe.y - owner.y;

          return {
            foe: foe,
            along: relX * dirX + relY * dirY,
            side: Math.abs(-relX * dirY + relY * dirX)
          };
        })
        .filter(function (entry) {
          return entry.along > 0 && entry.side <= entry.foe.r + width / 2;
        })
        .sort(function (a, b) {
          return a.along - b.along;
        })[0];

      if (!hit) {
        return;
      }

      const foe = hit.foe;

      if (laser.volley) {
        laser.volley.hit = true;
      }

      owner.stats.hits += 1;
      this.damage(foe, laser.damage || weapon.damage, owner, foe.x, foe.y);

      if (weapon.knockback) {
        const push = weapon.knockback * (0.5 + 0.5 * (laser.power || 0));

        foe.vx += dirX * push;
        foe.vy += dirY * push;
      }
    }

    /* ---------- Sinar Penghancur: tahan untuk mengisi, lepas untuk menembak ---------- */

    startBeam(orb) {
      orb.charging = true;
      orb.beam = { charge: 0 };
      orb.cd = 0;

      this.emit('laserCharge', orb);
    }

    updateBeam(orb, intent, dt) {
      const beam = orb.beam;

      if (!beam) {
        return;
      }

      const weapon = orb.weapon;

      beam.charge += dt;

      if (beam.charge >= weapon.maxCharge || (!intent.fire && beam.charge >= weapon.minCharge)) {
        this.releaseBeam(orb);
      } else if (!intent.fire) {
        // Dilepas terlalu cepat: batal tanpa menembak
        orb.beam = null;
        orb.charging = false;
        orb.cd = 0.35;
      }
    }

    releaseBeam(orb) {
      const weapon = orb.weapon;
      const power = Math.max(0, Math.min(1, (orb.beam.charge - weapon.minCharge) / (weapon.maxCharge - weapon.minCharge)));
      const damage = Math.round(weapon.minDamage + (weapon.maxDamage - weapon.minDamage) * power);
      const width = weapon.minWidth + (weapon.maxWidth - weapon.minWidth) * power;

      // Tiga sinar sekaligus: lurus, dan miring ke kiri dan kanan. Satu tembakan hanya melukai sekali.
      const volley = { hit: false };
      const fired = [-weapon.fan, 0, weapon.fan].map(function (offset) {
        return {
          owner: orb,
          angle: orb.aim + offset,
          state: 'fire',
          t: weapon.fireTime,
          power: power,
          width: width,
          damage: damage,
          beam: true,
          volley: volley
        };
      });

      orb.beam = null;
      orb.charging = false;
      orb.cd = weapon.cooldown;
      orb.stats.shots += 1;
      orb.vx -= Math.cos(orb.aim) * 220 * (0.4 + power);
      orb.vy -= Math.sin(orb.aim) * 220 * (0.4 + power);

      fired.forEach((laser) => {
        this.lasers.push(laser);
        this.resolveLaser(laser);
      });

      this.shake = Math.min(14, this.shake + 6 + power * 6);
      this.emit('laserFire', orb);
    }

    /* ---------- Lubang Hitam ---------- */

    fireBlackhole(orb) {
      const weapon = orb.weapon;
      const shot = Object.assign({}, weapon, { radius: weapon.shotRadius, damage: 0 });
      const bullet = this.spawnProjectile(orb, 'hole', orb.aim, shot);

      bullet.fuse = Math.min(weapon.maxRange, Math.max(weapon.minRange, orb.aimDistance));
    }

    /* Peluru singularitas sampai: lubang hitam terbuka di titik itu */
    openHole(bullet) {
      const owner = bullet.owner;
      const weapon = owner.weapon;
      const x = Math.min(this.width, Math.max(0, bullet.x));
      const y = Math.min(this.height, Math.max(0, bullet.y));

      this.holes.push({
        owner: owner,
        x: x,
        y: y,
        age: 0,
        life: weapon.life,
        tickTimer: 0
      });

      this.spawnRing(x, y, owner.color, 30);
      this.shake = Math.min(14, this.shake + 3);
      this.emit('holeOpen', owner);
    }

    updateHoles(dt) {
      for (let i = this.holes.length - 1; i >= 0; i--) {
        const hole = this.holes[i];
        const owner = hole.owner;
        const weapon = owner.weapon;

        hole.age += dt;
        hole.tickTimer = Math.max(0, hole.tickTimer - dt);

        let ticked = false;

        this.foesOf(owner).forEach((foe) => {
          const dx = hole.x - foe.x;
          const dy = hole.y - foe.y;
          const distance = Math.hypot(dx, dy) || 1;

          // Lawan tersedot ke pusat, makin dekat makin kuat
          if (distance < weapon.pullRadius) {
            const strength = 1 - distance / weapon.pullRadius;
            const step = weapon.pullSpeed * (0.25 + 0.75 * strength) * dt;

            foe.x += (dx / distance) * Math.min(step, distance);
            foe.y += (dy / distance) * Math.min(step, distance);
            this.keepInside(foe);
          }

          // Inti menggerus HP
          if (distance < weapon.coreRadius + foe.r && hole.tickTimer <= 0) {
            ticked = true;
            owner.stats.hits += 1;
            this.damage(foe, Math.round(weapon.tick * 0.25), owner, foe.x, foe.y);
          }
        });

        if (ticked) {
          hole.tickTimer = 0.25;
        }

        this.pullBullets(hole, weapon, dt);

        if (hole.age >= hole.life) {
          this.collapseHole(hole);
          this.holes.splice(i, 1);
        }
      }
    }

    /* Peluru lawan membelok masuk dan lenyap di inti lubang hitam */
    pullBullets(hole, weapon, dt) {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const bullet = this.projectiles[i];

        if (bullet.owner.side === hole.owner.side || bullet.kind === 'hole') {
          continue;
        }

        const dx = hole.x - bullet.x;
        const dy = hole.y - bullet.y;
        const distance = Math.hypot(dx, dy) || 1;

        if (distance > weapon.pullRadius) {
          continue;
        }

        if (distance < weapon.coreRadius * 0.45) {
          this.spawnSparks(bullet.x, bullet.y, hole.owner.accent, 6, 140);
          this.projectiles.splice(i, 1);
          continue;
        }

        const strength = 1 - distance / weapon.pullRadius;

        bullet.vx += (dx / distance) * 1800 * strength * dt;
        bullet.vy += (dy / distance) * 1800 * strength * dt;

        // Bom yang tersedot tidak lagi meledak di titik semula
        if (bullet.kind === 'bomb') {
          bullet.fuse = Math.max(bullet.fuse, 40);
        }
      }
    }

    /* Lubang hitam runtuh: ledakan besar yang mendorong lawan menjauh */
    collapseHole(hole) {
      const owner = hole.owner;
      const weapon = owner.weapon;

      this.spawnBlast(hole.x, hole.y, owner.accent, weapon.collapseRadius);
      this.spawnSparks(hole.x, hole.y, owner.color, 26, 380);
      this.spawnRing(hole.x, hole.y, owner.accent, weapon.collapseRadius * 0.6);
      this.shake = 14;
      this.emit('holeCollapse', owner);

      this.foesOf(owner).forEach((foe) => {
        const reach = Math.hypot(foe.x - hole.x, foe.y - hole.y) - foe.r;

        if (reach <= weapon.collapseRadius) {
          const falloff = 1 - 0.5 * Math.max(0, reach / weapon.collapseRadius);
          const dx = foe.x - hole.x;
          const dy = foe.y - hole.y;
          const length = Math.hypot(dx, dy) || 1;

          owner.stats.hits += 1;
          this.damage(foe, Math.round(weapon.damage * falloff), owner, foe.x, foe.y);
          foe.vx += (dx / length) * 520;
          foe.vy += (dy / length) * 520;
        }
      });
    }

    /* ---------- Awan Petir ---------- */

    castStorm(orb) {
      const weapon = orb.weapon;
      const distance = Math.min(weapon.castRange, orb.aimDistance);
      const x = Math.min(this.width, Math.max(0, orb.x + Math.cos(orb.aim) * distance));
      const y = Math.min(this.height, Math.max(0, orb.y + Math.sin(orb.aim) * distance));

      orb.vx -= Math.cos(orb.aim) * weapon.recoil;
      orb.vy -= Math.sin(orb.aim) * weapon.recoil;
      orb.stats.shots += 1;

      this.storms.push({
        owner: orb,
        x: x,
        y: y,
        r: weapon.cloudRadius,
        age: 0,
        struck: false,
        aftershocks: 0,
        afterTimer: 0
      });

      this.emit('stormCast', orb);
    }

    updateStorms(dt) {
      for (let i = this.storms.length - 1; i >= 0; i--) {
        const storm = this.storms[i];
        const weapon = storm.owner.weapon;

        storm.age += dt;

        if (!storm.struck && storm.age >= weapon.delay) {
          storm.struck = true;
          storm.afterTimer = weapon.afterGap;
          this.strikeStorm(storm, weapon.damage, weapon.minDamage, 1, 9);
          this.shake = 14;
        } else if (storm.struck && storm.aftershocks < weapon.afterCount) {
          storm.afterTimer -= dt;

          if (storm.afterTimer <= 0) {
            storm.afterTimer = weapon.afterGap;
            storm.aftershocks += 1;
            this.strikeStorm(storm, weapon.afterDamage, weapon.afterDamage, 0.75, 4);
            this.shake = Math.min(14, this.shake + 5);
          }
        } else if (storm.struck && storm.aftershocks >= weapon.afterCount && storm.afterTimer <= -0.4) {
          this.storms.splice(i, 1);
        } else if (storm.struck) {
          storm.afterTimer -= dt;
        }
      }
    }

    /* Petir menyambar di dalam awan: damage penuh di tengah, lebih kecil di tepi */
    strikeStorm(storm, damage, edgeDamage, reachFactor, bolts) {
      const owner = storm.owner;
      const radius = storm.r * reachFactor;

      for (let i = 0; i < bolts; i++) {
        const angle = Math.random() * Math.PI * 2;
        const reach = Math.sqrt(Math.random()) * radius;

        this.spawnBolt(storm.x + Math.cos(angle) * reach, storm.y + Math.sin(angle) * reach, owner.accent);
      }

      this.fx.push({
        type: 'flash',
        life: 0.25,
        maxLife: 0.25,
        color: owner.accent
      });

      this.emit('thunder', owner);

      this.foesOf(owner).forEach((foe) => {
        const distance = Math.hypot(foe.x - storm.x, foe.y - storm.y);

        if (distance - foe.r * 0.5 <= radius) {
          const edge = Math.min(1, Math.max(0, distance / radius));
          const amount = Math.round(damage + (edgeDamage - damage) * edge);

          this.spawnBolt(foe.x, foe.y, owner.accent);
          owner.stats.hits += 1;
          this.damage(foe, amount, owner, foe.x, foe.y);
        }
      });
    }

    /* Satu sambaran: garis patah dari atas arena sampai titik kena */
    spawnBolt(x, y, color) {
      const points = [];
      const top = -60;
      const steps = 9;

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const jitter = i === 0 || i === steps ? 0 : (Math.random() - 0.5) * 70 * (1 - t * 0.4);

        points.push({ x: x + jitter + (1 - t) * (Math.random() - 0.5) * 80, y: top + (y - top) * t });
      }

      points[steps] = { x: x, y: y };

      this.fx.push({
        type: 'bolt',
        points: points,
        life: 0.35,
        maxLife: 0.35,
        color: color
      });

      this.spawnSparks(x, y, color, 8, 260);
    }

    /* ---------- Damage dan akhir pertandingan ---------- */

    damage(target, amount, source, x, y) {
      target.hp = Math.max(0, target.hp - amount);
      target.hitFlash = 0.15;
      source.stats.damage += amount;

      this.spawnSparks(x, y, target.color, 9, 220);
      this.spawnText(target.x, target.y - target.r - 10, '-' + amount, source.color);
      this.shake = Math.min(12, this.shake + 3);
      this.emit('hit', target);

      if (target.hp <= 0) {
        this.spawnSparks(target.x, target.y, target.color, 40, 360);
        this.spawnRing(target.x, target.y, target.color, target.r);
        this.shake = 12;
      }
    }

    checkEnd() {
      const player = this.orbs[0];
      const enemy = this.orbs[1];

      if (player.hp <= 0 || enemy.hp <= 0) {
        if (player.hp <= 0 && enemy.hp <= 0) {
          this.finish('draw', 'ko');
        } else {
          this.finish(enemy.hp <= 0 ? 'win' : 'loss', 'ko');
        }

        return;
      }

      if (this.timeLeft <= 0) {
        // Waktu habis: yang dibandingkan HP pemain dan lawan utama (bos)
        if (Math.abs(player.hp - enemy.hp) < 0.5) {
          this.finish('draw', 'time');
        } else {
          this.finish(player.hp > enemy.hp ? 'win' : 'loss', 'time');
        }
      }
    }

    finish(outcome, reason) {
      const player = this.orbs[0];
      const enemy = this.orbs[1];
      const shots = player.stats.shots;

      this.state = 'finishing';
      this.endTimer = Config.match.endDelay;
      this.lasers = [];
      this.holes = [];
      this.storms = [];
      this.orbs.forEach(function (orb) {
        orb.charging = false;
        orb.beam = null;
        orb.burst = null;
      });

      this.result = {
        outcome: outcome,
        reason: reason,
        difficulty: this.difficulty,
        orb: player.weaponKey,
        enemyOrb: enemy.weaponKey,
        duration: Math.round(this.elapsed * 10) / 10,
        playerHp: Math.ceil(player.hp),
        playerMaxHp: player.maxHp,
        enemyHp: Math.ceil(enemy.hp),
        enemyMaxHp: enemy.maxHp,
        damageDealt: Math.round(player.stats.damage),
        accuracy: shots ? Math.round((player.stats.hits / shots) * 100) : 0
      };

      this.emit('end', this.result);
    }

    /* ---------- Efek visual ---------- */

    spawnSparks(x, y, color, count, speed) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = speed * (0.4 + Math.random() * 0.8);
        const life = 0.35 + Math.random() * 0.25;

        this.fx.push({
          type: 'spark',
          x: x,
          y: y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          life: life,
          maxLife: life,
          color: color,
          size: 2 + Math.random() * 2.5
        });
      }
    }

    spawnText(x, y, text, color) {
      this.fx.push({
        type: 'text',
        x: x,
        y: y,
        vy: -60,
        life: 0.8,
        maxLife: 0.8,
        text: text,
        color: color
      });
    }

    spawnRing(x, y, color, radius) {
      this.fx.push({
        type: 'ring',
        x: x,
        y: y,
        r: radius,
        life: 0.5,
        maxLife: 0.5,
        color: color
      });
    }

    /* Ledakan area: lingkaran terang yang memudar */
    spawnBlast(x, y, color, radius) {
      this.fx.push({
        type: 'blast',
        x: x,
        y: y,
        r: radius,
        life: 0.45,
        maxLife: 0.45,
        color: color
      });
    }

    updateEffects(dt) {
      for (let i = this.fx.length - 1; i >= 0; i--) {
        const fx = this.fx[i];

        fx.life -= dt;

        if (fx.life <= 0) {
          this.fx.splice(i, 1);
          continue;
        }

        if (fx.type === 'spark') {
          const drag = Math.pow(0.002, dt);

          fx.x += fx.vx * dt;
          fx.y += fx.vy * dt;
          fx.vx *= drag;
          fx.vy *= drag;
        } else if (fx.type === 'text') {
          fx.y += fx.vy * dt;
        }
      }
    }
  }

  function randomOrbKey() {
    const keys = Config.orbOrder;

    return keys[Math.floor(Math.random() * keys.length)];
  }

  /* ==========================================================
     GameScreen: menjalankan Match di layar (loop, HUD, input)
     ========================================================== */

  const GameScreen = {
    ready: false,
    active: false,
    paused: false,
    match: null,
    controller: null,
    options: null,
    frameId: 0,
    lastTime: 0,
    lastTimerText: '',

    init() {
      if (this.ready) {
        return;
      }

      const byId = (id) => document.getElementById(id);

      this.screen = byId('game-screen');
      this.canvas = byId('game-canvas');
      this.pauseOverlay = byId('pause-overlay');
      this.touchControls = byId('touch-controls');
      this.footer = byId('game-footer');
      this.timer = byId('hud-timer');
      this.playerName = byId('hud-player-name');
      this.playerFill = byId('hud-player-fill');
      this.playerHp = byId('hud-player-hp');
      this.enemyName = byId('hud-enemy-name');
      this.enemyFill = byId('hud-enemy-fill');
      this.enemyHp = byId('hud-enemy-hp');
      this.playerOrbLabel = byId('hud-player-orb');

      this.renderer = new ns.Renderer(this.canvas);
      this.loop = this.loop.bind(this);

      byId('btn-pause').addEventListener('click', () => this.togglePause());
      byId('btn-resume').addEventListener('click', () => this.resume());
      byId('btn-quit').addEventListener('click', () => this.quit());

      this.keyHandler = (event) => {
        if (event.code === 'Escape' || event.code === 'KeyP') {
          event.preventDefault();
          this.togglePause();
        }
      };

      ns.Input.bindTouchControls({
        root: this.touchControls,
        joystick: byId('joystick'),
        getController: () => this.controller
      });

      window.addEventListener('resize', () => this.handleResize());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.active) {
          this.pause();
        }
      });

      this.ready = true;
    },

    /* ---------- Mulai dan berhenti ---------- */

    start(options) {
      this.stop();

      const touch = options.settings.control === 'touch';
      const difficulty = Config.difficulties[options.difficulty];

      this.options = options;
      this.screen.classList.toggle('has-touch', touch);
      this.touchControls.hidden = !touch;
      this.footer.hidden = touch;
      this.pauseOverlay.hidden = true;

      this.controller = new ns.PlayerController({
        canvas: this.canvas,
        width: Config.arena.width,
        height: Config.arena.height,
        keymap: Config.keymaps.p1,
        lock: touch
      });
      this.controller.attach();

      const playerOrb = Config.orbs[options.orb] ? options.orb : Config.defaults.orb;
      const enemyOrb = options.enemyOrb || randomOrbKey();

      // Mode campaign: stage membawa HP, pengawal, dan tema arena
      const stage = options.stage || null;
      const guards = stage && stage.guards
        ? stage.guards.map(function (key) {
          return { key: key, hp: stage.guardHp, radius: Config.campaign.guardRadius };
        })
        : [];
      const controllers = [this.controller, new ns.BotController(options.difficulty)];

      guards.forEach(function () {
        controllers.push(new ns.BotController(stage.guardDifficulty));
      });

      this.renderer.setTheme(stage ? stage.theme : null);

      this.match = new ns.Match({
        difficulty: options.difficulty,
        orbKeys: [playerOrb, enemyOrb],
        names: [options.playerName, stage ? stage.bossName : 'Bot'],
        playerSetup: stage && stage.playerHp ? { hp: stage.playerHp } : null,
        enemySetup: stage ? { hp: stage.bossHp, tag: 'BOS' } : null,
        guards: guards,
        controllers: controllers,
        listener: (name, data) => this.handleEvent(name, data),
        onFinish: (result) => this.handleFinish(result)
      });

      this.playerName.textContent = options.playerName;
      this.enemyName.textContent = stage
        ? stage.bossName + ' · ' + Config.orbs[enemyOrb].short
        : 'Bot ' + difficulty.label + ' · ' + Config.orbs[enemyOrb].short;
      this.playerOrbLabel.textContent = Config.orbs[playerOrb].short;
      this.lastTimerText = '';
      this.lastSkillKey = '';
      this.lastLock = null;
      this.paused = false;
      this.active = true;

      window.addEventListener('keydown', this.keyHandler);
      this.renderer.resize();
      this.lastTime = performance.now();
      this.frameId = requestAnimationFrame(this.loop);
    },

    stop() {
      if (this.frameId) {
        cancelAnimationFrame(this.frameId);
        this.frameId = 0;
      }

      if (this.controller) {
        this.controller.detach();
        this.controller = null;
      }

      window.removeEventListener('keydown', this.keyHandler);
      this.active = false;
      this.paused = false;
      this.match = null;
    },

    quit() {
      const onQuit = this.options && this.options.onQuit;

      this.stop();

      if (onQuit) {
        onQuit();
      }
    },

    /* ---------- Jeda ---------- */

    pause() {
      if (!this.active || this.paused) {
        return;
      }

      this.paused = true;
      this.controller.releaseAll();
      this.pauseOverlay.hidden = false;
    },

    resume() {
      if (!this.active || !this.paused) {
        return;
      }

      this.paused = false;
      this.pauseOverlay.hidden = true;
      this.lastTime = performance.now();
    },

    togglePause() {
      if (this.paused) {
        this.resume();
      } else {
        this.pause();
      }
    },

    /* ---------- Loop ---------- */

    loop(now) {
      if (!this.active) {
        return;
      }

      this.frameId = requestAnimationFrame(this.loop);

      if (this.paused) {
        return;
      }

      const dt = Math.min((now - this.lastTime) / 1000, 1 / 30);

      this.lastTime = now;
      this.match.update(dt * Config.match.speed);

      // onFinish bisa menghentikan layar ini di tengah update
      if (!this.active || !this.match) {
        return;
      }

      this.renderer.draw(this.match, {
        lock: this.controller.lock,
        time: now
      });
      this.updateHud();
    },

    handleResize() {
      if (!this.active) {
        return;
      }

      this.renderer.resize();

      if (this.paused) {
        this.renderer.draw(this.match, {
          lock: this.controller.lock,
          time: performance.now()
        });
      }
    },

    handleFinish(result) {
      const onFinish = this.options.onFinish;

      if (this.options.stage) {
        result.stageId = this.options.stage.id;
      }

      this.stop();
      onFinish(result);
    },

    handleEvent(name, data) {
      const sfx = ns.Sfx;

      const kind = data && data.weapon ? data.weapon.kind : undefined;

      if (name === 'shoot') {
        // Tembakan bot lebih pelan dan sedikit lebih berat dari tembakanmu
        sfx.play('shoot', data.id === 'p1' ? { kind: kind } : { kind: kind, vol: 0.55, rate: 0.88 });
      } else if (name === 'end') {
        sfx.play(data.outcome);
      } else {
        sfx.play(name, { kind: kind });
      }
    },

    /* ---------- HUD ---------- */

    updateHud() {
      const match = this.match;
      const player = match.orbs[0];
      const enemy = match.orbs[1];
      const timerText = formatTime(match.timeLeft);

      this.setBar(this.playerFill, this.playerHp, player);
      this.setBar(this.enemyFill, this.enemyHp, enemy);

      if (timerText !== this.lastTimerText) {
        this.lastTimerText = timerText;
        this.timer.textContent = timerText;
        this.timer.classList.toggle('is-low', match.state === 'running' && match.timeLeft <= 10);
      }

      this.updateSkill(player);
      this.updateLock();
    },

    setBar(fill, text, orb) {
      const percent = Math.max(0, (orb.hp / orb.maxHp) * 100);
      const label = String(Math.ceil(orb.hp));

      if (fill.dataset.value !== label) {
        fill.dataset.value = label;
        fill.style.width = percent + '%';
        text.textContent = label;
      }
    },

    /* Indikator cooldown senjata bola pemain. DOM hanya disentuh saat nilainya berubah. */
    updateSkill(player) {
      const weapon = player.weapon;
      const busy = player.charging || Boolean(player.burst);
      const holding = Boolean(player.beam);
      const ready = holding ? player.beam.charge / weapon.maxCharge : (busy ? 0 : 1 - player.cd / weapon.cooldown);
      const isReady = player.cd <= 0 && !busy;
      const label = isReady ? 'Siap' : (holding ? 'Isi ' + Math.round((player.beam.charge / weapon.maxCharge) * 100) + '%' : (busy ? '...' : Math.ceil(player.cd) + ' dtk'));
      const level = Math.round(Math.max(0, Math.min(1, ready)) * 100) / 100;
      const key = level + '|' + isReady + '|' + label;

      if (key === this.lastSkillKey) {
        return;
      }

      this.lastSkillKey = key;
      this.skillMeters = this.skillMeters || document.querySelectorAll('[data-skill-meter]');
      this.skillTexts = this.skillTexts || document.querySelectorAll('[data-skill-text]');

      this.skillMeters.forEach(function (element) {
        element.style.setProperty('--ready', String(level));
        element.classList.toggle('is-ready', isReady);
      });

      this.skillTexts.forEach(function (element) {
        element.textContent = label;
      });
    },

    updateLock() {
      const on = this.controller.lock;

      if (on === this.lastLock) {
        return;
      }

      this.lastLock = on;
      this.lockStates = this.lockStates || document.querySelectorAll('[data-lock-state]');

      this.lockStates.forEach(function (element) {
        element.classList.toggle('is-on', on);

        if (element.classList.contains('chip')) {
          element.textContent = 'Lock Aim [E]: ' + (on ? 'ON' : 'OFF');
        }
      });
    }
  };

  ns.formatTime = formatTime;
  ns.Match = Match;
  ns.GameScreen = GameScreen;
})(window.OrbitArena = window.OrbitArena || {});
