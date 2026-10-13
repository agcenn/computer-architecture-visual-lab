import { useEffect, useLayoutEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Info, Layers3, Pause, Play, RotateCcw, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../../components/layout/Brand';
import { Sidebar } from '../../components/layout/Sidebar';
import { getPipelineSnapshot, PIPELINE_PRESETS, PIPELINE_STAGES } from '../../data/pipeline';
import { usePipelineStore } from '../../store/pipelineStore';
import type { CycleSnapshot, DataHazard, PipelineExecution } from '../../types/pipeline';
import { PipelineScene } from './PipelineScene';
import pipelineCover from '../../assets/visuals/pipeline-cover.webp';
import './PipelineVisualizer.css';

type PipelineState = ReturnType<typeof usePipelineStore.getState>;
const stageStyle = (color: string) => ({ '--pipeline-stage-color': color } as CSSProperties);

function usePipelinePlayback() {
  const { playing, cycle, speed, revision, next } = usePipelineStore();
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(next, 1500 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, cycle, speed, revision, next]);
}

function HazardDetail({ hazard, execution, active, cycle }: { hazard: DataHazard; execution: PipelineExecution; active: boolean; cycle: number }) {
  const producer = execution.instructions.find(instruction => instruction.id === hazard.producerId);
  const consumer = execution.instructions.find(instruction => instruction.id === hazard.consumerId);
  return <div className={`pipeline-hazard-detail ${active ? 'is-active' : ''}`} data-hazard-id={hazard.id}>
    <div className="pipeline-hazard-title"><AlertTriangle size={15} /><strong>RAW Hazard</strong><code>R{hazard.register}</code></div>
    <p><code>{consumer?.text}</code> 在 Cycle {hazard.readCycle} 的 ID 读取 <strong>R{hazard.register}</strong>。</p>
    <div className="pipeline-dependency"><code>{producer?.opcode} → R{hazard.register}</code><ArrowRight size={14} /><code>{consumer?.opcode} 读取</code></div>
    <dl><div><dt>读取时，生产者</dt><dd>{hazard.producerStageAtRead}</dd></div><div><dt>生产者完成 WB</dt><dd>Cycle {hazard.availableCycle}</dd></div></dl>
    <p className="pipeline-hazard-explanation">{cycle < hazard.availableCycle ? 'RAW：读取早于写回。' : 'RAW：提前读取已发生。'}当前调度未修复冒险。</p>
  </div>;
}

