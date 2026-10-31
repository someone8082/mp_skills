/**
 * SMIL 动画原语（零依赖，纯 SVG）。
 *
 * 设计纪律：
 * - 承接 anatomy「每一个数都来自同一个模型」与 solver-lab 确定性口径：
 *   调用方通过 modelTrack 提供模型函数 at(eased, raw) → 数值，本模块只按帧
 *   采样成 SMIL values；浏览器侧 calcMode="linear" 播放，不产生任何
 *   「编造」的中间值。动画因此是可复算的：换模型即换动画。
 * - 产物是单个 .svg 文件，浏览器/预览器原生播放，无需 JS 运行时。
 * - 尊重 prefers-reduced-motion：SVG 文档样式（见 figure.mjs 的
 *   SVG_STYLE）在 reduce 时隐藏动画元素，SMIL 随之失效，画面保持基础值
 *   （即动画第 0 帧，对运动学即 t=0 初始态）。
 */

/** 数字格式化：3 位小数、去尾零，SMIL values 对空白敏感不能用科学计数法。 */
function num(value) {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 1000) / 1000
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

/** 缓动函数库（t ∈ [0,1] → [0,1]）。 */
export const EASINGS = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeOutBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
}

/** 按名取缓动（未知名回退 linear），输入裁剪到 [0,1]。 */
export function ease(name, t) {
  const fn = EASINGS[name] ?? EASINGS.linear
  return fn(Math.min(1, Math.max(0, t)))
}

/**
 * 模型轨道：把模型函数采样成 SMIL values/keyTimes。
 * at 的返回值支持三种：number（单值属性）、number[]（如 translate 的
 * "dx dy"，逐元素格式化）、string（调用方自行格式化）。
 * @param {{duration?: number, fps?: number, easing?: keyof EASINGS|string,
 *          at: (eased: number, raw: number) => number|number[]|string}} options
 * @returns {{values: string, keyTimes: string, duration: number, frames: number}}
 */
export function modelTrack({ duration = 2, fps = 30, easing = 'linear', at }) {
  const frames = Math.max(2, Math.round(duration * fps))
  const values = []
  const keyTimes = []
  for (let i = 0; i <= frames; i += 1) {
    const raw = i / frames
    const value = at(ease(easing, raw), raw)
    if (Array.isArray(value)) values.push(value.map((v) => num(v)).join(' '))
    else values.push(typeof value === 'number' ? num(value) : String(value))
    keyTimes.push(num(Math.round(raw * 10000) / 10000))
  }
  // SMIL 规范：keyTimes 首末必须恰为 0/1，且数量与 values 一致
  keyTimes[0] = '0'
  keyTimes[keyTimes.length - 1] = '1'
  return { values: values.join(';'), keyTimes: keyTimes.join(';'), duration, frames: frames + 1 }
}

/**
 * 属性动画 <animate>。
 * @param {{attribute: string, values: string, keyTimes?: string, duration?: number,
 *          repeat?: string|number, begin?: string, calcMode?: string}} options
 * repeat 为 0/false 表示播放一次（fill="freeze" 保持终值）。
 */
export function animate({
  attribute,
  values,
  keyTimes,
  duration = 2,
  repeat = 'indefinite',
  begin = '0s',
  calcMode = 'linear',
}) {
  const repeatAttr = repeat === 0 || repeat === '0' || repeat === false
    ? ' repeatCount="1" fill="freeze"'
    : ` repeatCount="${repeat}"`
  return `<animate attributeName="${attribute}" values="${values}"${keyTimes ? ` keyTimes="${keyTimes}"` : ''} dur="${duration}s" begin="${begin}" calcMode="${calcMode}"${repeatAttr}/>`
}

