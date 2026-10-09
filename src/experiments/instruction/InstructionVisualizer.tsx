import { useEffect, useState } from 'react';
import { Play, Terminal } from 'lucide-react';
import { useCPUStore } from '../../store/cpuStore';

/** The clock advances the teaching state; Three.js only renders that state. */
export function useInstructionPlayback() {
  const playing = useCPUStore(state => state.playing);
  const step = useCPUStore(state => state.step);
  const speed = useCPUStore(state => state.speed);
  const next = useCPUStore(state => state.next);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(next, 1800 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, step, speed, next]);
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
        {state.error || <><span>支持 ADD Rd, Rs1, Rs2</span><span>R0 — R7</span></>}
      </div>
    </section>
  );
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
  const indices = [...new Set([instruction.rs1, instruction.rs2])];
  return <div className="experiment-inputs">
    <div><strong>改变操作数，观察结果</strong><span>按 Enter 或离开输入框应用。修改后回到执行前状态。</span></div>
    {indices.map(index => <RegisterInput key={index} index={index} />)}
  </div>;
}
