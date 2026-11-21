(function (ns) {
  'use strict';

  const Config = ns.Config;
  const Storage = ns.Storage;
  const STAGES = Config.campaign.stages;
  const TYPE_DELAY = 16;

  /*
   * Campaign: peta stage, dialog cerita, pilih bola, dan progres.
   *
   * Alur satu stage:
   *   peta -> cerita sebelum (dialog) -> pilih bola yang sudah terbuka
   *        -> pertarungan -> hasil -> (menang pertama kali) cerita sesudah
   *        + bola bos terbuka -> peta
   *
   * Bola terbuka = bola awal + bola dari bos yang sudah dikalahkan.
   * Pertandingan dijalankan lewat Menu (Loading, GameScreen, hasil).
   */

  function byId(id) {
    return document.getElementById(id);
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);

    node.className = className || '';

    if (text !== undefined) {
      node.textContent = text;
    }

    return node;
  }

  const { reducedMotion } = ns.Util;

  function starText(count) {
    return '★'.repeat(count) + '☆'.repeat(3 - count);
  }

  const Campaign = {
    menu: null,
    state: { cleared: {}, pick: null },
    stage: null,
    mode: 'before',
    lines: [],
    lineIndex: 0,
    typing: 0,
    typingText: '',
    pick: null,
    finished: false,
    justUnlocked: false,
    lastWin: false,
    resetTimer: 0,

    init(menu) {
      this.menu = menu;
      this.load();
    },

    load() {
      this.state = Storage.getCampaign(this.menu.user.id);
    },

    save() {
      Storage.saveCampaign(this.menu.user.id, this.state);
    },

    /* ---------- Data ---------- */

    stageById(id) {
      return STAGES.filter(function (stage) {
        return stage.id === Number(id);
      })[0] || null;
    },

    isCleared(id) {
      return Boolean(this.state.cleared[id]);
    },

    isOpen(id) {
      return id === 1 || this.isCleared(id - 1);
    },

    /* Bola awal ditambah bola dari bos yang sudah dikalahkan */
    unlocked() {
      return [Config.starterOrb].concat(
        STAGES.filter((stage) => this.isCleared(stage.id)).map(function (stage) {
          return stage.boss;
        })
      );
    },

    totalStars() {
      return Object.keys(this.state.cleared).reduce((sum, id) => sum + this.state.cleared[id].stars, 0);
    },

    /* ---------- Peta ---------- */

    renderMap() {
      const cleared = Object.keys(this.state.cleared).length;

      byId('camp-summary').textContent = cleared + ' dari ' + STAGES.length + ' bos dikalahkan, '
        + this.totalStars() + ' dari ' + STAGES.length * 3 + ' bintang. '
        + 'Kalahkan bos untuk merebut bolanya.';

      ['camp-path-1', 'camp-path-2'].forEach(function (id) {
        byId(id).textContent = '';
      });

      STAGES.forEach((stage) => {
        const orb = Config.orbs[stage.boss];
        const open = this.isOpen(stage.id);
        const done = this.isCleared(stage.id);
        const item = make('li', 'camp-item');
        const node = make('button', 'camp-node ' + (done ? 'is-done' : (open ? 'is-open' : 'is-locked')));
        const icon = make('canvas', 'orb-preview');

        node.type = 'button';
        node.disabled = !open;
        node.dataset.action = 'camp-stage';
        node.dataset.value = String(stage.id);
        node.style.setProperty('--node', orb.palette.main);
        node.style.setProperty('--node-soft', orb.palette.light);

        icon.dataset.kind = orb.kind;
        icon.dataset.team = 'enemy';
        icon.setAttribute('aria-hidden', 'true');

        node.appendChild(make('span', 'camp-num', String(stage.id)));
        node.appendChild(icon);
        node.appendChild(make('span', 'camp-name', stage.bossName));
        node.appendChild(make('span', 'camp-place', stage.title));
        node.appendChild(make('span', 'camp-reward', 'Hadiah: ' + orb.short));
        node.appendChild(make(
          'span',
          'camp-stars',
          done ? starText(this.state.cleared[stage.id].stars) : (open ? 'Belum selesai' : 'Terkunci')
        ));

        item.appendChild(node);
        byId(stage.guards ? 'camp-path-2' : 'camp-path-1').appendChild(item);
      });
    },

    /* ---------- Cerita ---------- */

    openStage(id, skipDialog) {
      const stage = this.stageById(id);

      if (!stage || !this.isOpen(stage.id)) {
        return;
      }

      this.stage = stage;
      this.mode = 'before';
      this.lines = stage.before;
      this.lineIndex = 0;
      this.finished = false;

      const unlocked = this.unlocked();

      this.pick = unlocked.indexOf(this.state.pick) !== -1 ? this.state.pick : Config.starterOrb;

      this.prepareStory(stage);
      this.menu.show('story');

      if (skipDialog) {
        this.finishDialog();
      } else {
        this.showLine();
      }
    },

    /* Cerita sesudah menang: dialog bos, lalu bola hadiah */
    openAfter(stage) {
      this.stage = stage;
      this.mode = 'after';
      this.lines = stage.after;
      this.lineIndex = 0;
      this.finished = false;

      this.prepareStory(stage);
      this.menu.show('story');
      this.showLine();
    },

    prepareStory(stage) {
      byId('story-title').textContent = 'Stage ' + stage.id;
      byId('story-stage').textContent = stage.title + (stage.guards ? ' · dijaga 2 pengawal' : '');
      byId('story-dialog').hidden = false;
      byId('story-reward').hidden = true;
      byId('story-loadout').hidden = true;
      byId('story-start').hidden = true;
      byId('story-next').hidden = false;
      byId('story-next').textContent = 'Lanjut';

      this.paintArena(stage.theme);
    },

    paintArena(theme) {
      const canvas = byId('story-arena');
      const ctx = canvas.getContext('2d');
      const scale = canvas.width / Config.arena.width;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ns.Arenas.paint(ctx, theme, Config.arena.width, Config.arena.height);
    },

    showLine() {
      const line = this.lines[this.lineIndex];
      const last = this.lineIndex === this.lines.length - 1;

      byId('story-who').textContent = line.who;
      byId('story-next').textContent = last && this.mode === 'before' ? 'Siap bertarung' : 'Lanjut';
      this.type(line.text);
    },

    /* Teks muncul huruf demi huruf; klik Lanjut saat mengetik menampilkan semuanya */
    type(text) {
      const target = byId('story-text');

      window.clearTimeout(this.typing);
      this.typingText = text;

      if (reducedMotion()) {
        target.textContent = text;
        this.typing = 0;

        return;
      }

      let shown = 0;

      target.textContent = '';

      const step = () => {
        shown += 1;
        target.textContent = text.slice(0, shown);

        if (shown < text.length) {
          this.typing = window.setTimeout(step, TYPE_DELAY);
        } else {
          this.typing = 0;
        }
      };

      this.typing = window.setTimeout(step, TYPE_DELAY);
    },

    next() {
      if (this.typing) {
        window.clearTimeout(this.typing);
        this.typing = 0;
        byId('story-text').textContent = this.typingText;

        return;
      }

      if (this.finished) {
        this.leaveAfter();

        return;
      }

      this.lineIndex += 1;

      if (this.lineIndex < this.lines.length) {
        this.showLine();
      } else {
        this.finishDialog();
      }
    },

    finishDialog() {
      this.finished = true;
      window.clearTimeout(this.typing);
      this.typing = 0;

      if (this.mode === 'before') {
        byId('story-dialog').hidden = true;
        byId('story-next').hidden = true;
        byId('story-loadout').hidden = false;
        byId('story-start').hidden = false;
        this.renderLoadout();

        return;
      }

      const orb = Config.orbs[this.stage.boss];
      const nextStage = this.stageById(this.stage.id + 1);

      byId('story-reward').hidden = false;
      byId('story-reward-orb').dataset.kind = orb.kind;
      byId('story-reward-name').textContent = orb.name;
      byId('story-reward-hint').textContent = orb.hint;
      byId('story-next').textContent = nextStage ? 'Stage ' + nextStage.id + ': ' + nextStage.title : 'Kembali ke Peta';
      byId('story-next').hidden = false;
    },

    leaveAfter() {
      const nextStage = this.stageById(this.stage.id + 1);

      if (nextStage) {
        this.openStage(nextStage.id, false);
      } else {
        this.menu.show('campaign');
      }
    },

    /* ---------- Pilih bola ---------- */

    renderLoadout() {
      const list = byId('story-orbs');
      const open = this.unlocked();
      const keys = [Config.starterOrb].concat(STAGES.map(function (stage) {
        return stage.boss;
      }));

      list.textContent = '';

      keys.forEach((key) => {
        const orb = Config.orbs[key];
        const locked = open.indexOf(key) === -1;
        const cell = make('button', 'camp-orb' + (locked ? ' is-locked' : ''));
        const icon = make('canvas', 'orb-preview');

        cell.type = 'button';
        cell.disabled = locked;
        cell.dataset.action = 'camp-pick';
        cell.dataset.value = key;
        cell.setAttribute('role', 'radio');
        cell.setAttribute('aria-checked', String(key === this.pick));
        cell.style.setProperty('--node', orb.palette.main);
        cell.style.setProperty('--node-soft', orb.palette.light);

        icon.dataset.kind = orb.kind;
        icon.dataset.team = 'player';
        icon.dataset.shadow = 'off';
        icon.setAttribute('aria-hidden', 'true');

        cell.appendChild(icon);
        cell.appendChild(make('span', 'camp-orb-name', locked ? 'Terkunci' : orb.short));
        list.appendChild(cell);
      });

      this.updateInfo();
    },

    choose(key) {
      if (this.unlocked().indexOf(key) === -1) {
        return;
      }

      this.pick = key;
      this.state.pick = key;
      this.save();

      byId('story-orbs').querySelectorAll('.camp-orb').forEach(function (cell) {
        cell.setAttribute('aria-checked', String(cell.dataset.value === key));
      });

      this.updateInfo();
    },

    hpFor(stage) {
      return stage.playerHp || Config.orb.maxHp;
    },

    updateInfo() {
      const orb = Config.orbs[this.pick];

      byId('story-hp').textContent = 'HP kamu ' + this.hpFor(this.stage);
      byId('story-info').textContent = orb.name + ': ' + orb.hint;
    },

    /* ---------- Mulai dan hasil ---------- */

    start() {
      const stage = Object.assign({}, this.stage, { playerHp: this.hpFor(this.stage) });

      this.menu.startCampaignRun(stage, this.pick);
    },

    retry() {
      if (this.stage) {
        this.openStage(this.stage.id, true);
      }
    },

    /* Dipanggil Menu saat pertandingan campaign selesai */
    onResult(result) {
      const stage = this.stageById(result.stageId);
      const won = result.outcome === 'win';

      this.stage = stage;
      this.lastWin = won;
      this.justUnlocked = false;

      if (won) {
        const stars = ns.Fx.starCount(result);
        const before = this.state.cleared[stage.id];

        this.justUnlocked = !before;
        this.state.cleared[stage.id] = { stars: Math.max(stars, before ? before.stars : 0) };
        this.save();
      }

      this.configureResult(true);
    },

    /* Tombol di layar hasil: campaign punya tombol sendiri */
    configureResult(campaign) {
      byId('result-actions').hidden = campaign;
      byId('result-campaign-actions').hidden = !campaign;

      if (campaign) {
        byId('camp-continue').hidden = !this.lastWin;
        byId('camp-continue').textContent = this.justUnlocked ? 'Lanjut: ambil bolanya' : 'Ke Peta';
      }
    },

    continueAfterWin() {
      if (this.justUnlocked) {
        this.openAfter(this.stage);
      } else {
        this.menu.show('campaign');
      }
    },

    /* ---------- Ulangi dari awal (Pengaturan) ---------- */

    askReset() {
      const button = byId('camp-reset');

      if (button.dataset.armed) {
        window.clearTimeout(this.resetTimer);
        delete button.dataset.armed;
        button.textContent = 'Ulangi Campaign dari awal';
        Storage.resetCampaign(this.menu.user.id);
        this.load();
        this.menu.showStatus('Progres Campaign dihapus.');

        return;
      }

      button.dataset.armed = 'true';
      button.textContent = 'Yakin? Klik sekali lagi';
      this.resetTimer = window.setTimeout(function () {
        delete button.dataset.armed;
        button.textContent = 'Ulangi Campaign dari awal';
      }, 4000);
    }
  };

  ns.Campaign = Campaign;
})(window.OrbitArena = window.OrbitArena || {});