/** 变换动画 <animateTransform>（type: translate|scale|rotate）。values 为字符串（如 "0 0;10 5"）。 */
export function animateTransform({
  type = 'translate',
  values,
  keyTimes,
  duration = 2,
  repeat = 'indefinite',
  begin = '0s',
  additive = 'replace',
}) {
  const repeatAttr = repeat === 0 || repeat === '0' || repeat === false
    ? ' repeatCount="1" fill="freeze"'
    : ` repeatCount="${repeat}"`
  return `<animateTransform attributeName="transform" type="${type}" values="${values}"${keyTimes ? ` keyTimes="${keyTimes}"` : ''} dur="${duration}s" begin="${begin}" additive="${additive}"${repeatAttr}/>`
}

/**
 * 路径运动 <animateMotion>：元素沿 path 移动。
 * @param {{path: string, duration?: number, repeat?: string|number, begin?: string,
 *          rotate?: 'auto'|'auto-reverse'|'0'|number, keyPoints?: string}} options
 */
export function animateMotion({
  path,
  duration = 2,
  repeat = 'indefinite',
  begin = '0s',
  rotate = 'auto',
  keyPoints,
}) {
  const repeatAttr = repeat === 0 || repeat === '0' || repeat === false
    ? ' repeatCount="1" fill="freeze"'
    : ` repeatCount="${repeat}"`
  const rotateAttr = rotate === 'auto' || rotate === 'auto-reverse' ? ` rotate="${rotate}"` : ''
  return `<animateMotion${rotateAttr} path="${path}"${keyPoints ? ` keyPoints="${keyPoints}"` : ''} dur="${duration}s" begin="${begin}"${repeatAttr}/>`
}

/** 折线总长（2D 屏幕坐标）。 */
export function polylineLength(points) {
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
  }
  return total
}

/**
 * 「画线」动画：stroke-dashoffset 由总长 → 0，线条被逐步画出。
 * 返回 { d, length, svg }，svg 是完整 path 元素串（动画内嵌为子元素）。
 * @param {number[][]} points 屏幕坐标折线
 * @param {{duration?: number, begin?: string, color?: string, width?: number,
 *          repeat?: string|number, easing?: string, opacity?: number, fps?: number}} options
 */
export function drawPolyline(points, {
  duration = 1,
  begin = '0s',
  color = '#2563eb',
  width = 2,
  repeat = 0,
  easing = 'linear',
  opacity = 1,
  fps = 30,
} = {}) {
  const d = `M ${points.map((p) => `${num(p[0])} ${num(p[1])}`).join(' L ')}`
  const len = polylineLength(points)
  const track = modelTrack({
    duration,
    fps,
    easing,
    at: (eased) => len * (1 - eased),
  })
  return {
    d,
    length: len,
    svg: `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" opacity="${opacity}" stroke-dasharray="${num(len)}">`
      + animate({ attribute: 'stroke-dashoffset', values: track.values, keyTimes: track.keyTimes, duration, begin, repeat })
      + '</path>',
  }
}

/**
 * 脉冲圆环：半径 r0→r1 同时透明度淡出，用于高亮像点/交点/圆心。
 * @returns {string} 完整的 <circle> 元素串
 */
export function pulse(cx, cy, {
  r0 = 2,
  r1 = 14,
  color = '#dc2626',
  duration = 1.2,
  begin = '0s',
  repeat = 'indefinite',
  width = 2,
} = {}) {
  return `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r0)}" fill="none" stroke="${color}" stroke-width="${width}">`
    + animate({ attribute: 'r', values: `${num(r0)};${num(r1)}`, duration, begin, repeat })
    + animate({ attribute: 'opacity', values: '0.9;0', duration, begin, repeat })
    + '</circle>'
}

/**
 * 闪烁点（透明度脉冲），用于电流方向指示、关注点提示。
 */
export function blink(cx, cy, {
  r = 3,
  color = '#dc2626',
  duration = 0.9,
  begin = '0s',
  repeat = 'indefinite',
} = {}) {
  return `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" fill="${color}">`
    + animate({ attribute: 'opacity', values: '1;0.15;1', duration, begin, repeat })
    + '</circle>'
}
