/* ============================================
   AUTH — Lock Screen Password Logic
   ============================================ */

const Auth = (() => {
  const STORAGE_KEY = 'learninghub_password';

  // Simple hash function for password (not cryptographic, just a deterrent)
  async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'learninghub_salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function isFirstVisit() {
    return !localStorage.getItem(STORAGE_KEY);
  }

  function getStoredHash() {
    return localStorage.getItem(STORAGE_KEY);
  }

  async function setPassword(password) {
    const hash = await hashPassword(password);
    localStorage.setItem(STORAGE_KEY, hash);
    return hash;
  }

  async function verifyPassword(password) {
    const hash = await hashPassword(password);
    return hash === getStoredHash();
  }

  // --- UI Bindings ---
  function init() {
    const form = document.getElementById('lock-form');
    const input = document.getElementById('lock-input');
    const subtitle = document.getElementById('lock-subtitle');
    const btnText = document.getElementById('lock-btn-text');
    const error = document.getElementById('lock-error');

    if (isFirstVisit()) {
      subtitle.textContent = 'Create a password to protect your hub';
      input.placeholder = 'Choose a password';
      input.autocomplete = 'new-password';
      btnText.textContent = 'Get Started';
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = input.value.trim();

      if (!password) {
        showError(error, 'Please enter a password');
        shakeInput(input);
        return;
      }

      if (password.length < 4) {
        showError(error, 'Password must be at least 4 characters');
        shakeInput(input);
        return;
      }

      if (isFirstVisit()) {
        await setPassword(password);
        onUnlock();
      } else {
        const valid = await verifyPassword(password);
        if (valid) {
          onUnlock();
        } else {
          showError(error, 'Wrong password. Try again.');
          shakeInput(input);
          input.value = '';
          input.focus();
        }
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
