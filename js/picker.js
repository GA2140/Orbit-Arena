(function (ns) {
  'use strict';

  const Config = ns.Config;

  /*
   * Picker: layar memilih bola sebelum pertandingan.
   *
   * Ada dua kotak, Kamu dan Bot. Di tiap kotak ada kotak biasa (bola
   * tingkat 1) dan kotak spesial (bola tingkat 2, HP 200). Pemain boleh
   * memilih sendiri bola untuk dirinya dan untuk bot, atau menekan
   * "Acak Bola" supaya sistem memilihkan. Pertandingan baru dimulai
   * setelah kedua bola terpilih dan tombol Mulai ditekan.
   *
   * Aturan adil:
   *   - Kedua sisi harus satu tingkat. Begitu satu sisi punya bola,
   *     bola tingkat lain di sisi lawan tidak bisa dipilih.
   *   - Hasil Acak Bola terkunci: sisi itu tidak bisa memilih ulang
   *     dan tidak bisa mengacak lagi.
   *   - Pilihan manual boleh dibatalkan dengan mengetuk bolanya lagi.
   */
  const ROLL_SECONDS = 1.1;
  const FAST_DELAY = 60;
  const SLOW_DELAY = 220;

  const { reducedMotion } = ns.Util;

  function byId(id) {
    return document.getElementById(id);
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  /*
   * Hasil acak mengikuti aturan tingkat: kalau lawan sudah punya bola,
   * hasilnya harus satu tingkat dengannya. Kalau belum, bola spesial
   * punya peluang kecil keluar supaya tetap terasa langka.
   */
  function randomTier(fixed) {
    if (fixed) {
      return fixed;
    }

    return Math.random() < Config.randomSpecialChance ? 2 : 1;
  }

  function makeCell(key, side) {
    const orb = Config.orbs[key];
    const cell = document.createElement('button');
    const icon = document.createElement('canvas');
    const name = document.createElement('span');

    cell.type = 'button';
    cell.className = 'pick-cell';
    cell.dataset.key = key;
    cell.dataset.side = side;
    cell.dataset.tier = orb.tier;
    cell.style.setProperty('--orb', orb.palette.main);
    cell.setAttribute('role', 'radio');
    cell.setAttribute('aria-checked', 'false');
    cell.setAttribute('aria-label', orb.name);

    icon.className = 'orb-preview';
    icon.dataset.kind = orb.kind;
    icon.setAttribute('aria-hidden', 'true');

    name.className = 'pick-cell-name';
    name.textContent = orb.short;

    cell.appendChild(icon);
    cell.appendChild(name);

    return cell;
  }

  const Picker = {
    picks: { player: null, enemy: null },
    locked: { player: false, enemy: false },
    timers: [],
    onDone: null,

    init() {
      this.title = byId('pick-title');
      this.start = byId('pick-start');
      this.note = byId('pick-note');
      this.boxes = {};

      ['player', 'enemy'].forEach((side) => {
        const root = byId('pick-' + side);
        const normal = root.querySelector('[data-cells="normal"]');
        const special = root.querySelector('[data-cells="special"]');

        normal.textContent = '';
        special.textContent = '';

        this.boxes[side] = {
          root: root,
          cells: [],
          state: root.querySelector('.pick-state'),
          random: root.querySelector('[data-pick-random]'),
          name: root.querySelector('.pick-name'),
          stats: root.querySelector('.pick-stats'),
          desc: root.querySelector('.pick-desc')
        };

        Config.tiers.forEach((tier, index) => {
          const holder = index === 0 ? normal : special;

          tier.keys.forEach((key) => {
            const cell = makeCell(key, side);

            holder.appendChild(cell);
            this.boxes[side].cells.push(cell);
          });
        });
      });

      byId('screen-pick').addEventListener('click', (event) => this.handleClick(event));
    },

    /* onDone(playerKey, enemyKey) dipanggil saat tombol Mulai ditekan */
    open(onDone, previous) {
      this.cancel();
      this.onDone = onDone;

      // Pertandingan baru selalu mulai dari kosong, tidak ada kunci yang tersisa
      this.picks.player = null;
      this.picks.enemy = null;
      this.locked.player = false;
      this.locked.enemy = false;
      this.render('player');
      this.render('enemy');
      this.refresh();
    },

    handleClick(event) {
      const cell = event.target.closest('.pick-cell');
      const random = event.target.closest('[data-pick-random]');
      const start = event.target.closest('#pick-start');

      // Selama kocokan berjalan, ketukan diabaikan supaya hasilnya adil
      if (this.rolling) {
        return;
      }

      if (cell) {
        this.choose(cell.dataset.side, cell.dataset.key);
      } else if (random) {
        this.roll(random.dataset.pickRandom);
      } else if (start && !start.disabled) {
        this.begin();
      }
    },

    /* Tingkat yang sedang dipakai lawan dari sisi ini (null kalau lawan belum punya bola) */
    tierAgainst(side) {
      const other = side === 'player' ? 'enemy' : 'player';
      const key = this.picks[other];

      return key ? Config.orbs[key].tier : null;
    },

    /* Bola boleh dipilih kalau sisi belum terkunci dan tingkatnya sama dengan lawan */
    allowed(side, key) {
      const tier = this.tierAgainst(side);

      if (this.locked[side]) {
        return false;
      }

      return tier === null || Config.orbs[key].tier === tier;
    },

    /* Pilihan manual: mengetuk bola yang sama lagi membatalkannya */
    choose(side, key) {
      if (!this.allowed(side, key)) {
        return;
      }

      this.select(side, this.picks[side] === key ? null : key, true);
    },

    select(side, key, withSound) {
      this.picks[side] = key;

      // Bola lawan yang tingkatnya tidak cocok lagi ikut dikosongkan, kecuali sudah terkunci
      const other = side === 'player' ? 'enemy' : 'player';

      if (key && this.picks[other] && !this.locked[other]
        && Config.orbs[this.picks[other]].tier !== Config.orbs[key].tier) {
        this.picks[other] = null;
      }

      this.render('player');
      this.render('enemy');

      if (key && withSound) {
        ns.Sfx.play('click');
      }

      this.refresh();
    },

    /* Gambar ulang satu kotak: bola terpilih, bola yang terkunci, dan info */
    render(side) {
      const box = this.boxes[side];
      const key = this.picks[side];
      const orb = key ? Config.orbs[key] : null;

      box.cells.forEach((cell) => {
        const chosen = cell.dataset.key === key;
        const blocked = !chosen && !this.allowed(side, cell.dataset.key);

        cell.classList.remove('is-hot');
        cell.classList.toggle('is-picked', chosen);
        cell.classList.toggle('is-dim', Boolean(key) && !chosen && !blocked);
        cell.classList.toggle('is-blocked', blocked);
        cell.disabled = blocked || (this.locked[side] && !chosen);
        cell.setAttribute('aria-checked', String(chosen));
      });

      box.root.classList.toggle('is-locked', Boolean(orb));
      box.root.classList.toggle('is-fixed', this.locked[side]);
      box.root.style.setProperty('--orb', orb ? orb.palette.main : '');
      if (this.rolling === side) {
        box.state.textContent = 'Mengacak';
      } else if (this.locked[side]) {
        box.state.textContent = 'Terkunci (hasil acak)';
      } else {
        box.state.textContent = orb ? 'Terpilih' : 'Belum dipilih';
      }

      box.random.disabled = this.locked[side] || Boolean(this.rolling);

      if (orb) {
        box.name.textContent = orb.name;
        box.stats.textContent = '';
        box.stats.appendChild(this.chip('HP ' + (orb.hp || Config.orb.maxHp), orb.tier === 2 ? 'is-special' : ''));
        box.stats.appendChild(this.chip(orb.tier === 2 ? 'Spesial' : 'Biasa', ''));
        box.desc.textContent = orb.hint;
      } else {
        const tier = this.tierAgainst(side);

        box.name.textContent = side === 'player' ? 'Pilih bola kamu' : 'Pilih bola bot';
        box.stats.textContent = '';
        box.desc.textContent = tier
          ? 'Lawan memakai bola ' + (tier === 2 ? 'spesial' : 'biasa') + ', jadi kamu juga harus memilih dari kotak itu.'
          : 'Ketuk salah satu bola di atas.';
      }
    },

    chip(text, extra) {
      const chip = document.createElement('span');

      chip.className = 'pick-chip ' + extra;
      chip.textContent = text;

      return chip;
    },

    refresh() {
      const ready = Boolean(this.picks.player && this.picks.enemy);

      this.start.disabled = !ready || Boolean(this.rolling);
      this.title.textContent = ready ? 'Siap bertanding!' : 'Pilih bola';
      this.note.textContent = ready
        ? 'Tekan Mulai, atau ganti bola dulu kalau mau.'
        : 'Pilih bola untuk kamu dan untuk bot, atau pakai Acak Bola. Kedua sisi harus satu tingkat, dan hasil acak tidak bisa diganti.';
    },

    /* Kursor melompat acak makin lambat, lalu terkunci di hasil acak */
    roll(side) {
      if (this.locked[side] || this.rolling) {
        return;
      }

      const box = this.boxes[side];
      const tier = randomTier(this.tierAgainst(side));
      const target = pick(Config.tiers[tier - 1].keys);
      const keys = Config.orbOrder.filter((key) => this.tierOk(side, key, tier));
      const total = ROLL_SECONDS * 1000;
      const begin = performance.now();

      // Mengacak menghapus pilihan manual sebelumnya
      this.picks[side] = null;
      this.rolling = side;

      const finish = () => {
        this.rolling = null;
        this.locked[side] = true;
        box.root.classList.remove('is-rolling');
        this.select(side, target, false);
        ns.Sfx.play('start');
      };

      if (reducedMotion()) {
        finish();

        return;
      }

      box.root.classList.add('is-rolling');
      this.render('player');
      this.render('enemy');
      this.refresh();

      const tick = () => {
        const elapsed = performance.now() - begin;
        const progress = Math.min(1, elapsed / total);

        if (progress >= 1) {
          finish();

          return;
        }

        const delay = FAST_DELAY + Math.pow(progress, 2) * (SLOW_DELAY - FAST_DELAY);
        const hot = pick(keys);

        box.cells.forEach(function (cell) {
          cell.classList.toggle('is-hot', cell.dataset.key === hot);
        });

        ns.Sfx.play('click');
        this.timers.push(window.setTimeout(tick, delay));
      };

      tick();
    },

    /* Dipakai saat mengacak: apakah bola ini boleh keluar untuk tingkat yang sudah ditentukan */
    tierOk(side, key, tier) {
      return Config.orbs[key].tier === tier;
    },

    stopRoll() {
      this.timers.forEach(function (timer) {
        window.clearTimeout(timer);
      });

      this.timers = [];
      this.rolling = null;

      Object.keys(this.boxes).forEach((side) => {
        this.boxes[side].root.classList.remove('is-rolling');
      });
    },

    begin() {
      const done = this.onDone;
      const player = this.picks.player;
      const enemy = this.picks.enemy;

      this.cancel();

      if (done && player && enemy) {
        done(player, enemy);
      }
    },

    cancel() {
      this.stopRoll();
      this.onDone = null;
    }
  };

  ns.Picker = Picker;
})(window.OrbitArena = window.OrbitArena || {});
