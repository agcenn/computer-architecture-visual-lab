import test from 'node:test'
import assert from 'node:assert/strict'
import { cloneCPUState, executionStages, formatBinary, formatHex, formatInstruction, getStepDetails, INITIAL_MEMORY, parseInstruction, PROGRAM_START_ADDRESS } from '../src/data/instructions'
import { createCPUStore } from '../src/store/cpuStore'
import type { Instruction } from '../src/types/cpu'

const complete = (store: ReturnType<typeof createCPUStore>) => { while (store.getState().step < executionStages.length - 1) store.getState().next() }
const advanceTo = (store: ReturnType<typeof createCPUStore>, target: number) => { while (store.getState().step < target) store.getState().next() }

for (const [text, expected] of [['ADD R1,R2,R3', 12], ['SUB R1,R2,R3', -2], ['MOV R1,R2', 5], ['LOAD R1,[0x1000]', 42]] as const) {
  test(`${text} commits its destination only at WRITE BACK and advances PC`, () => {
    const store = createCPUStore()
    store.getState().setInstructionText(text)
    store.getState().next()
    assert.equal(store.getState().step, 0)
    assert.equal(store.getState().playing, false)
    assert.equal(formatInstruction(store.getState().currentInstruction!), formatInstruction(parseInstruction(text).instruction!))
    for (let step = 1; step <= 4; step++) {
      store.getState().next()
      assert.equal(store.getState().step, step)
      assert.equal(store.getState().registers[1], 0)
      assert.equal(store.getState().pc, PROGRAM_START_ADDRESS)
    }
    store.getState().next()
    assert.equal(store.getState().registers[1], expected)
    assert.equal(store.getState().pc, PROGRAM_START_ADDRESS + 4)
    assert.equal(store.getState().playing, false)
    const completed = cloneCPUState(store.getState())
    store.getState().next()
    assert.deepEqual(cloneCPUState(store.getState()), completed, 'Next after commit must not commit twice')
  })
}

for (const text of ['ADD R2,R2,R3', 'SUB R2,R2,R3', 'MOV R2,R3', 'LOAD R2,[0x1000]', 'STORE R2,[0x1000]']) {
  test(`${text}: every Previous restores the entire preceding CPU observation`, () => {
    const store = createCPUStore()
    store.getState().setInstructionText(text)
    const snapshots = [cloneCPUState(store.getState())]
    store.getState().next()
    snapshots.push(cloneCPUState(store.getState()))
    for (let step = 1; step < executionStages.length; step++) { store.getState().next(); snapshots.push(cloneCPUState(store.getState())) }
    const originalHistory = structuredClone(store.getState().history)
    for (let step = 4; step >= -1; step--) {
      store.getState().previous()
      assert.equal(store.getState().step, step)
      assert.equal(store.getState().playing, false)
      assert.deepEqual(cloneCPUState(store.getState()), snapshots[step + 1], `Mismatch after restoring ${step}`)
      assert.deepEqual(store.getState().history, originalHistory, 'Projecting a state must not mutate history')
    }
    store.getState().previous()
    assert.deepEqual(cloneCPUState(store.getState()), snapshots[0])
    store.getState().next()
    complete(store)
    assert.deepEqual(cloneCPUState(store.getState()), snapshots[6], 'Forward replay must reproduce the commit exactly')
    store.getState().reset()
    assert.deepEqual(cloneCPUState(store.getState()), snapshots[0], 'Reset must recover the instruction origin')
    assert.equal(store.getState().executionBaseline, null)
    assert.deepEqual(store.getState().history, [])
  })
}

