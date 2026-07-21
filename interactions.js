(() => {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const createFlowerFall = () => {
    const field = document.createElement("div");
    field.className = "flower-fall";
    field.setAttribute("aria-hidden", "true");

    const flowers = [
      { x: 5, size: 13, duration: 24, delay: -8, drift: 58, opacity: 0.42, blur: 0.2, glyph: "✿" },
      { x: 14, size: 21, duration: 29, delay: -19, drift: -76, opacity: 0.32, blur: 0.6, glyph: "❀" },
      { x: 25, size: 11, duration: 21, delay: -14, drift: 44, opacity: 0.5, blur: 0, glyph: "✿" },
      { x: 36, size: 17, duration: 26, delay: -4, drift: -52, opacity: 0.4, blur: 0.3, glyph: "❀" },
      { x: 48, size: 24, duration: 28, delay: -22, drift: 82, opacity: 0.28, blur: 0.9, glyph: "✿" },
      { x: 59, size: 14, duration: 20, delay: -11, drift: -38, opacity: 0.48, blur: 0, glyph: "❀" },
      { x: 68, size: 19, duration: 27, delay: -17, drift: 66, opacity: 0.36, blur: 0.4, glyph: "✿" },
      { x: 77, size: 12, duration: 23, delay: -6, drift: -48, opacity: 0.5, blur: 0.1, glyph: "❀" },
      { x: 87, size: 22, duration: 30, delay: -25, drift: 70, opacity: 0.3, blur: 0.8, glyph: "✿" },
      { x: 95, size: 15, duration: 22, delay: -16, drift: -42, opacity: 0.44, blur: 0.2, glyph: "❀" },
    ];

    flowers.forEach((flower, index) => {
      const fall = document.createElement("span");
      const bloom = document.createElement("i");
      fall.className = "falling-flower";
      bloom.className = "falling-flower__bloom";
      bloom.textContent = flower.glyph;
      fall.style.setProperty("--flower-x", `${flower.x}%`);
      fall.style.setProperty("--flower-size", `${flower.size}px`);
      fall.style.setProperty("--flower-duration", `${flower.duration}s`);
      fall.style.setProperty("--flower-delay", `${flower.delay}s`);
      fall.style.setProperty("--flower-drift", `${flower.drift}px`);
      fall.style.setProperty("--flower-opacity", flower.opacity);
      fall.style.setProperty("--flower-blur", `${flower.blur}px`);
      fall.style.setProperty("--flower-sway", `${4.8 + (index % 4) * 0.7}s`);
      fall.append(bloom);
      field.append(fall);
    });

    document.body.append(field);
  };

  if (!reducedMotion.matches) {
    createFlowerFall();
  }

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
    cursor.style.transform = `translate3d(${currentX - 4.5}px, ${currentY - 4.5}px, 0)`;

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

  document.addEventListener("pointerdown", (event) => {
    const burst = document.createElement("span");
    burst.className = "pointer-burst";
    burst.setAttribute("aria-hidden", "true");
    burst.style.left = `${event.clientX}px`;
    burst.style.top = `${event.clientY}px`;
    document.body.append(burst);
    burst.addEventListener("animationend", () => burst.remove(), { once: true });
  });
})();
