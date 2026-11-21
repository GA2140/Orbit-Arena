(function (ns) {
  'use strict';

  const Config = ns.Config;
  const keys = Config.storageKeys;
  const memory = {};
  const persistent = checkStorage();

  /* ---------- Akses Local Storage yang aman ---------- */

  function checkStorage() {
    try {
      const probe = '__orbit_probe__';

      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);

      return true;
    } catch (error) {
      return false;
    }
  }

  function readRaw(key) {
    if (!persistent) {
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    }

    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeRaw(key, value) {
    if (!persistent) {
      memory[key] = value;
      return true;
    }

    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function removeRaw(key) {
    if (!persistent) {
      delete memory[key];
      return;
    }

    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      // diabaikan: tidak ada yang bisa dilakukan
    }
  }

  function readJson(key, fallback) {
    const raw = readRaw(key);

    if (raw === null) {
      return fallback;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    return writeRaw(key, JSON.stringify(value));
  }

  /* ---------- Validasi data ---------- */

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function toCount(value) {
    const number = Number(value);

    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
  }

  function isValidUser(user) {
    return isObject(user)
      && typeof user.id === 'string'
      && typeof user.username === 'string'
      && typeof user.passwordHash === 'string';
  }

  function isValidHistoryItem(item) {
    return isObject(item) && ['win', 'loss', 'draw'].indexOf(item.outcome) !== -1;
  }

  /* ---------- Data awal ---------- */

  function defaultProgress() {
    return {
      matches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      streak: 0,
      bestStreak: 0,
      history: []
    };
  }

  function detectControl() {
    try {
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
        return 'touch';
      }
    } catch (error) {
      // pakai nilai bawaan
    }

    return Config.defaults.control;
  }

  function defaultSettings() {
    return {
      sound: Config.defaults.sound,
      musicVolume: Config.defaults.musicVolume,
      sfxVolume: Config.defaults.sfxVolume,
      difficulty: Config.defaults.difficulty,
      control: detectControl()
    };
  }

  /* ---------- API publik ---------- */

  ns.Storage = {
    isPersistent() {
      return persistent;
    },

    defaultProgress,

    getUsers() {
      const stored = readJson(keys.users, []);

      return Array.isArray(stored) ? stored.filter(isValidUser) : [];
    },

    saveUsers(users) {
      return writeJson(keys.users, users);
    },

    getSession() {
      const stored = readJson(keys.session, null);

      if (isObject(stored) && typeof stored.userId === 'string') {
        return stored;
      }

      return null;
    },

    setSession(userId) {
      return writeJson(keys.session, {
        userId: userId,
        loggedInAt: new Date().toISOString()
      });
    },

    clearSession() {
      removeRaw(keys.session);
    },

    getProgress(userId) {
      const stored = readJson(keys.progress + userId, null);
      const progress = defaultProgress();

      if (!isObject(stored)) {
        return progress;
      }

      progress.wins = toCount(stored.wins);
      progress.losses = toCount(stored.losses);
      progress.draws = toCount(stored.draws);
      progress.matches = Math.max(toCount(stored.matches), progress.wins + progress.losses + progress.draws);
      progress.streak = toCount(stored.streak);
      progress.bestStreak = Math.max(toCount(stored.bestStreak), progress.streak);

      if (Array.isArray(stored.history)) {
        progress.history = stored.history
          .filter(isValidHistoryItem)
          .slice(0, Config.progress.historyLimit);
      }

      return progress;
    },

    saveProgress(userId, progress) {
      return writeJson(keys.progress + userId, progress);
    },

    resetProgress(userId) {
      return writeJson(keys.progress + userId, defaultProgress());
    },

    getSettings(userId) {
      const stored = readJson(keys.settings + userId, null);
      const settings = defaultSettings();

      if (!isObject(stored)) {
        return settings;
      }

      if (typeof stored.sound === 'boolean') {
        settings.sound = stored.sound;
      }

      ['musicVolume', 'sfxVolume'].forEach(function (name) {
        const value = Number(stored[name]);

        if (Number.isFinite(value) && value >= 0 && value <= 100) {
          settings[name] = Math.round(value);
        }
      });

      if (Config.difficulties[stored.difficulty]) {
        settings.difficulty = stored.difficulty;
      }

      if (Config.controls.indexOf(stored.control) !== -1) {
        settings.control = stored.control;
      }

      return settings;
    },

    /*
     * Progres Campaign per akun:
     *   cleared  { "1": { stars: 3 }, ... } stage yang sudah dimenangkan
     *   pick     bola yang terakhir dipakai
     */
    getCampaign(userId) {
      const stored = readJson(keys.campaign + userId, null);
      const campaign = { cleared: {}, pick: null };

      if (!isObject(stored)) {
        return campaign;
      }

      if (isObject(stored.cleared)) {
        Config.campaign.stages.forEach(function (stage) {
          const entry = stored.cleared[stage.id];

          if (isObject(entry)) {
            campaign.cleared[stage.id] = { stars: Math.min(3, Math.max(1, toCount(entry.stars))) };
          }
        });
      }

      if (typeof stored.pick === 'string' && Config.orbs[stored.pick]) {
        campaign.pick = stored.pick;
      }

      return campaign;
    },

    saveCampaign(userId, campaign) {
      return writeJson(keys.campaign + userId, campaign);
    },

    resetCampaign(userId) {
      removeRaw(keys.campaign + userId);
    },

    saveSettings(userId, settings) {
      return writeJson(keys.settings + userId, settings);
    }
  };
})(window.OrbitArena = window.OrbitArena || {});
