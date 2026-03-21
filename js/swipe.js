/* ============================================
   SWIPE — Touch gesture engine for card feed
   ============================================ */

const Swipe = (() => {
  const SWIPE_THRESHOLD = 100;   // px needed to trigger action
  const ROTATION_FACTOR = 0.08;  // rotation per px of drag
  const OPACITY_FACTOR = 0.004;  // opacity fade per px

  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let isDragging = false;
  let cardEl = null;
  let onSwipeRight = null;
  let onSwipeLeft = null;

  function init(card, { onRight, onLeft }) {
    cardEl = card;
    onSwipeRight = onRight;
    onSwipeLeft = onLeft;

    card.addEventListener('touchstart', handleTouchStart, { passive: true });
    card.addEventListener('touchmove', handleTouchMove, { passive: false });
    card.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Mouse support for desktop testing
    card.addEventListener('mousedown', handleMouseDown);
  }

  function handleTouchStart(e) {
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
  }

  function handleTouchMove(e) {
    if (!isDragging) return;
    const touch = e.touches[0];
    moveDrag(touch.clientX);
    // Prevent vertical scroll while swiping horizontally
    if (Math.abs(currentX - startX) > 10) {
      e.preventDefault();
    }
  }

  function handleTouchEnd() {
    endDrag();
  }

  function handleMouseDown(e) {
    startDrag(e.clientX, e.clientY);
    const onMouseMove = (ev) => moveDrag(ev.clientX);
    const onMouseUp = () => {
      endDrag();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function startDrag(x, y) {
    isDragging = true;
    startX = x;
    startY = y;
    currentX = x;
    if (cardEl) {
      cardEl.dataset.dragging = 'false';
      cardEl.style.transition = 'none';
    }
  }

  function moveDrag(x) {
    if (!isDragging || !cardEl) return;
    currentX = x;
    const deltaX = currentX - startX;

    // Mark as dragging if moved more than 5px (prevents tap-flip on drag)
    if (Math.abs(deltaX) > 5) {
      cardEl.dataset.dragging = 'true';
    }

    const rotation = deltaX * ROTATION_FACTOR;

    // Apply transform
    cardEl.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)`;

    // Show swipe indicators
    const saveIndicator = cardEl.parentElement.querySelector('.swipe-indicator--save');
    const dismissIndicator = cardEl.parentElement.querySelector('.swipe-indicator--dismiss');

    if (saveIndicator && dismissIndicator) {
      const progress = Math.abs(deltaX) / SWIPE_THRESHOLD;
      if (deltaX > 0) {
        saveIndicator.style.opacity = Math.min(progress, 1);
        dismissIndicator.style.opacity = 0;
        cardEl.classList.add('swiping-right');
        cardEl.classList.remove('swiping-left');
      } else if (deltaX < 0) {
        dismissIndicator.style.opacity = Math.min(progress, 1);
        saveIndicator.style.opacity = 0;
        cardEl.classList.add('swiping-left');
        cardEl.classList.remove('swiping-right');
      } else {
        saveIndicator.style.opacity = 0;
        dismissIndicator.style.opacity = 0;
      }
    }
  }

  function endDrag() {
    if (!isDragging || !cardEl) return;
    isDragging = false;

    const deltaX = currentX - startX;
    cardEl.style.transition = '';
    cardEl.classList.remove('swiping-right', 'swiping-left');

    // Hide indicators
    const saveIndicator = cardEl.parentElement.querySelector('.swipe-indicator--save');
    const dismissIndicator = cardEl.parentElement.querySelector('.swipe-indicator--dismiss');
    if (saveIndicator) saveIndicator.style.opacity = 0;
    if (dismissIndicator) dismissIndicator.style.opacity = 0;

    if (deltaX > SWIPE_THRESHOLD) {
      // Swipe right — save
      cardEl.classList.add('card-exit-right');
      setTimeout(() => {
        if (onSwipeRight) onSwipeRight();
      }, 300);
    } else if (deltaX < -SWIPE_THRESHOLD) {
      // Swipe left — dismiss
      cardEl.classList.add('card-exit-left');
      setTimeout(() => {
        if (onSwipeLeft) onSwipeLeft();
      }, 300);
    } else {
      // Spring back
      cardEl.style.transform = '';
      // Reset dragging flag after spring-back so tap can work
      setTimeout(() => {
        if (cardEl) cardEl.dataset.dragging = 'false';
      }, 50);
    }
  }

  function destroy() {
    if (cardEl) {
      cardEl.removeEventListener('touchstart', handleTouchStart);
      cardEl.removeEventListener('touchmove', handleTouchMove);
      cardEl.removeEventListener('touchend', handleTouchEnd);
      cardEl.removeEventListener('mousedown', handleMouseDown);
    }
    cardEl = null;
    onSwipeRight = null;
    onSwipeLeft = null;
  }

  return { init, destroy };
})();