test('STORE mutates memory at MEMORY, Previous undoes it, and WRITE BACK preserves registers', () => {
  const store = createCPUStore()
  store.getState().setRegister(1, 12)
  store.getState().setInstructionText('STORE R1,[0x1000]')
  const registers = [...store.getState().registers]
  store.getState().next()
  advanceTo(store, 3)
  assert.equal(store.getState().memory[0x1000], 42)
  assert.equal(store.getState().memoryData, null)
  assert.equal(store.getState().storeData, 12)
  store.getState().next()
  assert.equal(store.getState().memory[0x1000], 12)
  assert.equal(store.getState().memoryData, 12)
  store.getState().previous()
  assert.equal(store.getState().memory[0x1000], 42)
  assert.equal(store.getState().memoryData, null)
  complete(store)
  assert.equal(store.getState().memory[0x1000], 12)
  assert.deepEqual(store.getState().registers, registers)
  assert.equal(store.getState().controlSignals.RegWrite, 0)
  assert.equal(store.getState().pc, PROGRAM_START_ADDRESS + 4)
})

test('completed ADD → STORE → LOAD retains committed values and progresses PC across instructions', () => {
  const store = createCPUStore()
  store.getState().next(); complete(store)
  assert.equal(store.getState().registers[1], 12)
  store.getState().setInstructionText('STORE R1,[0x1000]')
  assert.equal(store.getState().registers[1], 12)
  assert.equal(store.getState().pc, PROGRAM_START_ADDRESS + 4)
  store.getState().next(); complete(store)
  assert.equal(store.getState().memory[0x1000], 12)
  store.getState().setInstructionText('LOAD R4,[0x1000]')
  store.getState().next(); complete(store)
  assert.equal(store.getState().registers[4], 12)
  assert.equal(store.getState().pc, PROGRAM_START_ADDRESS + 12)
  store.getState().reset()
  assert.equal(store.getState().registers[4], 0)
  assert.equal(store.getState().registers[1], 12)
  assert.equal(store.getState().memory[0x1000], 12)
  assert.equal(store.getState().pc, PROGRAM_START_ADDRESS + 8)
})

test('Play pauses/resumes the same observation and replays completion from its captured origin', () => {
  const store = createCPUStore()
  store.getState().run()
  assert.equal(store.getState().playing, true)
  advanceTo(store, 3)
  const snapshot = cloneCPUState(store.getState()), revision = store.getState().executionRevision
  store.getState().pause()
  store.getState().play()
  assert.equal(store.getState().step, 3)
  assert.deepEqual(cloneCPUState(store.getState()), snapshot)
  assert.equal(store.getState().executionRevision, revision)
  complete(store)
  assert.equal(store.getState().registers[1], 12)
  store.getState().play()
  assert.equal(store.getState().step, 0)
  assert.equal(store.getState().registers[1], 0)
  assert.equal(store.getState().pc, PROGRAM_START_ADDRESS)
  assert.ok(store.getState().executionRevision > revision)
  complete(store)
  assert.equal(store.getState().registers[1], 12)
})

test('valid edits roll back an unfinished STORE but preserve a previously committed instruction', () => {
  const store = createCPUStore()
  store.getState().setInstructionText('STORE R2,[0x1000]')
  store.getState().next(); advanceTo(store, 4)
  assert.equal(store.getState().memory[0x1000], 5)
  store.getState().setInstructionText('MOV R1,R3')
  assert.equal(store.getState().step, -1)
  assert.equal(store.getState().memory[0x1000], 42)
  assert.equal(store.getState().aluResult, null)
  store.getState().next(); complete(store)
  store.getState().setRegister(2, 10)
  assert.equal(store.getState().registers[1], 7)
  assert.equal(store.getState().pc, PROGRAM_START_ADDRESS + 4)
  store.getState().setMemory(0x1004, 99)
  assert.equal(store.getState().memory[0x1004], 99)
  assert.equal(store.getState().registers[1], 7)
})

