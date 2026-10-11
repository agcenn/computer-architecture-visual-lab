import type { ComponentId, DataFlowSpec } from '../types/cpu';

export type DatapathPoint = [number, number, number];
export type DatapathModule = {
  id: ComponentId;
  position: DatapathPoint;
  /** Housing dimensions in world units: width (x), height (y), depth (z). */
  size: DatapathPoint;
  title: string;
  subtitle: string;
  shape?: 'alu' | 'mux';
};
export type DatapathRoute = DataFlowSpec & {
  id: string;
  /** Orthogonal routes end at the housing's input and output ports. */
  points: DatapathPoint[];
  labelPoint: DatapathPoint;
};

export const DATAPATH_MODULES: DatapathModule[] = [
  { id: 'pc', position: [-11, 0, -6], size: [3.8, .55, 2.2], title: 'Program Counter', subtitle: '程序计数器 · PC' },
  { id: 'instructionMemory', position: [-11, 0, -2.7], size: [3.8, .55, 2.4], title: 'Instruction Memory', subtitle: '指令存储器' },
  { id: 'instructionRegister', position: [-11, 0, .6], size: [3.8, .55, 2], title: 'Instruction Register', subtitle: '指令显示寄存器 · IR' },
  { id: 'controlUnit', position: [-11, 0, 4.8], size: [3.8, .55, 2.6], title: 'Control Unit', subtitle: '控制单元 · Decoder' },
  { id: 'registerFile', position: [-4.3, 0, .6], size: [4.1, .55, 3.6], title: 'Register File', subtitle: '寄存器堆 · R0–R7' },
  { id: 'mux', position: [.1, 0, 4.5], size: [2.2, .55, 2.4], title: 'MUX', subtitle: 'ALUSrc · 操作数选择', shape: 'mux' },
  { id: 'alu', position: [3.2, 0, .6], size: [3.6, .55, 3.6], title: 'ALU', subtitle: '算术逻辑单元', shape: 'alu' },
  { id: 'dataMemory', position: [10.5, 0, .6], size: [4, .55, 3.6], title: 'Data Memory', subtitle: '数据存储器' },
  { id: 'writeBack', position: [7.3, 0, 7], size: [3.8, .55, 2.4], title: 'Write Back', subtitle: '结果选择 · MemtoReg' },
];

const p = (x: number, z: number): DatapathPoint => [x, .15, z];
const route = (id: string, from: ComponentId, to: ComponentId, type: DataFlowSpec['type'], label: string, coordinates: [number, number][], labelAt: [number, number]): DatapathRoute => ({
  id, from, to, type, label, points: coordinates.map(([x, z]) => p(x, z)), labelPoint: [labelAt[0], .8, labelAt[1]],
});

/** Complete teaching topology. ADD highlights only the routes it actually uses. */
export const DATAPATH_ROUTES: DatapathRoute[] = [
  route('pc-instruction-address', 'pc', 'instructionMemory', 'address', 'PC', [[-11, -4.9], [-11, -3.9]], [-11, -4.4]),
  route('instruction-word', 'instructionMemory', 'instructionRegister', 'memory', 'Instruction', [[-11, -1.5], [-11, -.4]], [-11, -1.0]),
  route('decode-opcode', 'instructionRegister', 'controlUnit', 'data', 'Opcode', [[-11, 1.6], [-11, 3.5]], [-11, 2.6]),
  route('register-addresses', 'instructionRegister', 'registerFile', 'address', 'rs1 / rs2 / rd', [[-9.1, .1], [-6.35, .1]], [-7.75, -.45]),
  route('read-operand-a', 'registerFile', 'alu', 'data', 'Read data 1', [[-2.25, -.4], [-1.6, -.4], [-1.6, -2.3], [.8, -2.3], [.8, -.4], [1.4, -.4]], [-.3, -2.45]),
  route('read-operand-b', 'registerFile', 'mux', 'data', 'Read data 2', [[-2.25, 1.6], [-1.8, 1.6], [-1.8, 4.1], [-1, 4.1]], [-1.8, 2.8]),
  route('selected-operand-b', 'mux', 'alu', 'data', 'ALU input B', [[1.2, 4.5], [2.3, 4.5], [2.3, 2.8], [.9, 2.8], [.9, 1.6], [1.4, 1.6]], [2.2, 3.35]),
  route('immediate-input', 'instructionRegister', 'mux', 'data', 'Immediate', [[-9.1, 1.1], [-8.4, 1.1], [-8.4, 7.4], [-2.8, 7.4], [-2.8, 5], [-1, 5]], [-5.6, 7.4]),
  route('memory-address', 'alu', 'dataMemory', 'address', 'Address', [[5, -.1], [8.5, -.1]], [6.7, -.6]),
  route('store-data', 'registerFile', 'dataMemory', 'data', 'Store data', [[-2.25, 1.6], [-1.8, 1.6], [-1.05, 1.6], [-1.05, -4], [10.5, -4], [10.5, -1.2]], [5.6, -4]),
  route('alu-result', 'alu', 'writeBack', 'data', 'ALU result', [[5, 1.3], [6.1, 1.3], [6.1, 5.1], [6.5, 5.1], [6.5, 5.8]], [6.1, 3.7]),
  route('memory-result', 'dataMemory', 'writeBack', 'memory', 'Read data', [[10.5, 2.4], [10.5, 5.1], [8.1, 5.1], [8.1, 5.8]], [9.8, 5.1]),
  route('write-register', 'writeBack', 'registerFile', 'data', 'Write data', [[5.4, 7], [4.2, 7], [4.2, 9.2], [-4.3, 9.2], [-4.3, 2.4]], [-4.3, 5.4]),
  route('control-alusrc', 'controlUnit', 'mux', 'control', 'ALUSrc', [[-9.1, 4.8], [-7.7, 4.8], [-7.7, 6.4], [-2.2, 6.4], [-2.2, 5.5], [-1, 5.5]], [-4.9, 6.4]),
  route('control-aluop', 'controlUnit', 'alu', 'control', 'ALUOp', [[-9.1, 4.1], [-7.2, 4.1], [-7.2, -3.2], [3.2, -3.2], [3.2, -1.2]], [3.2, -2.3]),
  route('control-memory', 'controlUnit', 'dataMemory', 'control', 'MemRead / MemWrite', [[-11.9, 6.1], [-11.9, 10], [13.5, 10], [13.5, .9], [12.5, .9]], [13.5, 4.2]),
  route('control-memto-reg', 'controlUnit', 'writeBack', 'control', 'MemtoReg', [[-10.3, 6.1], [-10.3, 8.5], [3.3, 8.5], [3.3, 10.7], [7.3, 10.7], [7.3, 8.2]], [7.3, 9.45]),
  route('control-regwrite', 'controlUnit', 'registerFile', 'control', 'RegWrite', [[-9.1, 5.6], [-6.9, 5.6], [-6.9, 1.6], [-6.35, 1.6]], [-6.9, 3.5]),
];

export const getDatapathRoute = (flow: Pick<DataFlowSpec, 'from' | 'to' | 'type'>) => DATAPATH_ROUTES.find(route => route.from === flow.from && route.to === flow.to && route.type === flow.type);
