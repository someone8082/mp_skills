// visualViewport tracks mobile keyboards and browser chrome without disabling zoom.
export function trackViewport(win) {
  const viewport=win.visualViewport,root=win.document.documentElement
  function update() {
    const zoomed=(viewport?.scale||1)>1.05
    const height=Math.max(1,zoomed?win.innerHeight:(viewport?.height||win.innerHeight))
    const top=zoomed?0:Math.max(0,viewport?.offsetTop||0)
    root.style.setProperty('--visible-height',`${height}px`)
    root.style.setProperty('--visible-top',`${top}px`)
    root.style.setProperty('--bottom-occlusion',`${zoomed?0:Math.max(0,win.innerHeight-height-top)}px`)
    win.document.body.dataset.zoomed=String(zoomed)
  }
  win.addEventListener('resize',update)
  viewport?.addEventListener('resize',update)
  viewport?.addEventListener('scroll',update)
  update()
}
