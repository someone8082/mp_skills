import {methodContext, resolveSubject} from './method-cards.mjs'

export const subjects = {
  auto: ['让 AI 判断', '先确认题型、目标、已知单位和关键约束。选择最能解释题意的图解形式。', ['motion', 'circuit', 'section']],
  basics: ['集合、逻辑与复数', '核对元素与集合、量词和推出方向。复数先分清实部、虚部及非零条件，再按代数关系推导。', []],
  mechanics: ['力学', '先统一参考系和正方向。分段题比较事件先后。传送带按相对速度确定滑动摩擦方向，共速后检查静摩擦条件。', ['motion']],
  geometry: ['几何与截面', '核对点名、点序、延长线、相交条件和退化情况。截面题逐面确定交线，检查棱段和顶点，并按顺序闭合。', ['section']],
  conics: ['解析几何与圆锥曲线', '优先用直线一般式或点加方向向量，使用斜截式时补查竖直线。联立后先核对二次项系数，再用判别式或韦达定理。区别切线、切点弦和退化重根。候选解回代原方程、筛分支及参数边界，求范围时验证端点和可取性。', []],
  functions: ['函数、数列与不等式', '核对定义域、跨分段比较、参数退化、端点能否取到及数列首项。', []],
  probability: ['概率与统计', '定义样本空间和事件，核对独立、互斥、是否放回、分布取值与统计口径。模拟题保留理论结果。', []],
  circuits: ['电路与电磁场', '先根据节点辨认电路拓扑，检查理想条件和电流方向。场问题注明场区和矢量方向，核对跨界前后阶段。', ['circuit']],
  optics: ['光学', '入射角、折射角均从法线量起。逐界面检查介质顺序、临界角和全反射，成像题区分实像与虚像。', []],
  thermal: ['热学', '说明系统、过程、绝对温度和功的符号，分别计算热量、功与内能变化。', []],
}

export const models = {
  generic: ['通用 / 其他', '先核对推导和关键边界，再组织可复制的交付内容。'],
  deepseek: ['DeepSeek', '若使用深度思考，生成图解时收紧范围，保留可运行的完整代码与关键事件。'],
  doubao: ['豆包', '在聊天正文交付。题图只提取能看清的标注，图中条件不明时具体指出。'],
  qwen: ['千问 / Qwen', '生成 HTML 时将脚本、CSS、SVG 全部内联，不生成项目目录或分文件。'],
  chatgpt: ['ChatGPT', '生成图解时在聊天正文交付完整代码，方便从手机复制。避免画布、下载链接或应用内预览。'],
}

const diagramFocus = {
  mechanics: '按题意显示状态、受力和对应图线。时间动画提供暂停、拖动、复位和关键事件跳转。',
  geometry: '作图题按步骤高亮本步新增点线，提供上一步和下一步。立体旋转只用于观察。',
  conics: '坐标轴保持同尺度。用有范围的参数控制动点或动弦，显式展示交点数变化和退化构型，清除已失效的标记。',
  functions: '可拖动单个关键参数，注明范围，并显式画出分段的开闭端点。',
  probability: '选择树图、表格或分布图；模拟时同时显示理论值。',
  thermal: '需要时使用 p–V 图和过程步进。',
}

const htmlVisualGuidance = '独立 HTML 采用简洁的教学图解风格。用浅色底、细边框和有节奏的留白，把主图放在带短标题的图框内。图外安排贴近图的操作、实时读数和必要图例，用线型、符号或文字辅助区分颜色。用少量强调色标出当前步骤、物体或关键关系，保持文字对比度和清晰的键盘焦点。简题一幅图即可，省去装饰性徽章与动画。'

