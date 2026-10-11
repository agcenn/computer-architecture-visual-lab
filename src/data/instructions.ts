import type { ALUOperation, ControlSignals, CPUExecutionContext, CPUState, DataFlowSpec, ExecutionStage, ExecutionStep, Instruction, StepDetails } from '../types/cpu'

export { componentInfo } from './modules'

export const INITIAL_REGISTERS = [0, 0, 5, 7, 0, 0, 0, 0] as const
export const INITIAL_MEMORY: Record<number, number> = { 0x1000: 42, 0x1004: 0 }
export const DEFAULT_INSTRUCTION = 'ADD R1, R2, R3'
export const PROGRAM_START_ADDRESS = 0x00400000

const signal = (from: DataFlowSpec['from'], to: DataFlowSpec['to'], type: DataFlowSpec['type'], label: string): DataFlowSpec => ({ from, to, type, label })

/** Six observation points within one instruction, not six clock cycles. */
export const executionStages: ExecutionStage[] = [
  { id: 'fetch', label: 'FETCH', title: '取指 · 读取当前指令', description: 'PC 提供指令地址，指令存储器将指令送入 IR 教学显示区。', activeComponents: ['pc', 'instructionMemory', 'instructionRegister'], flows: [signal('pc', 'instructionMemory', 'address', 'PC'), signal('instructionMemory', 'instructionRegister', 'memory', 'Instruction')] },
  { id: 'decode', label: 'DECODE', title: '译码 · 生成控制信号', description: 'Decoder 识别操作码与操作数字段，决定本条指令的数据通路。', activeComponents: ['instructionRegister', 'controlUnit', 'registerFile'], flows: [signal('instructionRegister', 'controlUnit', 'data', 'Opcode'), signal('instructionRegister', 'registerFile', 'address', 'Register addresses')] },
  { id: 'register-read', label: 'REGISTER READ', title: '读寄存器 · 准备操作数', description: '读取源寄存器，或准备 LOAD / STORE 的绝对地址。', activeComponents: ['controlUnit', 'registerFile', 'mux', 'alu'], flows: [signal('registerFile', 'alu', 'data', 'Operand A'), signal('registerFile', 'mux', 'data', 'Operand B'), signal('mux', 'alu', 'data', 'Operand B'), signal('controlUnit', 'mux', 'control', 'ALUSrc')] },
  { id: 'execute', label: 'EXECUTE', title: '执行 · 观察 ALU 输入和输出', description: 'ALU 完成算术、数据传递或有效地址计算；目标寄存器尚未写入。', activeComponents: ['controlUnit', 'registerFile', 'mux', 'alu', 'writeBack'], flows: [signal('registerFile', 'alu', 'data', 'Operand A'), signal('registerFile', 'mux', 'data', 'Operand B'), signal('mux', 'alu', 'data', 'Operand B'), signal('controlUnit', 'mux', 'control', 'ALUSrc'), signal('controlUnit', 'alu', 'control', 'ALUOp'), signal('alu', 'writeBack', 'data', 'ALU Result')] },
  { id: 'memory', label: 'MEMORY', title: '访存 · 读取或写入一个字', description: '只有 LOAD / STORE 访问数据存储器。算术与 MOV 指令在此处直接传递结果。', activeComponents: [], flows: [] },
  { id: 'write-back', label: 'WRITE BACK', title: '写回 · 提交结果并更新 PC', description: '需要写寄存器的指令经过 Write Back 保存结果；STORE 不写寄存器。PC 前进 4 字节。', activeComponents: ['pc', 'controlUnit', 'alu', 'writeBack', 'registerFile'], flows: [signal('alu', 'writeBack', 'data', 'ALU Result'), signal('writeBack', 'registerFile', 'data', 'Write data'), signal('controlUnit', 'writeBack', 'control', 'MemtoReg'), signal('controlUnit', 'registerFile', 'control', 'RegWrite')] },
]

export type ParseResult = { instruction: Instruction; error: null } | { instruction: null; error: string }
const syntaxError = '支持 ADD / SUB Rd, Rs1, Rs2；LOAD Rd, [0x1000]；STORE Rs, [0x1000]；MOV Rd, Rs。寄存器范围为 R0–R7。'

export function isWordAddress(address: number): boolean {
  return Number.isInteger(address) && address >= 0 && address <= 0xffffffff && address % 4 === 0
}

