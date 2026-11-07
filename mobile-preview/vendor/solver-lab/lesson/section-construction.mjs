import { cross, dot, length, subtract } from '../kit/vecmath.mjs'
import { assertFields } from './validation.mjs'

export const pointName = name => name.replace(/\d/g, digit => '₀₁₂₃₄₅₆₇₈₉'[Number(digit)])

export function boxPointLabels(solid) {
  if (solid.kind !== 'box') return []
  const { a, b, c } = solid.params
  return Object.entries({ A: [0,0,0], B: [a,0,0], C: [a,b,0], D: [0,b,0], A1: [0,0,c], B1: [a,0,c], C1: [a,b,c], D1: [0,b,c] })
    .map(([name, position]) => ({ name, label: pointName(name), position, kind: 'vertex' }))
}

/** Checked geometric operations, not a free-text proof supplied by a model. */
export function compileConstruction(raw, solid, plane, boundary) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('construction 必须为作图对象')
  assertFields(raw, ['points', 'through', 'operations'])
  const base = boxPointLabels(solid)
  if (!base.length) throw new Error('逐步作图目前只支持长方体或正方体')
  if (!Array.isArray(raw.points) || raw.points.length > 16) throw new Error('作图给定点必须为最多16项的数组')
  if (!Array.isArray(raw.operations) || !raw.operations.length || raw.operations.length > 30) throw new Error('作图操作须为1–30步')
  const points = new Map(base.map(p => [p.name, p]))
  const scale = Math.max(solid.params.a, solid.params.b, solid.params.c)
  const tolerance = 1e-9 * scale
  const same = (a, b) => length(subtract(a, b)) <= tolerance
  const onPlane = p => Math.abs(dot(subtract(p, plane.origin), plane.normal)) <= tolerance
  const get = name => {
    if (typeof name !== 'string' || !points.has(name)) throw new Error(`未定义的作图点：${String(name)}`)
    return points.get(name).position
  }
  const add = (name, position, kind) => {
    if (typeof name !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,7}$/.test(name) || points.has(name)) throw new Error('点名须为不重复的字母数字标记')
    if (!position.every(Number.isFinite) || !onPlane(position)) throw new Error(`${pointName(name)}不在题设截平面上`)
    points.set(name, { name, label: pointName(name), position, kind })
  }
  const pair = names => {
    if (!Array.isArray(names) || names.length !== 2) throw new Error('一条直线需要两个已定义点名')
    const ends = names.map(get)
    if (same(...ends)) throw new Error('直线的两点不能重合')
    return ends
  }
  const givenText = []
  for (const p of raw.points) {
    if (!p || typeof p !== 'object') throw new Error('棱上取点格式无效')
    assertFields(p, ['name', 'edge', 'ratio'])
    const [a,b] = pair(p.edge)
    if (!p.edge.every(name => base.some(p => p.name === name)) || a.filter((v,i) => v !== b[i]).length !== 1) throw new Error('给定点的edge必须为实体的一条棱')
    if (!Number.isFinite(p.ratio) || p.ratio <= 0 || p.ratio >= 1) throw new Error('棱上取点比例必须严格介于0与1之间')
    add(p.name, a.map((v,i) => v + p.ratio * (b[i]-v)), 'given')
    givenText.push(`${pointName(p.name)}在棱${p.edge.map(pointName).join('')}上${p.ratio === 0.5 ? '，且为中点' : `，距起点为该棱长的${p.ratio}倍`}`)
  }
  if (!Array.isArray(raw.through) || raw.through.length !== 3 || new Set(raw.through).size !== 3) throw new Error('through需要三个不共线的已知点')
  const through = raw.through.map(get)
  if (!through.every(onPlane) || length(cross(subtract(through[1],through[0]), subtract(through[2],through[0]))) <= tolerance*scale) throw new Error('作图的三个已知点必须在题设截平面上且不共线')

  const faces = [
    { axis: 0, value: 0, name: '侧面ADD₁A₁' }, { axis: 0, value: solid.params.a, name: '侧面BCC₁B₁' },
    { axis: 1, value: 0, name: '侧面ABB₁A₁' }, { axis: 1, value: solid.params.b, name: '侧面DCC₁D₁' },
    { axis: 2, value: 0, name: '底面ABCD' }, { axis: 2, value: solid.params.c, name: '上底面A₁B₁C₁D₁' },
  ]
  if (faces.some(face => Math.abs(Math.abs(plane.normal[face.axis])-1) < 1e-10 && Math.abs(plane.origin[face.axis]-face.value) <= tolerance)) throw new Error('截平面与实体表面重合，不使用逐面交线作图流程')
  const steps = [{ id: 'given-points', at: 0, title: '先认清已知点，再找各面上的交线', uses: [],
    formula: '截平面与一个面的交线，经过它们的两个公共点。',
    substitution: `${givenText.join('；')}。截平面经过${raw.through.map(pointName).join('、')}。`,
    result: '先核对三个已知点是否已经包含全部边界点；如果还有其他相交的棱，就继续找出交点。', reason: '先找同一面内的两个已知点，再沿相邻的面核对完整边界。' }]
  let segments = [], finished = false, outline = []
  const frames = []
  const snapshot = () => frames.push({ visible: [...points.keys()], segments: segments.map(s => ({ ...s })), finished, outline: [...outline] })
  snapshot()
  for (const [index, op] of raw.operations.entries()) {
    if (!op || typeof op !== 'object' || finished) throw new Error('闭合截面必须是作图最后一步')
    let detail
    if (op.type === 'join') {
      assertFields(op, ['type','points'])
      const ends = pair(op.points)
      if (!ends.every(onPlane)) throw new Error('作图连线的两端必须在截平面上')
      const face = faces.find(face => ends.every(p => Math.abs(p[face.axis]-face.value) <= tolerance))
      if (!face) throw new Error('这一步需要同一实体表面所在平面内的两个点')
      segments.push({ from: op.points[0], to: op.points[1], extension: false })
      const names = op.points.map(pointName)
      detail = { title: `连接${names.join('、')}`, formula: `截平面与${face.name}所在平面的交线经过这两点。`,
        substitution: `${names.join('和')}都在${face.name}所在的平面内，也都在截平面内。`, result: `连接${names.join('')}，并按需要延长，寻找相邻面上的交点。`, reason: '两个相交平面的公共点在它们的交线上。' }
    } else if (op.type === 'intersect') {
      assertFields(op, ['type','name','lines'])
      if (!Array.isArray(op.lines) || op.lines.length !== 2) throw new Error('求交需要两条直线')
      const [[p,q],[r,s]] = op.lines.map(pair)
      if (![[p,q],[r,s]].some(ends => ends.every(onPlane))) throw new Error('求交时至少一条直线必须已在截平面内，才能沿它找到新的截面点')
      const u=subtract(q,p), v=subtract(s,r), w=subtract(p,r)
      const a=dot(u,u), b=dot(u,v), c=dot(v,v), d=dot(u,w), e=dot(v,w)
      const denominator=a*c-b*b
      if (Math.abs(denominator) <= 1e-12*a*c) throw new Error('作图直线平行或重合，不能确定唯一交点')
      const t=(b*e-c*d)/denominator, z=(a*e-b*d)/denominator
      const hit=p.map((value,i) => value+t*u[i]), other=r.map((value,i) => value+z*v[i])
      if (!same(hit,other)) throw new Error('两条作图直线异面，没有交点')
      add(op.name, hit.map(value => Math.abs(value) <= tolerance ? 0 : value), 'derived')
      for (const line of op.lines) segments.push({ from: line[0], to: op.name, extension: true })
      const [first,second]=op.lines.map(line => line.map(pointName).join('')), name=pointName(op.name)
      const extended = t < 0 || t > 1 || z < 0 || z > 1
      const isEdge = op.lines[1].every(name => base.some(p => p.name === name)) && r.filter((value,i) => value !== s[i]).length === 1
      const location = isEdge ? `${name}位于${z >= 0 && z <= 1 ? `棱${second}上` : `${second}的延长线上`}，且仍在截平面内。` : `${name}仍在截平面内。`
      const next = raw.operations[index+1]
      const otherName = next?.type === 'join' && Array.isArray(next.points) && next.points.includes(op.name) ? next.points.find(name => name !== op.name) : null
      const nextFace = otherName && points.has(otherName) ? faces.find(face => [hit,get(otherName)].every(p => Math.abs(p[face.axis]-face.value) <= tolerance)) : null
      const purpose = nextFace ? `下一步与${pointName(otherName)}连接，就能确定${nextFace.name}所在平面上的截线。` : '把这个交点保留下来，继续核对截面的完整边界。'
      detail = { title: extended ? `延长${first}与${second}，得到${name}` : `取${first}与${second}的交点${name}`, formula: `${name}是直线${first}与直线${second}的交点。`,
        substitution: `在两条直线相交的位置标出${name}；虚线表示辅助线及其延长部分。`, result: location+purpose, reason: '沿截平面内的直线找交点，得到的新点仍属于截平面。' }
    } else if (op.type === 'finish') {
      assertFields(op, ['type','points'])
      if (!Array.isArray(op.points) || op.points.length !== boundary.length || new Set(op.points).size !== boundary.length) throw new Error('闭合截面的点数与真实边界不一致')
      const polygon=op.points.map(get)
      const ordered=[boundary,[...boundary].reverse()].some(order => order.some((_,offset) => polygon.every((p,i) => same(p,order[(offset+i)%order.length]))))
      if (!ordered) throw new Error('闭合点序不是内核验证的截面边界；不能跳点或交叉连接')
      finished=true; outline=[...op.points]
      const names=outline.map(pointName), loop=[...names,names[0]].join('—')
      const shape = { 3: '三角形', 4: '四边形', 5: '五边形', 6: '六边形' }[boundary.length] ?? `${boundary.length}边形`
      detail = { title: `依次连接，得到${shape}截面`, formula: loop,
        substitution: '沿实体各个面的交线依次连接这些边界点，最后回到起点。', result: `所求截面为${names.join('')}；每条边都位于实体的一个面内，没有跳过其他交点。`, reason: '各个面上的交线首尾相接，围成完整截面。' }
    } else throw new Error(`不支持的作图操作：${String(op.type)}`)
    steps.push({ id: `construction-${index+1}`, at: (index+1)*2, uses: [], ...detail })
    snapshot()
  }
  if (!finished) throw new Error('作图必须以finish闭合真实截面')
  return { points: [...points.values()], frames, steps, duration: (steps.length-1)*2 }
}
