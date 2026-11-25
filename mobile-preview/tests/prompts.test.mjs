import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {composePrompt, models, repairPrompt, subjects} from '../src/prompts.mjs'
import {prepareContent} from '../src/core.mjs'
import {compileLesson} from '../vendor/solver-lab/lesson/compile.mjs'

const motion = await readFile(new URL('../vendor/solver-lab/lesson/examples/motion.json', import.meta.url), 'utf8')
const examples = {motion}
const options = {
  compile: compileLesson,
  loadTemplate: topic => readFile(new URL(`../vendor/solver-lab/examples/lesson-${topic}.html`, import.meta.url), 'utf8'),
}

test('template prompts carry the actual schema example and reject an inferred duration as a given', () => {
  const prompt = composePrompt({subject:'mechanics', model:'deepseek', problem:'初速度为零，求达到指定高度的时间。', examples})
  assert.ok(prompt.includes(motion.trim()))
  assert.match(prompt, /题设.*给出.*时长/)
  assert.match(prompt, /深度思考/)
  assert.match(prompt, /初速度为零，求达到指定高度的时间。/)
})

test('an optics question gets HTML instructions and no unrelated template examples', () => {
  const prompt = composePrompt({subject:'optics', model:'qwen', problem:'求水到空气的临界角。', examples})
  assert.match(prompt, /法线/)
  assert.match(prompt, /一个完整.*HTML/)
  assert.ok(!prompt.includes(motion.trim()))
  assert.match(prompt, /仅输出.*代码块/)
})

test('Qwen diagram prompts request geometry, mobile and numeric checks from the HTML review', () => {
  const options = {subject:'conics', model:'qwen', problem:'椭圆内过 P 作一对垂直弦，数出指定面积的不同四边形。'}
  const prompt = composePrompt(options)
  assert.match(prompt, /延长.*真实端点.*方向向量/)
  assert.match(prompt, /实际渲染字号.*12px/)
  assert.match(prompt, /滑块.*保留焦点/)
  assert.match(prompt, /水平线斜率.*竖直线斜率未定义/)
  assert.match(prompt, /无序直线对.*镜像/)
  assert.match(prompt, /临界点本身.*可达的测试值/)
  assert.match(prompt, /极值两侧.*分别代入/)
  assert.doesNotMatch(composePrompt({...options, mode:'study'}), /实际渲染字号|无序直线对/)
  assert.doesNotMatch(composePrompt({...options, model:'deepseek'}), /实际渲染字号|竖直线斜率未定义/)
  assert.doesNotMatch(composePrompt({...options, subject:'optics'}), /无序直线对/)
})

test('DeepSeek answer modes recover original candidates and request exact verification before rounding', () => {
  const options = {subject:'conics', model:'deepseek', problem:'过 P 作两条垂直弦，求指定面积的四边形个数。'}
  for (const mode of ['study','diagram']) {
    const prompt = composePrompt({...options, mode})
    assert.match(prompt, /逐根还原.*原对象/)
    assert.match(prompt, /无序直线对.*交换.*镜像/)
    assert.match(prompt, /未平方的原式.*覆盖哪些候选/)
    assert.match(prompt, /最后.*统一四舍五入/)
    assert.match(prompt, /鞋带公式.*实际执行/)
    assert.doesNotMatch(prompt, /实际渲染字号/)
    assert.ok(prompt.endsWith(options.problem))
  }
  assert.doesNotMatch(composePrompt({...options, model:'chatgpt', mode:'study'}), /统一四舍五入/)
})

test('standalone diagram prompts include visual guidance without adding it to text answers or JSON repairs', () => {
  const options = {subject:'optics', model:'qwen', problem:'求水到空气的临界角。'}
  for (const prompt of [composePrompt(options), repairPrompt('html', '排版拥挤')]) {
    assert.match(prompt, /浅色底.*细边框/)
    assert.match(prompt, /图例.*线型/)
  }
  assert.doesNotMatch(composePrompt({...options, mode:'study'}), /细边框/)
  assert.doesNotMatch(repairPrompt('json', '单位错了'), /细边框/)
})

test('both answer modes preserve every selected subject and handle missing data consistently across models', () => {
  const question = '仅给出示意图，请根据原题求解。'
  for (const [subject, [label]] of Object.entries(subjects)) {
    for (const model of Object.keys(models)) {
      const study = composePrompt({subject, model, mode:'study', problem:question})
      const diagram = composePrompt({subject, model, mode:'diagram', problem:question})
      if (subject !== 'auto') assert.ok(study.includes(`所选题型：${label}`))
      assert.match(study, /本题检查重点/)
      assert.doesNotMatch(study, /单文件 HTML|代码块|LessonSpec/)
      assert.match(diagram, /缺.*条件.*直接用文字/)
      assert.match(diagram, /有足够条件.*仅输出一个完整/)
      assert.ok(study.endsWith(question) && diagram.endsWith(question))
      assert.match(diagram, /滑块只在用户操作时写入模型状态/)
      assert.doesNotMatch(study, /滑块只在用户操作时写入模型状态/)
    }
  }
})

test('a named conic avoids solid-section examples even in auto and broad geometry modes', () => {
  const problem = '椭圆 x²/16+y²/4=1，过给定点作两条互相垂直的弦，求四边形面积范围。'
  for (const subject of ['auto','geometry','conics']) {
    const prompt = composePrompt({subject, model:'deepseek', problem, examples:{...examples,section:'SECTION_EXAMPLE'}})
    assert.match(prompt, /竖直线/)
    assert.match(prompt, /二次项系数/)
    assert.match(prompt, /同尺度/)
    assert.doesNotMatch(prompt, /SECTION_EXAMPLE|LessonSpec/)
  }
})

test('a single fenced lesson can be copied together with the explanation', async () => {
  const response = `思路如下。\n\n\`\`\`json\n${motion.trim()}\n\`\`\`\n\n位移为9 m。`
  const lesson = await prepareContent(response, options)
  assert.equal(lesson.answer.s, 9)
  assert.equal(lesson.code, motion.trim().replaceAll('\r\n', '\n'))
})

test('multiple lesson blocks and a truncated code fence give actionable errors', async () => {
  const block = `\`\`\`json\n${motion.trim()}\n\`\`\``
  await assert.rejects(prepareContent(`${block}\n\n${block}`, options), {code:'multiple-blocks'})
  await assert.rejects(prepareContent(block.slice(0,-3), options), {code:'incomplete-block'})
})

test('repair feedback describes the failure and preserves the original problem and output format', () => {
  const prompt = repairPrompt('json', '加速度单位错误')
  assert.match(prompt, /加速度单位错误/)
  assert.match(prompt, /保留原题/)
  assert.match(prompt, /LessonSpec/)
  assert.match(repairPrompt('html', '外部资源被拦截'), /内联/)
})

test('generated and repaired HTML use the same state, boundary and playback checks', () => {
  for (const prompt of [
    composePrompt({subject:'functions', model:'qwen', problem:'演示动点从左侧趋近开区间端点。'}),
    repairPrompt('html', '到开区间端点附近时假装已经到达'),
    repairPrompt(undefined, '播放到末尾后位置不再更新'),
  ]) {
    assert.match(prompt, /独立的未舍入状态/)
    assert.match(prompt, /滑块只在用户操作时写入模型状态/)
    assert.match(prompt, /有限终点、极限状态和演示截止/)
    assert.match(prompt, /小于一个滑块步长.*检查/)
    assert.match(prompt, /没有运行.*未测/)
  }
  assert.doesNotMatch(repairPrompt('json', '加速度单位错误'), /独立的未舍入状态|演示截止/)
})
