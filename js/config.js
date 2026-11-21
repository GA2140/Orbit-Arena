(function (ns) {
  'use strict';

  /*
   * Konfigurasi Orbit Arena.
   * Semua angka gameplay ada di sini supaya mudah diubah.
   */
  ns.Config = {
    storageKeys: {
      users: 'orbit_users',
      session: 'orbit_session',
      progress: 'orbit_progress_',
      campaign: 'orbit_campaign_',
      settings: 'orbit_settings_'
    },

    pages: {
      home: 'index.html',
      login: 'login.html',
      register: 'register.html'
    },

    auth: {
      usernameMin: 3,
      usernameMax: 16,
      passwordMin: 4
    },

    /* Peta berbentuk persegi panjang 3:2. Satuan: piksel dunia game. */
    arena: {
      width: 960,
      height: 640
    },

    match: {
      duration: 80,
      /* Kecepatan permainan (1 = normal). Makin kecil makin santai. */
      speed: 0.82,
      countdown: 3,
      endDelay: 1.4
    },

    progress: {
      historyLimit: 10
    },

    /*
     * Warna tim hanya dipakai untuk cincin penanda, HP bar, dan nama.
     * Warna tiap bola mengikuti planetnya (lihat palette di Config.orbs).
     */
    colors: {
      player: {
        main: '#10b9a6',
        light: '#c9f5ee',
        dark: '#0a6f63'
      },
      enemy: {
        main: '#f2457a',
        light: '#ffd3e1',
        dark: '#a3194a'
      },
      gold: '#f5b301',
      line: '#9fc0c3',
      ink: '#10252a'
    },

    orb: {
      radius: 30,
      maxHp: 100,
      speed: 290,
      acceleration: 10
    },

    /*
     * Setiap bola hanya punya SATU senjata (kind). Tambah bola baru
     * cukup dengan menambah satu entri di sini, lalu tulis perilaku
     * senjatanya di Match (game.js) dan cara menggambarnya di skins.js
     * dan render.js.
     *
     * tier 1 = bola biasa (HP 100). tier 2 = bola spesial (HP 200, lebih besar).
     * palette = warna planet (dipakai skin, peluru, dan efek senjatanya).
     * botRange adalah jarak favorit bot saat memakai bola ini.
     */
    tiers: [
      {
        id: 1,
        label: 'Bola Biasa',
        keys: ['laser', 'burst', 'bomb', 'bounce']
      },
      {
        id: 2,
        label: 'Bola Spesial',
        note: 'HP 200',
        keys: ['blackhole', 'beam', 'thunder']
      }
    ],

    orbOrder: ['laser', 'burst', 'bomb', 'bounce', 'blackhole', 'beam', 'thunder'],

    /* Bola awal Campaign: satu peluru biasa. Tidak ikut mode Main biasa. */
    starterOrb: 'pistol',

    // Peluang tombol Acak Bola mengambil dari kotak spesial
    randomSpecialChance: 0.25,

    orbs: {
      pistol: {
        kind: 'pistol',
        tier: 1,
        starter: true,
        name: 'Lunara (Peluru)',
        short: 'Peluru',
        planet: 'Lunara',
        palette: { main: '#8a94b8', light: '#e4e9f7', dark: '#3d4670', accent: '#ffd23f' },
        hint: 'Bulan perak berkawah. Menembakkan satu peluru lurus, ringan dan cepat diisi ulang.',
        damage: 11,
        cooldown: 0.45,
        speed: 620,
        radius: 7,
        recoil: 18,
        botRange: 300
      },

      laser: {
        kind: 'laser',
        tier: 1,
        name: 'Aqualis (Laser)',
        short: 'Laser',
        planet: 'Aqualis',
        palette: { main: '#2f8cff', light: '#c4e1ff', dark: '#1450b8', accent: '#6fe8ff' },
        hint: 'Planet samudra. Mengisi sebentar lalu menembak sinar lurus. Satu kena, damage besar.',
        damage: 33,
        cooldown: 1.55,
        chargeTime: 0.5,
        fireTime: 0.25,
        width: 38,
        chargeSlow: 0.45,
        botRange: 320
      },
      burst: {
        kind: 'burst',
        tier: 1,
        name: 'Ignara (Beruntun)',
        short: 'Beruntun',
        planet: 'Ignara',
        palette: { main: '#ff5a5f', light: '#ffd0cc', dark: '#a31e2c', accent: '#ffe0a3' },
        hint: 'Planet merah berkawah dengan 5 bulan. Menembak 5 peluru beruntun, sulit dihindari semua.',
        damage: 4,
        count: 5,
        interval: 0.08,
        cooldown: 1.1,
        speed: 720,
        radius: 7,
        spread: 0.07,
        recoil: 14,
        botRange: 230
      },
      bomb: {
        kind: 'bomb',
        tier: 1,
        name: 'Magmora (Bom)',
        short: 'Bom',
        planet: 'Magmora',
        special: true,
        palette: { main: '#ff9a1f', light: '#ffe3a6', dark: '#8a3a05', accent: '#ffd23f' },
        hint: 'Planet lava. Bom meledak di titik bidik dan melukai semua yang ada di area ledakan.',
        damage: 22,
        splash: 92,
        cooldown: 1.65,
        speed: 360,
        radius: 12,
        minRange: 110,
        maxRange: 640,
        recoil: 60,
        botRange: 370
      },
      bounce: {
        kind: 'bounce',
        tier: 1,
        name: 'Jadis (Pantul)',
        short: 'Pantul',
        planet: 'Jadis',
        special: true,
        palette: { main: '#27c47d', light: '#c9f5dd', dark: '#0f6b44', accent: '#b6ff5e' },
        hint: 'Planet giok bercincin. Peluru memantul di dinding sampai 3 kali, bisa ditembak lewat pantulan.',
        damage: 12,
        cooldown: 0.7,
        speed: 550,
        radius: 8,
        bounces: 3,
        recoil: 30,
        botRange: 280
      },

      /* ---------- Tingkat 2: HP 200, lebih besar, skill menyeramkan ---------- */

      blackhole: {
        kind: 'blackhole',
        tier: 2,
        name: 'Umbra (Lubang Hitam)',
        short: 'Lubang Hitam',
        planet: 'Umbra',
        hp: 200,
        bodyRadius: 36,
        palette: { main: '#7a45f0', light: '#d8c6ff', dark: '#1a0b3d', accent: '#ff4fd8' },
        hint: 'Membuka lubang hitam yang menyedot lawan dan peluru, menggerus HP di inti, lalu runtuh meledak.',
        damage: 32,
        tick: 12,
        cooldown: 5,
        speed: 330,
        shotRadius: 14,
        minRange: 120,
        maxRange: 560,
        pullRadius: 210,
        coreRadius: 72,
        pullSpeed: 190,
        life: 3.4,
        collapseRadius: 135,
        recoil: 40,
        botRange: 380
      },
      beam: {
        kind: 'beam',
        tier: 2,
        name: 'Nova (Sinar Penghancur)',
        short: 'Penghancur',
        planet: 'Nova',
        hp: 200,
        bodyRadius: 36,
        palette: { main: '#ff3d9a', light: '#ffc9e3', dark: '#9c0f5c', accent: '#ffe27a' },
        hint: 'Tahan klik untuk mengisi tenaga, lepas jadi tiga sinar raksasa ke tiga arah. Makin lama diisi makin sakit.',
        minDamage: 30,
        maxDamage: 86,
        minCharge: 0.5,
        maxCharge: 1.7,
        fireTime: 0.55,
        minWidth: 38,
        maxWidth: 78,
        chargeSlow: 0.35,
        knockback: 620,
        fan: 0.4,
        cooldown: 7,
        botRange: 330
      },
      thunder: {
        kind: 'thunder',
        tier: 2,
        name: 'Tempestra (Awan Petir)',
        short: 'Awan Petir',
        planet: 'Tempestra',
        hp: 200,
        bodyRadius: 36,
        palette: { main: '#4a56e2', light: '#c3c8ff', dark: '#1b2178', accent: '#ffe14d' },
        hint: 'Memanggil awan badai raksasa. Setelah peringatan sesaat, petir menyambar seluruh area dengan damage besar.',
        damage: 46,
        minDamage: 28,
        afterDamage: 12,
        afterCount: 2,
        afterGap: 0.35,
        cloudRadius: 190,
        delay: 0.8,
        cooldown: 5,
        castRange: 600,
        recoil: 20,
        botRange: 420
      }
    },

    /* Bantuan bidik saat Lock Aim aktif (0 = tanpa prediksi, 1 = penuh) */
    lock: {
      assist: 0.85
    },

    /*
     * Mode Campaign. Kamu mulai dengan bola Lunara (satu peluru). Tiap bos
     * yang dikalahkan menyerahkan bolanya, dan bola yang sudah terbuka boleh
     * dipakai di stage berikutnya. Stage tingkat 2 dijaga dua pengawal kecil,
     * jadi HP kamu dinaikkan (playerHp) supaya tetap adil.
     *
     *   boss        kunci bola bos (dan bola hadiahnya)
     *   bossHp      HP bos; playerHp HP kamu (null = bawaan bola)
     *   theme       nama tema arena (js/arenas.js)
     *   difficulty  kesulitan bot bos
     *   guards      kunci bola pengawal (hanya tingkat 2)
     *   before      dialog sebelum bertarung  [{ who, text }]
     *   after       dialog setelah menang
     */
    campaign: {
      guardRadius: 22,
      guardHp: 30,
      guardDifficulty: 'easy',
      starStrong: 0.75,
      starOkay: 0.4,
      stages: [
        {
          id: 1,
          bossHp: 70,
          playerHp: null,
          boss: 'laser',
          theme: 'laser',
          title: 'Samudra Aqualis',
          bossName: 'Kapten Biru',
          difficulty: 'easy',
          before: [
            { who: 'Narator', text: 'Bulan kecil bernama Lunara mengembara ke Turnamen Orbit. Aturannya sederhana: kalahkan penjaga sebuah planet dan rebut bolanya.' },
            { who: 'Kapten Biru', text: 'Lautku tidak pernah dilewati tanpa izin. Tunjukkan kalau peluru kecilmu cukup tajam!' }
          ],
          after: [
            { who: 'Kapten Biru', text: 'Hebat. Bidikanmu lebih tajam dari ombakku. Bawalah laserku.' }
          ]
        },
        {
          id: 2,
          bossHp: 80,
          playerHp: null,
          boss: 'burst',
          theme: 'burst',
          title: 'Kawah Ignara',
          bossName: 'Jenderal Debu',
          difficulty: 'easy',
          before: [
            { who: 'Narator', text: 'Di balik lautan terbentang gurun merah penuh kawah. Tembakan beruntun menggema dari segala arah.' },
            { who: 'Jenderal Debu', text: 'Satu peluru tidak akan menembus badaiku. Coba bertahan sampai magasinku habis!' }
          ],
          after: [
            { who: 'Jenderal Debu', text: 'Kamu bergerak seperti bayangan. Ambil senapan beruntunku.' }
          ]
        },
        {
          id: 3,
          bossHp: 90,
          playerHp: null,
          boss: 'bomb',
          theme: 'bomb',
          title: 'Sungai Lava Magmora',
          bossName: 'Raja Magma',
          difficulty: 'normal',
          before: [
            { who: 'Narator', text: 'Tanah retak dan lava mengalir di antara batu hitam. Setiap langkah terasa panas.' },
            { who: 'Raja Magma', text: 'Bomku meledak di mana pun kamu berdiri. Lari saja kalau bisa!' }
          ],
          after: [
            { who: 'Raja Magma', text: 'Kamu menembus panasku... Bomku jadi milikmu sekarang.' }
          ]
        },
        {
          id: 4,
          bossHp: 100,
          playerHp: null,
          boss: 'bounce',
          theme: 'bounce',
          title: 'Kolam Giok Jadis',
          bossName: 'Nyonya Giok',
          difficulty: 'normal',
          before: [
            { who: 'Narator', text: 'Kolam giok yang tenang berubah menjadi arena pantulan. Peluru melesat dari dinding ke dinding.' },
            { who: 'Nyonya Giok', text: 'Pelurunya memantul, tapi pikiranmu tidak. Mari kita lihat siapa yang lebih lentur.' }
          ],
          after: [
            { who: 'Nyonya Giok', text: 'Cerdik sekali. Pantulan ini sekarang milikmu. Tingkat berikutnya jauh lebih berat.' }
          ]
        },
        {
          id: 5,
          bossHp: 100,
          playerHp: 220,
          boss: 'blackhole',
          theme: 'blackhole',
          title: 'Pusaran Umbra',
          bossName: 'Sang Hampa',
          difficulty: 'normal',
          guards: ['pistol', 'bounce'],
          before: [
            { who: 'Narator', text: 'Cahaya bintang memudar. Di tengah arena, lubang hitam berputar dan menyedot semua yang mendekat.' },
            { who: 'Sang Hampa', text: 'Aku ditemani dua pengawal. Lawanlah mereka di dalam gelapku, kalau kamu berani.' }
          ],
          after: [
            { who: 'Sang Hampa', text: 'Gelapku... ditembus cahaya kecil. Lubang hitam ini sekarang bolamu.' }
          ]
        },
        {
          id: 6,
          bossHp: 110,
          playerHp: 220,
          boss: 'beam',
          theme: 'beam',
          title: 'Nebula Nova',
          bossName: 'Ratu Supernova',
          difficulty: 'normal',
          guards: ['burst', 'laser'],
          before: [
            { who: 'Narator', text: 'Sebuah bintang meledak dan menyebarkan nebula merah muda. Gelombang kejutnya masih bergulir.' },
            { who: 'Ratu Supernova', text: 'Tiga sinarku menyapu seluruh arena. Pengawalku akan menahanmu di tempat!' }
          ],
          after: [
            { who: 'Ratu Supernova', text: 'Sinarku padam oleh peluru bulan kecil... Sinar Penghancur kuserahkan padamu.' }
          ]
        },
        {
          id: 7,
          bossHp: 120,
          playerHp: 240,
          boss: 'thunder',
          theme: 'thunder',
          title: 'Langit Badai Tempestra',
          bossName: 'Dewa Petir',
          difficulty: 'hard',
          guards: ['bomb', 'laser'],
          before: [
            { who: 'Narator', text: 'Awan hitam menutup langit. Hujan deras jatuh dan kilat menyambar dari segala arah. Inilah penjaga terakhir.' },
            { who: 'Dewa Petir', text: 'Banyak yang datang, tak ada yang pulang. Kuhujani kamu dengan petir!' }
          ],
          after: [
            { who: 'Dewa Petir', text: 'Badaiku reda... Kamu layak menyandang semua bola. Juara Turnamen Orbit adalah kamu!' }
          ]
        }
      ]
    },

    /*
     * Tingkat kesulitan bot.
     * aimError: sebaran meleset (radian). fireDelay: jeda bot setelah senjata siap.
     * dodge: peluang bot mencoba menghindar. reaction: waktu bot baru bereaksi.
     * dodgeCooldown: jeda minimal antar dua kali menghindar.
     * lead: seberapa jauh bot memprediksi gerakan pemain.
     */
    difficulties: {
      easy: {
        label: 'Mudah',
        hint: 'Bot menembak pelan, sering meleset, dan jarang menghindar.',
        aimError: 0.5,
        fireDelay: 1.1,
        moveScale: 0.5,
        dodge: 0.07,
        reaction: 0.45,
        dodgeCooldown: 2,
        lead: 0
      },
      normal: {
        label: 'Normal',
        hint: 'Bot membidik cukup akurat dan kadang menghindari tembakanmu.',
        aimError: 0.42,
        fireDelay: 0.75,
        moveScale: 0.6,
        dodge: 0.13,
        reaction: 0.36,
        dodgeCooldown: 1.7,
        lead: 0.1
      },
      hard: {
        label: 'Sulit',
        hint: 'Bot sedikit lebih tajam dari Normal, tapi tetap mudah dikalahkan kalau kamu terus bergerak.',
        aimError: 0.36,
        fireDelay: 0.6,
        moveScale: 0.66,
        dodge: 0.18,
        reaction: 0.32,
        dodgeCooldown: 1.5,
        lead: 0.15
      }
    },

    defaults: {
      sound: true,
      musicVolume: 100,
      sfxVolume: 100,
      difficulty: 'normal',
      control: 'keyboard',
      orb: 'laser'
    },

    controls: ['keyboard', 'touch'],

    /*
     * Pemetaan tombol per pemain. Mode dua pemain lokal nanti
     * cukup menambahkan keymap p2 dan PlayerController kedua.
     */
    keymaps: {
      p1: {
        up: ['KeyW', 'ArrowUp'],
        down: ['KeyS', 'ArrowDown'],
        left: ['KeyA', 'ArrowLeft'],
        right: ['KeyD', 'ArrowRight'],
        fire: ['Space'],
        lock: ['KeyE']
      }
    }
  };

  /* Fungsi bantu yang dipakai bersama oleh beberapa modul. */
  ns.Util = {
    clamp: function (value, min, max) {
      return Math.max(min, Math.min(max, value));
    },

    rand: function (min, max) {
      return min + Math.random() * (max - min);
    },

    easeOut: function (t) {
      return 1 - Math.pow(1 - t, 3);
    },

    reducedMotion: function () {
      try {
        return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      } catch (error) {
        return false;
      }
    }
  };
})(window.OrbitArena = window.OrbitArena || {});
