export type ComponentId =
  | 'pc'
  | 'instructionMemory'
  | 'instructionRegister'
  | 'controlUnit'
  | 'registerFile'
  | 'alu'
  | 'mux'
  | 'dataMemory'
  | 'cache'
  | 'bus'

export type CPUSpeed = 0.5 | 1 | 2

export interface ParsedInstruction {
  opcode: 'ADD'
  rd: number
  rs1: number
  rs2: number
}

export interface DataFlowSpec {
  from: ComponentId
  to: ComponentId
  type: 'data' | 'address' | 'control' | 'memory'
  label: string
}

export interface ExecutionStage {
  id: 'fetch' | 'decode' | 'register-read' | 'execute' | 'write-back'
  label: string
  title: string
  description: string
  activeComponents: ComponentId[]
  flows: DataFlowSpec[]
}

export interface CPUExecutionContext {
  parsedInstruction: ParsedInstruction
  step: number
  registers: number[]
  executionBaseline?: number[] | null
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
}

export interface CPUStore extends CPUExecutionContext {
  instructionText: string
  error: string | null
  playing: boolean
  speed: CPUSpeed
  selectedComponent: ComponentId | null
  executionBaseline: number[] | null
  setInstructionText: (text: string) => void
  run: () => void
  next: () => void
  previous: () => void
  reset: () => void
  pause: () => void
  play: () => void
  setSpeed: (speed: CPUSpeed) => void
  setRegister: (index: number, value: number) => void
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
