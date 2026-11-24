import {readFile, writeFile} from 'node:fs/promises'
import {composePrompt} from '../src/prompts.mjs'

const cards = JSON.parse(await readFile(new URL('../study/physics-courseware.json', import.meta.url), 'utf8'))
const groups = ['磁场', '电磁感应', '交变电流、电磁波与传感器', '光学', '热学']
const sections = [
  '# 高考物理配套课件 · 网页版解题提示词',
  '从教师用书第 10–14 单元的 18 份课件提炼。到文中找到对应小节，复制一个完整代码块，把最后一行换成原题，再粘贴到常用 AI 对话。遇到图示题，在同一个 AI 对话补上传清晰题图。',
  '每段包含方法前提、解题步骤、常见误用、变式复核和课件页序。变式检查是补充建议；相关页序用于回看。也可在线按题推荐专题或切换为交互图解。 [打开提示词生成页](https://solver-lab-mobile-20261106-8082.wwk58317.chatgpt.site/?mode=study)',
]
for (const [index, name] of groups.entries()) {
  const unit = index + 10
  sections.push(`## 第 ${unit} 单元　${name}`)
  for (const card of cards.filter(item => item.id.startsWith(`physics-${unit}.`))) {
    const prompt = composePrompt({subject:card.category, model:'generic', problem:'【在这里粘贴完整题目】', mode:'study', methodCards:[card]})
    sections.push(`### ${card.id.replace('physics-', '')}　${card.title}`, `\`\`\`text\n${prompt}\n\`\`\``)
  }
}
const markdown = sections.join('\n\n') + '\n'
if (process.argv[2]) await writeFile(process.argv[2], markdown, 'utf8')
else process.stdout.write(markdown)
