(function (ns) {
  'use strict';

  const Config = ns.Config;

  /*
   * Fx: animasi layar hasil dan statistik.
   * Angka berhitung naik, kartu muncul bergantian, bintang menyala satu
   * per satu, kembang api dan konfeti saat menang (js/victory.js), dan retakan, abu, serta bintang pecah
   * saat kalah (js/defeat.js). Semuanya berhenti saat layar
   * ditinggalkan, dan dilewati bila pengguna memilih gerak berkurang.
   */
  const COUNT_DURATION = 800;
  const STAR_START = 650;
  const STAR_GAP = 260;

  const { reducedMotion, easeOut } = ns.Util;

  function byId(id) {
    return document.getElementById(id);
  }

  const Fx = {
    timers: [],
    frames: [],

    /* ---------- Dasar ---------- */

    later(ms, callback) {
      this.timers.push(window.setTimeout(callback, ms));
    },

    /* Animasi nilai dari 0 ke target. render(nilai) menulis ke layar. */
    tween(target, delay, render) {
      if (reducedMotion()) {
        render(target);

        return;
      }

      render(0);

      this.later(delay, () => {
        const start = performance.now();

        const step = (now) => {
          const t = Math.min(1, (now - start) / COUNT_DURATION);

          render(target * easeOut(t));

          if (t < 1) {
            this.frames.push(requestAnimationFrame(step));
          } else {
            render(target);
          }
        };

        this.frames.push(requestAnimationFrame(step));
      });
    },

    countUp(id, target, delay, format) {
      const element = byId(id);

      if (!element) {
        return;
      }

      this.tween(target, delay, function (value) {
        element.textContent = format(Math.round(value));
      });
    },

    /* Isi bar tipis (0 sampai 1) dengan transisi CSS */
    meter(id, fraction, delay) {
      const fill = byId(id);

      if (!fill) {
        return;
      }

      fill.style.transform = 'scaleX(0)';
      this.later(delay, function () {
        fill.style.transform = 'scaleX(' + Math.max(0, Math.min(1, fraction)).toFixed(3) + ')';
      });
    },

    /* Mulai ulang animasi muncul bergantian pada elemen .reveal di dalam root */
    replay(root) {
      if (!root) {
        return;
      }

      root.querySelectorAll('.reveal').forEach(function (item, index) {
        item.style.setProperty('--i', String(index));
      });

      root.classList.remove('fx-play');
      void root.offsetWidth;
      root.classList.add('fx-play');
    },

    /* ---------- Layar hasil ---------- */

    starCount(result) {
      if (result.outcome === 'win') {
        const share = result.playerHp / (result.playerMaxHp || Config.orb.maxHp);

        if (share >= 0.7) {
          return 3;
        }

        return share >= 0.35 ? 2 : 1;
      }

      return result.outcome === 'draw' ? 1 : 0;
    },

    /* Titik tengah judul di layar, jadi pusat retakan saat kalah */
    titleCenter(title) {
      const box = title.getBoundingClientRect();

      return {
        x: box.left + box.width / 2,
        y: box.top + box.height / 2
      };
    },

    /* Pasang atau lepas penanda menang di layar hasil dan kedua bola */
    setVictory(won) {
      const screen = byId('result-card').closest('.screen-result');
      const player = byId('result-orb-player').closest('.versus-side');
      const enemy = byId('result-orb-enemy').closest('.versus-side');

      screen.classList.remove('is-victory');
      player.classList.remove('is-champion');
      enemy.classList.remove('is-beaten');
      void screen.offsetWidth;

      if (won) {
        screen.classList.add('is-victory');
        player.classList.add('is-champion');
        enemy.classList.add('is-beaten');
      }
    },

    /* Pasang atau lepas penanda kalah di layar hasil dan kedua bola */
    setDefeat(lost) {
      const screen = byId('result-card').closest('.screen-result');
      const player = byId('result-orb-player').closest('.versus-side');
      const enemy = byId('result-orb-enemy').closest('.versus-side');

      // Dilepas dulu supaya animasi CSS mulai dari awal pada rematch
      screen.classList.remove('is-defeat');
      player.classList.remove('is-fallen');
      enemy.classList.remove('is-victor');
      void screen.offsetWidth;

      if (lost) {
        screen.classList.add('is-defeat');
        player.classList.add('is-fallen');
        enemy.classList.add('is-victor');
      }
    },

    playResult(result) {
      this.stop();

      this.lastResult = result;

      const card = byId('result-card');
      const title = byId('result-title');
      const stars = byId('result-stars');
      const lit = this.starCount(result);
      const maxHp = result.playerMaxHp || Config.orb.maxHp;
      const lost = result.outcome === 'loss';
      const origin = lost ? this.titleCenter(title) : null;

      this.replay(card);
      this.setDefeat(lost);
      this.setVictory(result.outcome === 'win');

      // Salinan teks untuk efek glitch judul kalah
      title.dataset.text = title.textContent;

      // Judul menghantam layar (kalah: jatuh dari atas, lihat defeat.css)
      title.classList.remove('is-slam');
      void title.offsetWidth;
      title.classList.add('is-slam');

      this.countUp('res-duration', Math.round(result.duration), 250, ns.Statistics.formatDuration);
      this.countUp('res-hp', result.playerHp, 350, function (value) {
        return value + ' / ' + maxHp;
      });
      this.countUp('res-damage', result.damageDealt, 450, String);
      this.countUp('res-accuracy', result.accuracy, 550, function (value) {
        return value + '%';
      });

      this.meter('meter-duration', result.duration / Config.match.duration, 250);
      this.meter('meter-hp', result.playerHp / maxHp, 350);
      this.meter('meter-damage', result.damageDealt / (result.enemyMaxHp || Config.orb.maxHp), 450);
      this.meter('meter-accuracy', result.accuracy / 100, 550);

      // Bintang menyala satu per satu
      stars.setAttribute('aria-label', 'Penilaian ' + lit + ' dari 3 bintang');
      stars.querySelectorAll('.star').forEach((star, index) => {
        star.classList.remove('is-lit', 'is-broken');

        if (index < lit) {
          this.later(STAR_START + index * STAR_GAP, function () {
            star.classList.add('is-lit');
            ns.Sfx.play('click');
          });
        } else if (lost) {
          // Bintang kosong retak satu per satu
          this.later(STAR_START + index * STAR_GAP, function () {
            star.classList.add('is-broken');
            ns.Sfx.play('defeatCrack');
          });
        }
      });

      if (result.outcome === 'win') {
        this.victory();
      } else if (lost) {
        this.defeat(origin);
      }
    },

    /* ---------- Kalah ---------- */

    defeat(origin) {
      this.later(470, function () {
        ns.Sfx.play('defeatThud');
        ns.Sfx.play('defeatCrack');
      });

      this.later(900, function () {
        ns.Sfx.play('defeat');
      });

      if (!reducedMotion()) {
        ns.Defeat.play(byId('result-confetti'), origin);
      }
    },

    /* ---------- Statistik ---------- */

    playStats(progress) {
      this.stop();

      const rate = ns.Statistics.winRate(progress);
      const ring = byId('stat-ring');

      this.replay(byId('stats-root'));

      this.countUp('stat-matches', progress.matches, 150, String);
      this.countUp('stat-wins', progress.wins, 220, String);
      this.countUp('stat-losses', progress.losses, 290, String);
      this.countUp('stat-draws', progress.draws, 360, String);
      this.countUp('stat-rate', rate, 430, function (value) {
        return value + '%';
      });
      this.countUp('stat-best', progress.bestStreak, 500, String);

      if (ring) {
        this.tween(rate, 430, function (value) {
          ring.style.setProperty('--p', value.toFixed(1));
        });
      }
    },

    /* ---------- Menang ---------- */

    victory() {
      this.later(200, function () {
        ns.Sfx.play('winPop');
      });

      if (reducedMotion()) {
        return;
      }

      const title = byId('result-title');
      const stars = Array.prototype.slice.call(byId('result-stars').querySelectorAll('.star'));

      // Titik bintang dihitung dari tata letak akhir, setelah kartu selesai bergeser masuk
      this.later(120, () => {
        const layout = {
          title: this.titleCenter(title),
          stars: stars.slice(0, this.starCount(this.lastResult)).map(function (star) {
            const box = star.getBoundingClientRect();

            return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
          })
        };

        ns.Victory.play(byId('result-confetti'), layout);
      });
    },

    /* Hentikan semua animasi yang masih berjalan */
    stop() {
      this.timers.forEach(function (timer) {
        window.clearTimeout(timer);
      });

      this.frames.forEach(function (frame) {
        cancelAnimationFrame(frame);
      });

      if (ns.Victory) {
        ns.Victory.stop();
      }

      if (ns.Defeat) {
        ns.Defeat.stop();
      }

      const canvas = byId('result-confetti');

      if (canvas) {
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      }

      this.timers = [];
      this.frames = [];
    }
  };

  ns.Fx = Fx;
})(window.OrbitArena = window.OrbitArena || {});
