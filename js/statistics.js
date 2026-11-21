(function (ns) {
  'use strict';

  const Config = ns.Config;
  const Storage = ns.Storage;

  const OUTCOME_LABELS = {
    win: 'Menang',
    loss: 'Kalah',
    draw: 'Seri'
  };

  function formatDuration(seconds) {
    const total = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(total / 60);

    return minutes + ':' + String(total % 60).padStart(2, '0');
  }

  function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = String(value);
    }
  }

  function formatDate(iso) {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
      + ', '
      + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  function createCell(content) {
    const cell = document.createElement('td');

    if (content instanceof Node) {
      cell.appendChild(content);
    } else {
      cell.textContent = content;
    }

    return cell;
  }

  function createBadge(outcome) {
    const badge = document.createElement('span');

    badge.className = 'badge badge-' + outcome;
    badge.textContent = OUTCOME_LABELS[outcome];

    return badge;
  }

  function orbLabel(key) {
    return Config.orbs[key] ? Config.orbs[key].short : '-';
  }

  const OUTCOME_LETTERS = {
    win: 'M',
    loss: 'K',
    draw: 'S'
  };

  ns.Statistics = {
    filter: 'all',

    outcomeLabel(outcome) {
      return OUTCOME_LABELS[outcome] || '-';
    },

    formatDuration,

    winRate(progress) {
      if (!progress.matches) {
        return 0;
      }

      return Math.round((progress.wins / progress.matches) * 100);
    },

    /* Simpan hasil satu pertandingan lalu kembalikan progres terbaru */
    record(userId, result) {
      const progress = Storage.getProgress(userId);

      progress.matches += 1;

      if (result.outcome === 'win') {
        progress.wins += 1;
        progress.streak += 1;
        progress.bestStreak = Math.max(progress.bestStreak, progress.streak);
      } else if (result.outcome === 'loss') {
        progress.losses += 1;
        progress.streak = 0;
      } else {
        progress.draws += 1;
        progress.streak = 0;
      }

      progress.history.unshift({
        outcome: result.outcome,
        difficulty: result.difficulty,
        orb: result.orb,
        enemyOrb: result.enemyOrb,
        duration: result.duration,
        playerHp: result.playerHp,
        enemyHp: result.enemyHp,
        at: new Date().toISOString()
      });
      progress.history = progress.history.slice(0, Config.progress.historyLimit);

      Storage.saveProgress(userId, progress);

      return progress;
    },

    /* Ringkasan di Main Menu */
    renderSummary(progress) {
      setText('sum-matches', progress.matches);
      setText('sum-wins', progress.wins);
      setText('sum-losses', progress.losses);
      setText('sum-rate', this.winRate(progress) + '%');
    },

    /* Layar Statistik */
    renderScreen(progress) {
      const body = document.getElementById('history-body');
      const empty = document.getElementById('history-empty');

      setText('stat-matches', progress.matches);
      setText('stat-wins', progress.wins);
      setText('stat-losses', progress.losses);
      setText('stat-draws', progress.draws);
      setText('stat-rate', this.winRate(progress) + '%');
      setText('stat-best', progress.bestStreak);

      body.textContent = '';
      this.renderForm(progress);

      progress.history.forEach(function (item) {
        const row = document.createElement('tr');
        const level = Config.difficulties[item.difficulty];

        row.className = 'reveal';
        row.dataset.outcome = item.outcome;

        row.appendChild(createCell(formatDate(item.at)));
        row.appendChild(createCell(createBadge(item.outcome)));
        row.appendChild(createCell(level ? level.label : '-'));
        row.appendChild(createCell(orbLabel(item.orb) + ' vs ' + orbLabel(item.enemyOrb)));
        row.appendChild(createCell(formatDuration(Number(item.duration) || 0)));
        row.appendChild(createCell(String(Number(item.playerHp) || 0)));
        body.appendChild(row);
      });

      this.filterHistory('all');
    },

    /* Deretan hasil terakhir (terlama di kiri, terbaru di kanan) */
    renderForm(progress) {
      const strip = document.getElementById('form-strip');

      strip.textContent = '';

      progress.history.slice().reverse().forEach(function (item, index) {
        const dot = document.createElement('span');

        dot.className = 'form-dot is-' + item.outcome;
        dot.textContent = OUTCOME_LETTERS[item.outcome];
        dot.title = OUTCOME_LABELS[item.outcome] + ' · ' + formatDate(item.at);
        dot.style.setProperty('--d', String(index));
        strip.appendChild(dot);
      });
    },

    /* Tampilkan hanya riwayat dengan hasil tertentu (all = semuanya) */
    filterHistory(value) {
      const rows = document.querySelectorAll('#history-body tr');
      const empty = document.getElementById('history-empty');
      let visible = 0;

      this.filter = value;

      document.querySelectorAll('[data-action="filter-history"]').forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.value === value));
      });

      rows.forEach(function (row) {
        const show = value === 'all' || row.dataset.outcome === value;

        row.hidden = !show;
        visible += show ? 1 : 0;
      });

      empty.hidden = visible > 0;
      empty.textContent = rows.length
        ? 'Tidak ada pertandingan dengan hasil ini.'
        : 'Belum ada pertandingan. Mainkan satu ronde dulu.';
    }
  };
})(window.OrbitArena = window.OrbitArena || {});
