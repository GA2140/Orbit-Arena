(function (ns) {
  'use strict';

  /*
   * Titik masuk. Tiap halaman menandai dirinya dengan atribut
   * data-page (login, register, atau home).
   */
  function start() {
    const root = document.querySelector('[data-page]');
    const page = root ? root.dataset.page : '';
    const notice = document.getElementById('storage-notice');

    if (notice && !ns.Storage.isPersistent()) {
      notice.hidden = false;
    }

    // Latar belakang duel bot dipakai semua halaman
    if (ns.Backdrop) {
      ns.Backdrop.init(page === 'home' ? 'lobby' : 'demo');
    }

    if (ns.Ornament) {
      ns.Ornament.init();
    }

    if (page === 'login') {
      if (ns.Auth.requireGuest()) {
        ns.Auth.bindLoginForm();
      }
    } else if (page === 'register') {
      if (ns.Auth.requireGuest()) {
        ns.Auth.bindRegisterForm();
      }
    } else if (page === 'home') {
      const user = ns.Auth.requireLogin();

      if (user) {
        ns.Menu.init(user);

        // Intro pembuka tampil di atas menu, lalu menyingkap menu
        if (ns.Intro) {
          ns.Intro.play();
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window.OrbitArena = window.OrbitArena || {});
