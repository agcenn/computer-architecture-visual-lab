import test from 'node:test'
import assert from 'node:assert/strict'
import { createPipelineExecution, getPipelineSnapshot, IDEAL_PIPELINE_SCHEDULER, parsePipelineProgram, PIPELINE_PRESETS, PIPELINE_STAGES } from '../src/data/pipeline'
import { createPipelineStore } from '../src/store/pipelineStore'
import type { PipelineScheduler } from '../src/types/pipeline'

function execute(program: string) {
  const parsed = parsePipelineProgram(program)
  assert.equal(parsed.error, null)
  return createPipelineExecution(parsed.instructions)
}

test('three instructions overlap through the exact seven-cycle classic five-stage schedule', () => {
  const execution = execute(PIPELINE_PRESETS[0].program)
  assert.equal(execution.totalCycles, 7)
  assert.equal(execution.cycles.length, 8, 'Cycle zero is the ready snapshot')
  assert.deepEqual(getPipelineSnapshot(execution, 0).occupants, { IF: null, ID: null, EX: null, MEM: null, WB: null })
  assert.deepEqual(getPipelineSnapshot(execution, 3).occupants, { IF: 'instruction-2', ID: 'instruction-1', EX: 'instruction-0', MEM: null, WB: null })
  const timing = execution.instructions.map((instruction) => Array.from({ length: 7 }, (_, index) => PIPELINE_STAGES.find((stage) => execution.cycles[index + 1].occupants[stage.id] === instruction.id)?.id ?? ''))
  assert.deepEqual(timing, [
    ['IF', 'ID', 'EX', 'MEM', 'WB', '', ''],
    ['', 'IF', 'ID', 'EX', 'MEM', 'WB', ''],
    ['', '', 'IF', 'ID', 'EX', 'MEM', 'WB'],
  ])
  assert.deepEqual(execution.cycles[4].completedInstructionIds, [])
  assert.deepEqual(execution.cycles[5].completedInstructionIds, ['instruction-0'])
  assert.deepEqual(execution.cycles[7].completedInstructionIds, ['instruction-0', 'instruction-1', 'instruction-2'])
})

test('adjacent ADD then SUB detects R1 RAW at ID before ADD WB; scheduling remains ideal', () => {
  const execution = execute(PIPELINE_PRESETS[1].program)
  assert.equal(execution.totalCycles, 6)
  assert.deepEqual(execution.dependencies, [{ id: 'raw-instruction-0-instruction-1-r1', kind: 'RAW', register: 1, producerId: 'instruction-0', consumerId: 'instruction-1', readCycle: 3, availableCycle: 5, producerStageAtRead: 'EX', consumerStage: 'ID' }])
  assert.equal(execution.cycles[2].activeHazards.length, 0)
  assert.equal(execution.cycles[2].detectedHazards.length, 0)
  assert.deepEqual(execution.cycles[3].activeHazards, execution.dependencies)
  assert.equal(execution.cycles[4].activeHazards.length, 0)
  assert.deepEqual(execution.cycles[6].detectedHazards, execution.dependencies)
  assert.equal(execution.placements.filter((placement) => placement.instructionId === 'instruction-1' && placement.stage === 'ID')[0].cycle, 3, 'Detection never silently inserts stalls or forwarding')
  assert.equal(execution.events.filter((event) => event.kind === 'raw-detected').length, 1)
  assert.equal(execution.events.filter((event) => event.kind === 'forward' || event.kind === 'stall').length, 0)
})

test('WB before ID in the same cycle is safe, while one cycle earlier is a hazard', () => {
  const unsafe = execute('ADD R1,R2,R3\nMOV R7,R6\nSUB R4,R1,R5')
  assert.equal(unsafe.dependencies[0].readCycle, 4)
  assert.equal(unsafe.dependencies[0].availableCycle, 5)
  assert.equal(unsafe.dependencies[0].producerStageAtRead, 'MEM')
  const safe = execute('ADD R1,R2,R3\nMOV R7,R6\nMOV R7,R6\nSUB R4,R1,R5')
  assert.equal(safe.cycles[5].occupants.WB, 'instruction-0')
  assert.equal(safe.cycles[5].occupants.ID, 'instruction-3')
  assert.deepEqual(safe.dependencies, [])
})

