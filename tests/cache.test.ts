import test from 'node:test'
import assert from 'node:assert/strict'
import { cloneCacheState, getCacheStepDetails, initialCacheState, parseCacheAddress, PRESET_ADDRESSES, readMemoryBlock, readMemoryByte, simulateCacheAccess, splitAddress } from '../src/data/cache'
import { createCacheStore } from '../src/store/cacheStore'

type TestStore = ReturnType<typeof createCacheStore>
const complete = (store: TestStore) => {
  if (store.getState().phase < 0) store.getState().next()
  while (store.getState().phase < store.getState().steps.length - 1) store.getState().next()
}
const access = (store: TestStore, address: number) => {
  store.getState().setAddressText(`0x${address.toString(16)}`)
  store.getState().startAccess()
  complete(store)
}

test('16-bit byte address separates 12-bit tag, 2-bit index and 2-bit offset', () => {
  assert.deepEqual(splitAddress(0x1234), { address: 0x1234, binary: '0001001000110100', tagBits: '000100100011', indexBits: '01', offsetBits: '00', tag: 0x123, index: 1, offset: 0, blockStart: 0x1234 })
  assert.equal(splitAddress(0xffff).tag, 0xfff)
  assert.equal(splitAddress(0xffff).index, 3)
  assert.equal(splitAddress(0xffff).offset, 3)
  assert.equal(splitAddress(0xffff).blockStart, 0xfffc)
  assert.throws(() => splitAddress(-1), RangeError)
  assert.throws(() => splitAddress(0x10000), RangeError)
})

test('parser accepts 16-bit decimal/hex integers and rejects non-address expressions', () => {
  for (const [text, address] of [['0x1234', 0x1234], [' 0XFFFF ', 65535], ['0', 0], ['65535', 65535], ['0012', 12]] as const) {
    assert.deepEqual(parseCacheAddress(text), { address, error: null })
  }
  for (const text of ['', '0x', '-1', '+1', '1.2', '2e3', '1+2', '0x10000', '65536', 'NaN', 'Infinity']) {
    assert.equal(parseCacheAddress(text).address, null, text)
    assert.ok(parseCacheAddress(text).error)
  }
})

test('memory fills four deterministic consecutive bytes and distinguishes high addresses', () => {
  assert.deepEqual(readMemoryBlock(0x1001), [0x17, 0x24, 0x31, 0x3e])
  assert.deepEqual(readMemoryBlock(0x2000), [0x27, 0x34, 0x41, 0x4e])
  assert.deepEqual(readMemoryBlock(0xffff), [0xc2, 0xcf, 0xdc, 0xe9])
  assert.equal(readMemoryByte(0x1000), 0x17)
  assert.throws(() => readMemoryByte(0x10000), RangeError)
})

test('cold miss fills only at Memory → Cache and counts only at Cache → CPU', () => {
  const store = createCacheStore()
  assert.equal(store.getState().currentAddress, null)
  assert.equal(store.getState().fields?.index, 1)
  store.getState().startAccess()
  assert.deepEqual(store.getState().steps.map((step) => step.id), ['address', 'split', 'index', 'compare', 'memory-request', 'memory-to-cache', 'cache-to-cpu'])
  for (let phase = 0; phase <= 4; phase++) {
    assert.equal(store.getState().phase, phase)
    assert.equal(store.getState().lines[1].valid, false)
    assert.equal(store.getState().misses, 0)
    assert.equal(store.getState().cpuData, null)
    assert.equal(store.getState().result, phase < 3 ? null : 'miss')
    store.getState().next()
  }
  assert.equal(store.getState().phase, 5)
  assert.deepEqual(store.getState().lines[1], { line: 1, valid: true, tag: 0x123, data: readMemoryBlock(0x1234) })
  assert.equal(store.getState().misses, 0)
  assert.equal(store.getState().cpuData, null)
  store.getState().next()
  assert.equal(store.getState().misses, 1)
  assert.equal(store.getState().hits, 0)
  assert.equal(store.getState().cpuData, readMemoryByte(0x1234))
  const completed = cloneCacheState(store.getState())
  store.getState().next()
  assert.deepEqual(cloneCacheState(store.getState()), completed, 'Next at the final custom step must not count again')
})

test('same block and a different offset hit without touching Main Memory or replacing the line', () => {
  const store = createCacheStore()
  access(store, 0x1000)
  const lines = structuredClone(store.getState().lines)
  store.getState().setAddressText('0x1001')
  store.getState().startAccess()
  assert.deepEqual(store.getState().steps.map((step) => step.id), ['address', 'split', 'index', 'compare', 'cache-to-cpu'])
  complete(store)
  assert.equal(store.getState().result, 'hit')
  assert.equal(store.getState().cpuData, 0x24)
  assert.equal(store.getState().hits, 1)
  assert.equal(store.getState().misses, 1)
  assert.deepEqual(store.getState().lines, lines)
})

