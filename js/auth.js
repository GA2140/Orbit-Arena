(function (ns) {
  'use strict';

  const Config = ns.Config;
  const Storage = ns.Storage;

  /* ---------- SHA-256 ----------
   * Hash di sisi klien hanya untuk demo lokal. Ini bukan
   * autentikasi yang aman untuk aplikasi produksi.
   */

  const ROUND_CONSTANTS = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const INITIAL_HASH = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  function rotateRight(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  function toUtf8Bytes(text) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(text);
    }

    const binary = unescape(encodeURIComponent(text));
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  }

  function sha256(text) {
    const bytes = toUtf8Bytes(text);
    const length = bytes.length;
    const paddedLength = ((length + 9 + 63) >> 6) << 6;
    const buffer = new Uint8Array(paddedLength);
    const view = new DataView(buffer.buffer);
    const hash = INITIAL_HASH.slice();
    const words = new Array(64);

    buffer.set(bytes);
    buffer[length] = 0x80;
    view.setUint32(paddedLength - 8, Math.floor((length * 8) / 0x100000000));
    view.setUint32(paddedLength - 4, (length * 8) >>> 0);

    for (let offset = 0; offset < paddedLength; offset += 64) {
      for (let i = 0; i < 16; i++) {
        words[i] = view.getUint32(offset + i * 4);
      }

      for (let i = 16; i < 64; i++) {
        const s0 = rotateRight(words[i - 15], 7) ^ rotateRight(words[i - 15], 18) ^ (words[i - 15] >>> 3);
        const s1 = rotateRight(words[i - 2], 17) ^ rotateRight(words[i - 2], 19) ^ (words[i - 2] >>> 10);

        words[i] = (words[i - 16] + s0 + words[i - 7] + s1) | 0;
      }

      let a = hash[0];
      let b = hash[1];
      let c = hash[2];
      let d = hash[3];
      let e = hash[4];
      let f = hash[5];
      let g = hash[6];
      let h = hash[7];

      for (let i = 0; i < 64; i++) {
        const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
        const choice = (e & f) ^ (~e & g);
        const temp1 = (h + sum1 + choice + ROUND_CONSTANTS[i] + words[i]) | 0;
        const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (sum0 + majority) | 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) | 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) | 0;
      }

      hash[0] = (hash[0] + a) | 0;
      hash[1] = (hash[1] + b) | 0;
      hash[2] = (hash[2] + c) | 0;
      hash[3] = (hash[3] + d) | 0;
      hash[4] = (hash[4] + e) | 0;
      hash[5] = (hash[5] + f) | 0;
      hash[6] = (hash[6] + g) | 0;
      hash[7] = (hash[7] + h) | 0;
    }

    return hash
      .map(function (value) {
        return (value >>> 0).toString(16).padStart(8, '0');
      })
      .join('');
  }

  /* ---------- Fungsi akun ---------- */

  function createId(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function hashPassword(salt, password) {
    return sha256(salt + ':' + password);
  }

  function findUser(users, username) {
    const wanted = username.toLowerCase();

    return users.find(function (user) {
      return user.username.toLowerCase() === wanted;
    });
  }

  function fail(field, error) {
    return { ok: false, field: field, error: error };
  }

  function validateRegistration(username, password, confirm) {
    const rules = Config.auth;

    if (!username || !password || !confirm) {
      const missing = !username ? 'username' : (!password ? 'password' : 'confirm');

      return fail(missing, 'Semua kolom wajib diisi.');
    }

    if (username.length < rules.usernameMin || username.length > rules.usernameMax) {
      return fail('username', 'Username harus ' + rules.usernameMin + ' sampai ' + rules.usernameMax + ' karakter.');
    }

    if (!/^[A-Za-z0-9_]+$/.test(username)) {
      return fail('username', 'Username hanya boleh berisi huruf, angka, dan garis bawah.');
    }

    if (password.length < rules.passwordMin) {
      return fail('password', 'Password minimal ' + rules.passwordMin + ' karakter.');
    }

    if (password !== confirm) {
      return fail('confirm', 'Password dan konfirmasi password tidak sama.');
    }

    return null;
  }

  function redirect(page) {
    window.location.replace(Config.pages[page]);
  }

  /* ---------- Form di halaman ---------- */

  function bindPasswordToggles() {
    document.querySelectorAll('[data-toggle-password]').forEach(function (button) {
      const input = document.getElementById(button.dataset.togglePassword);

      button.addEventListener('click', function () {
        const show = input.type === 'password';

        input.type = show ? 'text' : 'password';
        button.textContent = show ? 'Sembunyikan' : 'Tampilkan';
      });
    });
  }

  function createFormHelpers(form) {
    const errorBox = document.getElementById('form-error');
    const inputs = Array.from(form.querySelectorAll('.input'));

    function clear() {
      errorBox.hidden = true;
      errorBox.textContent = '';
      inputs.forEach(function (input) {
        input.removeAttribute('aria-invalid');
      });
    }

    function show(result, fieldMap) {
      const input = document.getElementById(fieldMap[result.field]);

      errorBox.textContent = result.error;
      errorBox.hidden = false;

      if (input) {
        input.setAttribute('aria-invalid', 'true');
        input.focus();
      }
    }

    inputs.forEach(function (input) {
      input.addEventListener('input', clear);
    });

    return { clear: clear, show: show };
  }

  /* ---------- API publik ---------- */

  ns.Auth = {
    sha256,

    register(username, password, confirm) {
      const name = String(username || '').trim();
      const invalid = validateRegistration(name, String(password || ''), String(confirm || ''));

      if (invalid) {
        return invalid;
      }

      const users = Storage.getUsers();

      if (findUser(users, name)) {
        return fail('username', 'Username sudah dipakai di browser ini. Coba username lain.');
      }

      const salt = createId('salt');
      const user = {
        id: createId('user'),
        username: name,
        salt: salt,
        passwordHash: hashPassword(salt, password),
        createdAt: new Date().toISOString()
      };

      users.push(user);

      if (!Storage.saveUsers(users)) {
        return fail('username', 'Akun gagal disimpan. Penyimpanan browser penuh atau diblokir.');
      }

      return { ok: true, user: user };
    },

    login(username, password) {
      const name = String(username || '').trim();
      const secret = String(password || '');

      if (!name || !secret) {
        return fail(!name ? 'username' : 'password', 'Isi username dan password.');
      }

      const user = findUser(Storage.getUsers(), name);

      if (!user) {
        return fail('username', 'Username belum terdaftar. Buat akun dulu di halaman Daftar.');
      }

      if (hashPassword(user.salt || '', secret) !== user.passwordHash) {
        return fail('password', 'Password salah. Coba lagi.');
      }

      Storage.setSession(user.id);

      return { ok: true, user: user };
    },

    logout() {
      Storage.clearSession();
    },

    getCurrentUser() {
      const session = Storage.getSession();

      if (!session) {
        return null;
      }

      const user = Storage.getUsers().find(function (item) {
        return item.id === session.userId;
      });

      if (!user) {
        Storage.clearSession();
        return null;
      }

      return user;
    },

    /* Halaman game: kembali ke login bila belum masuk */
    requireLogin() {
      const user = this.getCurrentUser();

      if (!user) {
        redirect('login');
        return null;
      }

      return user;
    },

    /* Halaman login/register: langsung ke game bila sudah masuk */
    requireGuest() {
      if (this.getCurrentUser()) {
        redirect('home');
        return false;
      }

      return true;
    },

    redirect,

    bindLoginForm() {
      const form = document.getElementById('login-form');
      const helpers = createFormHelpers(form);
      const fields = { username: 'login-username', password: 'login-password' };

      bindPasswordToggles();

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        helpers.clear();

        const result = ns.Auth.login(
          document.getElementById('login-username').value,
          document.getElementById('login-password').value
        );

        if (!result.ok) {
          helpers.show(result, fields);
          return;
        }

        redirect('home');
      });
    },

    bindRegisterForm() {
      const form = document.getElementById('register-form');
      const helpers = createFormHelpers(form);
      const fields = {
        username: 'reg-username',
        password: 'reg-password',
        confirm: 'reg-confirm'
      };

      bindPasswordToggles();

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        helpers.clear();

        const result = ns.Auth.register(
          document.getElementById('reg-username').value,
          document.getElementById('reg-password').value,
          document.getElementById('reg-confirm').value
        );

        if (!result.ok) {
          helpers.show(result, fields);
          return;
        }

        // Setelah daftar, pemain langsung masuk
        Storage.setSession(result.user.id);
        redirect('home');
      });
    }
  };
})(window.OrbitArena = window.OrbitArena || {});
