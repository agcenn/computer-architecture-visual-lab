import { create } from 'zustand'
import { DEFAULT_INSTRUCTION, executionStages, getStepDetails, INITIAL_REGISTERS, parseInstruction } from '../data/instructions'
import type { CPUStore, ParsedInstruction } from '../types/cpu'

const defaultParsedInstruction: ParsedInstruction = { opcode: 'ADD', rd: 1, rs1: 2, rs2: 3 }

// Each run keeps a pre-instruction snapshot. Traversing the timeline is reversible,
// including when a source register is also the destination.
export function createCPUStore() {
  return create<CPUStore>()((set, get) => {
    const restoredRegisters = () => [...(get().executionBaseline ?? get().registers)]

    const start = (playing: boolean) => {
      const state = get()
      const parsed = parseInstruction(state.instructionText)
      const registers = restoredRegisters()
      if (!parsed.instruction) {
        set({ registers, executionBaseline: null, step: -1, playing: false, error: parsed.error })
        return
      }
      set({
        registers,
        executionBaseline: [...registers],
        parsedInstruction: parsed.instruction,
        instructionText: `ADD R${parsed.instruction.rd}, R${parsed.instruction.rs1}, R${parsed.instruction.rs2}`,
        step: 0,
        playing,
        error: null,
      })
    }

    return {
      instructionText: DEFAULT_INSTRUCTION,
      parsedInstruction: { ...defaultParsedInstruction },
      error: null,
      step: -1,
      playing: false,
      speed: 1,
      registers: [...INITIAL_REGISTERS],
      executionBaseline: null,
      selectedComponent: null,

      setInstructionText: (instructionText) => {
        const parsed = parseInstruction(instructionText)
        set({
          instructionText,
          ...(parsed.instruction ? { parsedInstruction: parsed.instruction } : {}),
          registers: restoredRegisters(),
          executionBaseline: null,
          step: -1,
          playing: false,
          error: null,
        })
      },

      run: () => start(true),

      next: () => {
        const state = get()
        if (state.step < 0) {
          start(false)
          return
        }
        if (state.step >= executionStages.length - 1) {
          set({ playing: false })
          return
        }
        const nextStep = state.step + 1
        const registers = restoredRegisters()
        if (nextStep === executionStages.length - 1) {
          registers[state.parsedInstruction.rd] = getStepDetails(state).result
        }
        set({ registers, step: nextStep, playing: nextStep < executionStages.length - 1 && state.playing })
      },

      previous: () => {
        const state = get()
        if (state.step < 0) return
        set({ registers: restoredRegisters(), step: state.step - 1, playing: false, error: null })
      },

      reset: () => set({
        registers: restoredRegisters(),
        executionBaseline: null,
        step: -1,
        playing: false,
        error: null,
      }),

      pause: () => set({ playing: false }),

      play: () => {
        const state = get()
        if (state.step < 0 || state.step >= executionStages.length - 1) {
          start(true)
        } else {
          set({ playing: true })
        }
      },

      setSpeed: (speed) => {
        if (speed === 0.5 || speed === 1 || speed === 2) set({ speed })
      },

      setRegister: (index, value) => {
        if (!Number.isInteger(index) || index < 0 || index > 7) return
        if (!Number.isInteger(value) || value < -0x80000000 || value > 0xffffffff) {
          set({ error: '寄存器请输入 32 位整数：−2147483648 至 4294967295。', playing: false })
          return
        }
        const registers = restoredRegisters()
        registers[index] = value | 0
        set({ registers, executionBaseline: null, step: -1, playing: false, error: null })
      },

      selectComponent: (selectedComponent) => set({ selectedComponent }),
    }
  })
}

export const useCPUStore = createCPUStore()