test('parser supports each opcode, case/whitespace and unsigned aligned addresses', () => {
  const cases: [string, Instruction][] = [
    ['  add r7, r0, r3  ', { opcode: 'ADD', rd: 7, rs1: 0, rs2: 3 }],
    ['SuB R1,R2,R3', { opcode: 'SUB', rd: 1, rs1: 2, rs2: 3 }],
    ['load R1, [ 0X1000 ]', { opcode: 'LOAD', rd: 1, address: 0x1000 }],
    ['STORE R2,[4096]', { opcode: 'STORE', rs: 2, address: 4096 }],
    ['mov R1 , R2', { opcode: 'MOV', rd: 1, rs: 2 }],
    ['LOAD R7,[0xFFFFFFFC]', { opcode: 'LOAD', rd: 7, address: 0xfffffffc }],
  ]
  for (const [text, expected] of cases) {
    assert.deepEqual(parseInstruction(text).instruction, expected)
    assert.deepEqual(parseInstruction(formatInstruction(expected)).instruction, expected, 'Formatting must round-trip')
  }
})

test('invalid or unsupported instruction text never mutates CPU architecture or observations', () => {
  const store = createCPUStore()
  store.getState().run(); advanceTo(store, 3)
  const before = cloneCPUState(store.getState())
  for (const text of ['', 'MUL R1,R2,R3', 'ADD R8,R2,R3', 'ADD R1,R2', 'MOV R1,R2 trailing', 'ADD R01,R2,R3', 'LOAD R1,[0x1001]', 'STORE R1,[0x100000000]', 'LOAD R1,[-4]', 'LOAD R1,[R2]', 'STORE R8,[0x1000]']) {
    assert.equal(parseInstruction(text).instruction, null, text)
    store.getState().setInstructionText(text)
    store.getState().run()
    assert.ok(store.getState().error, text)
    assert.equal(store.getState().playing, false)
    assert.equal(store.getState().step, 3)
    assert.deepEqual(cloneCPUState(store.getState()), before, text)
  }
})

test('ADD and SUB use 32-bit two’s complement with correct signed overflow and carry/no-borrow', () => {
  const store = createCPUStore()
  store.getState().setRegister(2, 0x7fffffff); store.getState().setRegister(3, 1)
  store.getState().next(); complete(store)
  assert.equal(store.getState().registers[1], -0x80000000)
  assert.equal(getStepDetails(store.getState()).overflow, true)
  assert.equal(getStepDetails(store.getState()).carry, false)
  assert.equal(formatHex(store.getState().registers[1]), '0x80000000')
  store.getState().setRegister(2, 0xffffffff)
  store.getState().setInstructionText('ADD R1,R2,R3'); store.getState().next(); complete(store)
  assert.equal(store.getState().registers[1], 0)
  assert.equal(getStepDetails(store.getState()).overflow, false)
  assert.equal(getStepDetails(store.getState()).carry, true)
  store.getState().setRegister(2, -0x80000000)
  store.getState().setInstructionText('SUB R1,R2,R3'); store.getState().next(); complete(store)
  assert.equal(store.getState().registers[1], 0x7fffffff)
  assert.equal(getStepDetails(store.getState()).overflow, true)
  assert.equal(getStepDetails(store.getState()).carry, true)
  assert.equal(formatBinary(-1), '11111111 11111111 11111111 11111111')
})

test('memory is sparse, word-aligned and stores signed 32-bit values, including high addresses', () => {
  const store = createCPUStore()
  store.getState().setInstructionText('LOAD R1,[0x2000]'); store.getState().next(); complete(store)
  assert.equal(store.getState().registers[1], 0)
  assert.equal(Object.hasOwn(store.getState().memory, 0x2000), false, 'Reading missing memory should not mutate memory')
  store.getState().setMemory(0xfffffffc, 0xffffffff)
  assert.equal(store.getState().memory[0xfffffffc], -1)
  store.getState().setInstructionText('LOAD R1,[0xFFFFFFFC]'); store.getState().next(); complete(store)
  assert.equal(store.getState().aluResult, -4)
  assert.equal(store.getState().registers[1], -1)
  assert.equal(getStepDetails(store.getState()).memoryAddress, 0xfffffffc)
  assert.deepEqual(INITIAL_MEMORY, { 0x1000: 42, 0x1004: 0 }, 'Execution must not mutate exported defaults')
})

