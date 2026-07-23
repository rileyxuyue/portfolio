(() => {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!finePointer.matches || reducedMotion.matches) {
    return;
  }

  const surfaceSelector = ".portrait-photo, .project-card";
  const cursor = document.createElement("div");
  cursor.className = "cursor-ripple";
  cursor.setAttribute("aria-hidden", "true");
  document.body.append(cursor);

  let targetX = -40;
  let targetY = -40;
  let currentX = targetX;
  let currentY = targetY;
  let animationFrame = 0;
  let activeSurface = null;

  const renderCursor = () => {
    currentX += (targetX - currentX) * 0.34;
    currentY += (targetY - currentY) * 0.34;
    cursor.style.transform = `translate3d(${currentX - 3}px, ${currentY - 3}px, 0)`;

    if (Math.abs(targetX - currentX) > 0.2 || Math.abs(targetY - currentY) > 0.2) {
      animationFrame = window.requestAnimationFrame(renderCursor);
    } else {
      animationFrame = 0;
    }
  };

  const moveCursor = (event) => {
    targetX = event.clientX;
    targetY = event.clientY;
    cursor.classList.add("is-visible");

    const nextSurface = event.target.closest?.(surfaceSelector) ?? null;

    if (nextSurface !== activeSurface) {
      activeSurface?.classList.remove("is-pointer-over");
      nextSurface?.classList.add("is-pointer-over");
      activeSurface = nextSurface;
      cursor.classList.toggle("is-over-surface", Boolean(activeSurface));
    }

    if (!animationFrame) {
      animationFrame = window.requestAnimationFrame(renderCursor);
    }
  };

  window.addEventListener("pointermove", moveCursor, { passive: true });

  const hideCursor = () => {
    cursor.classList.remove("is-visible");
    cursor.classList.remove("is-over-surface");
    activeSurface?.classList.remove("is-pointer-over");
    activeSurface = null;
  };

  window.addEventListener("blur", hideCursor);
  window.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) {
      hideCursor();
    }
  });

  const triggerModuleWave = (surface) => {
    surface.classList.remove("is-wave-clicked");
    void surface.offsetWidth;
    surface.classList.add("is-wave-clicked");
    window.setTimeout(() => surface.classList.remove("is-wave-clicked"), 780);
  };

  document.addEventListener("pointerdown", (event) => {
    const surface = event.target.closest?.(surfaceSelector);

    if (surface) {
      triggerModuleWave(surface);
    }
  });
})();
