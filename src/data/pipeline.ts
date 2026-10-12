import type { CycleSnapshot, DataHazard, PipelineExecution, PipelineInstruction, PipelinePlacement, PipelinePreset, PipelineScheduler, PipelineStage } from '../types/pipeline'

export const PIPELINE_STAGES: { id: PipelineStage; label: string; color: string; description: string }[] = [
  { id: 'IF', label: 'Instruction Fetch', color: '#1676e8', description: '根据 PC 从指令存储器取出指令。' },
  { id: 'ID', label: 'Instruction Decode', color: '#9659cc', description: '译码指令，并从寄存器堆读取源寄存器。' },
  { id: 'EX', label: 'Execute', color: '#d68b21', description: 'ALU 完成运算，或计算访存地址。' },
  { id: 'MEM', label: 'Memory Access', color: '#28946c', description: 'LOAD / STORE 访问数据存储器，其他指令传递结果。' },
  { id: 'WB', label: 'Write Back', color: '#249aab', description: '写入目标寄存器；STORE 不写回寄存器。' },
]

export const PIPELINE_PRESETS: PipelinePreset[] = [
  { id: 'mixed', title: '三条指令并行', description: '观察 ADD、SUB、LOAD 在五级流水中的重叠执行。', program: 'ADD R1,R2,R3\nSUB R4,R1,R5\nLOAD R6,0(R2)' },
  { id: 'raw', title: 'RAW Hazard', description: 'SUB 在 ID 读取 R1 时，前一条 ADD 还没有写回 R1。', program: 'ADD R1,R2,R3\nSUB R4,R1,R5' },
  { id: 'independent', title: '独立指令', description: '源寄存器不依赖前面的结果，观察没有 RAW Hazard 的流水。', program: 'ADD R1,R2,R3\nSUB R4,R5,R6\nLOAD R7,0(R2)' },
]

const STAGE_IDS = PIPELINE_STAGES.map((stage) => stage.id)
const MAX_PROGRAM_LENGTH = 8
const registerPattern = 'R([0-7])'
const displacementPattern = '([+-]?(?:0X[0-9A-F]+|[0-9]+))'
const arithmeticPattern = new RegExp(`^(ADD|SUB)\\s+${registerPattern}\\s*,\\s*${registerPattern}\\s*,\\s*${registerPattern}$`)
const movePattern = new RegExp(`^MOV\\s+${registerPattern}\\s*,\\s*${registerPattern}$`)
const memoryPattern = new RegExp(`^(LOAD|STORE)\\s+${registerPattern}\\s*,\\s*${displacementPattern}\\s*\\(\\s*${registerPattern}\\s*\\)$`)