test('invalid register and memory edits do not truncate or mutate CPU state', () => {
  const store = createCPUStore()
  store.getState().run()
  const before = cloneCPUState(store.getState())
  for (const value of [1.5, NaN, Infinity, 0x100000000, -0x80000001]) {
    store.getState().setRegister(2, value)
    assert.deepEqual(cloneCPUState(store.getState()), before)
    assert.ok(store.getState().error)
    assert.equal(store.getState().playing, false)
    store.getState().setMemory(0x1000, value)
    assert.deepEqual(cloneCPUState(store.getState()), before)
  }
  for (const address of [-4, 0x1001, 0x100000000, NaN]) {
    store.getState().setMemory(address, 1)
    assert.deepEqual(cloneCPUState(store.getState()), before)
    assert.ok(store.getState().error)
  }
  store.getState().setRegister(0, -4)
  assert.equal(store.getState().registers[0], -4, 'R0 is writable in this teaching register bank')
  assert.equal(store.getState().error, null)
})

test('decoded control signals are available after DECODE and stay stable across observation phases', () => {
  for (const [text, control] of [
    ['ADD R1,R2,R3', { ALUOp: 'ADD', ALUSrc: 0, RegWrite: 1, MemRead: 0, MemWrite: 0, MemtoReg: 0 }],
    ['SUB R1,R2,R3', { ALUOp: 'SUB', ALUSrc: 0, RegWrite: 1, MemRead: 0, MemWrite: 0, MemtoReg: 0 }],
    ['MOV R1,R2', { ALUOp: 'PASS', ALUSrc: 0, RegWrite: 1, MemRead: 0, MemWrite: 0, MemtoReg: 0 }],
    ['LOAD R1,[0x1000]', { ALUOp: 'ADD', ALUSrc: 1, RegWrite: 1, MemRead: 1, MemWrite: 0, MemtoReg: 1 }],
    ['STORE R1,[0x1000]', { ALUOp: 'ADD', ALUSrc: 1, RegWrite: 0, MemRead: 0, MemWrite: 1, MemtoReg: 0 }],
  ] as const) {
    const store = createCPUStore()
    store.getState().setInstructionText(text); store.getState().next()
    assert.equal(store.getState().controlSignals.ALUOp, null)
    for (let step = 1; step <= 5; step++) { store.getState().next(); assert.deepEqual(store.getState().controlSignals, control, `${text} step${step}`) }
  }
})

test('ADD EXECUTE simultaneously visualizes 5, 7, 12; skipped MEMORY never accesses data memory', () => {
  const store = createCPUStore()
  store.getState().next(); advanceTo(store, 3)
  const details = getStepDetails(store.getState())
  assert.equal(store.getState().aluResult, 12)
  assert.equal(details.flows.find(flow => flow.from === 'registerFile' && flow.to === 'alu')?.label, 'R2 = 5')
  assert.equal(details.flows.find(flow => flow.from === 'mux' && flow.to === 'alu')?.label, 'R3 = 7')
  assert.equal(details.flows.find(flow => flow.from === 'alu' && flow.to === 'writeBack')?.label, 'ALU Result = 12')
  assert.equal(store.getState().registers[1], 0)
  store.getState().next()
  assert.equal(getStepDetails(store.getState()).skipped, true)
  assert.equal(getStepDetails(store.getState()).activeComponents.includes('dataMemory'), false)
  for (const observation of store.getState().history) {
    store.setState({ ...cloneCPUState(observation.state), step: observation.index })
    assert.equal(getStepDetails(store.getState()).flows.some(flow => flow.from === 'dataMemory' || flow.to === 'dataMemory'), false)
  }
})
