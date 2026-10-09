import test from 'node:test'
import assert from 'node:assert/strict'
import { formatBinary, formatHex, getStepDetails, parseInstruction } from '../src/data/instructions'
import { createCPUStore } from '../src/store/cpuStore'

function complete(store: ReturnType<typeof createCPUStore>) {
  for (let stage = 0; stage < 4; stage += 1) store.getState().next()
}

test('ADD changes destination only at Write Back and keeps captured operands', () => {
  const store = createCPUStore()
  store.getState().run()
  assert.equal(store.getState().step, 0)
  assert.equal(store.getState().playing, true)
  for (let stage = 1; stage <= 3; stage += 1) {
    store.getState().next()
    assert.equal(store.getState().step, stage)
    assert.equal(store.getState().registers[1], 0)
  }
  assert.equal(getStepDetails(store.getState()).result, 12)
  store.getState().next()
  assert.equal(store.getState().registers[1], 12)
  assert.equal(store.getState().playing, false)
  assert.equal(store.getState().step, 4)
  store.getState().next()
  assert.equal(store.getState().registers[1], 12)
})

test('backward, replay and reset restore source/destination alias deterministically', () => {
  const store = createCPUStore()
  store.getState().setInstructionText('add r2, r2, r3')
  store.getState().run()
  complete(store)
  assert.equal(store.getState().registers[2], 12)
  assert.equal(getStepDetails(store.getState()).operandA, 5)
  store.getState().previous()
  assert.equal(store.getState().step, 3)
  assert.equal(store.getState().registers[2], 5)
  store.getState().next()
  assert.equal(store.getState().registers[2], 12)
  store.getState().play()
  assert.equal(store.getState().step, 0)
  assert.equal(store.getState().registers[2], 5)
  complete(store)
  assert.equal(store.getState().registers[2], 12)
  store.getState().reset()
  assert.equal(store.getState().step, -1)
  assert.equal(store.getState().registers[2], 5)
  assert.equal(store.getState().executionBaseline, null)
  assert.equal(store.getState().playing, false)
})

test('all backward stages are reversible, and Next from idle does not autoplay', () => {
  const store = createCPUStore()
  store.getState().next()
  assert.equal(store.getState().step, 0)
  assert.equal(store.getState().playing, false)
  complete(store)
  for (let step = 3; step >= -1; step -= 1) {
    store.getState().previous()
    assert.equal(store.getState().step, step)
    assert.equal(store.getState().registers[1], 0)
  }
  store.getState().previous()
  assert.equal(store.getState().step, -1)
})

test('instruction parser rejects unsupported opcodes, extra text and nonexistent registers', () => {
  for (const text of ['', 'SUB R1,R2,R3', 'ADD R8,R2,R3', 'ADD R1,R2', 'ADD R1,R2,R3 trailing', 'ADD R01,R2,R3']) {
    assert.equal(parseInstruction(text).instruction, null, text)
  }
  assert.deepEqual(parseInstruction('  add r7, r0, r3  ').instruction, { opcode: 'ADD', rd: 7, rs1: 0, rs2: 3 })
  const store = createCPUStore()
  store.getState().setInstructionText('ADD R9,R2,R3')
  store.getState().run()
  assert.equal(store.getState().step, -1)
  assert.equal(store.getState().playing, false)
  assert.match(store.getState().error!, /R0–R7/)
  assert.equal(store.getState().registers[1], 0)
})

test('editing a register or instruction resets the timeline and operand snapshot coherently', () => {
  const store = createCPUStore()
  store.getState().run()
  complete(store)
  store.getState().setRegister(2, 10)
  assert.equal(store.getState().registers[1], 0)
  assert.equal(store.getState().step, -1)
  store.getState().run()
  complete(store)
  assert.equal(store.getState().registers[1], 17)
  store.getState().setInstructionText('ADD R4,R2,R3')
  assert.equal(store.getState().registers[1], 0)
  assert.equal(store.getState().executionBaseline, null)
  store.getState().run()
  complete(store)
  assert.equal(store.getState().registers[4], 17)
})

test('ADD uses 32-bit two’s complement and distinguishes signed overflow from carry', () => {
  const store = createCPUStore()
  store.getState().setRegister(2, 0x7fffffff)
  store.getState().setRegister(3, 1)
  store.getState().run()
  complete(store)
  assert.equal(store.getState().registers[1], -0x80000000)
  assert.equal(getStepDetails(store.getState()).overflow, true)
  assert.equal(getStepDetails(store.getState()).carry, false)
  assert.equal(formatHex(store.getState().registers[1]), '0x80000000')
  store.getState().setRegister(2, 0xffffffff)
  store.getState().run()
  complete(store)
  assert.equal(store.getState().registers[1], 0)
  assert.equal(getStepDetails(store.getState()).overflow, false)
  assert.equal(getStepDetails(store.getState()).carry, true)
  assert.equal(formatBinary(-1), '11111111 11111111 11111111 11111111')
})

test('invalid register input does not silently truncate, mutate state or remain playing', () => {
  const store = createCPUStore()
  store.getState().run()
  for (const value of [1.5, NaN, Infinity, 0x100000000, -0x80000001]) {
    store.getState().setRegister(2, value)
    assert.equal(store.getState().registers[2], 5)
    assert.ok(store.getState().error)
    assert.equal(store.getState().playing, false)
  }
  store.getState().setRegister(2, -4)
  assert.equal(store.getState().error, null)
  assert.equal(store.getState().registers[2], -4)
})