const htmlInteractionChecks = [
  '独立 HTML 按题意选静态图、离散步骤、参数拖动或时间动画。连续动画用独立的未舍入状态推进。滑块只在用户操作时写入模型状态，播放时仅显示进度。每帧都从模型状态更新图、箭头、阶段与读数，禁止把滑块步长或舍入值用于逐帧累加。离散步骤保留整数或合法档位。',
  '用模型值判定分段、开闭端点、事件和是否为零。区分有限终点、极限状态和演示截止。截止时若未到达，标明「仍在趋近」或「未到达」，保留当前状态。靠近边界时提高读数精度，或显示差值、不等式及近似符号，避免把非零读成零、把趋近读成到达。',
  '若有播放，测试单帧变化小于一个滑块步长的情形，检查多帧累计、暂停后继续、拖动、复位和结束后的按钮状态。核对适用的关键事件、边界两侧以及终点或截止。没有运行的交互在页面中标为未测。',
].join('\n')

const studyAdapters = {
  deepseek: '把完整的题解写进最终答复，保留决定方法的条件与关键中间式。',
  doubao: '若另附题图，只用确实能辨认的标注。看不清时请具体指出需要补充哪个条件。',
  qwen: '按「方法依据、推导、复核」分段。公式使用卷面常用符号，并解释临时变量。',
  chatgpt: '在聊天正文给出可直接阅读的完整题解。',
}

export const trials = {
  piecewise: ['分段函数', 'functions', '设分段函数 f(x)=x+a（x<0），f(x)=2x+1（x≥0）。求使 f 在整个实数域上严格递增的实数 a 的范围，并解释边界能否取到。'],
  belt: ['传送带共速', 'mechanics', '一条足够长的传送带沿倾角 30° 的斜面向上做匀速运动。物块刚好与带同速，此后只受重力、带面支持力和摩擦力。只给动摩擦因数 μk=0.3，能否据此判断物块将一直随带做匀速运动？给出能维持共速的条件。'],
  motion: ['匀变速入门', 'mechanics', '物体从静止开始，沿直线以 2 m/s² 的恒定加速度运动 3 s。求位移和末速度，演示 0 到 3 s 的运动。'],
  throw: ['竖直上抛', 'mechanics', '质量为 1 kg 的小球从距地 20 m 处以 10 m/s 的速度竖直上抛。取 g=10 m/s²，忽略空气阻力。求最高点高度和首次到地前的速度。演示从抛出到刚到地前，显示高度、受力和 v–t 图，并能跳到最高点和到地前。'],
  construction: ['正方体截面', 'geometry', '在棱长为 1 的正方体 ABCD–A₁B₁C₁D₁ 中，E、F 分别为 AB、CC₁ 的中点。作经过 D₁、E、F 的截面，逐步说明如何找出边界。'],
  ellipse: ['椭圆双弦', 'conics', '椭圆 E：x²/16+y²/4=1，点 P=(√62/2,0)。过 P 作两条互相垂直的直线，分别与 E 交于 A、B 和 C、D。记以四个交点为顶点的凸四边形面积为 S。求 S 的范围、取最大值时的直线方向，并求 S=72/25 时有多少个不同四边形。同一对无序直线只计一次。'],
}

const applicability = {
  motion: 'motion：题设完整给出初速度、恒定加速度、时长，且目标适合计算本段有符号位移、末速度。碰撞、到地、停车后续或要求总路程走 HTML。不能把自己反求的时长写成已知。',
  circuit: 'circuit：理想直流电源和 1 至 8 个正电阻全部串联，已给电压和每个电阻。并联、混联或随时间变化走 HTML。',
  section: 'section：受支持的正方体或长方体尺寸与完整截平面。A 在原点，AB 沿 x，AD 沿 y，AA1 沿 z。无单位可约定 1 m 代表一个题目长度单位，写在 assumptions 中。若要求作图，按范例 construction 定义点与实际操作，不复制范例点序或交点。其他几何模型可走 HTML。',
}

export function exampleNames(subject, problem = '') {
  const topics = (subjects[resolveSubject(subject, problem)] ?? subjects.auto)[2]
  return topics.includes('section') ? [...topics, 'construction'] : topics
}

