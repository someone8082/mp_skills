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
  assert.equal(lesson.code, motion.trim())
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