function PipelineInspector({ state, snapshot }: { state: PipelineState; snapshot: CycleSnapshot }) {
  const selected = state.execution.instructions.find(instruction => instruction.id === state.selectedInstructionId);
  return <aside className="inspector pipeline-inspector" aria-label="Pipeline Inspector">
    <div className="inspector-heading"><span>Inspector</span><Layers3 size={16} /></div>
    <section className="pipeline-cycle-inspector"><span className="component-type">当前周期</span><h2>{state.cycle ? `Cycle ${state.cycle}` : 'Ready'}</h2><p>{state.cycle ? '不同指令，同周期推进。' : '每个周期发射一条指令。'}</p></section>
    <section className="pipeline-occupancies"><div className="pipeline-section-heading"><h3>当前阶段</h3><span>{state.execution.instructions.length} 条指令</span></div>
      {PIPELINE_STAGES.map(stage => {
        const id = snapshot.occupants[stage.id];
        const instruction = state.execution.instructions.find(item => item.id === id);
        return <button key={stage.id} className={`pipeline-occupancy ${id === state.selectedInstructionId && id ? 'is-selected' : ''}`} style={stageStyle(stage.color)} data-stage={stage.id} data-instruction-id={id ?? ''} disabled={!id} onClick={() => state.selectInstruction(id)} aria-label={instruction ? `选择 ${instruction.text}，当前 ${stage.id}` : `${stage.id} 空闲`}>
          <span>{stage.id}</span><code>{instruction?.text ?? '空闲'}</code>
        </button>;
      })}
    </section>
    {selected && <section className="pipeline-selection"><div className="pipeline-section-heading"><h3>选中指令</h3><button className="pipeline-clear-selection" aria-label="Pipeline Clear Selection" onClick={() => state.selectInstruction(null)}><X size={15} /></button></div><code className="pipeline-selected-text">{selected.text}</code><p>阶段与周期</p><div className="pipeline-selected-path">{state.execution.placements.filter(placement => placement.instructionId === selected.id).map(placement => { const stage = PIPELINE_STAGES.find(item => item.id === placement.stage)!; return <div key={`${stage.id}-${placement.cycle}`} style={stageStyle(stage.color)} className={placement.cycle === state.cycle ? 'is-current' : ''}><strong>{stage.id}</strong><span>C{placement.cycle}</span></div>; })}</div><dl className="pipeline-register-use"><div><dt>读取寄存器</dt><dd>{selected.sources.map(register => `R${register}`).join(', ') || '—'}</dd></div><div><dt>写回寄存器</dt><dd>{selected.destination === null ? '—' : `R${selected.destination}`}</dd></div></dl></section>}
    <section className="pipeline-hazard-inspector"><div className="pipeline-section-heading"><h3>数据冒险检测</h3><span data-hazard-count={snapshot.detectedHazards.length}>{snapshot.detectedHazards.length ? `${snapshot.detectedHazards.length} 次 RAW` : state.cycle ? '未发现 RAW' : '等待检测'}</span></div>
      {snapshot.detectedHazards.length ? snapshot.detectedHazards.map(hazard => <HazardDetail key={hazard.id} hazard={hazard} execution={state.execution} cycle={state.cycle} active={snapshot.activeHazards.some(active => active.id === hazard.id)} />) : <p className="pipeline-no-hazard">{state.cycle ? '尚未检测到提前读取。' : 'ID 读取早于前条指令 WB 时，标记 RAW。'}</p>}
    </section>
    <section className="pipeline-teaching-note"><Info size={16} /><div><h3>RAW：读取早于前条指令写回。</h3><details className="pipeline-concept-details"><summary>原理与模型说明</summary><figure><img src={pipelineCover} alt="五级流水线的概念插画" loading="lazy" decoding="async" width={1600} height={900} /><figcaption>概念插画</figcaption></figure><p>五级各占一个周期，不同指令重叠推进。红色标记提示读取尚未写回的数据。</p><p>本模型保留理想调度，仅检测冒险；不启用 forwarding、stall 或分支预测，也不计算寄存器结果。</p></details></div></section>
  </aside>;
}

