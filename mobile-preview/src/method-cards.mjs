const normalize = value => value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')

// Common words alone do not identify a textbook method. A match is a suggestion.
const generalWords = new Set([
  '定义', '概念', '方法', '函数', '图像', '面积', '斜率', '参数', '分类', '分支', '任意', '存在',
  '位移', '速度', '时间', '加速度', '受力', '物块', '斜面', '约束', '最高点', '最低点',
  '临界', '极值', '零速', '最值', '能量', '守恒', '综合应用', '支持力', '相切', '圆心', '温度', '轨迹',
])

const webAliases = {
  'math-54':['相邻排列', '排成一排', '排队'],
  'physics-01':['v-t 图', 'x-t 图', 'a-t 图', '速度–时间图'],
  'physics-02':['赶上'],
  'physics-10.2':['垂直射入匀强磁场', '在磁场中运动的时间'],
  'physics-12.1':['交流电'],
  'physics-14.3':['体积与压强', '压强怎样变化'],
}

const circleContext = /圆的方程|圆上|圆外|圆与直线|直线.{0,35}与圆|两圆|圆\s*[：:]\s*[xy]/

function conicFamily(problem) {
  if (/椭圆/.test(problem)) return 'math-50'
  if (/双曲线/.test(problem)) return 'math-51'
  const equation = problem.replaceAll('²', '^2').normalize('NFKC').replace(/[−–]/g, '-').replace(/\s/g, '')
  const parabola = equation.match(/([xy])\^2=[+-]?(?:\d+(?:\.\d+)?)?([xy])(?!\^2)/)
  if (parabola && parabola[1] !== parabola[2]) return 'math-52'
  if (/抛物线/.test(problem) && !/二次函数|函数图[像形]|对称轴|运动/.test(problem)) return 'math-52'
  const standard = equation.match(/([xy])\^2(\/\d+(?:\.\d+)?)?([+-])([xy])\^2(\/\d+(?:\.\d+)?)?=1(?![.\d])/)
  if (!standard || standard[1] === standard[4] || (!standard[2] && !standard[5])) return null
  if (standard[3] === '-') return 'math-51'
  return standard[2] === standard[5] ? null : 'math-50'
}

