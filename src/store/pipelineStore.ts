import { create } from 'zustand'
import { createPipelineExecution, parsePipelineProgram, PIPELINE_PRESETS } from '../data/pipeline'
import type { PipelineStore } from '../types/pipeline'

/** Cycle, stage occupancy and hazard visibility all select the same immutable execution snapshot. */
export function createPipelineStore() {
  return create<PipelineStore>()((set, get) => {
    const programText = PIPELINE_PRESETS[0].program
    const execution = createPipelineExecution(parsePipelineProgram(programText).instructions)
    const apply = (text: string) => {
      const parsed = parsePipelineProgram(text)
      if (parsed.error) { set({ error: parsed.error, playing: false }); return }
      set({ programText: text, execution: createPipelineExecution(parsed.instructions), cycle: 0, playing: false, selectedInstructionId: null, error: null, revision: get().revision + 1 })
    }
    return {
      execution, programText, cycle: 0, playing: false, speed: 1, revision: 0, selectedInstructionId: null, error: null,
      next: () => {
        const state = get()
        if (state.cycle >= state.execution.totalCycles) { set({ playing: false }); return }
        const cycle = state.cycle + 1
        set({ cycle, playing: state.playing && cycle < state.execution.totalCycles, revision: state.revision + 1 })
      },
      previous: () => {
        const state = get()
        if (state.cycle <= 0) { set({ playing: false }); return }
        set({ cycle: state.cycle - 1, playing: false, revision: state.revision + 1 })
      },
      play: () => set({ playing: get().cycle < get().execution.totalCycles }),
      pause: () => set({ playing: false }),
      reset: () => set({ cycle: 0, playing: false, selectedInstructionId: null, error: null, revision: get().revision + 1 }),
      selectInstruction: (id) => {
        if (id === null || get().execution.instructions.some((instruction) => instruction.id === id)) set({ selectedInstructionId: id })
      },
      setProgramText: (text) => set({ programText: text, error: null, playing: false }),
      applyProgram: () => apply(get().programText),
      loadPreset: (id) => {
        const preset = PIPELINE_PRESETS.find((candidate) => candidate.id === id)
        if (!preset) { set({ error: '没有找到这个指令预设。', playing: false }); return }
        apply(preset.program)
      },
      setSpeed: (speed) => { if (speed === 0.5 || speed === 1 || speed === 2) set({ speed }) },
    }
  })
}

export const usePipelineStore = createPipelineStore()
