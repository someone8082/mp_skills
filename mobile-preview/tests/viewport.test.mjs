import {test} from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {trackViewport} from '../src/viewport.mjs'

test('keyboard and toolbar changes keep controls within the visible viewport',()=>{
  const {window}=new JSDOM('<body></body>')
  Object.defineProperty(window,'innerHeight',{value:844,writable:true})
  const viewport=new window.EventTarget()
  Object.assign(viewport,{height:844,offsetTop:0,scale:1})
  Object.defineProperty(window,'visualViewport',{value:viewport})
  trackViewport(window)
  const style=window.document.documentElement.style
  assert.equal(style.getPropertyValue('--visible-height'),'844px')
  viewport.height=420;viewport.offsetTop=24;viewport.dispatchEvent(new window.Event('resize'))
  assert.equal(style.getPropertyValue('--visible-height'),'420px')
  assert.equal(style.getPropertyValue('--visible-top'),'24px')
  assert.equal(style.getPropertyValue('--bottom-occlusion'),'400px')
  viewport.height=800;viewport.offsetTop=0;viewport.dispatchEvent(new window.Event('scroll'))
  assert.equal(style.getPropertyValue('--bottom-occlusion'),'44px')
  viewport.height=844;viewport.dispatchEvent(new window.Event('resize'))
  assert.equal(style.getPropertyValue('--bottom-occlusion'),'0px')
})

test('pinch zoom leaves page navigation available without a fixed toolbar covering reading',()=>{
  const {window}=new JSDOM('<body></body>')
  const viewport=new window.EventTarget()
  Object.assign(viewport,{height:300,offsetTop:15,scale:2})
  Object.defineProperty(window,'visualViewport',{value:viewport})
  trackViewport(window)
  assert.equal(window.document.body.dataset.zoomed,'true')
  viewport.scale=1;viewport.dispatchEvent(new window.Event('resize'))
  assert.equal(window.document.body.dataset.zoomed,'false')
})

test('older browsers without visualViewport respond to ordinary window resizing',()=>{
  const {window}=new JSDOM('<body></body>')
  Object.defineProperty(window,'innerHeight',{value:600,writable:true})
  trackViewport(window)
  window.innerHeight=360;window.dispatchEvent(new window.Event('resize'))
  assert.equal(window.document.documentElement.style.getPropertyValue('--visible-height'),'360px')
  assert.equal(window.document.documentElement.style.getPropertyValue('--bottom-occlusion'),'0px')
})