export function resolveSubject(subject, problem) {
  if (subject !== 'auto' && subject !== 'geometry') return subject
  if (subject === 'auto') {
    if (/折射|全反射|透镜|棱镜|双缝干涉|单缝衍射|偏振片/.test(problem)) return 'optics'
    if (/磁场|电场|安培力|电磁|感应电流|电阻|变压器|传感器|交流电|交变电流/.test(problem)) return 'circuits'
    if (/气体|压强|热力学|比热容|布朗运动|油膜法|毛细现象/.test(problem)) return 'thermal'
    if (/传送带|皮带|动摩擦|竖直上抛|平抛|抛物运动/.test(problem)) return 'mechanics'
  }
  if (conicFamily(problem) || /圆锥曲线/.test(problem) || circleContext.test(problem)) return 'conics'
  if (subject === 'auto' && /函数|数列|f\s*[（(]|抛物线.*对称轴/i.test(problem)) return 'functions'
  return subject
}

function coversSubject(card, subject) {
  if (subject === 'auto') return true
  if (card.subject === 'math') {
    if (card.collection) return card.category === subject
    const chapter = Number(card.id.slice('math-'.length))
    if (subject === 'geometry') return chapter >= 18 && chapter <= 53
    if (subject === 'conics') return chapter >= 46 && chapter <= 53
    if (subject === 'functions') return chapter <= 39
    if (subject === 'probability') return chapter === 1 || chapter >= 54
  }
  if (subject === 'mechanics') return card.subject === 'physics' && !card.category
  return card.category === subject
}

function preferredGeometryCards(subject, problem) {
  if (subject === 'conics') {
    const conic = conicFamily(problem)
    if ((conic || /圆锥曲线/.test(problem)) && /交点|相交|交于|切线|相切|中点弦|韦达|弦长|两条.*弦|弦.*中点/.test(problem)) {
      return ['math-53', ...(conic ? [conic] : [])]
    }
    if (conic) return [conic]
    if (circleContext.test(problem) && /切线|相切|相交|交点|弦|两圆/.test(problem)) return ['math-49']
  }
  if (subject === 'geometry' || subject === 'auto') {
    if (/截面/.test(problem)) return ['math-41']
    if (/三角形/.test(problem) && /重心|垂心|内心|外心/.test(problem)) return ['math-29']
  }
  return []
}

export function selectMethodCards(cards, {subject, problem, manualId}) {
  if (manualId) {
    const card = cards.find(item => item.id === manualId)
    return card ? [card] : []
  }
  subject = resolveSubject(subject, problem)
  const preferred = preferredGeometryCards(subject, problem).map(id => cards.find(card => card.id === id)).filter(Boolean)
  const query = normalize(problem)
  const formulaText = problem.normalize('NFKC').toLowerCase().replace(/[–—−]/g, '-').replace(/\s/g, '')
  const ranked = []
  for (const card of cards) {
    if (!coversSubject(card, subject)) continue
    const title = normalize(card.title)
    const words = new Set([title, ...card.keywords, ...(webAliases[card.id] ?? [])])
    let score = 0
    for (const keyword of words) {
      const word = normalize(keyword)
      const notation = keyword.toLowerCase().replace(/[–—−]/g, '-').replace(/\s/g, '')
      const matched = /^[a-z]+-[a-z]+$/.test(notation) ? formulaText.includes(notation) : query.includes(word)
      if (matched && word.length > 1 && !generalWords.has(word)) {
        score += Math.min(word.length, 8)
      }
    }
    if (score > 0) ranked.push({card, score})
  }
  ranked.sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id, 'en'))
  if (preferred.length) {
    const supplement = ranked.find(({card}) => card.collection === 'bishua-2027')?.card
    return supplement ? [preferred[0], supplement] : preferred
  }
  const cutoff = (ranked[0]?.score ?? 0) * 0.6
  return ranked.filter(item => item.score >= cutoff).slice(0, 2).map(item => item.card)
}

function sourceLocator({title, pages, slides, printed, section}) {
  const pdfRange = pages && (pages[0] === pages[1] ? pages[0] : `${pages[0]}–${pages[1]}`)
  const printedRange = printed && (printed[0] === printed[1] ? printed[0] : `${printed[0]}–${printed[1]}`)
  const locator = slides ? `PPT 第 ${slides.join('、')} 张（按课件顺序从 1 起）` : `PDF 第 ${pdfRange} 页（从 1 起）`
  return `《${title.replace(/\.(pdf|pptx)$/i, '')}》${locator}${printed ? `，书内第 ${printedRange} 页` : ''}${section ? `，${section}` : ''}。`
}

export function methodContext(cards) {
  if (!cards.length) return '本次没有附教材方法卡。按题设独立推导，正文不引用未提供的教材、专题或页码。'
  return [
    '下列教材方法卡是提炼的参考方法。先逐项核对前提，说明哪些条件由题设给出、哪些需推导或仍未知。选真正适用的方法，结合原题写式子与理由；若前提不符，说明原因并换路线。变式检查是复核建议，不是额外题设。只列实际用到的卡片和所附出处，注明依据是方法卡；不要声称已通读或查阅原书或原课件。',
    ...cards.map(card => {
      return [
        `【${card.id} ${card.title}】`,
        `适用前提：\n- ${card.conditions.join('\n- ')}`,
        `解法步骤：\n${card.method.map((item, index) => `${index + 1}. ${item}`).join('\n')}`,
        `常见反例或误用：\n- ${card.pitfalls.join('\n- ')}`,
        `复核与变式：\n- ${card.transferChecks.join('\n- ')}`,
        `来源定位：${sourceLocator(card.source)}`,
        ...((card.relatedSources ?? []).map(source => `对应资料：${sourceLocator(source)}`)),
      ].join('\n')
    }),
  ].join('\n\n')
}
