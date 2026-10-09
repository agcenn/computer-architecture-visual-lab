import type { CPUExecutionContext, ExecutionStage, ParsedInstruction, StepDetails } from '../types/cpu'

export { componentInfo } from './modules'

export const INITIAL_REGISTERS = [0, 0, 5, 7, 0, 0, 0, 0] as const
export const DEFAULT_INSTRUCTION = 'ADD R1, R2, R3'
export const PROGRAM_START_ADDRESS = 0x00400000

export const executionStages: ExecutionStage[] = [
  {
    id: 'fetch',
    label: 'Fetch',
    title: '取指 · 找到下一条指令',
    description: 'PC 保存当前指令的地址。CPU 使用这个地址访问指令存储器，再把读取的指令送入指令寄存器。',
    activeComponents: ['pc', 'instructionMemory', 'instructionRegister', 'bus'],
    flows: [
      { from: 'pc', to: 'instructionMemory', type: 'address', label: '0x00400000' },
      { from: 'instructionMemory', to: 'instructionRegister', type: 'memory', label: 'ADD' },
    ],
  },
  {
    id: 'decode',
    label: 'Decode',
    title: '译码 · 读懂指令的含义',
    description: '控制单元识别 ADD 操作，并分离源寄存器与目标寄存器编号，生成接下来需要的控制信号。',
    activeComponents: ['instructionRegister', 'controlUnit', 'registerFile', 'bus'],
    flows: [
      { from: 'instructionRegister', to: 'controlUnit', type: 'control', label: 'Opcode: ADD' },
      { from: 'instructionRegister', to: 'registerFile', type: 'address', label: 'rs1 / rs2 / rd' },
    ],
  },
  {
    id: 'register-read',
    label: 'Register Read',
    title: '读寄存器 · 准备两个操作数',
    description: '寄存器堆同时读取两个源寄存器。MUX 选择寄存器数据作为 ALU 的输入，操作数沿数据通路送入 ALU。',
    activeComponents: ['registerFile', 'mux', 'alu', 'bus'],
    flows: [
      { from: 'registerFile', to: 'alu', type: 'data', label: 'Operand A' },
      { from: 'registerFile', to: 'mux', type: 'data', label: 'Operand B' },
      { from: 'mux', to: 'alu', type: 'data', label: 'Operand B' },
    ],
  },
  {
    id: 'execute',
    label: 'Execute',
    title: '执行 · ALU 完成加法',
    description: '控制单元让 ALU 执行加法。两个 32 位操作数相加，结果先留在 ALU 输出端，此时目标寄存器尚未改变。',
    activeComponents: ['controlUnit', 'alu'],
    flows: [{ from: 'controlUnit', to: 'alu', type: 'control', label: 'ALUOp: ADD' }],
  },
  {
    id: 'write-back',
    label: 'Write Back',
    title: '写回 · 保存运算结果',
    description: 'ALU 的结果沿写回通路存入目标寄存器。这条 ADD 指令无需读取数据存储器或 Cache。',
    activeComponents: ['alu', 'registerFile', 'bus'],
    flows: [{ from: 'alu', to: 'registerFile', type: 'data', label: 'Result → rd' }],
  },
]

export type ParseResult = { instruction: ParsedInstruction; error: null } | { instruction: null; error: string }

export function parseInstruction(text: string): ParseResult {
  const match = /^ADD\s+R([0-7])\s*,\s*R([0-7])\s*,\s*R([0-7])$/i.exec(text.trim())
  if (!match) {
    return {
      instruction: null,
      error: '请输入 ADD Rd, Rs1, Rs2，例如 ADD R1, R2, R3。寄存器范围为 R0–R7。',
    }
  }
  return {
    instruction: { opcode: 'ADD', rd: Number(match[1]), rs1: Number(match[2]), rs2: Number(match[3]) },
    error: null,
  }
}

export function formatHex(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(8, '0').toUpperCase()}`
}

export function formatBinary(value: number): string {
  return (value >>> 0).toString(2).padStart(32, '0').match(/.{8}/g)!.join(' ')
}

export function getStepDetails(state: CPUExecutionContext): StepDetails {
  const { parsedInstruction: instruction } = state
  const baseline = state.executionBaseline ?? state.registers
  const operandA = baseline[instruction.rs1] ?? 0
  const operandB = baseline[instruction.rs2] ?? 0
  const fullSum = operandA + operandB
  const result = fullSum | 0
  const overflow = fullSum > 0x7fffffff || fullSum < -0x80000000
  const carry = (operandA >>> 0) + (operandB >>> 0) > 0xffffffff
  const instructionLabel = `ADD R${instruction.rd}, R${instruction.rs1}, R${instruction.rs2}`
  const stage = executionStages[state.step] ?? null
  const common = { operandA, operandB, result, overflow, carry }

  if (!stage) {
    return {
      ...common,
      stage: null,
      id: 'idle',
      label: 'Ready',
      title: '一条指令，五个步骤',
      description: '运行 ADD 指令，观察地址、控制信号和数据如何在 CPU 内流动。点击任意模块查看它的作用。',
      activeComponents: [],
      flows: [],
      lines: [instructionLabel, `R${instruction.rs1} = ${operandA} · R${instruction.rs2} = ${operandB}`],
    }
  }

  const linesByStage: string[][] = [
    [`PC = ${formatHex(PROGRAM_START_ADDRESS)}`, `指令寄存器 ← ${instructionLabel}`],
    ['Opcode = ADD', `rs1 = R${instruction.rs1} · rs2 = R${instruction.rs2} · rd = R${instruction.rd}`],
    [`Operand A: R${instruction.rs1} = ${operandA}`, `Operand B: R${instruction.rs2} = ${operandB}`],
    [`${operandA} + ${operandB} = ${result}`, `ALU Result = ${result}${overflow ? ' · 有符号溢出，保留低 32 位' : ''}`],
    [`R${instruction.rd} ← ${result}`, `Decimal ${result} · Hex ${formatHex(result)}`],
  ]

  const flows = stage.flows.map((flow) => {
    let label = flow.label
    if (stage.id === 'fetch' && flow.from === 'instructionMemory') label = instructionLabel
    if (stage.id === 'decode' && flow.to === 'registerFile') {
      label = `R${instruction.rs1}, R${instruction.rs2} → R${instruction.rd}`
    }
    if (stage.id === 'register-read') {
      label = flow.to === 'alu' && flow.from === 'registerFile'
        ? `R${instruction.rs1} = ${operandA}`
        : `R${instruction.rs2} = ${operandB}`
    }
    if (stage.id === 'write-back') label = `${result} → R${instruction.rd}`
    return { ...flow, label }
  })

  return { ...common, ...stage, stage, flows, lines: linesByStage[state.step] }
}
