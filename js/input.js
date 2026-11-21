(function (ns) {
  'use strict';

  const Config = ns.Config;
  const DEADZONE = 0.18;

  /*
   * PlayerController mengubah input pemain (keyboard, mouse, sentuh)
   * menjadi "intent" yang dibaca Match. Bot memakai bentuk intent yang
   * sama, jadi mode dua pemain lokal tinggal membuat controller kedua.
   */
  class PlayerController {
    constructor(options) {
      this.canvas = options.canvas;
      this.width = options.width;
      this.height = options.height;
      this.keymap = options.keymap;
      this.lock = Boolean(options.lock);

      this.keys = {};
      this.aim = null;
      this.pointerFire = false;
      this.touchFire = false;
      this.joystick = { x: 0, y: 0 };
      this.handlers = null;
    }

    /* ---------- Pasang dan lepas listener ---------- */

    attach() {
      this.handlers = {
        keydown: (event) => this.onKeyDown(event),
        keyup: (event) => this.onKeyUp(event),
        blur: () => this.releaseAll(),
        pointerdown: (event) => this.onPointerDown(event),
        pointermove: (event) => this.onPointerMove(event),
        pointerup: (event) => this.onPointerUp(event),
        contextmenu: (event) => event.preventDefault()
      };

      window.addEventListener('keydown', this.handlers.keydown);
      window.addEventListener('keyup', this.handlers.keyup);
      window.addEventListener('blur', this.handlers.blur);
      window.addEventListener('pointerup', this.handlers.pointerup);
      window.addEventListener('pointercancel', this.handlers.pointerup);
      this.canvas.addEventListener('pointerdown', this.handlers.pointerdown);
      this.canvas.addEventListener('pointermove', this.handlers.pointermove);
      this.canvas.addEventListener('contextmenu', this.handlers.contextmenu);
    }

    detach() {
      if (!this.handlers) {
        return;
      }

      window.removeEventListener('keydown', this.handlers.keydown);
      window.removeEventListener('keyup', this.handlers.keyup);
      window.removeEventListener('blur', this.handlers.blur);
      window.removeEventListener('pointerup', this.handlers.pointerup);
      window.removeEventListener('pointercancel', this.handlers.pointerup);
      this.canvas.removeEventListener('pointerdown', this.handlers.pointerdown);
      this.canvas.removeEventListener('pointermove', this.handlers.pointermove);
      this.canvas.removeEventListener('contextmenu', this.handlers.contextmenu);
      this.handlers = null;
    }

    releaseAll() {
      this.keys = {};
      this.pointerFire = false;
      this.touchFire = false;
      this.joystick = { x: 0, y: 0 };
    }

    /* ---------- Keyboard ---------- */

    isMapped(code) {
      return Object.keys(this.keymap).some((action) => this.keymap[action].indexOf(code) !== -1);
    }

    isDown(action) {
      return this.keymap[action].some((code) => this.keys[code]) ? 1 : 0;
    }

    onKeyDown(event) {
      if (!this.isMapped(event.code)) {
        return;
      }

      event.preventDefault();
      this.keys[event.code] = true;

      if (event.repeat) {
        return;
      }

      if (this.keymap.lock.indexOf(event.code) !== -1) {
        this.toggleLock();
      }
    }

    onKeyUp(event) {
      if (this.isMapped(event.code)) {
        event.preventDefault();
        this.keys[event.code] = false;
      }
    }

    /* ---------- Mouse dan sentuhan di arena ---------- */

    toArena(event) {
      const rect = this.canvas.getBoundingClientRect();

      if (!rect.width) {
        return null;
      }

      return {
        x: ((event.clientX - rect.left) / rect.width) * this.width,
        y: ((event.clientY - rect.top) / rect.height) * this.height
      };
    }

    onPointerDown(event) {
      const point = this.toArena(event);

      if (point) {
        this.aim = point;
      }

      if (event.pointerType === 'mouse') {
        if (event.button === 0) {
          this.pointerFire = true;
        }
      }
    }

    onPointerMove(event) {
      const point = this.toArena(event);

      if (point) {
        this.aim = point;
      }
    }

    onPointerUp(event) {
      if (event.pointerType === 'mouse' && event.button === 0) {
        this.pointerFire = false;
      }
    }

    /* ---------- Aksi yang dipakai kontrol sentuh ---------- */

    toggleLock() {
      this.lock = !this.lock;
      return this.lock;
    }

    setTouchFire(value) {
      this.touchFire = Boolean(value);
    }

    setJoystick(x, y) {
      this.joystick.x = x;
      this.joystick.y = y;
    }

    /* ---------- Dibaca oleh Match ---------- */

    flush() {
      // Tidak ada antrian input: tembak dibaca langsung dari tombol yang ditekan
    }

    getIntent(match, orb) {
      const foe = match.getOpponent(orb);
      let moveX = this.joystick.x + this.isDown('right') - this.isDown('left');
      let moveY = this.joystick.y + this.isDown('down') - this.isDown('up');
      const length = Math.hypot(moveX, moveY);
      let target = foe;

      if (length > 1) {
        moveX /= length;
        moveY /= length;
      }

      if (this.lock) {
        // Lock Aim: bidik lawan dengan prediksi arah geraknya
        target = match.leadPoint(orb, foe, Config.lock.assist);
      } else if (this.aim) {
        target = this.aim;
      }

      const intent = {
        moveX: moveX,
        moveY: moveY,
        aimX: target.x,
        aimY: target.y,
        fire: this.pointerFire || this.touchFire || this.isDown('fire') === 1
      };

      return intent;
    }
  }

  /* ---------- Kontrol sentuh (joystick dan tombol) ---------- */

  function bindJoystick(base, getController) {
    const knob = base.querySelector('.joystick-knob');
    let activeId = null;

    function update(event) {
      const controller = getController();
      const rect = base.getBoundingClientRect();
      const limit = rect.width / 2 - knob.offsetWidth / 2;
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      const scale = distance > limit ? limit / distance : 1;
      const x = dx * scale;
      const y = dy * scale;
      const vx = x / limit;
      const vy = y / limit;

      knob.style.transform = 'translate(' + x + 'px, ' + y + 'px)';

      if (controller) {
        const inside = Math.hypot(vx, vy) >= DEADZONE;

        controller.setJoystick(inside ? vx : 0, inside ? vy : 0);
      }
    }

    function reset() {
      const controller = getController();

      activeId = null;
      knob.style.transform = '';

      if (controller) {
        controller.setJoystick(0, 0);
      }
    }

    base.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      activeId = event.pointerId;
      base.setPointerCapture(event.pointerId);
      update(event);
    });

    base.addEventListener('pointermove', function (event) {
      if (event.pointerId === activeId) {
        update(event);
      }
    });

    base.addEventListener('pointerup', reset);
    base.addEventListener('pointercancel', reset);
  }

  function bindTouchButtons(root, getController) {
    root.querySelectorAll('[data-touch]').forEach(function (button) {
      const action = button.dataset.touch;

      function release() {
        const controller = getController();

        if (action === 'attack' && controller) {
          controller.setTouchFire(false);
        }
      }

      button.addEventListener('pointerdown', function (event) {
        const controller = getController();

        event.preventDefault();

        if (!controller) {
          return;
        }

        if (action === 'attack') {
          button.setPointerCapture(event.pointerId);
          controller.setTouchFire(true);
        } else if (action === 'lock') {
          controller.toggleLock();
        }
      });

      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
    });
  }

  ns.PlayerController = PlayerController;

  ns.Input = {
    bindTouchControls(options) {
      bindJoystick(options.joystick, options.getController);
      bindTouchButtons(options.root, options.getController);
    }
  };
})(window.OrbitArena = window.OrbitArena || {});
