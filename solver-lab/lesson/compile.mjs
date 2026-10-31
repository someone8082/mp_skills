import { compileMotion } from './motion.mjs'
import { compileCircuit } from './circuit.mjs'
import { compileSection } from './section.mjs'

export const LESSON_TOPICS = Object.freeze(['motion', 'circuit', 'section'])
const compilers = { motion: compileMotion, circuit: compileCircuit, section: compileSection }
export function compileLesson(spec) {
  if (!spec || !Object.hasOwn(compilers, spec.topic)) return { ok: false, errors: [`不支持的教学题型：${spec?.topic ?? '缺失'}；支持 ${LESSON_TOPICS.join('、')}`], checks: [] }
  return compilers[spec.topic](spec)
}
