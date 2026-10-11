import { useEffect, useState } from 'react';
import { Play, Terminal } from 'lucide-react';
import { useCPUStore } from '../../store/cpuStore';
import './InstructionVisualizer.css';

const instructionExamples = [
  ['ADD', 'ADD R1,R2,R3'],
  ['SUB', 'SUB R1,R2,R3'],
  ['LOAD', 'LOAD R1,[0x1000]'],
  ['STORE', 'STORE R1,[0x1000]'],
  ['MOV', 'MOV R1,R2'],
] as const;

/** The clock advances the teaching state; Three.js only renders that state. */
export function useInstructionPlayback() {
  const playing = useCPUStore(state => state.playing);
  const step = useCPUStore(state => state.step);
  const speed = useCPUStore(state => state.speed);
  const executionRevision = useCPUStore(state => state.executionRevision);
  const next = useCPUStore(state => state.next);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(next, 1800 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, step, speed, executionRevision, next]);
}

export function InstructionInput() {
  const state = useCPUStore();
  return (
    <section className="instruction-bar">
      <form onSubmit={event => { event.preventDefault(); state.run(); }}>
        <label htmlFor="instruction"><Terminal size={15} /><span>指令</span></label>
        <input id="instruction" className="mono" aria-describedby="instruction-help" spellCheck={false}
          autoComplete="off" value={state.instructionText}
          onChange={event => state.setInstructionText(event.target.value)} />
        <button className="button run-button" type="submit"><Play size={13} fill="currentColor" /> Run</button>
      </form>
      <div id="instruction-help" className={state.error ? 'instruction-error' : 'instruction-helper'}
        role={state.error ? 'alert' : undefined}>
        {state.error || <><span>32 位教学指令 · R0 — R7 · 内存字地址</span><span>六步可逆执行</span></>}
      </div>
      <div className="instruction-examples" aria-label="指令示例"><span>试一条</span>{instructionExamples.map(([opcode, text]) => <button key={opcode} type="button" className={state.parsedInstruction.opcode === opcode ? 'active' : ''} aria-label={`示例 ${opcode}`} title={text} onClick={() => state.setInstructionText(text)}>{opcode}</button>)}</div>
    </section>
  );
}

function MemoryInput({ address }: { address: number }) {
  const value = useCPUStore(state => state.memory[address] ?? 0);
  const playing = useCPUStore(state => state.playing);
  const setMemory = useCPUStore(state => state.setMemory);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value, address]);
  const addressLabel = `0x${address.toString(16).toUpperCase()}`;
  const commit = () => {
    if (!draft.trim()) { setDraft(String(value)); return; }
    const nextValue = Number(draft);
    if (nextValue !== value) setMemory(address, nextValue);
  };
  return <label className="memory-editor">Memory [{addressLabel}]
    <input type="number" min="-2147483648" max="4294967295" step="1" disabled={playing}
      value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit}
      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      aria-label={`Memory ${addressLabel} value`} />
  </label>;
}

function RegisterInput({ index }: { index: number }) {
  const value = useCPUStore(state => state.registers[index]);
  const playing = useCPUStore(state => state.playing);
  const setRegister = useCPUStore(state => state.setRegister);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    if (!draft.trim()) { setDraft(String(value)); return; }
    const nextValue = Number(draft);
    if (nextValue !== value) setRegister(index, nextValue);
  };
  return <label>R{index}
    <input type="number" min="-2147483648" max="4294967295" step="1" disabled={playing}
      value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit}
      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      aria-label={`R${index} 操作数`} />
  </label>;
}

export function OperandEditor() {
  const instruction = useCPUStore(state => state.parsedInstruction);
  const indices = instruction.opcode === 'ADD' || instruction.opcode === 'SUB' ? [...new Set([instruction.rs1, instruction.rs2])] : instruction.opcode === 'MOV' || instruction.opcode === 'STORE' ? [instruction.rs] : [];
  return <div className="experiment-inputs simulator-inputs">
    <div><strong>{instruction.opcode === 'LOAD' ? '改变内存，观察读入值' : instruction.opcode === 'STORE' ? '改变源寄存器，观察写入内存' : '改变操作数，观察结果'}</strong><span>按 Enter 或离开输入框应用。执行中修改会恢复本条指令开始前的状态。</span></div>
    {indices.map(index => <RegisterInput key={index} index={index} />)}
    {(instruction.opcode === 'LOAD' || instruction.opcode === 'STORE') && <MemoryInput key={instruction.address} address={instruction.address} />}
  </div>;
}