/** Parse the scheduling operands only. This module never invents architectural register values. */
export function parsePipelineProgram(text: string): { instructions: PipelineInstruction[]; error: string | null } {
  const lines = text.split(/\r?\n/).map((line, index) => ({ line: line.replace(/(?:#|;|\/\/).*$/, '').trim().toUpperCase(), lineNumber: index + 1 })).filter(({ line }) => line.length > 0)
  if (!lines.length) return { instructions: [], error: '请输入至少一条指令。' }
  if (lines.length > MAX_PROGRAM_LENGTH) return { instructions: [], error: `一次最多观察 ${MAX_PROGRAM_LENGTH} 条指令。` }
  const instructions: PipelineInstruction[] = []
  for (const { line, lineNumber } of lines) {
    const id = `instruction-${instructions.length}`
    const arithmetic = line.match(arithmeticPattern)
    const move = line.match(movePattern)
    const memory = line.match(memoryPattern)
    if (arithmetic) {
      const opcode = arithmetic[1] as 'ADD' | 'SUB'
      const [destination, a, b] = arithmetic.slice(2).map(Number)
      instructions.push({ id, opcode, text: `${opcode} R${destination},R${a},R${b}`, sources: [a, b], destination })
    } else if (move) {
      const [destination, source] = move.slice(1).map(Number)
      instructions.push({ id, opcode: 'MOV', text: `MOV R${destination},R${source}`, sources: [source], destination })
    } else if (memory) {
      const opcode = memory[1] as 'LOAD' | 'STORE'
      const register = Number(memory[2])
      const signedDisplacement = memory[3]
      const negative = signedDisplacement.startsWith('-')
      const unsigned = signedDisplacement.replace(/^[+-]/, '')
      const displacement = Number(unsigned) * (negative ? -1 : 1)
      const baseRegister = Number(memory[4])
      if (!Number.isSafeInteger(displacement) || displacement < -2147483648 || displacement > 2147483647) return { instructions: [], error: `第 ${lineNumber} 行：位移必须是 32 位有符号整数。` }
      instructions.push({ id, opcode, text: `${opcode} R${register},${displacement}(R${baseRegister})`, sources: opcode === 'LOAD' ? [baseRegister] : [register, baseRegister], destination: opcode === 'LOAD' ? register : null, memory: { baseRegister, displacement } })
    } else return { instructions: [], error: `第 ${lineNumber} 行格式不正确。支持 ADD / SUB Rd,Ra,Rb；MOV Rd,Rs；LOAD / STORE Rn,位移(Rb)，寄存器范围 R0–R7。` }
  }
  return { instructions, error: null }
}

export const IDEAL_PIPELINE_SCHEDULER: PipelineScheduler = {
  id: 'ideal-five-stage',
  schedule: (instructions) => ({ placements: instructions.flatMap((instruction, index) => STAGE_IDS.map((stage, stageIndex) => ({ instructionId: instruction.id, stage, cycle: index + stageIndex + 1 }))) }),
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) freezeDeep(nested)
    Object.freeze(value)
  }
  return value
}

function stageCycles(placements: PipelinePlacement[], instructionId: string, stage: PipelineStage) {
  return placements.filter((placement) => placement.instructionId === instructionId && placement.stage === stage).map((placement) => placement.cycle)
}

/** Nearest earlier writer supplies each source. WB writes before ID reads in the same cycle. */
export function detectPipelineHazards(instructions: PipelineInstruction[], placements: PipelinePlacement[]): DataHazard[] {
  const hazards: DataHazard[] = []
  const writers = new Map<number, PipelineInstruction>()
  for (const consumer of instructions) {
    const readCycle = Math.max(...stageCycles(placements, consumer.id, 'ID'))
    for (const register of new Set(consumer.sources)) {
      const producer = writers.get(register)
      if (!producer) continue
      const availableCycle = Math.max(...stageCycles(placements, producer.id, 'WB'))
      if (readCycle >= availableCycle) continue
      const producerStageAtRead = placements.find((placement) => placement.instructionId === producer.id && placement.cycle === readCycle)?.stage
      // An extended scheduler can hold a producer between stages; report its latest reached stage.
      const reachedStage = producerStageAtRead ?? placements.filter((placement) => placement.instructionId === producer.id && placement.cycle <= readCycle).sort((a, b) => b.cycle - a.cycle)[0]?.stage ?? 'IF'
      hazards.push({ id: `raw-${producer.id}-${consumer.id}-r${register}`, kind: 'RAW', register, producerId: producer.id, consumerId: consumer.id, readCycle, availableCycle, producerStageAtRead: reachedStage, consumerStage: 'ID' })
    }
    if (consumer.destination !== null) writers.set(consumer.destination, consumer)
  }
  return hazards
}

function validateSchedule(instructions: PipelineInstruction[], placements: PipelinePlacement[]) {
  const ids = new Set(instructions.map((instruction) => instruction.id))
  if (!instructions.length || ids.size !== instructions.length) throw new Error('Pipeline instructions must have unique IDs and contain at least one instruction.')
  const occupied = new Set<string>()
  const instructionCycles = new Set<string>()
  for (const placement of placements) {
    if (!ids.has(placement.instructionId) || !STAGE_IDS.includes(placement.stage) || !Number.isInteger(placement.cycle) || placement.cycle < 1) throw new Error('Invalid pipeline placement.')
    const key = `${placement.cycle}:${placement.stage}`
    const instructionKey = `${placement.cycle}:${placement.instructionId}`
    if (occupied.has(key) || instructionCycles.has(instructionKey)) throw new Error('Pipeline placement collision.')
    occupied.add(key)
    instructionCycles.add(instructionKey)
  }
  for (const instruction of instructions) {
    let priorEnd = 0
    for (const stage of STAGE_IDS) {
      const cycles = stageCycles(placements, instruction.id, stage)
      if (!cycles.length || Math.min(...cycles) <= priorEnd) throw new Error('Every instruction must visit IF, ID, EX, MEM and WB in order.')
      priorEnd = Math.max(...cycles)
    }
  }
}

/** One frozen execution supplies both the stage model and timing diagram. Cycle 0 is ready. */
export function createPipelineExecution(instructions: PipelineInstruction[], options: { scheduler?: PipelineScheduler } = {}): PipelineExecution {
  const copiedInstructions = structuredClone(instructions)
  const scheduler = options.scheduler ?? IDEAL_PIPELINE_SCHEDULER
  const schedule = scheduler.schedule(structuredClone(copiedInstructions))
  const placements = structuredClone(schedule.placements).sort((a, b) => a.cycle - b.cycle || STAGE_IDS.indexOf(a.stage) - STAGE_IDS.indexOf(b.stage))
  validateSchedule(copiedInstructions, placements)
  const dependencies = detectPipelineHazards(copiedInstructions, placements)
  const totalCycles = Math.max(...placements.map((placement) => placement.cycle))
  const writeBackCycles = new Map(copiedInstructions.map((instruction) => [instruction.id, Math.max(...stageCycles(placements, instruction.id, 'WB'))]))
  const cycles = Array.from({ length: totalCycles + 1 }, (_, cycle): CycleSnapshot => ({
    cycle,
    occupants: Object.fromEntries(STAGE_IDS.map((stage) => [stage, placements.find((placement) => placement.cycle === cycle && placement.stage === stage)?.instructionId ?? null])) as Record<PipelineStage, string | null>,
    activeHazards: dependencies.filter((hazard) => hazard.readCycle === cycle),
    detectedHazards: dependencies.filter((hazard) => hazard.readCycle <= cycle),
    completedInstructionIds: copiedInstructions.filter((instruction) => writeBackCycles.get(instruction.id)! <= cycle).map((instruction) => instruction.id),
  }))
  const events = [
    ...placements.map((placement) => ({ kind: 'stage-entry' as const, ...placement })),
    ...dependencies.map((hazard) => ({ kind: 'raw-detected' as const, cycle: hazard.readCycle, hazardId: hazard.id })),
    ...structuredClone(schedule.events ?? []),
  ].sort((a, b) => a.cycle - b.cycle)
  return freezeDeep({ instructions: copiedInstructions, cycles, dependencies, totalCycles, schedulerId: scheduler.id, placements, events })
}

export function getPipelineSnapshot(execution: PipelineExecution, cycle: number): CycleSnapshot {
  if (!Number.isInteger(cycle) || cycle < 0 || cycle > execution.totalCycles) throw new RangeError('Pipeline cycle is outside this execution.')
  return execution.cycles[cycle]
}
