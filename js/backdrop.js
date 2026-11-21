(function (ns) {
  'use strict';

  const Config = ns.Config;

  /*
   * Backdrop: latar berupa poster empat bola dalam pose keren.
   * Tiap pose digambar sekali ke canvas (bola + efek senjatanya
   * dibekukan), lalu ditata dan digerakkan lewat CSS. Tidak ada
   * simulasi waktu nyata, jadi ringan dan tidak patah-patah.
   *
   * Supaya tidak diam, di atas poster ada lapisan CSS yang hidup:
   *   - tiap bola melayang pelan, dikelilingi cincin dan satelit
   *   - bola menembak sendiri tiap beberapa detik
   *   - bara cahaya naik di seluruh layar
   *   - cahaya mengikuti kursor, klik meledakkan percikan
   *   - klik tepat di bola membuatnya melonjak dan menembak
   *   - menyorot tombol menu menonjolkan satu bola
   * Semua gerak memakai transform dan opacity saja.
   *
   * Semua pose digambar menghadap ke kanan, bola di sisi kiri canvas.
   * Sudut miring diatur lewat CSS.
   */
  const POSE_WIDTH = 900;
  const POSE_HEIGHT = 600;
  const ORB_X = 190;
  const ORB_Y = 300;
  const ORB_RADIUS = 110;
  const TAU = Math.PI * 2;

  const POSES = [
    { kind: 'laser', team: 'player' },
    { kind: 'bomb', team: 'enemy' },
    { kind: 'burst', team: 'player' },
    { kind: 'bounce', team: 'enemy' }
  ];

  /* ---------- Alat gambar ---------- */

  /* Warna hex jadi rgba supaya bisa dipakai di gradasi */
  function rgba(hex, alpha) {
    const value = parseInt(hex.slice(1), 16);

    return 'rgba(' + (value >> 16) + ', ' + ((value >> 8) & 255) + ', ' + (value & 255) + ', ' + alpha + ')';
  }

  function line(ctx, x1, y1, x2, y2, width, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function dot(ctx, x, y, radius, color, glow) {
    ctx.save();
    ctx.shadowColor = glow || color;
    ctx.shadowBlur = radius * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function diamond(ctx, x, y, size, rotation, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 1.6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -size * 1.5);
    ctx.lineTo(size * 1.5, 0);
    ctx.lineTo(0, size * 1.5);
    ctx.lineTo(-size * 1.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.45, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function sparks(ctx, x, y, count, reach, color) {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * TAU + 0.4;
      const from = reach * 0.35;

      line(
        ctx,
        x + Math.cos(angle) * from,
        y + Math.sin(angle) * from,
        x + Math.cos(angle) * reach,
        y + Math.sin(angle) * reach,
        4,
        color,
        0.8
      );
    }
  }

  /* ---------- Pose per jenis bola ---------- */

  /* Sinar memudar halus ke ujung, jadi tidak terlihat terpotong di tepi gambar */
  function poseLaser(ctx, palette) {
    const startX = ORB_X + ORB_RADIUS * 0.6;

    function fadingBeam(width, color, peak) {
      const gradient = ctx.createLinearGradient(startX, 0, POSE_WIDTH, 0);

      gradient.addColorStop(0, rgba(color, peak));
      gradient.addColorStop(0.55, rgba(color, peak));
      gradient.addColorStop(1, rgba(color, 0));

      ctx.strokeStyle = gradient;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, ORB_Y);
      ctx.lineTo(POSE_WIDTH, ORB_Y);
      ctx.stroke();
    }

    ctx.save();
    ctx.shadowColor = palette.main;
    ctx.shadowBlur = 50;
    fadingBeam(74, palette.main, 0.28);
    fadingBeam(36, palette.main, 0.95);
    ctx.restore();

    fadingBeam(12, '#ffffff', 1);
    sparks(ctx, ORB_X + ORB_RADIUS + 20, ORB_Y, 8, 70, palette.light);
  }

  function poseBurst(ctx, palette) {
    const count = 5;

    for (let i = 0; i < count; i += 1) {
      const x = ORB_X + ORB_RADIUS + 90 + i * 120;
      const y = ORB_Y + (i % 2 ? 8 : -8);
      const fade = 1 - i * 0.12;

      line(ctx, x - 100, y, x, y, 18, palette.main, 0.35 * fade);
      dot(ctx, x, y, 17, '#ffffff', palette.main);

      ctx.save();
      ctx.strokeStyle = palette.main;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function poseBomb(ctx, palette) {
    const bombX = 560;
    const blastX = 770;
    const blastR = 120;

    // Lintasan putus-putus menuju titik ledak
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = palette.light;
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 14]);
    ctx.beginPath();
    ctx.moveTo(ORB_X + ORB_RADIUS, ORB_Y);
    ctx.lineTo(blastX, ORB_Y);
    ctx.stroke();
    ctx.restore();

    // Area ledakan
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = palette.main;
    ctx.beginPath();
    ctx.arc(blastX, ORB_Y, blastR, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = palette.main;
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 12]);
    ctx.stroke();
    ctx.restore();

    // Bom yang sedang melayang
    ctx.save();
    ctx.shadowColor = palette.main;
    ctx.shadowBlur = 36;
    ctx.fillStyle = '#10142e';
    ctx.beginPath();
    ctx.arc(bombX, ORB_Y, 34, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = palette.main;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.restore();

    dot(ctx, bombX, ORB_Y, 11, '#ffffff', palette.main);
    line(ctx, bombX - 150, ORB_Y, bombX - 40, ORB_Y, 22, palette.main, 0.3);
  }

  function poseBounce(ctx, palette) {
    const points = [
      [ORB_X + ORB_RADIUS * 0.7, ORB_Y - 30],
      [520, 70],
      [700, 330],
      [860, 120]
    ];

    // Jejak pantulan
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = palette.light;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.setLineDash([14, 12]);
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(function (point) {
      ctx.lineTo(point[0], point[1]);
    });
    ctx.stroke();
    ctx.restore();

    // Percikan di tiap titik pantul
    sparks(ctx, points[1][0], points[1][1], 7, 40, palette.main);
    sparks(ctx, points[2][0], points[2][1], 7, 40, palette.main);

    diamond(ctx, 330, 190, 16, 0.5, palette.main);
    diamond(ctx, 610, 205, 18, 1.1, palette.main);
    diamond(ctx, 820, 160, 22, 0.2, palette.light);
  }

  const DRAW_POSE = {
    laser: poseLaser,
    burst: poseBurst,
    bomb: poseBomb,
    bounce: poseBounce
  };

  function drawPose(canvas, kind, team) {
    const ctx = canvas.getContext('2d');
    const palette = Config.colors[team];

    canvas.width = POSE_WIDTH;
    canvas.height = POSE_HEIGHT;

    DRAW_POSE[kind](ctx, palette);

    // Bola digambar terakhir supaya berada di atas efek
    ns.Skins.draw(ctx, {
      x: ORB_X,
      y: ORB_Y,
      r: ORB_RADIUS,
      kind: kind,
      color: palette.main,
      light: palette.light,
      dark: palette.dark,
      time: 1.2,
      level: 1
    });
  }

  /* ---------- Poster ---------- */

  const EMBER_COUNT = 10;
  const SHOT_GAP = 2600;
  const REDUCED = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  /* Pusat bola di dalam gambar pose, dalam persen lebar dan tinggi */
  const ORB_LEFT = (ORB_X / POSE_WIDTH) * 100;
  const ORB_TOP = (ORB_Y / POSE_HEIGHT) * 100;
  const ORB_SIZE = ((ORB_RADIUS * 2) / POSE_WIDTH) * 100;

  function element(tag, className, parent) {
    const node = document.createElement(tag);

    node.className = className;

    if (parent) {
      parent.appendChild(node);
    }

    return node;
  }

  function reduced() {
    return Boolean(REDUCED && REDUCED.matches);
  }

  const Backdrop = {
    root: null,
    ambient: null,
    holders: [],
    frame: 0,
    pointer: { x: 0, y: 0 },
    shotTimer: 0,
    shotIndex: 0,
    scene: 'menu',

    /* mode 'lobby': poster di sisi menu utama. 'demo': di belakang kartu login. */
    init(mode) {
      if (this.root || !ns.Skins) {
        return;
      }

      this.root = element('div', 'poster ' + (mode === 'lobby' ? 'is-lobby' : 'is-center'));

      // Halaman login dan register tidak berganti layar
      if (mode !== 'lobby') {
        this.root.dataset.fixed = 'true';
      }
      this.root.setAttribute('aria-hidden', 'true');

      POSES.forEach(function (pose) {
        const holder = element('div', 'pose pose-' + pose.kind, this.root);
        const float = element('div', 'pose-float', holder);
        const canvas = element('canvas', 'pose-art', float);
        const orb = element('div', 'pose-orb', float);

        // Cincin orbit, satelit, dan halo berdenyut di sekitar bola
        element('i', 'orb-ring', orb);
        element('i', 'orb-ring orb-ring-2', orb);
        element('i', 'orb-sat', orb);
        element('i', 'orb-sat orb-sat-2', orb);

        drawPose(canvas, pose.kind, pose.team);
        holder.dataset.kind = pose.kind;
        this.holders.push({ kind: pose.kind, holder: holder, float: float, canvas: canvas, orb: orb });
      }, this);

      this.buildAmbient();

      // Lapisan ambient harus setelah poster di DOM supaya cahaya kursor dan bara tampil di atas poster
      document.body.insertBefore(this.root, document.body.firstChild);
      document.body.insertBefore(this.ambient, this.root.nextSibling);

      window.addEventListener('pointermove', (event) => this.onPointerMove(event));
      window.addEventListener('pointerdown', (event) => this.onPointerDown(event));
      document.addEventListener('pointerover', (event) => this.onHover(event));
      document.addEventListener('pointerout', (event) => this.onHover(event));
      document.addEventListener('focusin', (event) => this.onHover(event));
      document.addEventListener('focusout', (event) => this.onHover(event));
      document.addEventListener('visibilitychange', () => this.updateTimer());

      this.updateTimer();
    },

    /* Lapisan seluruh layar: bara cahaya dan percikan klik */
    buildAmbient() {
      this.ambient = element('div', 'ambient');
      this.ambient.setAttribute('aria-hidden', 'true');

      const embers = element('div', 'embers', this.ambient);

      for (let index = 0; index < EMBER_COUNT; index += 1) {
        const ember = element('i', 'ember' + (index % 3 === 0 ? ' is-warm' : index % 5 === 0 ? ' is-gold' : ''), embers);

        ember.style.setProperty('--x', (Math.random() * 100).toFixed(1) + '%');
        ember.style.setProperty('--size', (3 + Math.random() * 6).toFixed(1) + 'px');
        ember.style.setProperty('--dur', (9 + Math.random() * 10).toFixed(1) + 's');
        ember.style.setProperty('--delay', (-Math.random() * 18).toFixed(1) + 's');
        ember.style.setProperty('--drift', Math.round(-60 + Math.random() * 120) + 'px');
      }
    },

    /*
     * Layar yang tampil menentukan tata letak poster:
     *   menu  poster besar di sisi kanan
     *   game  poster disembunyikan
     *   lain  poster mengitari kotak sebagai ornamen
     * tone 'win' atau 'loss' menonjolkan bola tim yang menang.
     */
    setScene(scene, tone) {
      if (!this.root) {
        return;
      }

      this.scene = scene;

      if (this.ambient) {
        this.ambient.hidden = scene === 'game' || scene === 'loading';
      }

      this.updateTimer();

      if (this.root.dataset.fixed) {
        return;
      }

      this.root.hidden = scene === 'game';
      this.root.classList.toggle('is-lobby', scene === 'menu');
      this.root.classList.toggle('is-center', scene !== 'menu');

      if (tone) {
        this.root.dataset.tone = tone;
      } else {
        delete this.root.dataset.tone;
      }
    },

    /* ---------- Tembakan otomatis ---------- */

    /* Timer hanya jalan saat poster terlihat dan tab aktif */
    updateTimer() {
      const visible = !document.hidden && !reduced() && this.scene !== 'game' && this.scene !== 'loading';

      if (visible && !this.shotTimer) {
        this.shotTimer = window.setInterval(() => this.autoFire(), SHOT_GAP);
      } else if (!visible && this.shotTimer) {
        window.clearInterval(this.shotTimer);
        this.shotTimer = 0;
      }
    },

    autoFire() {
      if (this.scene !== 'menu' && !this.root.dataset.fixed) {
        return;
      }

      this.shotIndex = (this.shotIndex + 1) % this.holders.length;
      this.fire(this.holders[this.shotIndex]);
    },

    /* Satu bola menembak: badan menyentak ke belakang, proyektil melesat sesuai senjatanya */
    fire(entry) {
      const art = entry.canvas;
      const shot = element('i', 'shot shot-' + entry.kind, entry.orb);

      art.classList.remove('is-recoil');
      void art.offsetWidth;
      art.classList.add('is-recoil');

      if (entry.kind === 'burst') {
        for (let index = 1; index < 4; index += 1) {
          const extra = element('i', 'shot shot-burst', entry.orb);

          extra.style.animationDelay = index * 70 + 'ms';
          extra.addEventListener('animationend', function () {
            extra.remove();
          });
        }
      }

      shot.addEventListener('animationend', function () {
        shot.remove();
      });
    },

    /* ---------- Interaksi kursor ---------- */

    /* Kursor menggeser poster: nilai -1 sampai 1, ditulis paling banyak sekali per frame */
    onPointerMove(event) {
      if (!this.root || event.pointerType !== 'mouse' || this.frame) {
        return;
      }

      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;

      this.frame = requestAnimationFrame(() => {
        this.frame = 0;

        const x = this.pointer.x / window.innerWidth * 2 - 1;
        const y = this.pointer.y / window.innerHeight * 2 - 1;

        this.root.style.setProperty('--px', x.toFixed(3));
        this.root.style.setProperty('--py', y.toFixed(3));

        document.body.classList.toggle('orb-hover', Boolean(this.hitOrb(this.pointer.x, this.pointer.y)));
      });
    },

    /* Bola mana yang ada di bawah titik layar ini (hanya saat poster besar tampil) */
    hitOrb(x, y) {
      if (!this.root || this.root.hidden || this.scene !== 'menu' || this.root.dataset.fixed) {
        return null;
      }

      for (let index = this.holders.length - 1; index >= 0; index -= 1) {
        const entry = this.holders[index];
        const rect = entry.orb.getBoundingClientRect();
        const radius = rect.width / 2;

        if (radius > 0 && Math.hypot(x - (rect.left + radius), y - (rect.top + rect.height / 2)) < radius * 0.95) {
          return entry;
        }
      }

      return null;
    },

    /* Klik: percikan di titik klik. Klik tepat di bola membuatnya melonjak dan menembak. */
    onPointerDown(event) {
      if (!this.ambient || this.ambient.hidden || event.button > 0) {
        return;
      }

      this.spark(event.clientX, event.clientY, event.target);

      const entry = this.hitOrb(event.clientX, event.clientY);

      if (entry && !(event.target.closest && event.target.closest('button, a, input'))) {
        entry.canvas.classList.remove('is-pop');
        void entry.canvas.offsetWidth;
        entry.canvas.classList.add('is-pop');
        this.fire(entry);

        if (ns.Sfx) {
          ns.Sfx.play(entry.kind === 'bomb' ? 'explode' : entry.kind === 'laser' ? 'laserFire' : 'shoot');
        }
      }
    },

    /* Cincin dan serpihan kecil yang menyebar dari titik klik */
    spark(x, y, target) {
      if (reduced()) {
        return;
      }

      const hot = target && target.closest ? target.closest('[data-pose]') : null;
      const warm = hot ? hot.dataset.pose === 'bomb' || hot.dataset.pose === 'bounce' : Math.random() > 0.5;
      const burst = element('div', 'click-burst' + (warm ? ' is-warm' : ''), this.ambient);

      burst.style.left = x + 'px';
      burst.style.top = y + 'px';
      element('i', 'click-ring', burst);

      for (let index = 0; index < 8; index += 1) {
        const shard = element('i', 'click-shard', burst);
        const angle = (index / 8) * TAU + Math.random() * 0.4;
        const reach = 36 + Math.random() * 34;

        shard.style.setProperty('--dx', Math.round(Math.cos(angle) * reach) + 'px');
        shard.style.setProperty('--dy', Math.round(Math.sin(angle) * reach) + 'px');
      }

      window.setTimeout(function () {
        burst.remove();
      }, 700);
    },

    /* Menyorot tombol menu menonjolkan satu bola */
    onHover(event) {
      if (!this.root) {
        return;
      }

      const target = event.target && event.target.closest ? event.target.closest('[data-pose]') : null;
      const entering = event.type === 'pointerover' || event.type === 'focusin';

      if (target && entering) {
        this.root.dataset.focus = target.dataset.pose;
        this.ambient.dataset.focus = target.dataset.pose;
      } else if (!entering) {
        delete this.root.dataset.focus;
        delete this.ambient.dataset.focus;
      }
    }
  };

  ns.Backdrop = Backdrop;
})(window.OrbitArena = window.OrbitArena || {});