export function parseInstruction(text: string): ParseResult {
  const input = text.trim()
  const arithmetic = /^(ADD|SUB)\s+R([0-7])\s*,\s*R([0-7])\s*,\s*R([0-7])$/i.exec(input)
  if (arithmetic) return { instruction: { opcode: arithmetic[1].toUpperCase() as 'ADD' | 'SUB', rd: Number(arithmetic[2]), rs1: Number(arithmetic[3]), rs2: Number(arithmetic[4]) }, error: null }
  const move = /^MOV\s+R([0-7])\s*,\s*R([0-7])$/i.exec(input)
  if (move) return { instruction: { opcode: 'MOV', rd: Number(move[1]), rs: Number(move[2]) }, error: null }
  const memory = /^(LOAD|STORE)\s+R([0-7])\s*,\s*\[\s*(0x[0-9a-f]+|[0-9]+)\s*\]$/i.exec(input)
  if (memory) {
    const address = Number(memory[3])
    if (!isWordAddress(address)) return { instruction: null, error: '内存地址必须是 0x00000000 至 0xFFFFFFFC 范围内、按 4 字节对齐的 32 位地址。' }
    const register = Number(memory[2])
    return { instruction: memory[1].toUpperCase() === 'LOAD' ? { opcode: 'LOAD', rd: register, address } : { opcode: 'STORE', rs: register, address }, error: null }
  }
  return { instruction: null, error: syntaxError }
}

