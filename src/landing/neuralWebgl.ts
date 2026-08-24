type NeuralPointerState = {
  x: number;
  y: number;
  active: boolean;
};

type NeuralWebglOptions = {
  getEnergy?: () => number;
  getReactive?: () => boolean;
  getPointer?: () => NeuralPointerState | null;
};

const MAX_PIXEL_COUNT = 2_250_000;

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform float u_energy;
uniform float u_pixelRatio;
uniform float u_visibility;
out vec4 outColor;

#define PI 3.14159265359

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float field(vec2 p, float t) {
  float n = noise(p * 2.6 + vec2(t * 0.06, -t * 0.04));
  n += 0.5 * noise(p * 5.3 - vec2(t * 0.1, t * 0.08));
  return n / 1.5;
}

vec2 toAspect(vec2 p) {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  p.x *= aspect;
  return p;
}

float lineSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = toAspect(uv - 0.5);
  vec2 pointer = toAspect(u_pointer - 0.5);
  vec2 cameraOffset = pointer * vec2(0.038, 0.030);
  p -= cameraOffset;
  float t = u_time * (0.28 + u_energy * 0.32);
  float pointerDistance = length(p - pointer);
  float pointerInfluence = exp(-pointerDistance * 3.0) * (0.10 + u_energy * 0.12);
  p += normalize(p + vec2(0.0001)) * pointerInfluence;

  vec3 color = vec3(0.0);
  float network = 0.0;
  float glow = 0.0;

  for (int i = 0; i < 18; i++) {
    float fi = float(i);
    float seed = hash31(vec3(fi, 7.0, 2.0));
    float angle = seed * PI * 2.0 + t * (0.08 + seed * 0.12);
    float radius = 0.10 + hash31(vec3(seed, 4.0, 9.0)) * 0.55;
    vec2 node = vec2(cos(angle), sin(angle) * 0.74) * radius;
    node += vec2(
      sin(t * 0.7 + fi * 1.37),
      cos(t * 0.52 + fi * 1.91)
    ) * (0.018 + u_energy * 0.018);

    // Subtle seed-driven parallax: near nodes respond more strongly while
    // deeper nodes drift slightly against the pointer direction.
    float depth = mix(-0.10, 0.34, seed);
    node += pointer * depth * (0.055 + u_energy * 0.018);

    float distanceToNode = length(p - node);
    float nodeGlow = exp(-distanceToNode * (58.0 - u_energy * 10.0)) * 0.20;
    float nodeCore = exp(-distanceToNode * 260.0) * 0.035;
    glow += nodeGlow * 0.34;

    vec3 electricBlue = vec3(0.216, 0.773, 1.0);
    vec3 violet = vec3(0.490, 0.420, 1.0);
    vec3 livingGreen = vec3(0.157, 0.941, 0.710);
    vec3 auroraGold = vec3(0.965, 0.769, 0.325);
    vec3 nodeColor =
      seed < 0.40 ? electricBlue :
      seed < 0.65 ? violet :
      seed < 0.85 ? livingGreen :
                    auroraGold;

    color += nodeColor * nodeGlow * 0.34;
    color += mix(vec3(1.0, 0.95, 0.78), auroraGold, 0.44) * nodeCore * (0.20 + u_energy * 0.30);

    for (int j = 0; j < 4; j++) {
      float fj = float(j);
      float otherSeed = hash31(vec3(fi + fj + 1.0, 11.0, 5.0));
      float otherAngle = otherSeed * PI * 2.0 + t * (0.08 + otherSeed * 0.12);
      float otherRadius = 0.10 + hash31(vec3(otherSeed, 4.0, 9.0)) * 0.55;
      vec2 other = vec2(cos(otherAngle), sin(otherAngle) * 0.74) * otherRadius;
      other += vec2(
        sin(t * 0.7 + (fi + fj + 1.0) * 1.37),
        cos(t * 0.52 + (fi + fj + 1.0) * 1.91)
      ) * (0.018 + u_energy * 0.018);
      float otherDepth = mix(-0.10, 0.34, otherSeed);
      other += pointer * otherDepth * (0.055 + u_energy * 0.018);
      float edge = lineSegment(p, node, other);
      network += exp(-edge * (104.0 - u_energy * 32.0)) * 0.31;
    }
  }

  float wave = sin(t * 1.2 - length(p) * 13.0) * 0.5 + 0.5;
  float core = exp(-length(p) * (4.2 - u_energy * 0.8));
  float noiseField = field(p * 1.6, t) * 0.12;
  vec3 electricBlue = vec3(0.216, 0.773, 1.0);
  vec3 violet = vec3(0.490, 0.420, 1.0);
  vec3 livingGreen = vec3(0.157, 0.941, 0.710);
  vec3 auroraGold = vec3(0.965, 0.769, 0.325);

  float spectralPhase = sin(t * 0.34 + length(p) * 5.2) * 0.5 + 0.5;
  vec3 spectralNetwork = mix(electricBlue, violet, spectralPhase * 0.58);
  spectralNetwork = mix(spectralNetwork, livingGreen, 0.18 + wave * 0.08);

  color += spectralNetwork * network * (0.62 + wave * 0.48);
  color += mix(violet, electricBlue, 0.46) * glow * 0.010;
  color += auroraGold * glow * 0.008;
  color += mix(auroraGold, electricBlue, 0.24) * core * (0.18 + u_energy * 0.13);
  color += mix(electricBlue, violet, 0.38) * noiseField;

  float vignette = smoothstep(1.18, 0.18, length(p));
  float alpha = (0.12 + network * 0.72 + glow * 0.035 + core * 0.16) * vignette * u_visibility;
  outColor = vec4(color * 1.12, alpha);
}
`;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export function initNeuralWebgl(
  canvas: HTMLCanvasElement,
  stage: HTMLElement,
  options: NeuralWebglOptions = {},
) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reducedMotion.matches) return null;

  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  if (!gl) return null;

  const program = createProgram(gl);
  if (!program) return null;

  const buffer = gl.createBuffer();
  if (!buffer) {
    gl.deleteProgram(program);
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const positionLocation = gl.getAttribLocation(program, "a_position");
  const uniforms = {
    time: gl.getUniformLocation(program, "u_time"),
    resolution: gl.getUniformLocation(program, "u_resolution"),
    pointer: gl.getUniformLocation(program, "u_pointer"),
    energy: gl.getUniformLocation(program, "u_energy"),
    pixelRatio: gl.getUniformLocation(program, "u_pixelRatio"),
    visibility: gl.getUniformLocation(program, "u_visibility"),
  };

  // Keep input and rendered pointer separate so camera/parallax motion eases
  // toward the user's intent instead of snapping on every pointer event.
  const pointer = { x: 0.5, y: 0.5 };
  const pointerTarget = { x: 0.5, y: 0.5, active: false };
  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let raf = 0;
  let disposed = false;
  let inViewport = true;
  let lastTime = 0;

  const resize = () => {
    const rect = stage.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const maxRatio = Math.sqrt(MAX_PIXEL_COUNT / Math.max(1, width * height));
    pixelRatio = Math.min(pixelRatio, Math.max(0.75, maxRatio));
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const pointerMove = (event: PointerEvent) => {
    const rect = stage.getBoundingClientRect();
    pointerTarget.x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    pointerTarget.y = 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    pointerTarget.active = true;
  };
  const pointerLeave = () => {
    pointerTarget.active = false;
  };
  const schedule = () => {
    if (!disposed && raf === 0) {
      raf = window.requestAnimationFrame(draw);
    }
  };

  const draw = (now: number) => {
    raf = 0;
    if (disposed) return;
    const isVisible = inViewport && document.visibilityState === "visible";
    if (!isVisible) return;
    const externalPointer = options.getPointer?.();
    if (externalPointer?.active) {
      pointerTarget.active = true;
      pointerTarget.x = Math.min(1, Math.max(0, externalPointer.x));
      pointerTarget.y = Math.min(1, Math.max(0, externalPointer.y));
    }

    const reactive = options.getReactive?.() ? 1 : 0;
    const audioEnergy = Math.min(1, Math.max(0, options.getEnergy?.() || 0));
    const energy = reactive * audioEnergy;
    const delta = lastTime ? Math.min(40, now - lastTime) : 16;
    lastTime = now;
    if (isVisible) {
      // ~260 ms inertial follow keeps the scene responsive without feeling
      // attached to the cursor. Leaving the stage recenters it organically.
      const smoothing = Math.min(1, delta / 260);
      const targetX = pointerTarget.active ? pointerTarget.x : 0.5;
      const targetY = pointerTarget.active ? pointerTarget.y : 0.5;
      pointer.x += (targetX - pointer.x) * smoothing;
      pointer.y += (targetY - pointer.y) * smoothing;
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(uniforms.time, now * 0.001);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform2f(uniforms.pointer, pointer.x, pointer.y);
      gl.uniform1f(uniforms.energy, energy);
      gl.uniform1f(uniforms.pixelRatio, pixelRatio);
      gl.uniform1f(uniforms.visibility, 1);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      canvas.dataset.neuralMotion = "running";
      canvas.dataset.neuralFrame = String(Math.floor(now / 120));
    }
    schedule();
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") schedule();
  };

  const resizeObserver = "ResizeObserver" in window
    ? new ResizeObserver(resize)
    : null;
  resizeObserver?.observe(stage);
  window.addEventListener("resize", resize, { passive: true });
  stage.addEventListener("pointermove", pointerMove, { passive: true });
  stage.addEventListener("pointerleave", pointerLeave, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  resize();
  schedule();

  return {
    destroy() {
      disposed = true;
      window.cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      stage.removeEventListener("pointermove", pointerMove);
      stage.removeEventListener("pointerleave", pointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      delete canvas.dataset.neuralMotion;
      delete canvas.dataset.neuralFrame;
    },
    setViewport(value: boolean) {
      inViewport = value;
      if (value) schedule();
    },
  };
}
