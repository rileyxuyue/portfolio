(() => {
  "use strict";

  const canvas = document.getElementById("water-surface");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let available = false;
  let frameCount = 0;
  let dropsInjected = 0;
  let simWidth = 0;
  let simHeight = 0;
  const dropQueue = [];

  const unavailableApi = {
    available: false,
    drop() {},
    splashRect() {},
    status: () => ({ available: false }),
  };

  window.portfolioWater = unavailableApi;

  if (!canvas || reduceMotion) {
    return;
  }

  canvas.dataset.waterState = "booting";

  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  });

  if (!gl) {
    canvas.hidden = true;
    canvas.dataset.waterState = "no-webgl";
    return;
  }

  let textureType = null;
  const floatTextures = gl.getExtension("OES_texture_float");
  const floatTargets = gl.getExtension("WEBGL_color_buffer_float");

  if (floatTextures && floatTargets) {
    textureType = gl.FLOAT;
  } else {
    const halfTextures = gl.getExtension("OES_texture_half_float");
    const halfTargets = gl.getExtension("EXT_color_buffer_half_float");

    if (halfTextures && halfTargets) {
      textureType = halfTextures.HALF_FLOAT_OES;
    }
  }

  if (!textureType) {
    canvas.hidden = true;
    canvas.dataset.waterState = "no-float-texture";
    return;
  }

  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }

    return shader;
  };

  const createProgram = (vertexSource, fragmentSource) => {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }

    return program;
  };

  const vertexShader = `
    attribute vec2 aPosition;
    varying vec2 vUv;

    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const simulationShader = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uPrevious;
    uniform vec2 uTexel;
    uniform vec2 uDrop;
    uniform float uDropRadius;
    uniform float uDropStrength;

    void main() {
      vec2 state = texture2D(uPrevious, vUv).rg;
      float height = state.r;
      float velocity = state.g;
      float leftHeight = texture2D(uPrevious, vUv - vec2(uTexel.x, 0.0)).r;
      float rightHeight = texture2D(uPrevious, vUv + vec2(uTexel.x, 0.0)).r;
      float downHeight = texture2D(uPrevious, vUv - vec2(0.0, uTexel.y)).r;
      float upHeight = texture2D(uPrevious, vUv + vec2(0.0, uTexel.y)).r;
      float average = (leftHeight + rightHeight + downHeight + upHeight) * 0.25;

      velocity += (average - height) * 2.0;
      velocity *= 0.994;
      height += velocity;
      height *= 0.9992;

      if (uDrop.x >= 0.0) {
        float distanceFromDrop = distance(vUv, uDrop);
        height += uDropStrength * exp(
          -distanceFromDrop * distanceFromDrop / (uDropRadius * uDropRadius)
        );
      }

      gl_FragColor = vec4(height, velocity, 0.0, 1.0);
    }
  `;

  const renderShader = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uHeight;
    uniform vec2 uTexel;

    void main() {
      float leftHeight = texture2D(uHeight, vUv - vec2(uTexel.x, 0.0)).r;
      float rightHeight = texture2D(uHeight, vUv + vec2(uTexel.x, 0.0)).r;
      float downHeight = texture2D(uHeight, vUv - vec2(0.0, uTexel.y)).r;
      float upHeight = texture2D(uHeight, vUv + vec2(0.0, uTexel.y)).r;
      float height = texture2D(uHeight, vUv).r;
      vec2 gradient = vec2(rightHeight - leftHeight, upHeight - downHeight);
      float slope = length(gradient);
      float ridge = smoothstep(0.001, 0.026, slope);
      float body = smoothstep(0.002, 0.035, abs(height));
      vec3 normal = normalize(vec3(-gradient * 8.0, 1.0));
      vec3 lightDirection = normalize(vec3(-0.35, 0.5, 0.78));
      float highlight = pow(max(dot(normal, lightDirection), 0.0), 110.0);
      float crest = smoothstep(-0.018, 0.022, height);
      vec3 coolTrough = vec3(0.24, 0.54, 0.64);
      vec3 warmCrest = vec3(0.74, 0.42, 0.72);
      vec3 color = mix(coolTrough, warmCrest, crest);
      color = mix(color, vec3(1.0, 0.98, 0.94), highlight * 0.72);
      float alpha = clamp(ridge * 0.42 + body * 0.1 + highlight * 0.32, 0.0, 0.56);

      gl_FragColor = vec4(color, alpha);
    }
  `;

  let simulationProgram;
  let renderProgram;

  try {
    simulationProgram = createProgram(vertexShader, simulationShader);
    renderProgram = createProgram(vertexShader, renderShader);
  } catch (error) {
    canvas.hidden = true;
    canvas.dataset.waterState = "shader-error";
    return;
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const bindQuad = (program) => {
    const location = gl.getAttribLocation(program, "aPosition");
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  };

  let targets = [];
  let currentTarget = 0;

  const createTarget = (width, height) => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      textureType,
      null,
    );

    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteTexture(texture);
      gl.deleteFramebuffer(framebuffer);
      return null;
    }

    return { texture, framebuffer };
  };

  const resize = () => {
    const deviceScale = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(window.innerWidth * deviceScale);
    canvas.height = Math.floor(window.innerHeight * deviceScale);
    simWidth = Math.min(560, Math.max(220, Math.floor(canvas.width * 0.36)));
    simHeight = Math.min(360, Math.max(180, Math.floor(canvas.height * 0.36)));

    targets.forEach((target) => {
      gl.deleteTexture(target.texture);
      gl.deleteFramebuffer(target.framebuffer);
    });

    targets = [createTarget(simWidth, simHeight), createTarget(simWidth, simHeight)];

    if (targets.some((target) => !target)) {
      available = false;
      canvas.hidden = true;
      canvas.dataset.waterState = "framebuffer-error";
      return;
    }

    targets.forEach((target) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.viewport(0, 0, simWidth, simHeight);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    });

    currentTarget = 0;
    available = true;
    canvas.dataset.waterState = "targets-ready";
  };

  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(resize);
  });
  resize();

  const queueDrop = (clientX, clientY, strength, radius) => {
    if (!available) {
      return;
    }

    dropQueue.push({
      x: clientX / window.innerWidth,
      y: 1 - clientY / window.innerHeight,
      strength,
      radius,
    });

    if (dropQueue.length > 28) {
      dropQueue.splice(0, dropQueue.length - 28);
    }
  };

  let lastPointerX = null;
  let lastPointerY = null;
  let lastPointerTime = 0;

  window.addEventListener(
    "pointermove",
    (event) => {
      const now = window.performance.now();

      if (now - lastPointerTime < 36) {
        return;
      }

      let speed = 8;

      if (lastPointerX !== null) {
        speed = Math.hypot(event.clientX - lastPointerX, event.clientY - lastPointerY);
      }

      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      lastPointerTime = now;
      queueDrop(event.clientX, event.clientY, Math.min(speed / 720, 0.04) + 0.003, 0.013);
    },
    { passive: true },
  );

  window.addEventListener(
    "pointerdown",
    (event) => {
      const surface = event.target.closest?.(".portrait-photo, .project-card");

      queueDrop(
        event.clientX,
        event.clientY,
        surface ? 0.1 : 0.18,
        surface ? 0.016 : 0.02,
      );

      if (surface) {
        splashRect(surface.getBoundingClientRect());
      }
    },
    { passive: true },
  );

  const splashRect = (rect) => {
    const points = [
      [0.5, 0.12],
      [0.88, 0.5],
      [0.5, 0.88],
      [0.12, 0.5],
    ];

    points.forEach(([xRatio, yRatio]) => {
      queueDrop(
        rect.left + rect.width * xRatio,
        rect.top + rect.height * yRatio,
        0.06,
        0.014,
      );
    });
  };

  const simulationUniforms = {
    previous: gl.getUniformLocation(simulationProgram, "uPrevious"),
    texel: gl.getUniformLocation(simulationProgram, "uTexel"),
    drop: gl.getUniformLocation(simulationProgram, "uDrop"),
    radius: gl.getUniformLocation(simulationProgram, "uDropRadius"),
    strength: gl.getUniformLocation(simulationProgram, "uDropStrength"),
  };
  const renderUniforms = {
    height: gl.getUniformLocation(renderProgram, "uHeight"),
    texel: gl.getUniformLocation(renderProgram, "uTexel"),
  };

  const frame = () => {
    if (!available || document.hidden) {
      window.requestAnimationFrame(frame);
      return;
    }

    const drop = dropQueue.shift();
    gl.disable(gl.BLEND);
    gl.useProgram(simulationProgram);
    bindQuad(simulationProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[1 - currentTarget].framebuffer);
    gl.viewport(0, 0, simWidth, simHeight);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[currentTarget].texture);
    gl.uniform1i(simulationUniforms.previous, 0);
    gl.uniform2f(simulationUniforms.texel, 1 / simWidth, 1 / simHeight);
    gl.uniform2f(simulationUniforms.drop, drop ? drop.x : -1, drop ? drop.y : -1);
    gl.uniform1f(simulationUniforms.radius, drop ? drop.radius : 0.014);
    gl.uniform1f(simulationUniforms.strength, drop ? drop.strength : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    currentTarget = 1 - currentTarget;

    if (drop) {
      dropsInjected += 1;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(renderProgram);
    bindQuad(renderProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[currentTarget].texture);
    gl.uniform1i(renderUniforms.height, 0);
    gl.uniform2f(renderUniforms.texel, 1 / simWidth, 1 / simHeight);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    frameCount += 1;

    if (frameCount % 30 === 0) {
      canvas.dataset.waterFrames = String(frameCount);
      canvas.dataset.waterDrops = String(dropsInjected);
      canvas.dataset.waterQueue = String(dropQueue.length);
      canvas.dataset.waterSimulation = `${simWidth}x${simHeight}`;
    }

    window.requestAnimationFrame(frame);
  };

  window.portfolioWater = {
    available: true,
    drop: queueDrop,
    splashRect,
    status: () => ({
      available,
      frameCount,
      dropsInjected,
      queuedDrops: dropQueue.length,
      simulation: { width: simWidth, height: simHeight },
    }),
  };

  canvas.dataset.waterState = "running";

  window.requestAnimationFrame(frame);
})();