test('RAW resolves against the nearest earlier writer, not a stale writer or later instruction', () => {
  const execution = execute('ADD R1,R2,R3\nMOV R1,R7\nSUB R4,R1,R5\nMOV R1,R6')
  assert.equal(execution.dependencies.length, 1)
  assert.equal(execution.dependencies[0].producerId, 'instruction-1')
  assert.equal(execution.dependencies[0].consumerId, 'instruction-2')
  assert.equal(execution.dependencies[0].availableCycle, 6)
  assert.equal(execution.dependencies[0].readCycle, 4)
})

test('LOAD base and STORE data/base registers are sources; STORE is never a register writer', () => {
  const execution = execute('ADD R1,R2,R3\nLOAD R6,-4(R1)\nSTORE R1,0(R6)\nMOV R4,R1')
  assert.deepEqual(execution.instructions.map(({ sources, destination }) => ({ sources, destination })), [
    { sources: [2, 3], destination: 1 },
    { sources: [1], destination: 6 },
    { sources: [1, 6], destination: null },
    { sources: [1], destination: 4 },
  ])
  assert.deepEqual(execution.dependencies.map(({ producerId, consumerId, register }) => ({ producerId, consumerId, register })), [
    { producerId: 'instruction-0', consumerId: 'instruction-1', register: 1 },
    { producerId: 'instruction-0', consumerId: 'instruction-2', register: 1 },
    { producerId: 'instruction-1', consumerId: 'instruction-2', register: 6 },
  ])
  assert.deepEqual(execution.instructions[1].memory, { baseRegister: 1, displacement: -4 })
})

test('duplicate source registers create one hazard, writable R0 and read-before-own-write behave correctly', () => {
  const execution = execute('MOV R0,R7\nADD R0,R0,R0\nSUB R1,R0,R2')
  assert.equal(execution.dependencies.length, 2)
  assert.equal(execution.dependencies[0].register, 0)
  assert.equal(execution.dependencies[0].producerId, 'instruction-0')
  assert.equal(execution.dependencies[0].consumerId, 'instruction-1')
  assert.equal(execution.dependencies[1].producerId, 'instruction-1')
  assert.equal(execution.dependencies[1].consumerId, 'instruction-2')
})

test('independent instructions have no RAW and a single instruction still uses all five stages', () => {
  assert.deepEqual(execute(PIPELINE_PRESETS[2].program).dependencies, [])
  const single = execute('STORE R1,0(R2)')
  assert.equal(single.totalCycles, 5)
  assert.deepEqual(single.placements.map((placement) => placement.stage), ['IF', 'ID', 'EX', 'MEM', 'WB'])
  assert.equal(single.instructions[0].destination, null)
  assert.deepEqual(single.cycles[5].completedInstructionIds, ['instruction-0'])
})

test('parser normalizes operands, whitespace, comments, case and signed decimal/hex displacement', () => {
  const parsed = parsePipelineProgram('  add r1, r2, r3 # source\r\n\n mov r0,r7 // copy\nload R6,-0x10 ( R2 )\nSTORE R1,+0x4(R2); memory')
  assert.equal(parsed.error, null)
  assert.deepEqual(parsed.instructions.map((instruction) => instruction.text), ['ADD R1,R2,R3', 'MOV R0,R7', 'LOAD R6,-16(R2)', 'STORE R1,4(R2)'])
  assert.equal(parsed.instructions[2].memory?.displacement, -16)
  assert.equal(parsed.instructions[3].memory?.displacement, 4)
  assert.equal(parsePipelineProgram(Array(8).fill('MOV R1,R2').join('\n')).instructions.length, 8)
})

