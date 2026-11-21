(function (ns) {
  'use strict';

  const Config = ns.Config;
  const Storage = ns.Storage;
  const Statistics = ns.Statistics;

  const RESULT_TITLES = {
    win: 'Menang',
    loss: 'Kalah',
    draw: 'Seri'
  };

  const RESULT_REASONS = {
    'win-ko': 'HP lawan habis',
    'loss-ko': 'HP kamu habis',
    'draw-ko': 'Kalian tumbang bersamaan',
    'win-time': 'Waktu habis, HP kamu lebih tinggi',
    'loss-time': 'Waktu habis, HP lawan lebih tinggi',
    'draw-time': 'Waktu habis, HP sama kuat'
  };

  function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = String(value);
    }
  }

  const Menu = {
    user: null,
    settings: null,
    progress: null,
    lastDifficulty: null,
    lastPicks: null,
    statusTimer: 0,

    init(user) {
      this.user = user;
      this.settings = Storage.getSettings(user.id);
      this.progress = Storage.getProgress(user.id);
      this.screens = Array.from(document.querySelectorAll('[data-screen]'));

      ns.Sfx.setMusicVolume(this.settings.musicVolume);
      ns.Sfx.setSfxVolume(this.settings.sfxVolume);
      ns.Sfx.enabled = this.settings.sound;
      ns.GameScreen.init();
      ns.Picker.init();
      ns.Campaign.init(this);
      ns.Skins.startPreviews();

      this.splitTitle();
      document.addEventListener('click', (event) => this.handleClick(event));

      // Slider volume di Pengaturan: berlaku langsung, disimpan saat dilepas
      document.querySelectorAll('[data-volume]').forEach((slider) => {
        slider.addEventListener('input', () => this.setVolume(slider.dataset.volume, Number(slider.value), false));
        slider.addEventListener('change', () => this.setVolume(slider.dataset.volume, Number(slider.value), true));
      });

      // Tombol lobi berbunyi kecil saat disorot kursor
      document.querySelectorAll('.lobby-btn').forEach(function (button) {
        button.addEventListener('pointerenter', function (event) {
          if (event.pointerType === 'mouse') {
            ns.Sfx.play('hover');
          }
        });
      });

      this.renderPlayer();
      this.renderSettings();
      this.show('menu');
    },

    /* Judul dipecah per huruf supaya tiap huruf bisa melompat saat disentuh */
    splitTitle() {
      const title = document.querySelector('.lobby-title');
      let index = 0;

      if (!title || title.dataset.split) {
        return;
      }

      title.dataset.split = 'true';
      title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());

      title.querySelectorAll('span').forEach(function (word) {
        const letters = word.textContent.split('');

        word.textContent = '';
        word.setAttribute('aria-hidden', 'true');

        letters.forEach(function (letter) {
          const node = document.createElement('i');

          node.className = 'ch';
          node.textContent = letter;
          node.style.setProperty('--i', index);
          index += 1;
          word.appendChild(node);
        });
      });

      title.addEventListener('pointerover', function (event) {
        const letter = event.target.closest ? event.target.closest('.ch') : null;

        if (letter && !letter.classList.contains('is-jump')) {
          letter.classList.add('is-jump');
          ns.Sfx.play('tick');
          window.setTimeout(function () {
            letter.classList.remove('is-jump');
          }, 520);
        }
      });
    },

    /* ---------- Navigasi ---------- */

    show(name) {
      if (name !== 'game' && ns.GameScreen.active) {
        ns.GameScreen.stop();
      }

      if (name !== 'pick') {
        ns.Picker.cancel();
      }

      if (name !== 'loading') {
        ns.Loading.cancel();
      }

      ns.Fx.stop();

      // Poster latar: besar di menu, ornamen di sekeliling kotak pada layar lain
      if (ns.Backdrop) {
        ns.Backdrop.setScene(name, name === 'result' ? this.resultTone : '');
      }

      this.closePlayerMenu();

      // Musik: trek pertandingan hanya saat bermain, trek menu di layar lain
      ns.Sfx.music(name === 'game' ? 'battle' : 'menu');

      this.screens.forEach(function (screen) {
        screen.hidden = screen.dataset.screen !== name;
      });

      if (name === 'menu') {
        this.renderMenu();
      } else if (name === 'stats') {
        Statistics.renderScreen(this.progress);
        ns.Fx.playStats(this.progress);
      } else if (name === 'mode' || name === 'settings') {
        this.renderSettings();
      } else if (name === 'campaign') {
        ns.Campaign.renderMap();
      }

      if (name === 'settings') {
        this.cancelReset();
      }

      window.scrollTo(0, 0);

      const target = document.querySelector('[data-screen="' + name + '"] [data-focus]');

      if (target) {
        target.focus({ preventScroll: true });
      }
    },

    handleClick(event) {
      if (!event.target.closest('.player-menu')) {
        this.closePlayerMenu();
      }

      const element = event.target.closest('[data-goto], [data-action]');

      if (!element || element.disabled) {
        return;
      }

      ns.Sfx.unlock();
      ns.Sfx.play('click');

      if (element.dataset.goto) {
        this.show(element.dataset.goto);
        return;
      }

      const action = element.dataset.action;
      const value = element.dataset.value;

      switch (action) {
        case 'play':
        case 'start-match':
          this.startMatch(this.settings.difficulty);
          break;
        case 'rematch':
          this.startMatch(this.lastDifficulty || this.settings.difficulty);
          break;
        case 'camp-stage':
          ns.Campaign.openStage(value, false);
          break;
        case 'story-next':
          ns.Campaign.next();
          break;
        case 'camp-pick':
          ns.Campaign.choose(value);
          break;
        case 'camp-start':
          ns.Campaign.start();
          break;
        case 'camp-retry':
          ns.Campaign.retry();
          break;
        case 'camp-continue':
          ns.Campaign.continueAfterWin();
          break;
        case 'camp-reset':
          ns.Campaign.askReset();
          break;
        case 'filter-history':
          Statistics.filterHistory(value);
          break;
        case 'toggle-player':
          this.togglePlayerMenu();
          break;
        case 'logout':
          this.logout();
          break;
        case 'set-difficulty':
          this.setDifficulty(value);
          break;
        case 'set-control':
          this.setControl(value);
          break;
        case 'toggle-sound':
          this.toggleSound();
          break;
        case 'reset-ask':
          this.askReset();
          break;
        case 'reset-confirm':
          this.confirmReset();
          break;
        case 'reset-cancel':
          this.cancelReset();
          break;
        default:
          break;
      }
    },

    /* ---------- Pertandingan ---------- */

    /* Pilih bola dulu (manual atau Acak Bola), baru pertandingan dimulai lewat tombol Mulai */
    startMatch(difficulty) {
      this.lastDifficulty = difficulty;
      this.show('pick');

      ns.Picker.open((playerOrb, enemyOrb) => {
        this.lastPicks = { player: playerOrb, enemy: enemyOrb };
        this.showLoading(difficulty, playerOrb, enemyOrb);
      }, this.lastPicks);
    },

    /* Layar memuat singkat, lalu pertandingan dimulai */
    showLoading(difficulty, playerOrb, enemyOrb) {
      this.show('loading');

      ns.Loading.run([playerOrb, enemyOrb], () => this.beginMatch(difficulty, playerOrb, enemyOrb));
    },

    /* Campaign: loading singkat, lalu pertandingan dengan stage tertentu */
    startCampaignRun(stage, playerOrb) {
      this.lastDifficulty = stage.difficulty;
      this.show('loading');

      ns.Loading.run([playerOrb, stage.boss], () => {
        this.show('game');

        ns.GameScreen.start({
          playerName: this.user.username,
          difficulty: stage.difficulty,
          orb: playerOrb,
          enemyOrb: stage.boss,
          stage: stage,
          settings: this.settings,
          onFinish: (result) => this.finishMatch(result),
          onQuit: () => this.show('campaign')
        });
      });
    },

    togglePlayerMenu() {
      const pop = document.getElementById('player-pop');

      this.setPlayerMenu(pop.hidden);
    },

    closePlayerMenu() {
      this.setPlayerMenu(false);
    },

    setPlayerMenu(open) {
      const pop = document.getElementById('player-pop');
      const button = document.querySelector('[data-action="toggle-player"]');

      pop.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
    },

    beginMatch(difficulty, playerOrb, enemyOrb) {
      this.show('game');

      ns.GameScreen.start({
        playerName: this.user.username,
        difficulty: difficulty,
        orb: playerOrb,
        enemyOrb: enemyOrb,
        settings: this.settings,
        onFinish: (result) => this.finishMatch(result),
        onQuit: () => this.show('menu')
      });
    },

    finishMatch(result) {
      this.progress = Statistics.record(this.user.id, result);

      if (result.stageId) {
        ns.Campaign.onResult(result);
      } else {
        ns.Campaign.configureResult(false);
      }

      this.renderResult(result);
      this.resultTone = result.outcome === 'win' ? 'win' : (result.outcome === 'loss' ? 'loss' : '');
      this.show('result');
      ns.Fx.playResult(result);
    },

    logout() {
      ns.GameScreen.stop();
      ns.Auth.logout();
      ns.Auth.redirect('login');
    },

    /* ---------- Tampilan ---------- */

    renderPlayer() {
      setText('player-name', this.user.username);
    },

    renderMenu() {
      Statistics.renderSummary(this.progress);
    },

    renderResult(result) {
      const title = document.getElementById('result-title');
      const progress = this.progress;

      title.textContent = RESULT_TITLES[result.outcome];
      title.className = 'result-title is-' + result.outcome;

      setText('result-reason', RESULT_REASONS[result.outcome + '-' + result.reason]);
      setText('res-duration', Statistics.formatDuration(result.duration));
      setText('res-hp', result.playerHp + ' / ' + (result.playerMaxHp || Config.orb.maxHp));
      setText('res-damage', result.damageDealt);
      setText('res-accuracy', result.accuracy + '%');
      document.getElementById('result-orb-player').dataset.kind = Config.orbs[result.orb].kind;
      document.getElementById('result-orb-enemy').dataset.kind = Config.orbs[result.enemyOrb].kind;
      setText('result-orb-player-name', Config.orbs[result.orb].name);
      setText('result-orb-enemy-name', Config.orbs[result.enemyOrb].name);
      setText(
        'result-total',
        'Total ' + progress.matches + ' main: ' + progress.wins + ' menang, '
          + progress.losses + ' kalah, ' + progress.draws + ' seri. Winrate '
          + Statistics.winRate(progress) + '%.'
      );
    },

    /* Deretan bola yang bisa keluar saat pengacakan, dibuat dari Config.orbs */
    renderOrbPool() {
      document.querySelectorAll('[data-orb-pool]').forEach(function (pool) {
        if (pool.children.length) {
          return;
        }

        Config.orbOrder.forEach(function (key) {
          const orb = Config.orbs[key];
          const item = document.createElement('div');
          const icon = document.createElement('canvas');
          const name = document.createElement('span');

          item.className = 'pool-item';

          icon.className = 'orb-preview';
          icon.dataset.kind = orb.kind;
          icon.dataset.team = 'player';
          icon.setAttribute('aria-hidden', 'true');

          name.className = 'pool-name';
          name.textContent = orb.short;

          item.appendChild(icon);
          item.appendChild(name);
          pool.appendChild(item);
        });
      });
    },

    renderSettings() {
      const settings = this.settings;
      const level = Config.difficulties[settings.difficulty];

      this.renderOrbPool();

      document.getElementById('sound-switch').setAttribute('aria-checked', String(settings.sound));

      [['music', settings.musicVolume], ['sfx', settings.sfxVolume]].forEach(function (entry) {
        document.getElementById(entry[0] + '-volume').value = entry[1];
        setText(entry[0] + '-volume-value', entry[1] + '%');
      });
      setText('difficulty-hint', level.hint);

      document.querySelectorAll('[data-action="set-difficulty"]').forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.value === settings.difficulty));
      });

      document.querySelectorAll('[data-action="set-control"]').forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.value === settings.control));
      });
    },

    /* ---------- Pengaturan ---------- */

    saveSettings(message) {
      Storage.saveSettings(this.user.id, this.settings);
      this.renderSettings();
      this.showStatus(message);
    },

    setDifficulty(value) {
      if (Config.difficulties[value]) {
        this.settings.difficulty = value;
        this.saveSettings('Kesulitan bot: ' + Config.difficulties[value].label + '.');
      }
    },

    setControl(value) {
      if (Config.controls.indexOf(value) !== -1) {
        this.settings.control = value;
        this.saveSettings(value === 'touch' ? 'Kontrol layar sentuh aktif.' : 'Kontrol keyboard dan mouse aktif.');
      }
    },

    setVolume(which, value, save) {
      const key = which === 'music' ? 'musicVolume' : 'sfxVolume';

      this.settings[key] = value;
      setText(which + '-volume-value', value + '%');

      if (which === 'music') {
        ns.Sfx.setMusicVolume(value);
      } else {
        ns.Sfx.setSfxVolume(value);

        if (save) {
          ns.Sfx.play('click');
        }
      }

      if (save) {
        Storage.saveSettings(this.user.id, this.settings);
      }
    },

    toggleSound() {
      this.settings.sound = !this.settings.sound;
      ns.Sfx.enabled = this.settings.sound;
      this.saveSettings(this.settings.sound ? 'Suara dinyalakan.' : 'Suara dimatikan.');
    },

    showStatus(message) {
      const status = document.getElementById('settings-status');

      status.textContent = message;
      window.clearTimeout(this.statusTimer);
      this.statusTimer = window.setTimeout(function () {
        status.textContent = '';
      }, 2500);
    },

    /* ---------- Reset progres (konfirmasi di dalam halaman) ---------- */

    askReset() {
      document.getElementById('reset-confirm').hidden = false;
      document.getElementById('reset-ask').hidden = true;
    },

    cancelReset() {
      document.getElementById('reset-confirm').hidden = true;
      document.getElementById('reset-ask').hidden = false;
    },

    confirmReset() {
      Storage.resetProgress(this.user.id);
      this.progress = Storage.getProgress(this.user.id);
      this.cancelReset();
      this.showStatus('Progres sudah direset.');
    }
  };

  ns.Menu = Menu;
})(window.OrbitArena = window.OrbitArena || {});
