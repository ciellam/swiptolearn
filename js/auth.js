/* ============================================
   AUTH — Lock Screen Password Logic
   ============================================ */

const Auth = (() => {
  // Pre-computed SHA-256 hash — the actual password never appears in code
  const PASSWORD_HASH = '573c34b6cf0329baf63f799a542e4757472fceb4d7e6422d6907b2e4bc59f5f8';
  const AUTH_KEY = 'learninghub_authenticated';

  async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'learninghub_salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function verifyPassword(password) {
    const hash = await hashPassword(password);
    return hash === PASSWORD_HASH;
  }

  function isAuthenticated() {
    return localStorage.getItem(AUTH_KEY) === 'true';
  }

  // --- UI Bindings ---
  function init() {
    // Skip lock screen if already authenticated on this device
    if (isAuthenticated()) {
      document.getElementById('lock-screen').hidden = true;
      document.body.classList.remove('locked');
      if (typeof App !== 'undefined') {
        App.start();
      }
      return;
    }

    const form = document.getElementById('lock-form');
    const input = document.getElementById('lock-input');
    const error = document.getElementById('lock-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = input.value.trim();

      if (!password) {
        showError(error, 'Please enter a password');
        shakeInput(input);
        return;
      }

      const valid = await verifyPassword(password);
      if (valid) {
        localStorage.setItem(AUTH_KEY, 'true');
        onUnlock();
      } else {
        showError(error, 'Wrong password. Try again.');
        shakeInput(input);
        input.value = '';
        input.focus();
      }
    });

    // Focus input on load (slight delay for animation)
    setTimeout(() => input.focus(), 800);
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 3000);
  }

  function shakeInput(el) {
    el.style.animation = 'none';
    el.offsetHeight; // trigger reflow
    el.style.animation = 'inputShake 0.5s ease';
  }

  function onUnlock() {
    const lockScreen = document.getElementById('lock-screen');
    lockScreen.style.animation = 'lockExit 0.4s cubic-bezier(0.55, 0, 1, 0.45) forwards';
    setTimeout(() => {
      lockScreen.hidden = true;
      lockScreen.style.animation = '';
      if (typeof App !== 'undefined') {
        App.start();
      }
    }, 400);
  }

  // Add shake animation dynamically
  const shakeStyle = document.createElement('style');
  shakeStyle.textContent = `
    @keyframes inputShake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-8px); }
      40% { transform: translateX(8px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }
    @keyframes lockExit {
      to {
        opacity: 0;
        transform: scale(0.95) translateY(-10px);
      }
    }
  `;
  document.head.appendChild(shakeStyle);

  return { init };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => Auth.init());