function TimingDiagram({ state, snapshot }: { state: PipelineState; snapshot: CycleSnapshot }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const columns = Array.from({ length: state.execution.totalCycles }, (_, index) => index + 1);
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const revealCurrentColumn = () => {
      const current = wrapper.querySelector<HTMLElement>(`thead [data-cycle="${state.cycle}"]`);
      if (!current) return;
      const container = wrapper.getBoundingClientRect();
      const cell = current.getBoundingClientRect();
      const label = wrapper.querySelector<HTMLElement>('.pipeline-instruction-heading')?.getBoundingClientRect().width ?? 160;
      if (cell.right > container.right - 12) wrapper.scrollLeft += cell.right - container.right + 12;
      else if (cell.left < container.left + label + 8) wrapper.scrollLeft -= container.left + label + 8 - cell.left;
    };
    revealCurrentColumn();
    const observer = new ResizeObserver(revealCurrentColumn);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [state.cycle, state.execution]);
  return <section className="pipeline-timing-section" aria-label="Pipeline Timing Diagram">
    <div className="pipeline-section-heading"><div><h2>Pipeline Timing Diagram</h2></div><span className="pipeline-timing-cycle">{state.cycle ? `Cycle ${state.cycle}` : 'READY'} <small>/ {state.execution.totalCycles}</small></span></div>
    <div className="pipeline-timing-scroll" ref={wrapperRef} tabIndex={0} aria-label="流水时序图，可横向滚动">
      <table className="pipeline-timing-table" style={{ '--pipeline-cycle-count': columns.length } as CSSProperties}><caption className="sr-only">每条指令按 IF、ID、EX、MEM、WB 执行。当前周期 {state.cycle}。</caption><thead><tr><th scope="col" className="pipeline-instruction-heading"><span>Instruction</span><small>Cycle →</small></th>{columns.map(cycle => <th scope="col" key={cycle} data-cycle={cycle} className={state.cycle === cycle ? 'is-current' : ''} aria-current={state.cycle === cycle ? 'step' : undefined}>{cycle}</th>)}</tr></thead><tbody>
        {state.execution.instructions.map((instruction, instructionIndex) => <tr key={instruction.id} className={state.selectedInstructionId === instruction.id ? 'is-selected' : ''} data-instruction-id={instruction.id}>
          <th scope="row"><button onClick={() => state.selectInstruction(instruction.id)} aria-pressed={state.selectedInstructionId === instruction.id} aria-label={`Select Pipeline Instruction ${instructionIndex + 1}`} title={instruction.text}><span>I{instructionIndex + 1}</span><code>{instruction.text}</code></button></th>
          {columns.map(cycle => {
            const placement = state.execution.placements.find(item => item.instructionId === instruction.id && item.cycle === cycle);
            const stage = PIPELINE_STAGES.find(item => item.id === placement?.stage);
            const hazards = snapshot.detectedHazards.filter(hazard => hazard.consumerId === instruction.id && hazard.readCycle === cycle);
            const current = cycle === state.cycle;
            return <td key={cycle} className={`pipeline-timing-cell ${stage ? 'has-stage' : ''} ${cycle > state.cycle ? 'is-future' : 'is-past'} ${current ? 'is-current' : ''} ${hazards.length ? 'has-hazard' : ''}`} data-instruction-id={instruction.id} data-cycle={cycle} data-stage={stage?.id ?? ''} data-hazard={hazards.length > 0} style={stage ? stageStyle(stage.color) : undefined}>
              {stage ? <button aria-label={`选择 ${instruction.text}，Cycle ${cycle} ${stage.id}${hazards.length ? `，RAW Hazard ${hazards.map(hazard => `R${hazard.register}`).join(', ')}` : ''}`} aria-pressed={state.selectedInstructionId === instruction.id} onClick={() => state.selectInstruction(instruction.id)}><strong>{stage.id}</strong>{hazards.length > 0 && <span className="pipeline-cell-hazard">RAW {hazards.map(hazard => `R${hazard.register}`).join('/')}</span>}</button> : <span className="pipeline-empty-cell">·</span>}
            </td>;
          })}
        </tr>)}
      </tbody></table>
    </div>
    <div className="pipeline-timing-legend"><span><i className="current" /> 当前周期</span><span><i className="future" /> 待执行</span><span><i className="hazard" /> RAW 读取冒险</span></div>
    <p className="pipeline-diagram-helper">点击指令或阶段，追踪路径。</p>
  </section>;
}

