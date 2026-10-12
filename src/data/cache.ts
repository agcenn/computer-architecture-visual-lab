import type { AddressFields, CacheState, CacheStep, CacheStepDetails, CacheStore } from '../types/cache'

export const CACHE_CONFIG = { addressWidth: 16, cacheLines: 4, blockSize: 4, tagBits: 12, indexBits: 2, offsetBits: 2 } as const
export const PRESET_ADDRESSES = [0x1000, 0x1004, 0x1000, 0x2000, 0x1004] as const

export function formatCacheAddress(address: number): string { return `0x${address.toString(16).toUpperCase().padStart(4, '0')}` }
export function formatByte(value: number): string { return `0x${value.toString(16).toUpperCase().padStart(2, '0')}` }

export function parseCacheAddress(text: string): { address: number | null; error: string | null } {
  const input = text.trim()
  if (!/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(input)) return { address: null, error: '请输入 16 位字节地址，例如 0x1234；支持十六进制或十进制整数。' }
  const address = Number(input)
  if (!Number.isInteger(address) || address < 0 || address > 0xffff) return { address: null, error: '地址范围为 0x0000 至 0xFFFF（0 至 65535）。' }
  return { address, error: null }
}

export function splitAddress(address: number): AddressFields {
  if (!Number.isInteger(address) || address < 0 || address > 0xffff) throw new RangeError('Cache address must be an unsigned 16-bit byte address.')
  const binary = address.toString(2).padStart(16, '0')
  return { address, binary, tagBits: binary.slice(0, 12), indexBits: binary.slice(12, 14), offsetBits: binary.slice(14), tag: address >>> 4, index: (address >>> 2) & 3, offset: address & 3, blockStart: address & ~3 }
}

/** Deterministic teaching memory: bytes differ across both offsets and high addresses. */
export function readMemoryByte(address: number): number {
  if (!Number.isInteger(address) || address < 0 || address > 0xffff) throw new RangeError('Memory address must be an unsigned 16-bit byte address.')
  return ((address & 0xff) * 13 + (address >>> 8) * 17 + 7) & 0xff
}
export function readMemoryBlock(address: number): number[] {
  const { blockStart } = splitAddress(address)
  return Array.from({ length: CACHE_CONFIG.blockSize }, (_, offset) => readMemoryByte(blockStart + offset))
}

export function initialCacheState(): CacheState {
  return { lines: Array.from({ length: CACHE_CONFIG.cacheLines }, (_, line) => ({ line, valid: false, tag: null, data: [0, 0, 0, 0] })), currentAddress: null, phase: -1, result: null, cpuData: null, hits: 0, misses: 0 }
}

export function cloneCacheState(state: CacheState): CacheState {
  return { lines: state.lines.map((line) => ({ ...line, data: [...line.data] })), currentAddress: state.currentAddress, phase: state.phase, result: state.result, cpuData: state.cpuData, hits: state.hits, misses: state.misses }
}

/** Generate independent, reversible observations of one read-only byte access. */
export function simulateCacheAccess(address: number, baseline: CacheState): CacheStep[] {
  const fields = splitAddress(address)
  const original = baseline.lines[fields.index]
  const hit = original.valid && original.tag === fields.tag
  const state = cloneCacheState(baseline)
  state.currentAddress = address
  state.result = null
  state.cpuData = null
  const steps: CacheStep[] = []
  const add = (id: CacheStep['id'], title: string, description: string) => {
    state.phase = steps.length
    steps.push({ id, title, description, state: cloneCacheState(state) })
  }
  add('address', 'CPU 发出 Address', `CPU 请求地址 ${formatCacheAddress(address)} 的 1 个字节。`)
  add('split', '拆分 Tag / Index / Offset', `16 位地址分成 12 位 Tag、2 位 Index 和 2 位 Offset。`)
  add('index', '使用 Index 查找 Cache Line', `Index = ${fields.index}，只能查找 Line ${fields.index}；Offset = ${fields.offset} 选择块内字节。`)
  state.result = hit ? 'hit' : 'miss'
  add('compare', '比较 Valid 与 Tag', hit ? `Valid = 1 且 Tag = 0x${fields.tag.toString(16).toUpperCase()} 匹配：CACHE HIT。` : original.valid ? `Line ${fields.index} 有效，但已存 Tag 与请求 Tag 不匹配：CACHE MISS，需要替换这一行。` : `Line ${fields.index} 的 Valid = 0：CACHE MISS，需要先从主存读取。`)
  if (!hit) {
    add('memory-request', '请求 Main Memory', `向主存请求整个 4 字节块 ${formatCacheAddress(fields.blockStart)}–${formatCacheAddress(fields.blockStart + 3)}。`)
    state.lines[fields.index] = { line: fields.index, valid: true, tag: fields.tag, data: readMemoryBlock(address) }
    add('memory-to-cache', 'Memory → Cache：填充完整块', `将 4 个字节装入 Line ${fields.index}，更新 Valid = 1 与 Tag。`)
  }
  state.cpuData = state.lines[fields.index].data[fields.offset]
  if (hit) state.hits++
  else state.misses++
  add('cache-to-cpu', 'Cache → CPU：返回字节', `Offset = ${fields.offset}，CPU 收到 ${formatByte(state.cpuData)}；本次 ${hit ? 'Hit' : 'Miss'} 计入已完成访问。`)
  return steps
}

export function getCacheStepDetails(state: Pick<CacheStore, 'phase' | 'steps' | 'fields' | 'currentAddress' | 'result' | 'cpuData' | 'lines'>): CacheStepDetails {
  const step = state.steps[state.phase]
  const fields = state.currentAddress === null ? state.fields : splitAddress(state.currentAddress)
  const id = step?.id ?? 'ready'
  const route = id === 'address' ? 'cpu-cache' : id === 'memory-request' ? 'memory-request' : id === 'memory-to-cache' ? 'memory-cache' : id === 'cache-to-cpu' ? 'cache-cpu' : null
  return { id, title: step?.title ?? 'READY · 输入一个字节地址', description: step?.description ?? '按 Index 映射到唯一一行，再检查 Valid 与 Tag；命中时从缓存返回，未命中时从主存填充完整块。', activeLine: fields?.index ?? null, route, result: state.result, byte: id === 'cache-to-cpu' ? state.cpuData : null, block: id === 'memory-to-cache' && fields ? [...state.lines[fields.index].data] : null }
}
