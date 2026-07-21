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
