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
  let lastRippleAt = 0;
  let lastRippleX = -100;
  let lastRippleY = -100;
  const waterRipples = new Set();

  const createWaterRipple = (x, y, overSurface) => {
    if (waterRipples.size >= 12) {
      const oldestRipple = waterRipples.values().next().value;
      oldestRipple?.remove();
      waterRipples.delete(oldestRipple);
    }

    const ripple = document.createElement("span");
    ripple.className = `water-ripple${overSurface ? " is-over-surface" : ""}`;
    ripple.setAttribute("aria-hidden", "true");
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.body.append(ripple);
    waterRipples.add(ripple);

    ripple.addEventListener(
      "animationend",
      () => {
        ripple.remove();
        waterRipples.delete(ripple);
      },
      { once: true },
    );
  };

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

    if (activeSurface) {
      updateSurfaceRipple(activeSurface, event);
    }

    const now = window.performance.now();
    const distance = Math.hypot(event.clientX - lastRippleX, event.clientY - lastRippleY);

    if (now - lastRippleAt > 82 && distance > 16) {
      createWaterRipple(event.clientX, event.clientY, Boolean(activeSurface));
      lastRippleAt = now;
      lastRippleX = event.clientX;
      lastRippleY = event.clientY;
    }

    if (!animationFrame) {
      animationFrame = window.requestAnimationFrame(renderCursor);
    }
  };

  const updateSurfaceRipple = (surface, event) => {
    const bounds = surface.getBoundingClientRect();
    surface.style.setProperty("--ripple-x", `${event.clientX - bounds.left}px`);
    surface.style.setProperty("--ripple-y", `${event.clientY - bounds.top}px`);
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

  const createModuleWave = (surface) => {
    const bounds = surface.getBoundingClientRect();
    const wave = document.createElement("span");
    const borderRadius = window.getComputedStyle(surface).borderRadius;
    wave.className = "module-wave";
    wave.setAttribute("aria-hidden", "true");
    wave.style.left = `${bounds.left + bounds.width / 2}px`;
    wave.style.top = `${bounds.top + bounds.height / 2}px`;
    wave.style.width = `${bounds.width}px`;
    wave.style.height = `${bounds.height}px`;
    wave.style.borderRadius = borderRadius;

    for (let index = 0; index < 3; index += 1) {
      wave.append(document.createElement("i"));
    }

    document.body.append(wave);
    wave.lastElementChild?.addEventListener("animationend", () => wave.remove(), { once: true });

    surface.classList.remove("is-wave-clicked");
    void surface.offsetWidth;
    surface.classList.add("is-wave-clicked");
    window.setTimeout(() => surface.classList.remove("is-wave-clicked"), 780);
  };

  document.addEventListener("pointerdown", (event) => {
    const burst = document.createElement("span");
    burst.className = "pointer-burst";
    burst.setAttribute("aria-hidden", "true");
    burst.style.left = `${event.clientX}px`;
    burst.style.top = `${event.clientY}px`;
    document.body.append(burst);
    burst.addEventListener("animationend", () => burst.remove(), { once: true });

    const surface = event.target.closest?.(surfaceSelector);

    if (surface) {
      createModuleWave(surface);
    }
  });
})();