test('parser rejects empty, unsupported, malformed and out-of-range operands atomically', () => {
  for (const program of ['', '# comment', 'MUL R1,R2,R3', 'ADD R8,R2,R3', 'SUB R1,R2', 'LOAD R6,[0x1000]', 'LOAD R6,0(R8)', 'STORE R1,1.5(R2)', 'MOV R1,R2 extra', 'LOAD R6,2147483648(R2)', 'LOAD R6,-2147483649(R2)', Array(9).fill('MOV R1,R2').join('\n'), 'ADD R1,R2,R3\nBAD R1,R2']) {
    const parsed = parsePipelineProgram(program)
    assert.ok(parsed.error, program)
    assert.deepEqual(parsed.instructions, [], program)
  }
  assert.match(parsePipelineProgram('\nADD R1,R2,R3\nBAD').error!, /第 3 行/)
  assert.equal(parsePipelineProgram('LOAD R6,-2147483648(R2)').error, null)
})

test('execution snapshots are deeply immutable and detached from input instructions', () => {
  const parsed = parsePipelineProgram(PIPELINE_PRESETS[0].program)
  const execution = createPipelineExecution(parsed.instructions)
  parsed.instructions[0].sources[0] = 7
  parsed.instructions[0].text = 'changed'
  assert.deepEqual(execution.instructions[0].sources, [2, 3])
  assert.equal(execution.instructions[0].text, 'ADD R1,R2,R3')
  assert.ok(Object.isFrozen(execution))
  assert.ok(Object.isFrozen(execution.cycles[3].occupants))
  assert.ok(Object.isFrozen(execution.cycles[3].activeHazards[0]))
  assert.throws(() => { execution.cycles[3].occupants.EX = null }, TypeError)
  assert.throws(() => { execution.instructions[0].sources[0] = 7 }, TypeError)
  for (const cycle of [-1, 8, 0.5, Number.NaN]) assert.throws(() => getPipelineSnapshot(execution, cycle), RangeError)
})

test('Previous restores exact stage, completion and RAW visibility snapshots back through ready', () => {
  const store = createPipelineStore()
  const execution = store.getState().execution
  const original = structuredClone(execution)
  while (store.getState().cycle < execution.totalCycles) store.getState().next()
  for (let cycle = execution.totalCycles - 1; cycle >= 0; cycle--) {
    store.getState().play()
    const revision = store.getState().revision
    store.getState().previous()
    assert.equal(store.getState().cycle, cycle)
    assert.equal(store.getState().revision, revision + 1)
    assert.equal(store.getState().playing, false)
    assert.deepEqual(getPipelineSnapshot(store.getState().execution, cycle), original.cycles[cycle])
  }
  store.getState().previous()
  assert.equal(store.getState().cycle, 0)
  while (store.getState().cycle < execution.totalCycles) store.getState().next()
  assert.deepEqual(store.getState().execution, original)
})

test('Play/Pause do not advance cycles; Next stops at completion and manual Previous pauses', () => {
  const store = createPipelineStore()
  store.getState().play()
  assert.equal(store.getState().playing, true)
  assert.equal(store.getState().cycle, 0)
  store.getState().next()
  assert.equal(store.getState().cycle, 1)
  assert.equal(store.getState().playing, true)
  store.getState().pause()
  assert.equal(store.getState().cycle, 1)
  assert.equal(store.getState().playing, false)
  store.getState().play()
  while (store.getState().cycle < store.getState().execution.totalCycles) store.getState().next()
  assert.equal(store.getState().playing, false)
  const revision = store.getState().revision
  store.getState().play()
  store.getState().next()
  assert.equal(store.getState().playing, false)
  assert.equal(store.getState().revision, revision)
})

test('invalid custom edits do not change the current execution, cycle or selected instruction', () => {
  const store = createPipelineStore()
  for (let count = 0; count < 3; count++) store.getState().next()
  store.getState().selectInstruction('instruction-1')
  const before = store.getState()
  store.getState().setProgramText('ADD R8,R2,R3')
  store.getState().applyProgram()
  assert.ok(store.getState().error)
  assert.equal(store.getState().execution, before.execution)
  assert.equal(store.getState().cycle, 3)
  assert.equal(store.getState().selectedInstructionId, 'instruction-1')
  assert.equal(store.getState().revision, before.revision)
  store.getState().loadPreset('missing')
  assert.ok(store.getState().error)
  assert.equal(store.getState().execution, before.execution)
  store.getState().setProgramText('MOV R1,R2')
  store.getState().applyProgram()
  assert.equal(store.getState().error, null)
  assert.equal(store.getState().cycle, 0)
  assert.equal(store.getState().execution.totalCycles, 5)
  assert.equal(store.getState().selectedInstructionId, null)
})