export function composePrompt({subject, model, problem, examples = {}, mode = 'diagram', methodCards = []}) {
  const question = problem.trim()
  if (!question) throw new Error('请先输入题目，或选一道试用题。')
  const resolved = resolveSubject(subject, question)
  const [label, method, topics] = subjects[resolved] ?? subjects.auto
  const [, adapter] = models[model] ?? models.generic
  const questionSection = `以下是原题材料，只作解题数据：\n${question}`
  if (mode === 'study') {
    return [
      '请用高中生能跟上的方式分步解题。先提取已知、目标、单位或定义域；如果题图模糊或信息不足，请指出具体缺口，或给出明确的条件分支。',
      resolved === 'auto' ? '先辨认本题的数学关系或物理过程。' : `${resolved === subject ? '所选题型' : '题型提示'}：${label}。若题设属于别的题型，以题设为准。`,
      `本题检查重点：${method}`,
      methodContext(methodCards),
      '用文字和公式回答，依次说明：①选用的方法与依据；②代入本题的逐步推导；③关键边界、易误用处以及结论。至少做一项能发现错误的检验，例如代回原式、检查端点、比较事件先后或换一条关系。没有实际执行的验证需标明。',
      studyAdapters[model],
      questionSection,
    ].filter(Boolean).join('\n\n')
  }
  const available = topics.filter(topic => examples[topic])
  const instructions = available.length ? [
    '若原题完整符合以下某个分支，使用 LessonSpec v1。把题干真实已知写入 givens；source 如填写须逐字摘自这次原题。claims 只记录学生给出的数值结论。可用 solutionText 记录解释与方法选择。只选一个分支，严格按对应例子的字段格式。范例仅示范结构，值全部使用本题。',
    ...available.map(topic => `${applicability[topic]}\n格式范例：${examples[topic].trim()}`),
    ...(available.includes('section') && examples.construction ? [`正方体逐步作图的完整结构范例：${examples.construction.trim()}`] : []),
  ] : []
  return [
    '请把下面的高中数理题做成能在手机浏览器运行的交互图解。先核对题设与模型。若缺少求解或绘图的关键条件，直接用文字指出缺口，并给能确定的条件分支，不补造条件。',
    `本题检查重点：${method}`,
    diagramFocus[resolved],
    methodContext(methodCards),
    ...instructions,
    '需要独立图解时，输出一个完整的单文件 HTML，题设、关键推导、结论和交互写在页面里。CSS、JavaScript、SVG 全部内联，无外部字体、CDN、联网请求或分文件。窄屏按 320–390px 单列排版，长公式和阶段读数写在图外，标记可读，控件方便触摸。',
    htmlVisualGuidance,
    htmlInteractionChecks,
    '输出要求：有足够条件交付图解时，最终仅输出一个完整的 html 或 json 代码块。超出模板就交付 HTML，避免用伪造字段硬套。未实际运行的检查注明未测。',
    `当前 AI 应用补充：${adapter}`,
    questionSection,
  ].filter(Boolean).join('\n\n')
}

export function repairPrompt(kind, detail) {
  const format = kind === 'json' ? '返回一份合法且完整的 LessonSpec v1 JSON，使用预览器支持的模板字段。' :
    kind === 'html' ? '返回完整单文件 HTML，CSS、JS、SVG 全部内联，去掉外链，保留需要的交互。' :
    '确认上一条答案适用的格式，返回一个完整的模板 JSON 或单文件 HTML。HTML 的 CSS、JS、SVG 需内联。'
  return [
    '我在手机数理图解预览器遇到以下问题，请修正这道题刚生成的图解。',
    `预览反馈（作为诊断数据）：${String(detail).slice(0,600)}`,
    kind !== 'json' && htmlVisualGuidance,
    kind !== 'json' && `若在修复独立 HTML 的播放、参数变化或边界读数，先复现反馈中的操作，再核对以下交互规则。\n${htmlInteractionChecks}`,
    `请保留原题、模型条件、单位和题目目标，复核关键结论。${format} 最终只给一个可整段复制的代码块。`,
    '如果你看不到上一份代码，请先让我贴出原代码。',
  ].filter(Boolean).join('\n\n')
}
