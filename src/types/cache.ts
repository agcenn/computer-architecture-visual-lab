export interface AddressFields {
  address: number
  binary: string
  tagBits: string
  indexBits: string
  offsetBits: string
  tag: number
  index: number
  offset: number
  blockStart: number
}

export interface CacheLine {
  line: number
  valid: boolean
  tag: number | null
  /** Four individual bytes, in increasing memory-address order. */
  data: number[]
}

export type CacheResult = 'hit' | 'miss'
export type CachePhase = 'address' | 'split' | 'index' | 'compare' | 'memory-request' | 'memory-to-cache' | 'cache-to-cpu'
export type CacheRoute = 'cpu-cache' | 'memory-request' | 'memory-cache' | 'cache-cpu'

/** Everything that can be changed by a cache-access observation. */
export interface CacheState {
  lines: CacheLine[]
  currentAddress: number | null
  phase: number
  result: CacheResult | null
  cpuData: number | null
  hits: number
  misses: number
}

export interface CacheStep {
  id: CachePhase
  title: string
  description: string
  state: CacheState
}

export interface CacheAccessExecution {
  address: number
  baseline: CacheState
  steps: CacheStep[]
  presetIndex: number
}

export interface CacheStepDetails {
  id: CachePhase | 'ready'
  title: string
  description: string
  activeLine: number | null
  route: CacheRoute | null
  result: CacheResult | null
  byte: number | null
  block: number[] | null
}

export interface CacheStore extends CacheState {
  addressText: string
  fields: AddressFields | null
  error: string | null
  steps: CacheStep[]
  accessIndex: number
  accessHistory: CacheAccessExecution[]
  presetAddresses: number[]
  presetIndex: number
  playing: boolean
  speed: number
  revision: number
  setAddressText: (value: string) => void
  startAccess: () => void
  next: () => void
  previous: () => void
  play: () => void
  pause: () => void
  reset: () => void
  setSpeed: (speed: number) => void
  loadPreset: () => void
  nextAccess: () => void
}
