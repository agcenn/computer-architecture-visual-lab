import type { ComponentId, ComponentInfo, CourseModule } from '../types/cpu'

export const courseModules: CourseModule[] = [
  { id: 'overview', title: 'Computer System Overview', subtitle: '计算机系统概览', available: true },
  { id: 'datapath', title: 'CPU Datapath', subtitle: 'CPU 数据通路', available: true },
  { id: 'instruction', title: 'Instruction Execution', subtitle: '指令执行', available: true },
  { id: 'alu', title: 'ALU', subtitle: '算术逻辑单元', available: false },
  { id: 'registers', title: 'Registers', subtitle: '寄存器', available: false },
  { id: 'memory', title: 'Memory Hierarchy', subtitle: '存储层次', available: false },
  { id: 'cache', title: 'Cache Visualizer', subtitle: '高速缓存', available: true },
  { id: 'bus', title: 'Bus', subtitle: '总线', available: false },
  { id: 'pipeline', title: 'Pipeline Visualizer', subtitle: '流水线', available: true },
  { id: 'virtual-memory', title: 'Virtual Memory', subtitle: '虚拟内存', available: false },
]

export const componentInfo: Record<ComponentId, ComponentInfo> = {
  pc: {
    name: '程序计数器', englishName: 'Program Counter', shortLabel: 'PC', color: '#60A5FA',
    description: '保存当前指令的地址，决定 CPU 从哪里取指令。',
    inputs: ['下一条指令地址'], outputs: ['Instruction Address'],
    detail: 'PC 初始为 0x00400000，每完成一条教学指令前进 4 字节。切换到下一条指令会保留已完成的 PC、寄存器与内存；Previous 和 Reset 可以恢复本次指令之前的 PC。',
  },
  instructionMemory: {
    name: '指令存储器', englishName: 'Instruction Memory', shortLabel: 'I-MEM', color: '#7C9DF6',
    description: '按 PC 给出的地址读取程序指令。',
    inputs: ['Instruction Address'], outputs: ['Instruction'],
    detail: 'FETCH 取得编辑器中待执行的教学指令，地址由实际 PC 给出。支持 ADD、SUB、LOAD、STORE 和 MOV。本模型把指令流与数据内存分开，不模拟特定 ISA 的二进制机器码。',
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
    detail: 'DECODE 根据指令产生控制信号。ADD / SUB 使用两个寄存器；MOV 传递一个寄存器值；LOAD 使用 MemRead 与 MemtoReg，STORE 使用 MemWrite 并关闭 RegWrite。六个步骤用于观察信号传播和状态变化，不是六级流水线。',
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
    detail: '当前支持 ADD 加法、SUB 减法、MOV 的 PASS 传递，以及 LOAD / STORE 的地址计算。EXECUTE 同时显示输入、操作、结果与数据线数值。算术结果保留低 32 位，并显示 Zero / Carry / Overflow。',
  },
  mux: {
    name: '多路选择器', englishName: 'Multiplexer', shortLabel: 'MUX', color: '#7D91BE',
    description: '根据控制信号，从多个输入中选择一个送往输出。',
    inputs: ['Register Data', 'Immediate', 'Select'], outputs: ['Selected Operand'],
    detail: 'ADD / SUB 选择第二个源寄存器的数据；LOAD / STORE 选择指令中的地址立即数，用于 ALU 地址计算。ALUSrc 控制当前输入选择。',
  },
  dataMemory: {
    name: '数据存储器', englishName: 'Data Memory', shortLabel: 'D-MEM', color: '#50B995',
    description: '保存程序数据，根据地址执行读取或写入。',
    inputs: ['Address', 'Write Data', 'MemRead / MemWrite'], outputs: ['Read Data'],
    detail: 'Memory 是可读写的 32 位字内存，地址需按 4 字节对齐，初始 0x1000 = 42。LOAD 在 MEMORY 读取，STORE 在 MEMORY 写入；Previous 会撤销本步骤的内存变化。ADD、SUB 和 MOV 跳过访存。',
  },
  writeBack: {
    name: '写回结果选择', englishName: 'Write Back', shortLabel: 'WRITE BACK', color: '#D9A73D',
    description: '通过 MemtoReg 选择 ALU 结果或存储器读出数据，再送回寄存器堆。',
    inputs: ['ALU Result', 'Memory Read Data', 'MemtoReg'], outputs: ['Write Data → Register File'],
    detail: '这个外壳表示结果选择器。ADD / SUB / MOV 使用 MemtoReg = 0 选择 ALU 输出；LOAD 使用 MemtoReg = 1 选择内存读数。WRITE BACK 把结果写入 rd 并推进 PC；STORE 不写寄存器，只完成 PC 推进。',
  },
  cache: {
    name: '高速缓存', englishName: 'Cache', shortLabel: 'CACHE', color: '#53C6CF',
    description: '保存经常使用的数据副本，减少访问主存的等待时间。',
    inputs: ['Memory Address', 'Read / Write Request'], outputs: ['Cached Data', 'Hit / Miss'],
    detail: 'Cache 实验使用 16 位字节地址、4 行直接映射缓存和 4 字节块。地址分为 12 位 Tag、2 位 Index 和 2 位 Offset；Valid 与 Tag 一起决定命中。Miss 从主存回填整块，然后按 Offset 把所需字节返回 CPU。',
  },
  bus: {
    name: '总线与数据通路', englishName: 'Bus & Datapath', shortLabel: 'BUS', color: '#F2B95D',
    description: '连接 CPU 模块，传递数据、地址与控制信号。',
    inputs: ['源模块的输出'], outputs: ['目标模块的输入'],
    detail: '黄色表示数据，蓝色表示地址，紫色表示控制信号，绿色表示存储器读取。移动粒子展示当前阶段信号传递的方向。',
  },
}