test('valid = false cannot produce a hit even when a zero tag matches', () => {
  const state = initialCacheState()
  state.lines[0].tag = 0
  const steps = simulateCacheAccess(0, state)
  assert.equal(steps[3].state.result, 'miss')
  assert.equal(steps.at(-1)?.state.cpuData, readMemoryByte(0))
  assert.equal(steps.at(-1)?.state.lines[0].tag, 0)
})

test('preset generates Miss, Miss, Hit, Miss, Hit with final 40% hit rate', () => {
  const store = createCacheStore()
  store.getState().loadPreset()
  assert.equal(store.getState().phase, -1)
  assert.equal(store.getState().presetIndex, 0)
  assert.equal(store.getState().fields?.address, 0x1000)
  const results: string[] = []
  for (let index = 0; index < PRESET_ADDRESSES.length; index++) {
    if (index) store.getState().next()
    complete(store)
    assert.equal(store.getState().currentAddress, PRESET_ADDRESSES[index])
    assert.equal(store.getState().presetIndex, index)
    results.push(store.getState().result!)
  }
  assert.deepEqual(results, ['miss', 'miss', 'hit', 'miss', 'hit'])
  assert.equal(store.getState().hits, 2)
  assert.equal(store.getState().misses, 3)
  assert.equal(store.getState().hits / (store.getState().hits + store.getState().misses), 0.4)
  assert.equal(store.getState().lines[0].tag, 0x200)
  assert.equal(store.getState().lines[1].tag, 0x100)
  const final = cloneCacheState(store.getState())
  store.getState().next()
  store.getState().play()
  store.getState().nextAccess()
  assert.deepEqual(cloneCacheState(store.getState()), final)
  assert.equal(store.getState().playing, false)
  access(store, 0x1000)
  assert.equal(store.getState().result, 'miss', '0x2000 evicts 0x1000 from the same line')
})

test('Previous restores every cache byte, counter and CPU return across all preset access boundaries', () => {
  const store = createCacheStore()
  store.getState().loadPreset()
  const snapshots = [cloneCacheState(store.getState())]
  while (store.getState().presetIndex < PRESET_ADDRESSES.length - 1 || store.getState().phase < store.getState().steps.length - 1) {
    store.getState().next()
    snapshots.push(cloneCacheState(store.getState()))
  }
  const history = structuredClone(store.getState().accessHistory)
  for (let index = snapshots.length - 2; index >= 0; index--) {
    store.getState().previous()
    assert.deepEqual(cloneCacheState(store.getState()), snapshots[index], `Reverse mismatch at observation ${index}`)
    assert.equal(store.getState().playing, false)
    assert.deepEqual(store.getState().accessHistory, history, 'Restoring snapshots cannot mutate access history')
  }
  store.getState().previous()
  assert.deepEqual(cloneCacheState(store.getState()), snapshots[0])
  while (store.getState().presetIndex < PRESET_ADDRESSES.length - 1 || store.getState().phase < store.getState().steps.length - 1) store.getState().next()
  assert.deepEqual(cloneCacheState(store.getState()), snapshots.at(-1))
})

test('Previous undoes a conflict replacement and CPU completion; valid editing preserves prior committed accesses', () => {
  const store = createCacheStore()
  access(store, 0x1000)
  const first = cloneCacheState(store.getState())
  access(store, 0x2000)
  store.getState().previous()
  assert.equal(store.getState().misses, 1)
  assert.equal(store.getState().cpuData, null)
  assert.equal(store.getState().lines[0].tag, 0x200)
  store.getState().previous()
  assert.deepEqual(store.getState().lines, first.lines, 'Undoing fill must restore the replaced original block')
  store.getState().setAddressText('0x1002')
  assert.equal(store.getState().phase, -1)
  assert.deepEqual(store.getState().lines, first.lines)
  assert.equal(store.getState().misses, first.misses)
  assert.equal(store.getState().cpuData, first.cpuData)
  store.getState().startAccess()
  complete(store)
  assert.equal(store.getState().result, 'hit')
  assert.equal(store.getState().cpuData, 0x31)
})

test('invalid drafts, starts and next steps never mutate cache or statistics', () => {
  const store = createCacheStore()
  access(store, 0x1000)
  const valid = cloneCacheState(store.getState())
  for (const input of ['0x10000', 'bad', '-1']) {
    store.getState().setAddressText(input)
    assert.deepEqual(cloneCacheState(store.getState()), valid)
    assert.equal(store.getState().fields, null)
    store.getState().startAccess()
    assert.ok(store.getState().error)
    assert.deepEqual(cloneCacheState(store.getState()), valid)
    store.getState().next()
    store.getState().play()
    store.getState().nextAccess()
    assert.deepEqual(cloneCacheState(store.getState()), valid)
    assert.equal(store.getState().playing, false)
  }
})

