export type PipelineStage = 'IF' | 'ID' | 'EX' | 'MEM' | 'WB'
export type PipelineOpcode = 'ADD' | 'SUB' | 'LOAD' | 'STORE' | 'MOV'

/** Register R0 is writable, just like the other seven teaching registers. */
export interface PipelineInstruction {
  id: string
  opcode: PipelineOpcode
  text: string
  sources: number[]
  destination: number | null
  memory?: { baseRegister: number; displacement: number }
}

export interface DataHazard {
  id: string
  kind: 'RAW'
  register: number
  producerId: string
  consumerId: string
  readCycle: number
  availableCycle: number
  producerStageAtRead: PipelineStage
  consumerStage: 'ID'
}

/** A placement can repeat a stage in later cycles when a future scheduler inserts a stall. */
export interface PipelinePlacement {
  instructionId: string
  stage: PipelineStage
  cycle: number
}

export type PipelineEvent =
  | { kind: 'stage-entry'; cycle: number; instructionId: string; stage: PipelineStage }
  | { kind: 'raw-detected'; cycle: number; hazardId: string }
  | { kind: 'stall'; cycle: number; instructionId: string; stage: PipelineStage }
  | { kind: 'forward'; cycle: number; producerId: string; consumerId: string; register: number }
  | { kind: 'branch-prediction'; cycle: number; instructionId: string; prediction: 'taken' | 'not-taken' }

export interface PipelineSchedule {
  placements: PipelinePlacement[]
  events?: PipelineEvent[]
}

/** Timing policy is separate from rendering and RAW analysis. Only ideal scheduling ships today. */
export interface PipelineScheduler {
  id: string
  schedule: (instructions: PipelineInstruction[]) => PipelineSchedule
}

export interface CycleSnapshot {
  cycle: number
  occupants: Record<PipelineStage, string | null>
  activeHazards: DataHazard[]
  detectedHazards: DataHazard[]
  completedInstructionIds: string[]
}

export interface PipelineExecution {
  instructions: PipelineInstruction[]
  cycles: CycleSnapshot[]
  dependencies: DataHazard[]
  totalCycles: number
  schedulerId: string
  placements: PipelinePlacement[]
  events: PipelineEvent[]
}

export interface PipelinePreset {
  id: string
  title: string
  description: string
  program: string
}

export interface PipelineStore {
  execution: PipelineExecution
  cycle: number
  playing: boolean
  speed: number
  revision: number
  selectedInstructionId: string | null
  programText: string
  error: string | null
  next: () => void
  previous: () => void
  play: () => void
  pause: () => void
  reset: () => void
  selectInstruction: (id: string | null) => void
  setProgramText: (text: string) => void
  applyProgram: () => void
  loadPreset: (id: string) => void
  setSpeed: (speed: number) => void
}
