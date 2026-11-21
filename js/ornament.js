(function (ns) {
  'use strict';

  /*
   * Ornament: hiasan di sekeliling kotak, gayanya "sistem planet mini".
   *
   * Kotak besar (kartu hasil dan kartu login) mendapat:
   *   - dua lembar kertas pastel yang menumpuk di belakang kotak
   *   - planet kecil bercincin yang mengorbit di sudut kanan atas
   *   - planet kecil yang mengintip dari sudut kiri bawah
   *
   * Kotak kecil (panel, statistik, kartu mode, kotak pilih bola)
   * hanya mendapat tab warna di tepi kiri.
   *
   * Warna bergilir per kotak (tosca, mawar, amber, ungu, biru, hijau).
   * Interaksi: kotak terangkat saat kursor masuk, dan klik melempar
   * titik-titik warna dari tempat klik. Gerak memakai transform dan
   * opacity saja.
   */
  const FULL = '.result-card, .auth-card';
  const LITE = '.panel, .stat, .mode-card:not(.is-disabled), .pick-box';
  const HUES = 6;
  const BURST_DOTS = 9;

  function add(parent, tag, className) {
    const node = document.createElement(tag);

    node.className = className;
    parent.appendChild(node);

    return node;
  }

  const Ornament = {
    count: 0,
    active: null,

    init() {
      document.querySelectorAll(FULL).forEach((box) => this.decorate(box, false));
      document.querySelectorAll(LITE).forEach((box) => this.decorate(box, true));

      document.addEventListener('pointerover', (event) => this.onOver(event));
      document.addEventListener('pointerout', (event) => this.onOut(event));
      document.addEventListener('pointerdown', (event) => this.onDown(event));
    },

    /* Pasang lapisan ornamen ke satu kotak. lite = hanya tab warna di kiri. */
    decorate(box, lite) {
      if (box.querySelector(':scope > .orn')) {
        return;
      }

      const layer = add(box, 'span', 'orn' + (lite ? ' orn-lite' : ''));

      layer.setAttribute('aria-hidden', 'true');
      box.classList.add('has-orn', 'orn-c' + (this.count % HUES));
      box.classList.toggle('orn-full', !lite);
      this.count += 1;

      if (lite) {
        add(layer, 'i', 'orn-tab');

        return;
      }

      // Planet bercincin yang mengorbit di sudut kanan atas
      const orbit = add(layer, 'i', 'orn-orbit');
      const tilt = add(orbit, 'i', 'orn-tilt');
      const spin = add(tilt, 'i', 'orn-spin');

      add(tilt, 'i', 'orn-path');
      add(tilt, 'i', 'orn-core');
      add(spin, 'i', 'orn-moon');
      add(spin, 'i', 'orn-moon orn-moon-small');

      // Planet kecil yang mengintip dari sudut kiri bawah
      const peek = add(layer, 'i', 'orn-peek');

      add(peek, 'i', 'orn-peek-ring');
    },

    boxOf(target) {
      return target && target.closest ? target.closest('.has-orn') : null;
    },

    onOver(event) {
      const box = this.boxOf(event.target);

      if (box && box !== this.active && event.pointerType === 'mouse') {
        this.active = box;
        box.classList.add('is-hot');
      }
    },

    onOut(event) {
      const box = this.boxOf(event.target);

      if (box && box === this.active && !box.contains(event.relatedTarget)) {
        box.classList.remove('is-hot');
        this.active = null;
      }
    },

    /* Klik: titik-titik warna terlempar dari tempat klik */
    onDown(event) {
      const box = this.boxOf(event.target);

      if (!box || event.button > 0) {
        return;
      }

      const layer = box.querySelector(':scope > .orn');
      const rect = box.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      for (let i = 0; i < BURST_DOTS; i += 1) {
        const angle = (i / BURST_DOTS) * Math.PI * 2 + Math.random() * 0.5;
        const reach = 26 + Math.random() * 30;
        const dot = add(layer, 'i', 'orn-pop orn-pop-' + (i % HUES));

        dot.style.setProperty('--px', x + 'px');
        dot.style.setProperty('--py', y + 'px');
        dot.style.setProperty('--dx', Math.cos(angle) * reach + 'px');
        dot.style.setProperty('--dy', Math.sin(angle) * reach + 'px');

        window.setTimeout(function () {
          dot.remove();
        }, 650);
      }
    }
  };

  ns.Ornament = Ornament;
})(window.OrbitArena = window.OrbitArena || {});
