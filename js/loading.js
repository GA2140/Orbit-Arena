(function (ns) {
  'use strict';

  const Config = ns.Config;

  /*
   * Loading: layar memuat singkat antara pemilihan bola dan
   * pertandingan. Selama itu gambar bola dan cahaya disiapkan
   * lebih dulu supaya pertandingan mulai tanpa tersendat.
   */
  const DURATION = 0.9;
  const DURATION_REDUCED = 0.3;

  // Jaring pengaman: kalau animasi tertahan, pertandingan tetap dimulai
  const FALLBACK_EXTRA = 1;

  const STEPS = [
    { from: 0, text: 'Menyiapkan arena' },
    { from: 0.45, text: 'Memasang bola' },
    { from: 0.85, text: 'Siap bertanding' }
  ];

  const { reducedMotion } = ns.Util;

  /* Kemajuan tidak lurus: cepat, menahan sebentar, lalu penuh */
  function easeProgress(t) {
    if (t < 0.35) {
      return (t / 0.35) * 0.45;
    }

    if (t < 0.6) {
      return 0.45 + ((t - 0.35) / 0.25) * 0.2;
    }

    return 0.65 + ((t - 0.6) / 0.4) * 0.35;
  }

  /* Gambar tiap jenis bola sekali di canvas kecil supaya cache cahayanya terisi */
  function warmUp(keys) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 120;
    canvas.height = 120;

    keys.forEach(function (key) {
      ns.Skins.draw(ctx, {
        x: 60,
        y: 60,
        r: 26,
        kind: Config.orbs[key].kind,
        time: 0,
        level: 1
      });
    });
  }

  const Loading = {
    frameId: 0,
    fallbackId: 0,
    running: false,

    /* onDone dipanggil sekali setelah bar penuh */
    run(keys, onDone) {
      this.cancel();

      const fill = document.getElementById('loading-fill');
      const bar = document.getElementById('loading-bar');
      const step = document.getElementById('loading-step');
      const total = (reducedMotion() ? DURATION_REDUCED : DURATION) * 1000;
      const start = performance.now();
      let label = '';

      try {
        warmUp(keys);
      } catch (error) {
        // Persiapan gambar gagal bukan alasan untuk menahan pertandingan
      }

      this.running = true;

      const finish = () => {
        if (!this.running) {
          return;
        }

        this.cancel();
        onDone();
      };

      this.fallbackId = window.setTimeout(finish, total + FALLBACK_EXTRA * 1000);

      const tick = (now) => {
        if (!this.running) {
          return;
        }

        const t = Math.max(0, Math.min(1, (now - start) / total));
        const progress = easeProgress(t);
        const current = STEPS.filter(function (item) {
          return t >= item.from;
        }).pop().text;

        fill.style.transform = 'scaleX(' + progress.toFixed(3) + ')';

        if (current !== label) {
          label = current;
          step.textContent = current;
          bar.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
        }

        if (t >= 1) {
          finish();

          return;
        }

        this.frameId = requestAnimationFrame(tick);
      };

      fill.style.transform = 'scaleX(0)';
      step.textContent = STEPS[0].text;
      this.frameId = requestAnimationFrame(tick);
    },

    cancel() {
      if (this.frameId) {
        cancelAnimationFrame(this.frameId);
      }

      window.clearTimeout(this.fallbackId);

      this.frameId = 0;
      this.fallbackId = 0;
      this.running = false;
    }
  };

  ns.Loading = Loading;
})(window.OrbitArena = window.OrbitArena || {});
