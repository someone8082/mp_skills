import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { compileLesson } from '../solver-lab/lesson/compile.mjs'

const checks=[]
const q=(value,unit,source)=>({value,unit,...(source?{source}:{})})
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`)
function check(id,detail,fn){fn();checks.push({id,detail,passed:true})}
const motion={version:1,topic:'motion',problemText:'初速度36 km/h，加速度恒为-2 m/s²，沿同一直线自由运动8 s，不存在碰撞、接触或停车保持约束。求有符号位移和末速度。',givens:{v0:q(36,'km/h','36 km/h'),a:q(-2,'m/s²','-2 m/s²'),t:q(8,'s','8 s')}}
check('valid-motion-signed','A路线给定v0/a/t、单位与逐字source可导入，有符号位移16m、末速度-6m/s。',()=>{const r=compileLesson(motion);assert.equal(r.ok,true);near(r.answer.s,16);near(r.answer.v,-6)})
check('inverse-time-is-not-a-template-input','模板不反求缺少的t；不能把输出目标列表解释成反解能力。',()=>{const s=structuredClone(motion);s.problemText='从静止以2 m/s²运动，位移9 m，求时间。';s.givens={v0:q(0,'m/s'),a:q(2,'m/s²')};assert.equal(compileLesson(s).ok,false)})
check('derived-time-cannot-have-invented-source','独立推导出的3秒若未出现在题干中，不可伪造source为题设已知。',()=>{const s=structuredClone(motion);s.problemText='从静止以2 m/s²运动，位移9 m，求时间。';s.givens={v0:q(0,'m/s'),a:q(2,'m/s²'),t:q(3,'s','3 s')};const r=compileLesson(s);assert.equal(r.ok,false);assert.ok(r.errors.some(x=>x.includes('source')))})
check('braking-needs-a-new-stage','自由恒加速度算到8秒是倒退；停车保持静止的题路程25m、速度0，不能直接使用该整段模型。',()=>{const r=compileLesson(motion);near(r.answer.v,-6);near(10*5-5*5,25);assert.notEqual(r.answer.v,0)})
const circuit={version:1,topic:'circuit',problemText:'理想12 V电源与两个2 Ω电阻全部串联。',givens:{voltage:q(12,'V','12 V'),resistors:[q(2,'Ω','2 Ω'),q(2,'Ω','2 Ω')]}}
check('valid-series','全部串联模板I=3A，功率36W。',()=>{const r=compileLesson(circuit);assert.equal(r.ok,true);near(r.answer.current,3);near(r.answer.power,36)})
check('parallel-cannot-be-encoded-as-series','内核不理解自然语言拓扑；把并联6Ω/3Ω只写成resistors数组会按串联算4/3A，而原题应为6A。此检查证明错误映射风险，不是认证错误题意。',()=>{const s=structuredClone(circuit);s.problemText='理想12 V电源两端并联6 Ω和3 Ω。';s.givens.resistors=[q(6,'Ω'),q(3,'Ω')];const r=compileLesson(s);assert.equal(r.ok,true);near(r.answer.current,4/3);near(12/6+12/3,6);assert.ok(r.checks.some(x=>x.scope==='model'&&x.status==='pending'))})
const section={version:1,topic:'section',problemText:'正六棱柱底面外接圆半径2 cm、高5 cm，求距下底2 cm平行截面面积。',givens:{solid:{kind:'prism',n:6,radius:2,height:5},plane:{point:[0,0,2],normal:[0,0,1]},unit:'cm'}}
check('valid-regular-hexagon','正六棱柱外接圆半径2的平行截面面积6sqrt(3)。',()=>{const r=compileLesson(section);assert.equal(r.ok,true);near(r.answer.area,6*Math.sqrt(3))})
check('decagon-outside-template-range','正十棱柱不在当前section模板n=3..8范围。',()=>{const s=structuredClone(section);s.givens.solid.n=10;const r=compileLesson(s);assert.equal(r.ok,false);assert.ok(r.errors.some(x=>x.includes('3–8')))})
check('nonregular-prism-mapping-is-wrong','任意直三棱柱不能只用n和外接圆半径表示；3-4-5底面积6，不等于正三角模型面积。',()=>{const s=structuredClone(section);s.givens.solid={kind:'prism',n:3,radius:2.5,height:6};const r=compileLesson(s);assert.equal(r.ok,true);near(3*4/2,6);assert.ok(Math.abs(r.answer.area-6)>1);assert.ok(r.checks.some(x=>x.scope==='statement'&&x.status==='pending'))})
const construction=JSON.parse(await readFile(new URL('../solver-lab/lesson/examples/section-construction.json',import.meta.url),'utf8'))
check('construction-example-runs','原有完整construction示例可导入并得到五边形。',()=>{const r=compileLesson(construction);assert.equal(r.ok,true,JSON.stringify(r.errors));assert.equal(r.answer.shape,'五边形')})
check('wrong-claim-evidence-preserved','保留原14m/s错误claim先失败，独立订正版不伪造新claim。',()=>{const original={version:1,topic:'motion',problemText:'v0=10 m/s，a=2 m/s²，t=3 s。',solutionText:'末速度14 m/s。',givens:{v0:q(10,'m/s'),a:q(2,'m/s²'),t:q(3,'s')},claims:[{quantity:'v',value:14,unit:'m/s'}]};const failed=compileLesson(original);assert.equal(failed.ok,false);assert.equal(original.claims[0].value,14);const corrected=structuredClone(original);delete corrected.claims;corrected.title='独立订正演示';const r=compileLesson(corrected);assert.equal(r.ok,true);near(r.answer.v,16);near(r.answer.s,39);assert.ok(r.checks.some(x=>x.scope==='user-work'&&x.status==='pending'))})
console.log(JSON.stringify({ok:true,checks:checks.length}))
