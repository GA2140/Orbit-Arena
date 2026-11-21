(function (ns) {
  'use strict';

  /*
   * Audio: semua suara berasal dari file rekaman di assets/audio/
   * (tidak ada lagi nada buatan). Sumber dan lisensi ada di
   * assets/audio/CREDITS.txt.
   *
   *   - Efek suara: dimuat sekali lalu diputar lewat Web Audio API.
   *     Satu kejadian bisa terdiri dari beberapa lapis (mis. ledakan =
   *     dentuman + benturan), dengan sedikit variasi nada supaya
   *     tembakan beruntun tidak terdengar sama persis.
   *   - Musik: satu trek untuk menu dan satu untuk pertandingan,
   *     diputar berulang dengan fade antar-layar.
   */
  const SFX_PATH = 'assets/audio/sfx/';
  const MUSIC_PATH = 'assets/audio/music/';

  /* Nama pendek untuk variasi benturan: im('Punch_medium') jadi tiga file bergantian */
  function im(name) {
    return ['im-' + name + '-000', 'im-' + name + '-001', 'im-' + name + '-002'];
  }

  /* Nama pendek untuk variasi rekaman asli: rl('shot') jadi tiga file bergantian */
  function rl(name, count) {
    const list = [];

    for (let index = 1; index <= count; index += 1) {
      list.push('rl-' + name + '-' + index);
    }

    return list;
  }

  /*
   * Setiap kejadian = daftar lapisan. Lapisan:
   *   file    nama file (atau daftar file yang dipilih acak)
   *   vol     volume 0..1
   *   rate    kecepatan putar (1 = asli, makin kecil makin berat)
   *   jitter  variasi acak kecepatan, mis. 0.08 = plus minus 8%
   *   delay   tunda dalam detik
   *
   * Kunci "nama:jenis" dipakai lebih dulu bila jenis senjata diberikan.
   *
   * Berkas rl-* adalah rekaman nyata (petir, meriam, senapan, api, kaca)
   * dan im-* rekaman benturan benda; lihat CREDITS.txt.
   */
  const SOUNDS = {
    // Antarmuka
    click: [{ file: 'ui-click_003', vol: 0.5 }],
    hover: [{ file: 'ui-tick_002', vol: 0.1 }],
    tick: [{ file: 'ui-select_006', vol: 0.55 }],
    start: [
      { file: 'ui-confirmation_003', vol: 0.65 },
      { file: im('Plate_light'), vol: 0.25, rate: 0.9 }
    ],

    // Tembakan, tiap jenis senjata punya suara sendiri
    shoot: [{ file: rl('shot', 3), vol: 0.2, rate: 1.5, jitter: 0.08 }],
    'shoot:laser': [
      { file: rl('shot', 3), vol: 0.3, rate: 1.7, jitter: 0.06 },
      { file: im('Plate_light'), vol: 0.1, rate: 1.6 }
    ],
    'shoot:burst': [{ file: rl('shot', 3), vol: 0.22, rate: 1.35, jitter: 0.1 }],
    'shoot:bomb': [
      { file: 'rl-howitzer', vol: 0.5, rate: 1.2, jitter: 0.05 },
      { file: im('Soft_heavy'), vol: 0.3, rate: 0.9 }
    ],
    'shoot:bounce': [
      { file: im('Plate_light'), vol: 0.35, rate: 1.5, jitter: 0.1 },
      { file: rl('shot', 3), vol: 0.1, rate: 2, jitter: 0.1 }
    ],
    'shoot:blackhole': [{ file: 'rl-suck', vol: 0.4, rate: 1.1 }],

    hit: [
      { file: im('Punch_medium'), vol: 0.55, jitter: 0.1 },
      { file: im('Generic_light'), vol: 0.25, rate: 1.1, jitter: 0.1 }
    ],
    bounce: [{ file: im('Plate_light'), vol: 0.3, rate: 1.3, jitter: 0.12 }],
    explode: [
      { file: rl('boom', 3), vol: 0.75, jitter: 0.05 },
      { file: 'rl-tnt', vol: 0.5, rate: 0.9, jitter: 0.05 }
    ],

    // Laser dan Sinar Penghancur
    laserCharge: [{ file: 'rl-charge', vol: 0.35, rate: 1.6 }],
    'laserCharge:beam': [
      { file: 'rl-charge', vol: 0.55 },
      { file: 'rl-flame', vol: 0.25, rate: 0.9 }
    ],
    laserFire: [
      { file: rl('shot', 3), vol: 0.5, rate: 1.1 },
      { file: 'rl-boom-1', vol: 0.3, rate: 1.4 }
    ],
    'laserFire:beam': [
      { file: 'rl-boom-big', vol: 0.6 },
      { file: 'rl-flame', vol: 0.5, rate: 1.1 },
      { file: 'rl-howitzer', vol: 0.3 }
    ],

    // Bola spesial
    holeOpen: [
      { file: 'rl-suck', vol: 0.6, rate: 0.8 },
      { file: 'rl-storm-gather', vol: 0.3, rate: 0.6 }
    ],
    holeCollapse: [
      { file: 'rl-howitzer', vol: 0.7, rate: 0.55 },
      { file: 'rl-tnt', vol: 0.5, rate: 0.6 },
      { file: 'rl-boom-big', vol: 0.4, rate: 0.7 }
    ],
    stormCast: [{ file: 'rl-storm-gather', vol: 0.85 }],
    thunder: [
      { file: rl('thunder', 3), vol: 0.95 },
      { file: rl('boom', 3), vol: 0.55, rate: 0.65 }
    ],

    // Hasil pertandingan
    win: [{ file: 'rl-fanfare', vol: 0.75 }],
    loss: [{ file: 'rl-lament', vol: 0.75 }],
    draw: [{ file: im('Bell_heavy'), vol: 0.6, rate: 0.8 }],

    // Perayaan menang
    winPop: [{ file: 'rl-tnt', vol: 0.25, rate: 1.8, jitter: 0.15 }],
    winFirework: [
      { file: rl('boom', 3), vol: 0.25, rate: 1.5, jitter: 0.12 },
      { file: 'rl-crackle', vol: 0.2, rate: 1.3 }
    ],
    winSparkle: [
      { file: 'ui-glass_005', vol: 0.3, jitter: 0.1 },
      { file: 'ui-pluck_002', vol: 0.25, rate: 1.3 }
    ],

    // Layar kalah
    defeatThud: [
      { file: 'rl-howitzer', vol: 0.8, rate: 0.5 },
      { file: im('Punch_heavy'), vol: 0.5, rate: 0.6 }
    ],
    defeatCrack: [{ file: rl('glass', 3), vol: 0.7, jitter: 0.1 }],
    defeat: [{ file: 'rl-boom-big', vol: 0.5, rate: 0.5 }],

    // Intro pembuka
    introSweep: [{ file: 'rl-suck', vol: 0.3, rate: 1.2 }],
    introWhoosh: [{ file: 'rl-charge', vol: 0.3, rate: 1.3 }],
    introImpact: [
      { file: 'rl-boom-big', vol: 0.7, rate: 0.9 },
      { file: im('Bell_heavy'), vol: 0.4, rate: 0.7 }
    ],
    introChime: [
      { file: 'ui-bong_001', vol: 0.45 },
      { file: 'ui-glass_002', vol: 0.25 }
    ]
  };

  /* Trek musik: volume akhir dan lama fade (detik) */
  const TRACKS = {
    menu: { file: 'menu.mp3', volume: 0.2, fade: 1.6 },
    battle: { file: 'battle.mp3', volume: 0.16, fade: 1.2 }
  };

  function pickOne(file) {
    return Array.isArray(file) ? file[Math.floor(Math.random() * file.length)] : file;
  }

  /* Semua nama file yang dipakai SOUNDS, untuk dimuat di awal */
  function allFiles() {
    const names = {};

    Object.keys(SOUNDS).forEach(function (key) {
      SOUNDS[key].forEach(function (layer) {
        [].concat(layer.file).forEach(function (name) {
          names[name] = true;
        });
      });
    });

    return Object.keys(names);
  }

  const Sfx = {
    context: null,
    master: null,
    musicLevel: 1,
    sfxLevel: 1,
    buffers: {},
    loading: false,
    flag: true,
    held: false,
    wanted: null,
    track: null,
    audios: {},
    fades: {},

    /* Mati-hidupkan suara dari pengaturan: ikut menghentikan atau melanjutkan musik */
    get enabled() {
      return this.flag;
    },

    set enabled(value) {
      this.flag = Boolean(value);
      this.syncMusic();
    },

    /* Harus dipanggil dari gestur pengguna (klik/ketuk) */
    unlock() {
      if (this.context) {
        if (this.context.state === 'suspended') {
          this.context.resume();
        }
      } else {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;

        if (AudioContextClass) {
          try {
            this.context = new AudioContextClass();
            this.master = this.context.createGain();
            this.master.gain.value = 0.9 * this.sfxLevel;
            this.master.connect(this.context.destination);
          } catch (error) {
            this.context = null;
          }
        }
      }

      this.load();
      this.syncMusic();
    },

    /* Muat dan urai semua file efek sekali saja */
    load() {
      if (this.loading || !this.context) {
        return;
      }

      this.loading = true;

      allFiles().forEach((name) => {
        fetch(SFX_PATH + name + '.mp3')
          .then(function (response) {
            return response.arrayBuffer();
          })
          .then((data) => new Promise((resolve, reject) => {
            this.context.decodeAudioData(data, resolve, reject);
          }))
          .then((buffer) => {
            this.buffers[name] = buffer;
          })
          .catch(function () {
            // File gagal dimuat: kejadian itu hanya diam, game tetap jalan
          });
      });
    },

    layer(layer, volume, rate, delay) {
      const buffer = this.buffers[pickOne(layer.file)];

      if (!buffer) {
        return;
      }

      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      const jitter = layer.jitter ? 1 + (Math.random() * 2 - 1) * layer.jitter : 1;

      source.buffer = buffer;
      source.playbackRate.value = (layer.rate || 1) * rate * jitter;
      gain.gain.value = layer.vol * volume;

      source.connect(gain);
      gain.connect(this.master);
      source.start(this.context.currentTime + (layer.delay || 0) + delay);
    },

    /*
     * name  nama kejadian, mis. 'hit' atau 'explode'
     * opts  kind (jenis senjata), vol (pengali volume), rate (pengali nada)
     */
    play(name, opts) {
      if (!this.flag || !this.context || this.context.state !== 'running') {
        return;
      }

      const options = opts || {};
      const layers = SOUNDS[name + ':' + options.kind] || SOUNDS[name];

      if (!layers) {
        return;
      }

      layers.forEach((layer) => {
        this.layer(layer, options.vol || 1, options.rate || 1, 0);
      });
    },

    /* ---------- Musik ---------- */

    /* Tahan musik selama intro tampil, lepas setelahnya */
    hold(value) {
      this.held = Boolean(value);
      this.syncMusic();
    },

    /* Volume musik dan efek dari pengaturan, 0 sampai 100 */
    setMusicVolume(percent) {
      this.musicLevel = Math.max(0, Math.min(100, percent)) / 100;

      // Berlaku langsung pada trek yang sedang terdengar, tanpa menunggu fade
      Object.keys(this.audios).forEach((name) => {
        if (this.wanted === name && !this.audios[name].paused) {
          window.clearInterval(this.fades[name]);
          this.audios[name].volume = TRACKS[name].volume * this.musicLevel;
        }
      });

      this.syncMusic();
    },

    setSfxVolume(percent) {
      this.sfxLevel = Math.max(0, Math.min(100, percent)) / 100;

      if (this.master) {
        this.master.gain.value = 0.9 * this.sfxLevel;
      }
    },

    /* Pilih trek untuk layar sekarang. null = tanpa musik. */
    music(name) {
      this.wanted = name && TRACKS[name] ? name : null;
      this.syncMusic();
    },

    audioFor(name) {
      if (!this.audios[name]) {
        const audio = new Audio(MUSIC_PATH + TRACKS[name].file);

        audio.loop = true;
        audio.preload = 'auto';
        audio.volume = 0;
        this.audios[name] = audio;
      }

      return this.audios[name];
    },

    /* Samakan keadaan semua trek dengan keinginan: trek terpilih naik, yang lain turun */
    syncMusic() {
      const active = this.flag && !this.held && this.context && this.context.state === 'running';

      Object.keys(TRACKS).forEach((name) => {
        const shouldPlay = Boolean(active) && this.wanted === name;

        if (shouldPlay) {
          this.fadeTo(name, TRACKS[name].volume * this.musicLevel);
        } else if (this.audios[name]) {
          this.fadeTo(name, 0);
        }
      });
    },

    fadeTo(name, target) {
      const audio = this.audioFor(name);
      const track = TRACKS[name];

      window.clearInterval(this.fades[name]);

      if (target > 0 && audio.paused) {
        const attempt = audio.play();

        if (attempt && attempt.catch) {
          attempt.catch(function () {
            // Browser belum mengizinkan; dicoba lagi pada gestur berikutnya
          });
        }
      }

      const step = 50;
      const delta = (track.volume / (track.fade * 1000)) * step;

      this.fades[name] = window.setInterval(() => {
        const next = audio.volume + (target > audio.volume ? delta : -delta);

        if ((target > audio.volume && next >= target) || (target < audio.volume && next <= target)) {
          audio.volume = target;
          window.clearInterval(this.fades[name]);

          if (target === 0) {
            audio.pause();
          }
        } else {
          audio.volume = Math.max(0, Math.min(1, next));
        }
      }, step);
    }
  };

  ns.Sfx = Sfx;
})(window.OrbitArena = window.OrbitArena || {});
