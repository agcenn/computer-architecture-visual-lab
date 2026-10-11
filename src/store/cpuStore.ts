import { create } from 'zustand'
import { clearExecutionValues, cloneCPUState, DEFAULT_INSTRUCTION, executionStages, INITIAL_MEMORY, INITIAL_REGISTERS, isWordAddress, parseInstruction, formatInstruction, PROGRAM_START_ADDRESS, simulateInstruction, idleControlSignals } from '../data/instructions'
import type { CPUState, CPUStore, Instruction } from '../types/cpu'

const defaultInstruction: Instruction = { opcode: 'ADD', rd: 1, rs1: 2, rs2: 3 }
const initialCPUState = (): CPUState => ({ pc: PROGRAM_START_ADDRESS, registers: [...INITIAL_REGISTERS], memory: { ...INITIAL_MEMORY }, currentInstruction: null, operandA: null, operandB: null, aluResult: null, memoryData: null, storeData: null, controlSignals: idleControlSignals() })
const isWordValue = (value: number) => Number.isInteger(value) && value >= -0x80000000 && value <= 0xffffffff

/** One state source drives CPU side effects, Inspector values and scene routes. */
export function createCPUStore() {
  return create<CPUStore>()((set, get) => {
    // A completed instruction can feed the next one. An unfinished edit rolls
    // back the current instruction before changing its initial conditions.
    const editableOrigin = () => {
      const state = get()
      return clearExecutionValues(state.step >= 0 && state.step < executionStages.length - 1 && state.executionBaseline ? state.executionBaseline : state)
    }
    const start = (playing: boolean) => {
      const state = get()
      const parsed = parseInstruction(state.instructionText)
      if (!parsed.instruction) {
        set({ playing: false, error: parsed.error })
        return
      }
      const baseline = clearExecutionValues(state.executionBaseline ?? state)
      const history = simulateInstruction(parsed.instruction, baseline)
      set({ ...cloneCPUState(history[0].state), executionBaseline: cloneCPUState(baseline), history, parsedInstruction: parsed.instruction, instructionText: formatInstruction(parsed.instruction), step: 0, playing, error: null, executionRevision: state.executionRevision + 1 })
    }
    const rejectInvalidInput = () => {
      const parsed = parseInstruction(get().instructionText)
      if (parsed.instruction) return false
      set({ playing: false, error: parsed.error })
      return true
    }
    const replaceOrigin = (state: CPUState) => set({ ...clearExecutionValues(state), executionBaseline: null, history: [], step: -1, playing: false, error: null, executionRevision: get().executionRevision + 1 })
    return {
      ...initialCPUState(), instructionText: DEFAULT_INSTRUCTION, parsedInstruction: { ...defaultInstruction }, error: null, step: -1, playing: false, speed: 1, executionBaseline: null, history: [], executionRevision: 0, selectedComponent: null,
      setInstructionText: (instructionText) => {
        const parsed = parseInstruction(instructionText)
        if (!parsed.instruction) {
          // Invalid text is an editor draft, never a CPU instruction.
          set({ instructionText, playing: false, error: null })
          return
        }
        replaceOrigin(editableOrigin())
        set({ instructionText, parsedInstruction: parsed.instruction })
      },
      run: () => start(true),
      next: () => {
        const state = get()
        if (state.step < 0) { start(false); return }
        if (rejectInvalidInput()) return
        if (state.step >= executionStages.length - 1) { set({ playing: false }); return }
        const nextStep = state.step + 1
        const snapshot = state.history[nextStep]
        if (!snapshot) return
        set({ ...cloneCPUState(snapshot.state), step: nextStep, playing: nextStep < executionStages.length - 1 && state.playing, error: null, executionRevision: state.executionRevision + 1 })
      },
      previous: () => {
        const state = get()
        if (state.step < 0 || !state.executionBaseline) return
        const previousStep = state.step - 1
        const snapshot = previousStep >= 0 ? state.history[previousStep].state : state.executionBaseline
        set({ ...cloneCPUState(snapshot), step: previousStep, playing: false, error: null, executionRevision: state.executionRevision + 1 })
      },
      reset: () => {
        const state = get()
        replaceOrigin(state.executionBaseline ?? state)
      },
      pause: () => set({ playing: false }),
      play: () => {
        const state = get()
        if (state.step < 0 || state.step >= executionStages.length - 1) start(true)
        else if (!rejectInvalidInput()) set({ playing: true })
      },
      setSpeed: (speed) => { if (speed === 0.5 || speed === 1 || speed === 2) set({ speed }) },
      setRegister: (index, value) => {
        if (!Number.isInteger(index) || index < 0 || index > 7) return
        if (!isWordValue(value)) { set({ error: '寄存器请输入 32 位整数：−2147483648 至 4294967295。', playing: false }); return }
        const state = editableOrigin()
        state.registers[index] = value | 0
        replaceOrigin(state)
      },
      setMemory: (address, value) => {
        if (!isWordAddress(address)) { set({ error: '内存地址必须是按 4 字节对齐的 32 位无符号地址。', playing: false }); return }
        if (!isWordValue(value)) { set({ error: '内存请输入 32 位整数：−2147483648 至 4294967295。', playing: false }); return }
        const state = editableOrigin()
        state.memory[address] = value | 0
        replaceOrigin(state)
      },
      selectComponent: (selectedComponent) => set({ selectedComponent }),
    }
  })
}

export const useCPUStore = createCPUStore()