export default function PipelineVisualizer() {
  const state = usePipelineStore();
  const snapshot = getPipelineSnapshot(state.execution, state.cycle);
  usePipelinePlayback();
  useEffect(() => { document.title = 'Pipeline Visualizer · Architecture Visual Lab'; return () => usePipelineStore.getState().pause(); }, []);
  const selected = state.execution.instructions.find(instruction => instruction.id === state.selectedInstructionId);
  const detectedRegisters = Array.from(new Set(snapshot.detectedHazards.map(hazard => hazard.register)));
  const complete = state.cycle === state.execution.totalCycles;
  return <div className="lab-page pipeline-page" data-visualizer="pipeline" data-cycle={state.cycle} data-playing={state.playing}>
    <header className="lab-header"><Brand /><div className="lab-breadcrumb"><span>实验室</span><ChevronRight size={14} /><strong>Pipeline Visualizer</strong></div><Link to="/" className="back-home"><ArrowLeft size={14} /> 返回课程</Link></header>
    <div className="lab-layout"><Sidebar moduleId="pipeline" /><main className="lab-main pipeline-main">
      <div className="lab-title"><div><h1>Pipeline Visualizer</h1><p>五级流水线 <span>· IF → ID → EX → MEM → WB</span></p></div><span className="model-badge"><span className="status-dot" /> 周期同步模型</span></div>
      <div className="pipeline-model-note"><Info size={14} /><span>理想调度 · 仅检测冒险</span></div>
      <section className="pipeline-scene-section" aria-label="CPU Pipeline 3D 模型"><div className="pipeline-section-heading"><div><h2>CPU Pipeline <span className="pipeline-3d-badge">3D</span></h2></div><span className="pipeline-scene-cycle" aria-live="polite">{state.cycle ? `Cycle ${state.cycle}` : 'Ready'}</span></div>
        <div className="pipeline-scene-viewport"><PipelineScene execution={state.execution} snapshot={snapshot} selectedInstructionId={state.selectedInstructionId} onSelectInstruction={state.selectInstruction} /></div>
        <div className="pipeline-stage-legend">{PIPELINE_STAGES.map(stage => <span key={stage.id} style={stageStyle(stage.color)}><i /><strong>{stage.id}</strong><small>{stage.label}</small></span>)}</div>
        <div className="pipeline-scene-caption">{selected ? <><code>{selected.text}</code><span>路径已高亮</span><button onClick={() => state.selectInstruction(null)} aria-label="Pipeline Clear Scene Selection"><X size={13} /> 取消选择</button></> : <><span>不同阶段，并行推进。</span><span>点击指令追踪路径</span></>}</div>
      </section>
      <div className={`pipeline-hazard-banner ${snapshot.detectedHazards.length ? 'has-hazard' : ''}`} data-result={snapshot.detectedHazards.length ? 'RAW' : 'pending'} aria-live="polite">{snapshot.detectedHazards.length ? <><AlertTriangle size={17} /><strong>RAW Hazard</strong><code>{detectedRegisters.map(register => `R${register}`).join(' · ')}</code><span>{snapshot.activeHazards.length ? '读取早于 WB。' : '已记录 RAW，调度未修复。'}</span></> : <><Layers3 size={16} /><strong>{state.cycle ? '检测中' : '准备就绪'}</strong><span>ID 读取，对照前条指令 WB。</span></>}</div>
      <TimingDiagram state={state} snapshot={snapshot} />
      <section className="pipeline-program-section"><div className="pipeline-section-heading"><h3>切换教学示例</h3><span>每个周期发射一条</span></div><div className="pipeline-presets">{PIPELINE_PRESETS.map(preset => <button key={preset.id} data-preset={preset.id} aria-label={`Pipeline Preset ${preset.id}`} className={state.execution.instructions.map(instruction => instruction.text).join('\n') === preset.program ? 'is-selected' : ''} onClick={() => state.loadPreset(preset.id)}><strong>{preset.title}</strong><small>{preset.description}</small></button>)}</div>
        <details className="pipeline-editor"><summary>编辑指令序列 <span>最多 8 条</span></summary><form onSubmit={event => { event.preventDefault(); state.applyProgram(); }}><label htmlFor="pipeline-program">每行一条指令</label><textarea id="pipeline-program" aria-label="Pipeline Program" aria-describedby="pipeline-program-help" value={state.programText} onChange={event => state.setProgramText(event.target.value)} rows={4} spellCheck={false} /><div id="pipeline-program-help" className={state.error ? 'instruction-error' : 'instruction-helper'} role={state.error ? 'alert' : undefined}>{state.error || 'ADD / SUB / LOAD / STORE / MOV；如 LOAD R6,0(R2)。应用后从 Cycle 0 开始。'}</div><button className="button" type="submit" aria-label="Pipeline Apply Program">应用指令序列 <ArrowRight size={14} /></button></form></details>
      </section>
    </main><PipelineInspector state={state} snapshot={snapshot} /></div>
    <section className="timeline pipeline-controls" aria-label="流水线周期与播放控制"><div className="playback"><div className="playback-buttons"><button className="pipeline-cycle-button" disabled={state.cycle === 0} onClick={state.previous} aria-label="Pipeline Previous Cycle"><ChevronLeft size={18} /><span>Previous Cycle</span></button><button className="button play-button" onClick={state.playing ? state.pause : state.play} aria-label={state.playing ? 'Pipeline Pause' : 'Pipeline Play'}>{state.playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}<span>{state.playing ? '暂停' : '播放'}</span></button><button className="pipeline-cycle-button" onClick={state.next} disabled={complete} aria-label="Pipeline Next Cycle"><span>Next Cycle</span><ChevronRight size={18} /></button><span className="control-divider" /><button className="text-button reset-button" onClick={state.reset} aria-label="Pipeline Reset"><RotateCcw size={15} /><span>重置</span></button></div><div className="playback-right"><label className="speed-label">播放速度<select aria-label="Pipeline Playback Speed" value={state.speed} onChange={event => state.setSpeed(Number(event.target.value))}><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label><span className="pipeline-cycle-counter mono" data-current-cycle={state.cycle}>{state.cycle} / {state.execution.totalCycles}</span></div></div></section>
  </div>;
}