test('state projections cannot mutate stored baseline or future snapshots', () => {
  const baseline = initialCacheState()
  const baselineCopy = structuredClone(baseline)
  const steps = simulateCacheAccess(0xffff, baseline)
  assert.deepEqual(baseline, baselineCopy)
  steps[0].state.lines[0].data[0] = 99
  assert.equal(steps[1].state.lines[0].data[0], 0)
  assert.equal(baseline.lines[0].data[0], 0)
  const store = createCacheStore()
  store.getState().startAccess()
  const history = structuredClone(store.getState().accessHistory)
  store.getState().lines[0].data[0] = 99
  assert.deepEqual(store.getState().accessHistory, history)
})

test('first and last byte addresses select the correct bytes without crossing memory bounds', () => {
  for (const address of [0, 0xffff]) {
    const store = createCacheStore()
    access(store, address)
    const fields = splitAddress(address)
    assert.equal(store.getState().cpuData, readMemoryByte(address))
    assert.equal(store.getState().lines[fields.index].tag, fields.tag)
    assert.deepEqual(store.getState().lines[fields.index].data, readMemoryBlock(address))
  }
})

test('reset is explicitly cold: clears all lines, counters, access history and animation playback', () => {
  const store = createCacheStore()
  access(store, 0x1000)
  store.getState().play()
  store.getState().setSpeed(2)
  store.getState().reset()
  assert.deepEqual(cloneCacheState(store.getState()), initialCacheState())
  assert.deepEqual(store.getState().accessHistory, [])
  assert.deepEqual(store.getState().presetAddresses, [])
  assert.equal(store.getState().presetIndex, -1)
  assert.equal(store.getState().playing, false)
  assert.equal(store.getState().speed, 2)
  assert.equal(store.getState().addressText, '0x1000')
  store.getState().nextAccess()
  complete(store)
  assert.equal(store.getState().result, 'miss')
})

test('nextAccess begins preset first address and keeps cumulative custom access state', () => {
  const store = createCacheStore()
  store.getState().loadPreset()
  store.getState().nextAccess()
  assert.equal(store.getState().currentAddress, 0x1000)
  complete(store)
  store.getState().nextAccess()
  assert.equal(store.getState().currentAddress, 0x1004)
  complete(store)
  store.getState().setAddressText('0x1004')
  store.getState().nextAccess()
  complete(store)
  assert.equal(store.getState().hits, 1)
  assert.equal(store.getState().misses, 2)
  store.getState().nextAccess()
  complete(store)
  assert.equal(store.getState().hits, 2)
})

test('details use visible snapshot data and correct routes, not future CPU results', () => {
  const store = createCacheStore()
  assert.equal(getCacheStepDetails(store.getState()).id, 'ready')
  store.getState().startAccess()
  assert.equal(getCacheStepDetails(store.getState()).route, 'cpu-cache')
  assert.equal(getCacheStepDetails(store.getState()).byte, null)
  while (store.getState().phase < 4) store.getState().next()
  assert.equal(getCacheStepDetails(store.getState()).route, 'memory-request')
  assert.equal(getCacheStepDetails(store.getState()).block, null)
  store.getState().next()
  assert.deepEqual(getCacheStepDetails(store.getState()).block, readMemoryBlock(0x1234))
  assert.equal(getCacheStepDetails(store.getState()).route, 'memory-cache')
  assert.equal(getCacheStepDetails(store.getState()).byte, null)
  store.getState().next()
  assert.equal(getCacheStepDetails(store.getState()).route, 'cache-cpu')
  assert.equal(getCacheStepDetails(store.getState()).byte, readMemoryByte(0x1234))
  store.getState().previous()
  assert.equal(getCacheStepDetails(store.getState()).byte, null)
})

test('a custom multi-access history can be undone to cold and replayed forward without losing future accesses', () => {
  const store = createCacheStore()
  access(store, 0x1000)
  access(store, 0x1001)
  access(store, 0x2000)
  const final = cloneCacheState(store.getState())
  const history = structuredClone(store.getState().accessHistory)
  while (store.getState().phase >= 0) store.getState().previous()
  assert.deepEqual(cloneCacheState(store.getState()), initialCacheState())
  assert.deepEqual(store.getState().accessHistory, history)
  store.getState().next()
  assert.equal(store.getState().currentAddress, 0x1000)
  complete(store)
  store.getState().next()
  assert.equal(store.getState().currentAddress, 0x1001)
  complete(store)
  store.getState().nextAccess()
  assert.equal(store.getState().currentAddress, 0x2000)
  complete(store)
  assert.deepEqual(cloneCacheState(store.getState()), final)
  assert.deepEqual(store.getState().accessHistory, history)
})