export function formatHex(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(8, '0').toUpperCase()}`
}

export function formatBinary(value: number): string {
  return (value >>> 0).toString(2).padStart(32, '0').match(/.{8}/g)!.join(' ')
}

export function formatInstruction(instruction: Instruction): string {
  switch (instruction.opcode) {
    case 'ADD': case 'SUB': return `${instruction.opcode} R${instruction.rd}, R${instruction.rs1}, R${instruction.rs2}`
    case 'LOAD': return `LOAD R${instruction.rd}, [${formatHex(instruction.address)}]`
    case 'STORE': return `STORE R${instruction.rs}, [${formatHex(instruction.address)}]`
    case 'MOV': return `MOV R${instruction.rd}, R${instruction.rs}`
  }
}

export const idleControlSignals = (): ControlSignals => ({ ALUOp: null, ALUSrc: 0, RegWrite: 0, MemRead: 0, MemWrite: 0, MemtoReg: 0 })

export function cloneCPUState(state: CPUState): CPUState {
  return { pc: state.pc, registers: [...state.registers], memory: { ...state.memory }, currentInstruction: state.currentInstruction ? { ...state.currentInstruction } : null, operandA: state.operandA, operandB: state.operandB, aluResult: state.aluResult, memoryData: state.memoryData, storeData: state.storeData, controlSignals: { ...state.controlSignals } }
}

export function clearExecutionValues(state: CPUState): CPUState {
  return { ...cloneCPUState(state), currentInstruction: null, operandA: null, operandB: null, aluResult: null, memoryData: null, storeData: null, controlSignals: idleControlSignals() }
}

function evaluate(instruction: Instruction, baseline: CPUState) {
  let operandA = 0, operandB = 0, operation: ALUOperation = 'ADD'
  let inputALabel = '常量 0', inputBLabel = '常量 0'
  let memoryAddress: number | null = null, memoryValue: number | null = null
  let destination: number | null = null, storeData: number | null = null
  switch (instruction.opcode) {
    case 'ADD': case 'SUB':
      operandA = baseline.registers[instruction.rs1]; operandB = baseline.registers[instruction.rs2]
      inputALabel = `R${instruction.rs1}`; inputBLabel = `R${instruction.rs2}`
      operation = instruction.opcode; destination = instruction.rd
      break
    case 'MOV':
      operandA = baseline.registers[instruction.rs]; inputALabel = `R${instruction.rs}`
      inputBLabel = '未使用'; operation = 'PASS'; destination = instruction.rd
      break
    case 'LOAD': case 'STORE':
      memoryAddress = instruction.address; operandB = instruction.address | 0
      inputBLabel = `地址 ${formatHex(instruction.address)}`
      memoryValue = baseline.memory[instruction.address] ?? 0
      if (instruction.opcode === 'LOAD') destination = instruction.rd
      else { storeData = baseline.registers[instruction.rs]; memoryValue = storeData }
      break
  }
  const fullResult = operation === 'SUB' ? operandA - operandB : operation === 'PASS' ? operandA : operandA + operandB
  const result = fullResult | 0
  const overflow = fullResult > 0x7fffffff || fullResult < -0x80000000
  // In subtraction, carry means "no unsigned borrow".
  const carry = operation === 'SUB' ? (operandA >>> 0) >= (operandB >>> 0) : operation === 'ADD' && (operandA >>> 0) + (operandB >>> 0) > 0xffffffff
  const writeBackValue = instruction.opcode === 'STORE' ? null : instruction.opcode === 'LOAD' ? memoryValue : result
  return { operandA, operandB, operation, inputALabel, inputBLabel, result, overflow, carry, memoryAddress, memoryValue, destination, storeData, writeBackValue }
}

/** Build immutable observations from the same origin, including all side effects. */
export function simulateInstruction(instruction: Instruction, baseline: CPUState): ExecutionStep[] {
  const values = evaluate(instruction, baseline)
  const memoryOperation = instruction.opcode === 'LOAD' || instruction.opcode === 'STORE'
  const state = clearExecutionValues(baseline)
  return executionStages.map((stage, index) => {
    if (index === 0) state.currentInstruction = { ...instruction }
    // These are decoded instruction intent, stable in a single-cycle datapath.
    // Observation snapshots delay visible side effects, not control assertion.
    if (index >= 1) state.controlSignals = { ALUOp: values.operation, ALUSrc: memoryOperation ? 1 : 0, RegWrite: instruction.opcode !== 'STORE' ? 1 : 0, MemRead: instruction.opcode === 'LOAD' ? 1 : 0, MemWrite: instruction.opcode === 'STORE' ? 1 : 0, MemtoReg: instruction.opcode === 'LOAD' ? 1 : 0 }
    if (index === 2) { state.operandA = values.operandA; state.operandB = values.operandB; state.storeData = values.storeData }
    if (index === 3) state.aluResult = values.result
    if (index === 4 && memoryOperation) {
      state.memoryData = values.memoryValue
      if (instruction.opcode === 'STORE') state.memory[instruction.address] = values.storeData!
    }
    if (index === 5) {
      if (values.destination !== null) state.registers[values.destination] = values.writeBackValue!
      state.pc = (baseline.pc + 4) >>> 0
    }
    return { index, id: stage.id, state: cloneCPUState(state) }
  })
}

function operandFlows(instruction: Instruction, values: ReturnType<typeof evaluate>): DataFlowSpec[] {
  if (instruction.opcode === 'LOAD' || instruction.opcode === 'STORE') return [signal('instructionRegister', 'mux', 'data', formatHex(instruction.address)), signal('mux', 'alu', 'data', formatHex(instruction.address)), signal('controlUnit', 'mux', 'control', 'ALUSrc = 1')]
  if (instruction.opcode === 'MOV') return [signal('registerFile', 'alu', 'data', `${values.inputALabel} = ${values.operandA}`)]
  return [signal('registerFile', 'alu', 'data', `${values.inputALabel} = ${values.operandA}`), signal('registerFile', 'mux', 'data', `${values.inputBLabel} = ${values.operandB}`), signal('mux', 'alu', 'data', `${values.inputBLabel} = ${values.operandB}`), signal('controlUnit', 'mux', 'control', 'ALUSrc = 0')]
}

function registerFields(instruction: Instruction): string {
  switch (instruction.opcode) {
    case 'ADD': case 'SUB': return `R${instruction.rs1}, R${instruction.rs2} → R${instruction.rd}`
    case 'LOAD': return `rd = R${instruction.rd}`
    case 'STORE': return `rs = R${instruction.rs}`
    case 'MOV': return `R${instruction.rs} → R${instruction.rd}`
  }
}

export function getStepDetails(state: CPUExecutionContext): StepDetails {
  const instruction = state.parsedInstruction
  const baseline = state.executionBaseline ?? state
  const values = evaluate(instruction, baseline)
  const stage = executionStages[state.step] ?? null
  const instructionLabel = formatInstruction(instruction)
  const memoryOperation = instruction.opcode === 'LOAD' || instruction.opcode === 'STORE'
  const common = { operandA: values.operandA, operandB: values.operandB, result: values.result, overflow: values.overflow, carry: values.carry, operation: values.operation, inputALabel: values.inputALabel, inputBLabel: values.inputBLabel, writeBackValue: values.writeBackValue, memoryAddress: values.memoryAddress, memoryValue: values.memoryValue }
  if (!stage) return { ...common, stage: null, id: 'idle', label: 'READY', title: '一条指令，六个观察步骤', description: '选择指令并单步执行，观察取指、译码、读寄存器、执行、访存与写回。六步拆解同一指令的数据传播，并非六个时钟周期；IR 是教学显示区。', activeComponents: [], flows: [], lines: [instructionLabel, `PC = ${formatHex(state.pc)}`], skipped: false }
  let activeComponents = [...stage.activeComponents], flows: DataFlowSpec[] = [], lines: string[] = [], description = stage.description, skipped = false
  switch (stage.id) {
    case 'fetch':
      flows = [signal('pc', 'instructionMemory', 'address', formatHex(baseline.pc)), signal('instructionMemory', 'instructionRegister', 'memory', instructionLabel)]
      lines = [`PC = ${formatHex(baseline.pc)}`, `Current Instruction ← ${instructionLabel}`]
      break
    case 'decode':
      flows = [signal('instructionRegister', 'controlUnit', 'data', `Opcode: ${instruction.opcode}`), signal('instructionRegister', 'registerFile', 'address', registerFields(instruction))]
      lines = [`Opcode = ${instruction.opcode}`, registerFields(instruction), `ALUOp = ${values.operation} · ALUSrc = ${memoryOperation ? 1 : 0}`]
      description = `${instruction.opcode} 的译码已完成。控制信号表达本条指令的操作意图，并在本次执行中保持稳定；后续观察步骤展示数据传播与状态提交。`
      break
    case 'register-read':
      if (instruction.opcode === 'LOAD') {
        activeComponents = ['instructionRegister', 'controlUnit', 'mux']
        flows = [signal('instructionRegister', 'mux', 'data', formatHex(instruction.address)), signal('controlUnit', 'mux', 'control', 'ALUSrc = 1')]
        lines = ['无需读取源寄存器', `准备绝对地址 ${formatHex(instruction.address)}`]
        skipped = true; description = 'LOAD 使用绝对地址，不需要读取源寄存器。目标寄存器将在 WRITE BACK 更新。'
      } else if (instruction.opcode === 'STORE') {
        activeComponents = ['registerFile', 'instructionRegister', 'controlUnit', 'mux']
        flows = [signal('registerFile', 'dataMemory', 'data', `R${instruction.rs} = ${values.storeData}`), signal('instructionRegister', 'mux', 'data', formatHex(instruction.address)), signal('controlUnit', 'mux', 'control', 'ALUSrc = 1')]
        lines = [`Store Data: R${instruction.rs} = ${values.storeData}`, `地址 = ${formatHex(instruction.address)} · 本观察点尚未写入内存`]
        description = '读取要存入内存的寄存器值，同时准备绝对地址。此时数据仅到达内存输入端，还未修改内存。'
      } else {
        flows = operandFlows(instruction, values)
        activeComponents = instruction.opcode === 'MOV' ? ['registerFile', 'alu'] : activeComponents
        lines = [`Input A: ${values.inputALabel} = ${values.operandA}`, instruction.opcode === 'MOV' ? 'MOV 只使用一个源寄存器' : `Input B: ${values.inputBLabel} = ${values.operandB}`]
      }
      break
    case 'execute':
      flows = [...operandFlows(instruction, values), signal('controlUnit', 'alu', 'control', `ALUOp = ${values.operation}`), memoryOperation ? signal('alu', 'dataMemory', 'address', formatHex(values.result)) : signal('alu', 'writeBack', 'data', `ALU Result = ${values.result}`)]
      activeComponents = memoryOperation ? ['instructionRegister', 'controlUnit', 'mux', 'alu'] : instruction.opcode === 'MOV' ? ['registerFile', 'controlUnit', 'alu', 'writeBack'] : activeComponents
      lines = [`Input A: ${values.inputALabel} = ${values.operandA}`, `Input B: ${values.inputBLabel}${memoryOperation ? '' : ` = ${values.operandB}`}`, `Operation: ${values.operation}`, memoryOperation ? `Address = ${formatHex(values.result)}` : `Result: ${values.result}${values.overflow ? ' · 有符号溢出，保留低 32 位' : ''}`, '目标寄存器尚未改变 · 写回观察点展示状态提交']
      description = memoryOperation ? 'ALU 将常量 0 与绝对地址相加，形成有效地址。控制信号已经译码；下一观察点展示由该地址进行的内存访问。' : instruction.opcode === 'MOV' ? 'ALU 的 PASS 操作把输入 A 原样送到 Write Back 输入端，目标寄存器尚未改变。' : `ALU 执行 ${values.operation}，操作数和结果同时显示在数据线路上。结果已到达 Write Back 输入端，尚未写寄存器。`
      break
    case 'memory':
      if (instruction.opcode === 'LOAD') {
        activeComponents = ['controlUnit', 'alu', 'dataMemory', 'writeBack']
        flows = [signal('alu', 'dataMemory', 'address', formatHex(instruction.address)), signal('dataMemory', 'writeBack', 'memory', `${values.memoryValue}`), signal('controlUnit', 'dataMemory', 'control', 'MemRead = 1 · MemWrite = 0')]
        lines = [`Address: ${formatHex(instruction.address)}`, `Memory[${formatHex(instruction.address)}] = ${values.memoryValue}`, 'MemRead = 1 · 已读取，目标寄存器尚未改变']
      } else if (instruction.opcode === 'STORE') {
        activeComponents = ['registerFile', 'controlUnit', 'alu', 'dataMemory']
        flows = [signal('alu', 'dataMemory', 'address', formatHex(instruction.address)), signal('registerFile', 'dataMemory', 'data', `R${instruction.rs} = ${values.storeData}`), signal('controlUnit', 'dataMemory', 'control', 'MemRead = 0 · MemWrite = 1')]
        lines = [`Memory[${formatHex(instruction.address)}] ← ${values.storeData}`, `Source: R${instruction.rs} = ${values.storeData}`, 'MemWrite = 1 · Previous 可恢复写入前的内存']
      } else {
        activeComponents = ['alu', 'writeBack']; flows = [signal('alu', 'writeBack', 'data', `ALU Result = ${values.result}`)]
        lines = [`${instruction.opcode} 无需访问数据存储器`, `结果 ${values.result} 等待写回 · MemRead = 0 · MemWrite = 0`]
        description = `${instruction.opcode} 跳过内存读写。结果沿 ALU → Write Back 继续传递，数据存储器保持灰色。`; skipped = true
      }
      break
    case 'write-back':
      if (instruction.opcode === 'STORE') {
        activeComponents = ['pc', 'controlUnit']; flows = []
        lines = ['STORE 不写寄存器 · RegWrite = 0', `内存已保存 ${values.storeData}`, `PC: ${formatHex(baseline.pc)} → ${formatHex(state.pc)}`]
        description = 'STORE 的内存写入已完成，不经过寄存器写回。指令提交后 PC 前进 4 字节。'; skipped = true
      } else {
        activeComponents = ['pc', 'controlUnit', 'writeBack', 'registerFile', instruction.opcode === 'LOAD' ? 'dataMemory' : 'alu']
        flows = [instruction.opcode === 'LOAD' ? signal('dataMemory', 'writeBack', 'memory', `${values.memoryValue}`) : signal('alu', 'writeBack', 'data', `ALU Result = ${values.result}`), signal('writeBack', 'registerFile', 'data', `${values.writeBackValue} → R${values.destination}`), signal('controlUnit', 'writeBack', 'control', `MemtoReg = ${instruction.opcode === 'LOAD' ? 1 : 0}`), signal('controlUnit', 'registerFile', 'control', 'RegWrite = 1')]
        lines = [`R${values.destination} ← ${values.writeBackValue}`, `Decimal ${values.writeBackValue} · Hex ${formatHex(values.writeBackValue!)}`, `PC: ${formatHex(baseline.pc)} → ${formatHex(state.pc)}`]
        description = instruction.opcode === 'LOAD' ? 'MemtoReg = 1 选择内存读取值，RegWrite = 1 写入目标寄存器。PC 前进 4 字节。' : 'MemtoReg = 0 选择 ALU 结果，RegWrite = 1 写入目标寄存器。PC 前进 4 字节。'
      }
      break
  }
  return { ...common, ...stage, stage, activeComponents, flows, lines, description, skipped }
}
