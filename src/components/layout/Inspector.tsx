import { ArrowRight, ChevronRight, Info, X } from 'lucide-react';
import { useState } from 'react';
import { componentInfo, formatBinary, formatHex, formatInstruction, getStepDetails } from '../../data/instructions';
import { useCPUStore } from '../../store/cpuStore';
import type { Instruction } from '../../types/cpu';
import '../../experiments/instruction/InstructionVisualizer.css';

function sourceRegisters(instruction: Instruction) {
  if (instruction.opcode === 'ADD' || instruction.opcode === 'SUB') return [instruction.rs1, instruction.rs2];
  if (instruction.opcode === 'MOV' || instruction.opcode === 'STORE') return [instruction.rs];
  return [];
}

export function Inspector() {
  const state = useCPUStore();
  const details = getStepDetails(state);
  const instruction = state.currentInstruction ?? state.parsedInstruction;
  const selected = state.selectedComponent ? componentInfo[state.selectedComponent] : null;
  const [showBits, setShowBits] = useState(false);
  const reading = details.id === 'register-read' ? sourceRegisters(instruction) : [];
  const destination = 'rd' in instruction ? instruction.rd : null;
  const wroteRegister = details.id === 'write-back' && state.controlSignals.RegWrite === 1;
  const addresses = [...new Set([...Object.keys(state.memory).map(Number), ...(details.memoryAddress === null ? [] : [details.memoryAddress])])].sort((a, b) => a - b);
  const activeMemory = details.id === 'memory' && !details.skipped;

  return <aside className="inspector simulator-inspector" aria-label="组件与指令状态检查器">
    <div className="inspector-heading"><span>组件与状态</span>{selected ? <button className="small-icon-button" aria-label="取消选择组件" onClick={() => state.selectComponent(null)}><X size={15} /></button> : <Info size={14} />}</div>
    <section className="live-execution" aria-label="实时 CPU 状态">
      <div className="live-stage"><span className="component-type">LIVE EXECUTION</span><strong>{details.id === 'idle' ? 'READY' : details.label.toUpperCase()}</strong></div>
      <div className="current-instruction"><span>CURRENT INSTRUCTION · IR</span><code>{state.currentInstruction ? formatInstruction(state.currentInstruction) : '等待取指'}</code></div>
      <div className="state-row pc-state"><span>Program Counter</span><code>{formatHex(state.pc)}</code></div>
      <div className={`alu-execution ${details.id === 'execute' ? 'executing' : ''}`} aria-label="ALU 当前运算">
        <div className="alu-card-heading"><span>ALU</span><span>{details.id === 'execute' ? 'EXECUTE' : '当前内部状态'}</span></div>
        <div className="alu-input"><span>Input A</span><code>{state.operandA === null ? '—' : `${details.inputALabel} = ${state.operandA}`}</code></div>
        <div className="alu-input"><span>Input B</span><code>{state.operandB === null ? '—' : `${details.inputBLabel} = ${state.operandB}`}</code></div>
        <div className="alu-input"><span>Operation</span><strong>{state.controlSignals.ALUOp ?? '—'}</strong></div>
        <div className={`alu-result ${instruction.opcode === 'LOAD' || instruction.opcode === 'STORE' ? 'is-address' : ''}`}><span>{instruction.opcode === 'LOAD' || instruction.opcode === 'STORE' ? 'Result · 有效地址' : 'Result'}</span><strong>{state.aluResult === null ? '—' : instruction.opcode === 'LOAD' || instruction.opcode === 'STORE' ? formatHex(state.aluResult) : state.aluResult}</strong></div>
      </div>
      <div className={`memory-operation ${activeMemory ? 'active' : ''}`}><span>MEMORY</span><p>{details.id === 'memory' && details.skipped ? '跳过 · 此指令不访问数据存储器' : activeMemory && details.memoryAddress !== null ? `${instruction.opcode === 'STORE' ? '写入' : '读取'} ${formatHex(details.memoryAddress)} · ${state.memoryData ?? details.memoryValue ?? '—'}` : instruction.opcode !== 'LOAD' && instruction.opcode !== 'STORE' ? '本指令不访问数据存储器' : state.memoryData === null ? '等待访存' : `Memory Data = ${state.memoryData}`}</p></div>
      <section className="control-signals" aria-label="实时控制信号"><div className="register-heading"><h3>控制信号 · 译码结果</h3><span>CONTROL</span></div><div className="signal-grid">{Object.entries(state.controlSignals).map(([name, value]) => <div className={`signal-cell ${value === 1 || typeof value === 'string' ? 'enabled' : ''}`} key={name}><span>{name}</span><code>{value ?? '—'}</code></div>)}</div></section>
    </section>
    <section className="register-section live-registers" aria-label="寄存器状态"><div className="register-heading"><h3>寄存器</h3><span>REGISTER FILE</span></div><div className="register-table">{state.registers.map((value, index) => <div className={`register-row ${wroteRegister && index === destination ? 'written' : ''} ${reading.includes(index) ? 'reading' : ''}`} data-register={`R${index}`} key={index}><span className="mono">R{index}</span><strong>{value}</strong><code>{formatHex(value)}</code></div>)}</div><div className="register-legend"><span className="orange-dot" />{wroteRegister ? `R${destination} 已写回` : reading.length ? '蓝色为本步读取的寄存器' : '与 CPU 状态同步 · 上一步会恢复数值'}</div></section>
    <section className="memory-section" aria-label="数据存储器状态"><div className="register-heading"><h3>内存</h3><span>DATA MEMORY</span></div><div className="memory-table">{addresses.map(address => <div className={`memory-row ${activeMemory && address === details.memoryAddress ? instruction.opcode === 'STORE' ? 'written' : 'reading' : ''}`} data-address={address} key={address}><code>{formatHex(address)}</code><strong>{state.memory[address] ?? 0}</strong></div>)}</div><p className="memory-note">32 位字 · 地址按 4 字节对齐</p></section>
    {selected ? <section className="component-inspector selected-component"><span className="component-type">SELECTED COMPONENT</span><h2>{selected.name}</h2><p className="component-english">{selected.englishName}</p><p className="inspector-description">{selected.description}</p><details className="component-ports"><summary>输入、输出与原理</summary><div className="io-section"><h3>输入 <span>INPUT</span></h3>{selected.inputs.map(input => <div className="io-row" key={input}><span className="io-dot" />{input}</div>)}</div><div className="io-section"><h3>输出 <span>OUTPUT</span></h3>{selected.outputs.map(output => <div className="io-row" key={output}><span className="io-dot output" />{output}</div>)}</div><p className="component-detail">{selected.detail}</p></details>{state.selectedComponent === 'alu' && <button className="inspector-action" onClick={() => setShowBits(!showBits)}>{showBits ? '收起 32 位表示' : '查看 32 位表示'}<ChevronRight size={14} /></button>}{showBits && state.selectedComponent === 'alu' && <div className="bits-preview"><span>32-BIT · {state.controlSignals.ALUOp ?? 'READY'}</span><code>A: {state.operandA === null ? '—' : formatBinary(state.operandA)}</code><code>B: {state.operandB === null ? '—' : formatBinary(state.operandB)}</code><code>Result: {state.aluResult === null ? '—' : formatBinary(state.aluResult)}</code><p>{state.aluResult === null ? '执行后显示结果标志' : `Zero: ${Number(state.aluResult === 0)} · Carry: ${Number(details.carry)} · Overflow: ${Number(details.overflow)}`}</p></div>}</section> : <div className="inspector-tip"><Info size={15} /><div><p>点击 3D 模块，查看说明与连接端口。实时状态会持续保留。</p><div className="quick-components"><button onClick={() => state.selectComponent('alu')}>ALU <ArrowRight size={12} /></button><button onClick={() => state.selectComponent('dataMemory')}>Memory <ArrowRight size={12} /></button></div></div></div>}
  </aside>;
}
