import type { ComponentId, ComponentInfo, CourseModule } from '../types/cpu'

export const courseModules: CourseModule[] = [
  { id: 'overview', title: 'Computer System Overview', subtitle: '计算机系统概览', available: true },
  { id: 'datapath', title: 'CPU Datapath', subtitle: 'CPU 数据通路', available: true },
  { id: 'instruction', title: 'Instruction Execution', subtitle: '指令执行', available: true },
  { id: 'alu', title: 'ALU', subtitle: '算术逻辑单元', available: false },
  { id: 'registers', title: 'Registers', subtitle: '寄存器', available: false },
  { id: 'memory', title: 'Memory Hierarchy', subtitle: '存储层次', available: false },
  { id: 'cache', title: 'Cache', subtitle: '高速缓存', available: false },
  { id: 'bus', title: 'Bus', subtitle: '总线', available: false },
  { id: 'pipeline', title: 'Pipeline', subtitle: '流水线', available: false },
  { id: 'virtual-memory', title: 'Virtual Memory', subtitle: '虚拟内存', available: false },
]

export const componentInfo: Record<ComponentId, ComponentInfo> = {
  pc: {
    name: '程序计数器', englishName: 'Program Counter', shortLabel: 'PC', color: '#60A5FA',
    description: '保存当前指令的地址，决定 CPU 从哪里取指令。',
    inputs: ['下一条指令地址'], outputs: ['Instruction Address'],
    detail: '本实验的指令位于 0x00400000。顺序执行时，32 位定长指令通常让 PC 增加 4；跳转指令则选择新的地址。',
  },
  instructionMemory: {
    name: '指令存储器', englishName: 'Instruction Memory', shortLabel: 'I-MEM', color: '#7C9DF6',
    description: '按 PC 给出的地址读取程序指令。',
    inputs: ['Instruction Address'], outputs: ['Instruction'],
    detail: '取指阶段输出 ADD 指令。本教学模型把指令存储器和数据存储器分开，方便看清指令流与数据流。',
  },
  instructionRegister: {
    name: '指令寄存器', englishName: 'Instruction Register', shortLabel: 'IR', color: '#8398E6',
    description: '展示从指令存储器取出的指令及其字段，便于观察译码输入。',
    inputs: ['Instruction'], outputs: ['Opcode', 'rs1 / rs2 / rd'],
    detail: 'ADD R1, R2, R3 表示把 R2 与 R3 相加后写入 R1。IR 是本教学图中的指令观察点；标准单周期数据通路通常直接把指令存储器输出送入译码器，不需要额外的 IR 时钟阶段。',
  },
  controlUnit: {
    name: '控制单元与译码器', englishName: 'Control Unit / Decoder', shortLabel: 'CONTROL', color: '#A78BFA',
    description: '包含指令译码器，根据指令生成数据通路所需的控制信号。',
    inputs: ['Opcode', '指令字段'], outputs: ['ALUOp', 'ALUSrc', 'MemRead / MemWrite', 'MemtoReg', 'RegWrite'],
    detail: 'ADD 的控制信号为 ALUSrc = 0（寄存器操作数）、ALUOp = ADD、MemtoReg = 0（ALU 结果）、RegWrite = 1；MemRead = 0、MemWrite = 0。信号在同一周期中驱动组合数据通路，目标寄存器在周期结束的时钟边沿更新。五个演示步骤只是这一周期的教学拆解。',
  },
  registerFile: {
    name: '寄存器堆', englishName: 'Register File', shortLabel: 'REGISTERS', color: '#6AA3FF',
    description: '保存 CPU 正在使用的数据，提供两个读取端口和一个写入端口。',
    inputs: ['rs1 / rs2', 'rd', 'Write Data', 'RegWrite'], outputs: ['Operand A', 'Operand B'],
    detail: '本教学 CPU 使用 R0–R7 八个可写的 32 位通用寄存器。初始 R2 = 5、R3 = 7；ADD 完成写回后 R1 = 12。',
  },
  alu: {
    name: '算术逻辑单元', englishName: 'Arithmetic Logic Unit', shortLabel: 'ALU', color: '#5685FF',
    description: '执行算术和逻辑运算，是 CPU 数据处理的核心。',
    inputs: ['Operand A', 'Operand B', 'ALUOp'], outputs: ['Result', 'Zero Flag', 'Carry Flag', 'Overflow Flag'],
    detail: '常见操作包括 ADD、SUB、AND、OR、XOR 与移位。第一阶段展示 ADD：5 + 7 = 12。结果保留低 32 位，有符号溢出时会给出提示。',
  },
  mux: {
    name: '多路选择器', englishName: 'Multiplexer', shortLabel: 'MUX', color: '#7D91BE',
    description: '根据控制信号，从多个输入中选择一个送往输出。',
    inputs: ['Register Data', 'Immediate', 'Select'], outputs: ['Selected Operand'],
    detail: '对于 ADD，MUX 选择第二个源寄存器的数据。其他指令可以选择立即数。本阶段没有立即数指令实验。',
  },
  dataMemory: {
    name: '数据存储器', englishName: 'Data Memory', shortLabel: 'D-MEM', color: '#50B995',
    description: '保存程序数据，根据地址执行读取或写入。',
    inputs: ['Address', 'Write Data', 'MemRead / MemWrite'], outputs: ['Read Data'],
    detail: 'LOAD 与 STORE 指令会使用数据存储器。ADD 在两个寄存器之间完成运算，因此本次执行中该模块不参与。独立存储器实验将在后续阶段提供。',
  },
  writeBack: {
    name: '写回结果选择', englishName: 'Write Back', shortLabel: 'WRITE BACK', color: '#D9A73D',
    description: '通过 MemtoReg 选择 ALU 结果或存储器读出数据，再送回寄存器堆。',
    inputs: ['ALU Result', 'Memory Read Data', 'MemtoReg'], outputs: ['Write Data → Register File'],
    detail: '这个外壳表示写回选择器（结果 MUX），不是额外的存储寄存器。ADD 使用 MemtoReg = 0 选择 ALU 结果，默认示例为 12，结果随操作数变化；LOAD 会选择存储器读出数据。RegWrite = 1 时，寄存器堆在周期结束的时钟边沿把选中的结果写入 rd。',
  },
  cache: {
    name: '高速缓存', englishName: 'Cache', shortLabel: 'CACHE', color: '#53C6CF',
    description: '保存经常使用的数据副本，减少访问主存的等待时间。',
    inputs: ['Memory Address', 'Read / Write Request'], outputs: ['Cached Data', 'Hit / Miss'],
    detail: 'Cache 通过有效位、标签与索引判断请求是否命中。当前 ADD 不访问数据 Cache；命中率与地址映射实验将在后续阶段提供。',
  },
  bus: {
    name: '总线与数据通路', englishName: 'Bus & Datapath', shortLabel: 'BUS', color: '#F2B95D',
    description: '连接 CPU 模块，传递数据、地址与控制信号。',
    inputs: ['源模块的输出'], outputs: ['目标模块的输入'],
    detail: '黄色表示数据，蓝色表示地址，紫色表示控制信号，绿色表示存储器读取。移动粒子展示当前阶段信号传递的方向。',
  },
}
