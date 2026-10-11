import test from 'node:test'
import assert from 'node:assert/strict'
import { DATAPATH_MODULES, DATAPATH_ROUTES, getDatapathRoute, type DatapathPoint } from '../src/data/datapath'
import { executionStages } from '../src/data/instructions'
import type { ComponentId, DataFlowSpec } from '../src/types/cpu'

const key = (flow: Pick<DataFlowSpec, 'from' | 'to' | 'type'>) => `${flow.from}:${flow.to}:${flow.type}`
const modules = new Map(DATAPATH_MODULES.map(module => [module.id, module]))

test('all execution signals have one permanent route with the same signal classification', () => {
  const routeKeys = DATAPATH_ROUTES.map(key)
  assert.equal(new Set(routeKeys).size, routeKeys.length, 'Ambiguous route selection')
  for (const stage of executionStages) {
    for (const flow of stage.flows) assert.ok(getDatapathRoute(flow), `${stage.id}: missing ${key(flow)}`)
  }
})

test('the complete teaching graph includes fetch, operands, memory and result selection', () => {
  const requiredModules: ComponentId[] = ['pc', 'instructionMemory', 'instructionRegister', 'controlUnit', 'registerFile', 'mux', 'alu', 'dataMemory', 'writeBack']
  assert.deepEqual([...modules.keys()].sort(), requiredModules.sort())
  const chain = ['pc', 'instructionMemory', 'instructionRegister', 'controlUnit'] as const
  for (let i = 1; i < chain.length; i++) {
    assert.equal(modules.get(chain[i])!.position[0], modules.get(chain[i - 1])!.position[0])
    assert.ok(modules.get(chain[i])!.position[2] > modules.get(chain[i - 1])!.position[2])
  }
  const required: [ComponentId, ComponentId, DataFlowSpec['type']][] = [
    ['pc', 'instructionMemory', 'address'], ['instructionMemory', 'instructionRegister', 'memory'],
    ['instructionRegister', 'controlUnit', 'data'], ['registerFile', 'alu', 'data'],
    ['registerFile', 'mux', 'data'], ['mux', 'alu', 'data'], ['alu', 'dataMemory', 'address'],
    ['registerFile', 'dataMemory', 'data'], ['alu', 'writeBack', 'data'],
    ['dataMemory', 'writeBack', 'memory'], ['writeBack', 'registerFile', 'data'],
    ['controlUnit', 'mux', 'control'], ['controlUnit', 'alu', 'control'],
    ['controlUnit', 'dataMemory', 'control'], ['controlUnit', 'writeBack', 'control'],
    ['controlUnit', 'registerFile', 'control'],
  ]
  for (const [from, to, type] of required) assert.ok(getDatapathRoute({ from, to, type }), `${from} → ${to}`)
  assert.equal(DATAPATH_ROUTES.some(route => route.from === 'alu' && route.to === 'registerFile'), false, 'Writeback must pass through result selection')
  assert.deepEqual(getDatapathRoute({ from: 'registerFile', to: 'dataMemory', type: 'data' })!.points[0], getDatapathRoute({ from: 'registerFile', to: 'mux', type: 'data' })!.points[0], 'Store data uses the second read port')
})

test('wires end at module ports and never pass through another housing', () => {
  const isPort = (point: DatapathPoint, id: ComponentId) => {
    const module = modules.get(id)!
    const dx = Math.abs(point[0] - module.position[0]), dz = Math.abs(point[2] - module.position[2])
    const hx = module.size[0] / 2, hz = module.size[2] / 2
    return dx <= hx + .001 && dz <= hz + .001 && (Math.abs(dx - hx) < .001 || Math.abs(dz - hz) < .001)
  }
  for (const route of DATAPATH_ROUTES) {
    assert.ok(isPort(route.points[0], route.from), `${route.id}: source port`)
    assert.ok(isPort(route.points[route.points.length - 1], route.to), `${route.id}: destination port`)
    for (let index = 1; index < route.points.length; index++) {
      const a = route.points[index - 1], b = route.points[index]
      assert.ok(a.every(Number.isFinite) && b.every(Number.isFinite))
      assert.ok(a[0] === b[0] || a[2] === b[2], `${route.id}: orthogonal routing`)
      assert.notDeepEqual(a, b, `${route.id}: zero length segment`)
      for (const module of DATAPATH_MODULES) {
        if ([route.from, route.to].includes(module.id)) continue
        const left = module.position[0] - module.size[0] / 2 + .1
        const right = module.position[0] + module.size[0] / 2 - .1
        const top = module.position[2] - module.size[2] / 2 + .1
        const bottom = module.position[2] + module.size[2] / 2 - .1
        const intersects = a[0] === b[0]
          ? a[0] > left && a[0] < right && Math.max(a[2], b[2]) > top && Math.min(a[2], b[2]) < bottom
          : a[2] > top && a[2] < bottom && Math.max(a[0], b[0]) > left && Math.min(a[0], b[0]) < right
        assert.equal(intersects, false, `${route.id}: segment passes through ${module.id}`)
      }
    }
  }
})
