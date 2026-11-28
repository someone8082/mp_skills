import assert from 'node:assert/strict'
import test from 'node:test'
import { createCamera, figureMotionTrack, figureOptics, figureOpticsAnim } from '../solver-lab/kit/figure.mjs'
import { solveSpec } from '../solver-lab/scripts/solve-lib.mjs'

function xy(svg, attr) {
  return svg.match(new RegExp(`${attr}="([^"]+)"`))[1].split(/[ ,]+/).map(Number)
}

function frames(svg) {
  return [...svg.matchAll(/<animateTransform [^>]*type="translate" values="([^"]+)"/g)]
    .map(match => match[1].split(';').map(pair => pair.split(' ').map(Number)))
}

test('changing focal length changes static construction and real images are inverted', () => {
  const short = figureOptics({ f: 10, u: 30 }).parts.join('')
  const long = figureOptics({ f: 20, u: 30 }).parts.join('')
  assert.notEqual(short, long)
  for (const render of [figureOptics, figureOpticsAnim]) {
    const svg = render({ f: 10, u: 15 }).parts.join('').split('<g class="still-only">')[0]
    const image = svg.match(/<line [^>]*class="lens-image"[^>]*>/)?.[0]
    assert.ok(image, 'show an image in both diagrams')
    assert.ok(xy(image, 'y2')[0] > xy(image, 'y1')[0], 'real image points below the axis')
    const imageTip = [xy(image, 'x2')[0], xy(image, 'y2')[0]]
    const rays = [...svg.matchAll(/<path [^>]*class="lens-ray"[^>]*>/g)]
    assert.equal(rays.length, 3)
    for (const ray of rays) {
      const points = ray[0].match(/ d="([^"]+)"/)[1].match(/-?\d+(?:\.\d+)?/g).map(Number)
      assert.deepEqual(points.slice(-2), imageTip, 'ray terminates at the image tip')
    }
  }
})

test('an object inside the focal distance has an upright virtual image on the object side', () => {
  const svg = figureOptics({ f: 10, u: 6 }).parts.join('')
  const image = svg.match(/<line class="lens-image"[^>]*>/)[0]
  const object = svg.match(/<line [^>]*stroke="#d97706"[^>]*>/)[0]
  assert.ok(xy(image, 'x1')[0] < xy(object, 'x1')[0])
  assert.ok(xy(image, 'y2')[0] < xy(object, 'y2')[0])
  const extensions = [...svg.matchAll(/<line [^>]*stroke-dasharray="4 4"[^>]*>/g)]
  assert.equal(extensions.length, 3)
  for (const [line] of extensions) {
    assert.deepEqual([xy(line, 'x2')[0], xy(line, 'y2')[0]], [xy(image, 'x2')[0], xy(image, 'y2')[0]])
  }
})

test('incline advances downhill and stops at the end of a constant-speed track', () => {
  const camera = createCamera({ scale: 34 })
  const track = figureMotionTrack({ length: 4, a: 0, v0: 2, duration: 5 })
  const [block] = frames(track.render(camera).join(''))
  const end = camera.project([-4 * Math.cos(Math.PI / 6), 0, -2])
  assert.ok(block.at(-1).every((value, i) => Math.abs(value - end[i]) < 0.001))
  assert.equal(track.duration, 2)
})

test('fall and speed marker use absolute positions on their own rails', () => {
  const camera = createCamera({ scale: 34 })
  const track = figureMotionTrack({ kind: 'freefall', dropHeight: 5, a: 10, duration: 1, vMax: 10 })
  const [ball, speed] = frames(track.render(camera).join(''))
  const release = camera.project([2, 1.5, 5])
  const ground = camera.project([2, 1.5, 0])
  const rulerZero = camera.project([5.2, 1.5, 0])
  const rulerTen = camera.project([5.2, 1.5, 5])
  for (const [actual, expected] of [[ball[0], release], [ball.at(-1), ground], [speed[0], rulerZero], [speed.at(-1), rulerTen]]) {
    assert.ok(actual.every((value, i) => Math.abs(value - expected[i]) < 0.001))
  }
})

test('the default compass view fits all three vertices and rotates inside its center transform', () => {
  const solution = solveSpec({
    domain: 'geometry', task: 'geometry.three-point-circle', givens: { points: [[0, 0], [6, 0], [0, 8]] },
    figure: { kind: 'plane-triangle', compass: true },
  })
  assert.equal(solution.ok, true)
  const svg = solution.figure.svg
  const point = [...svg.matchAll(/<circle cx="([^"]+)" cy="([^"]+)" r="3.5"/g)]
  assert.equal(point.length, 3)
  const [, cx, cy] = svg.match(/transform="translate\(([^ ]+) ([^)]+)\) scale\(1 /)
  const [, r] = svg.match(/<circle cx="0" cy="0" r="([^"]+)" pathLength/)
  for (const [, x, y] of point) {
    assert.ok(x > 0 && x < 640 && y > 0 && y < 420)
    assert.ok(Math.abs(Math.hypot(x - cx, y - cy) - r) < 0.01)
  }
  assert.match(svg, /<g transform="translate\([^)]+\) scale\([^)]+\)"><g><animateTransform [^>]*type="rotate"/)
})