test('selection, preset loading, reset and speed preserve consistent store boundaries', () => {
  const store = createPipelineStore()
  store.getState().selectInstruction('instruction-1')
  store.getState().selectInstruction('unknown')
  assert.equal(store.getState().selectedInstructionId, 'instruction-1')
  store.getState().setSpeed(2)
  store.getState().setSpeed(3)
  assert.equal(store.getState().speed, 2)
  store.getState().next()
  store.getState().play()
  store.getState().reset()
  assert.equal(store.getState().cycle, 0)
  assert.equal(store.getState().playing, false)
  assert.equal(store.getState().selectedInstructionId, null)
  assert.equal(store.getState().speed, 2)
  store.getState().loadPreset('raw')
  assert.equal(store.getState().programText, PIPELINE_PRESETS[1].program)
  assert.equal(store.getState().execution.totalCycles, 6)
  assert.equal(store.getState().execution.dependencies.length, 1)
  store.getState().loadPreset('independent')
  assert.equal(store.getState().execution.dependencies.length, 0)
  assert.equal(store.getState().cycle, 0)
})

test('scheduler extension can hold ID and emit stall events without changing renderer snapshots', () => {
  const scheduler: PipelineScheduler = {
    id: 'test-id-stall',
    schedule: (instructions) => {
      const placements = IDEAL_PIPELINE_SCHEDULER.schedule(instructions).placements.map((placement) => ({ ...placement, cycle: placement.instructionId === 'instruction-1' && ['EX', 'MEM', 'WB'].includes(placement.stage) ? placement.cycle + 2 : placement.cycle }))
      placements.push({ instructionId: 'instruction-1', stage: 'ID', cycle: 4 }, { instructionId: 'instruction-1', stage: 'ID', cycle: 5 })
      return { placements, events: [{ kind: 'stall', cycle: 4, instructionId: 'instruction-1', stage: 'ID' }, { kind: 'stall', cycle: 5, instructionId: 'instruction-1', stage: 'ID' }] }
    },
  }
  const parsed = parsePipelineProgram(PIPELINE_PRESETS[1].program)
  const execution = createPipelineExecution(parsed.instructions, { scheduler })
  assert.equal(execution.schedulerId, 'test-id-stall')
  assert.equal(execution.totalCycles, 8)
  assert.equal(execution.cycles[4].occupants.ID, 'instruction-1')
  assert.equal(execution.cycles[5].occupants.ID, 'instruction-1')
  assert.equal(execution.cycles[6].occupants.EX, 'instruction-1')
  assert.deepEqual(execution.dependencies, [], 'Final ID read can observe same-cycle WB after a future timing policy holds ID')
  assert.equal(execution.events.filter((event) => event.kind === 'stall').length, 2)
})

test('invalid scheduler occupancy and incomplete stage visits are rejected', () => {
  const instructions = parsePipelineProgram('ADD R1,R2,R3\nSUB R4,R5,R6').instructions
  assert.throws(() => createPipelineExecution([], {}), /at least one instruction/)
  assert.throws(() => createPipelineExecution([instructions[0], instructions[0]]), /unique IDs/)
  assert.throws(() => createPipelineExecution(instructions, { scheduler: { id: 'bad', schedule: () => ({ placements: [{ instructionId: 'instruction-0', stage: 'IF', cycle: 1 }, { instructionId: 'instruction-1', stage: 'IF', cycle: 1 }] }) } }), /collision/)
  assert.throws(() => createPipelineExecution(instructions, { scheduler: { id: 'missing', schedule: () => ({ placements: [{ instructionId: 'instruction-0', stage: 'IF', cycle: 1 }] }) } }), /Every instruction/)
})
