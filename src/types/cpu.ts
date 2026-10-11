export type ComponentId =
  | 'pc'
  | 'instructionMemory'
  | 'instructionRegister'
  | 'controlUnit'
  | 'registerFile'
  | 'alu'
  | 'mux'
  | 'dataMemory'
  | 'writeBack'
  | 'cache'
  | 'bus'

export type CPUSpeed = 0.5 | 1 | 2

export type Instruction =
  | { opcode: 'ADD' | 'SUB'; rd: number; rs1: number; rs2: number }
  | { opcode: 'LOAD'; rd: number; address: number }
  | { opcode: 'STORE'; rs: number; address: number }
  | { opcode: 'MOV'; rd: number; rs: number }

export type ParsedInstruction = Instruction
export type ALUOperation = 'ADD' | 'SUB' | 'PASS'

export interface ControlSignals {
  ALUOp: ALUOperation | null
  ALUSrc: 0 | 1
  RegWrite: 0 | 1
  MemRead: 0 | 1
  MemWrite: 0 | 1
  MemtoReg: 0 | 1
}

/** Architectural state and the visible instruction's intermediate values. */
export interface CPUState {
  pc: number
  registers: number[]
  memory: Record<number, number>
  currentInstruction: Instruction | null
  operandA: number | null
  operandB: number | null
  aluResult: number | null
  memoryData: number | null
  storeData: number | null
  controlSignals: ControlSignals
}

export interface DataFlowSpec {
  from: ComponentId
  to: ComponentId
  type: 'data' | 'address' | 'control' | 'memory'
  label: string
}

export interface ExecutionStage {
  id: 'fetch' | 'decode' | 'register-read' | 'execute' | 'memory' | 'write-back'
  label: string
  title: string
  description: string
  activeComponents: ComponentId[]
  flows: DataFlowSpec[]
}

export interface ExecutionStep {
  index: number
  id: ExecutionStage['id']
  state: CPUState
}

export interface CPUExecutionContext extends CPUState {
  parsedInstruction: ParsedInstruction
  step: number
  executionBaseline?: CPUState | null
}

export interface StepDetails {
  stage: ExecutionStage | null
  id: ExecutionStage['id'] | 'idle'
  label: string
  title: string
  description: string
  activeComponents: ComponentId[]
  flows: DataFlowSpec[]
  lines: string[]
  operandA: number
  operandB: number
  result: number
  overflow: boolean
  carry: boolean
  operation: ALUOperation
  inputALabel: string
  inputBLabel: string
  writeBackValue: number | null
  memoryAddress: number | null
  memoryValue: number | null
  skipped: boolean
}

export interface CPUStore extends CPUExecutionContext {
  instructionText: string
  error: string | null
  playing: boolean
  speed: CPUSpeed
  selectedComponent: ComponentId | null
  executionBaseline: CPUState | null
  history: ExecutionStep[]
  executionRevision: number
  setInstructionText: (text: string) => void
  run: () => void
  next: () => void
  previous: () => void
  reset: () => void
  pause: () => void
  play: () => void
  setSpeed: (speed: CPUSpeed) => void
  setRegister: (index: number, value: number) => void
  setMemory: (address: number, value: number) => void
  selectComponent: (id: ComponentId | null) => void
}

export interface ComponentInfo {
  name: string
  englishName: string
  shortLabel: string
  color: string
  description: string
  inputs: string[]
  outputs: string[]
  detail: string
}

export interface CourseModule {
  id: string
  title: string
  subtitle: string
  available: boolean
}
