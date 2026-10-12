import { create } from 'zustand'
import { cloneCacheState, formatCacheAddress, initialCacheState, parseCacheAddress, PRESET_ADDRESSES, simulateCacheAccess, splitAddress } from '../data/cache'
import type { CacheAccessExecution, CacheStore } from '../types/cache'

/** Machine snapshots and their animation revision always move together. */
export function createCacheStore() {
  return create<CacheStore>()((set, get) => {
    const project = (execution: CacheAccessExecution, accessIndex: number, phase: number, playing: boolean) => {
      set({ ...cloneCacheState(execution.steps[phase].state), steps: execution.steps, accessIndex, presetIndex: execution.presetIndex, addressText: formatCacheAddress(execution.address), fields: splitAddress(execution.address), error: null, playing, revision: get().revision + 1 })
    }
    const start = (playing: boolean, requestedAddress?: number, requestedPresetIndex?: number) => {
      const state = get()
      const parsed = requestedAddress === undefined ? parseCacheAddress(state.addressText) : { address: requestedAddress, error: null }
      if (parsed.address === null) { set({ error: parsed.error, playing: false }); return }
      const unfinished = state.phase >= 0 && state.phase < state.steps.length - 1
      const baseline = cloneCacheState(unfinished ? state.accessHistory[state.accessIndex].baseline : state)
      const accessIndex = unfinished ? state.accessIndex : state.accessIndex + 1
      const execution: CacheAccessExecution = { address: parsed.address, baseline, steps: simulateCacheAccess(parsed.address, baseline), presetIndex: requestedPresetIndex ?? state.presetIndex }
      set({ accessHistory: [...state.accessHistory.slice(0, accessIndex), execution] })
      project(execution, accessIndex, 0, playing)
    }
    const hasNextPreset = () => get().presetIndex >= 0 && get().presetIndex + 1 < get().presetAddresses.length
    const replayNextAccess = (playing: boolean) => {
      const state = get()
      const execution = state.accessHistory[state.accessIndex + 1]
      if (!execution) return false
      project(execution, state.accessIndex + 1, 0, playing)
      return true
    }
    const advanceAccess = (playing: boolean) => {
      const state = get()
      if (hasNextPreset()) start(playing, state.presetAddresses[state.presetIndex + 1], state.presetIndex + 1)
      else start(playing)
    }
    return {
      ...initialCacheState(), addressText: '0x1234', fields: splitAddress(0x1234), error: null, steps: [], accessIndex: -1, accessHistory: [], presetAddresses: [], presetIndex: -1, playing: false, speed: 1, revision: 0,
      setAddressText: (addressText) => {
        const state = get()
        const parsed = parseCacheAddress(addressText)
        if (parsed.address === null) { set({ addressText, fields: null, error: null, playing: false }); return }
        const unfinished = state.phase >= 0 && state.phase < state.steps.length - 1
        const baseline = cloneCacheState(unfinished ? state.accessHistory[state.accessIndex].baseline : state)
        const accessIndex = unfinished ? state.accessIndex - 1 : state.accessIndex
        set({ ...baseline, phase: -1, currentAddress: null, result: null, addressText, fields: splitAddress(parsed.address), error: null, steps: [], accessIndex, accessHistory: state.accessHistory.slice(0, accessIndex + 1), presetAddresses: [], presetIndex: -1, playing: false, revision: state.revision + 1 })
      },
      startAccess: () => start(false),
      next: () => {
        const state = get()
        if (parseCacheAddress(state.addressText).address === null) { set({ error: parseCacheAddress(state.addressText).error, playing: false }); return }
        if (state.phase < 0) { if (!replayNextAccess(state.playing)) start(state.playing); return }
        if (state.phase < state.steps.length - 1) {
          const phase = state.phase + 1
          project(state.accessHistory[state.accessIndex], state.accessIndex, phase, state.playing && (phase < state.steps.length - 1 || hasNextPreset()))
        } else if (replayNextAccess(state.playing)) return
        else if (hasNextPreset()) advanceAccess(state.playing)
        else set({ playing: false })
      },
      previous: () => {
        const state = get()
        if (state.phase > 0) { project(state.accessHistory[state.accessIndex], state.accessIndex, state.phase - 1, false); return }
        if (state.phase < 0 && state.accessIndex >= 0) {
          const execution = state.accessHistory[state.accessIndex]
          project(execution, state.accessIndex, execution.steps.length - 1, false)
          return
        }
        if (state.phase === 0 && state.accessIndex > 0) {
          const execution = state.accessHistory[state.accessIndex - 1]
          project(execution, state.accessIndex - 1, execution.steps.length - 1, false)
          return
        }
        if (state.phase === 0 && state.accessIndex === 0) set({ ...cloneCacheState(state.accessHistory[0].baseline), phase: -1, currentAddress: null, result: null, steps: [], accessIndex: -1, error: null, playing: false, revision: state.revision + 1 })
        else set({ playing: false })
      },
      play: () => {
        const state = get()
        const parsed = parseCacheAddress(state.addressText)
        if (parsed.address === null) { set({ error: parsed.error, playing: false }); return }
        if (state.phase < 0) { if (!replayNextAccess(true)) start(true) }
        else if (state.phase < state.steps.length - 1) set({ playing: true, error: null })
        else if (replayNextAccess(true)) return
        else if (state.presetIndex >= 0 && !hasNextPreset()) set({ playing: false })
        else advanceAccess(true)
      },
      pause: () => set({ playing: false }),
      reset: () => {
        const state = get()
        const parsed = parseCacheAddress(state.addressText)
        set({ ...initialCacheState(), fields: parsed.address === null ? null : splitAddress(parsed.address), error: null, steps: [], accessIndex: -1, accessHistory: [], presetAddresses: [], presetIndex: -1, playing: false, revision: state.revision + 1 })
      },
      setSpeed: (speed) => { if (speed === 0.5 || speed === 1 || speed === 2) set({ speed }) },
      loadPreset: () => {
        set({ ...initialCacheState(), addressText: formatCacheAddress(PRESET_ADDRESSES[0]), fields: splitAddress(PRESET_ADDRESSES[0]), error: null, steps: [], accessIndex: -1, accessHistory: [], presetAddresses: [...PRESET_ADDRESSES], presetIndex: 0, playing: false, revision: get().revision + 1 })
      },
      nextAccess: () => {
        const state = get()
        const parsed = parseCacheAddress(state.addressText)
        if (parsed.address === null) { set({ error: parsed.error, playing: false }); return }
        if (state.phase < 0) { if (!replayNextAccess(false)) start(false); return }
        if (state.phase >= 0 && state.phase < state.steps.length - 1) { set({ playing: false }); return }
        if (replayNextAccess(false)) return
        if (state.presetIndex >= 0 && !hasNextPreset() && state.phase >= 0) { set({ playing: false }); return }
        advanceAccess(false)
      },
    }
  })
}

export const useCacheStore = createCacheStore()
