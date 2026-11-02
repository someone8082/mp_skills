(() => {
  'use strict'
  const dialog = document.getElementById('fv-dialog')
  if (!dialog || dialog.dataset.initialized) return
  dialog.dataset.initialized = 'true'
  const get = selector => dialog.querySelector(selector)
  const viewport = get('[data-fv-viewport]'), image = get('[data-fv-image]')
  const scaleLabel = get('[data-fv-scale]'), quality = get('[data-fv-quality]')
  const pointers = new Map()
  const MIN = 1, MAX = 12
  let active = false, opener = null, oldOverflow = '', intrinsicWidth = 1, intrinsicHeight = 1
  let baseWidth = 1, baseHeight = 1, zoom = 1, x = 0, y = 0, gesture = null, fallback = ''
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
  const bounds = () => viewport.getBoundingClientRect()
  const local = event => { const box = bounds(); return { x: event.clientX - box.left, y: event.clientY - box.top } }
  function render() {
    const box = bounds(), width = baseWidth * zoom, height = baseHeight * zoom
    x = width <= box.width ? (box.width - width) / 2 : clamp(x, box.width - width, 0)
    y = height <= box.height ? (box.height - height) / 2 : clamp(y, box.height - height, 0)
    image.style.width = `${baseWidth}px`; image.style.height = `${baseHeight}px`
    image.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`
    scaleLabel.textContent = `${Math.round(zoom * 100)}%`
    get('[data-fv-action="out"]').disabled = zoom <= MIN
    get('[data-fv-action="in"]').disabled = zoom >= MAX
  }
  function fit() {
    if (!active) return
    const box = bounds()
    if (!(box.width > 0 && box.height > 0)) return
    const ratio = Math.min(box.width / intrinsicWidth, box.height / intrinsicHeight)
    baseWidth = intrinsicWidth * ratio; baseHeight = intrinsicHeight * ratio
    zoom = 1; x = (box.width - baseWidth) / 2; y = (box.height - baseHeight) / 2
    clearPointers(); render()
  }
  function zoomAt(next, point) {
    next = clamp(next, MIN, MAX)
    x = point.x - (point.x - x) * next / zoom
    y = point.y - (point.y - y) * next / zoom
    zoom = next; render()
  }
  function clearPointers() {
    const ids = [...pointers.keys()]
    pointers.clear(); gesture = null; viewport.classList.remove('fv-dragging')
    for (const id of ids) { try { viewport.releasePointerCapture?.(id) } catch { /* Already released by the browser. */ } }
  }
  function finishClose() {
    if (!active) return
    active = false; clearPointers(); document.body.style.overflow = oldOverflow
    dialog.removeAttribute('open'); dialog.removeAttribute('aria-modal')
    image.removeAttribute('src')
    if (opener?.isConnected) opener.focus({ preventScroll: true })
  }
  function close() {
    if (!active) return
    if (typeof dialog.close === 'function' && dialog.open) dialog.close()
    finishClose()
  }
  function open(button) {
    const figure = button.closest('.fv-figure')
    if (!figure) return
    opener = button
    intrinsicWidth = Number(figure.dataset.fvWidth) || 1
    intrinsicHeight = Number(figure.dataset.fvHeight) || 1
    const preview = figure.querySelector('img')
    if (!(Number(figure.dataset.fvWidth) > 0)) {
      intrinsicWidth = preview.naturalWidth || preview.width || 800
      intrinsicHeight = preview.naturalHeight || preview.height || 450
    }
    fallback = figure.dataset.fvKind === 'vector' ? preview.src : ''
    get('#fv-title').textContent = figure.dataset.fvTitle
    image.alt = preview.alt
    quality.textContent = figure.dataset.fvKind === 'vector' ? 'SVG矢量图 · 放大保持清晰' : '原图查看 · 放大后的清晰度受原图限制'
    oldOverflow = document.body.style.overflow
    active = true
    if (typeof dialog.showModal === 'function') {
      try { dialog.showModal() } catch { dialog.setAttribute('open', '') }
    } else dialog.setAttribute('open', '')
    dialog.setAttribute('aria-modal', 'true')
    document.body.style.overflow = 'hidden'
    image.src = figure.dataset.fvSrc
    fit(); get('[data-fv-action="close"]').focus({ preventScroll: true })
  }
  for (const button of document.querySelectorAll('[data-fv-open]')) button.addEventListener('click', () => open(button))
  dialog.addEventListener('cancel', event => { event.preventDefault(); close() })
  // A previous close event may be queued when the user has already reopened a figure.
  dialog.addEventListener('close', () => { if (!dialog.open) finishClose() })
  dialog.addEventListener('click', event => {
    const button = event.target.closest('[data-fv-action]')
    if (!button || !active) return
    const action = button.dataset.fvAction, box = bounds()
    if (action === 'close') close()
    else if (action === 'fit' || action === 'reset') fit()
    else zoomAt(zoom * (action === 'in' ? 1.3 : 1 / 1.3), { x: box.width / 2, y: box.height / 2 })
  })
  image.addEventListener('error', () => {
    if (!active) return
    quality.textContent = '原图查看 · 放大后的清晰度受原图限制'
    if (fallback) { const src = fallback; fallback = ''; image.src = src }
  })
  image.addEventListener('load', () => {
    if (active && image.src.startsWith('data:image/png') && image.naturalWidth > 0) {
      intrinsicWidth = image.naturalWidth; intrinsicHeight = image.naturalHeight; fit()
    }
  })
  viewport.addEventListener('wheel', event => {
    if (!active) return
    event.preventDefault()
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds().height : 1)
    zoomAt(zoom * Math.exp(clamp(-delta * .002, -2, 2)), local(event))
    rebase()
  }, { passive: false })
  function rebase() {
    const pts = [...pointers.values()]
    if (!pts.length) { gesture = null; return }
    const a = pts[0], b = pts[1] || a
    gesture = { x, y, zoom, center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) }
  }
  viewport.addEventListener('pointerdown', event => {
    if (!active || event.button !== 0 || pointers.size >= 2) return
    event.preventDefault(); pointers.set(event.pointerId, local(event))
    try { viewport.setPointerCapture?.(event.pointerId) } catch { /* Capture is optional on older hosts. */ }
    viewport.classList.add('fv-dragging'); rebase()
  })
  viewport.addEventListener('pointermove', event => {
    if (!active || !pointers.has(event.pointerId) || !gesture) return
    event.preventDefault(); pointers.set(event.pointerId, local(event))
    const pts = [...pointers.values()], a = pts[0], b = pts[1] || a
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const next = pts.length === 2 && gesture.distance > 0 ? clamp(gesture.zoom * Math.hypot(a.x - b.x, a.y - b.y) / gesture.distance, MIN, MAX) : gesture.zoom
    x = center.x - (gesture.center.x - gesture.x) * next / gesture.zoom
    y = center.y - (gesture.center.y - gesture.y) * next / gesture.zoom
    zoom = next; render()
  })
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) viewport.addEventListener(name, event => {
    pointers.delete(event.pointerId); rebase()
    if (!pointers.size) viewport.classList.remove('fv-dragging')
  })
  document.addEventListener('keydown', event => {
    if (!active) return
    if (event.key === 'Escape') { event.preventDefault(); close(); return }
    if (event.key === 'Tab') {
      const nodes = [...dialog.querySelectorAll('button:not(:disabled), [tabindex="0"]')]
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus() }
      return
    }
    const box = bounds()
    if (['+', '=', '-', '−', '0', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault()
      if (event.key === '0') fit()
      else if (['+', '=', '-', '−'].includes(event.key)) zoomAt(zoom * (['+', '='].includes(event.key) ? 1.3 : 1 / 1.3), { x: box.width / 2, y: box.height / 2 })
      else { x += event.key === 'ArrowRight' ? 40 : event.key === 'ArrowLeft' ? -40 : 0; y += event.key === 'ArrowDown' ? 40 : event.key === 'ArrowUp' ? -40 : 0; render() }
      rebase()
    }
  })
  window.addEventListener('resize', fit)
  window.addEventListener('blur', clearPointers)
})()
