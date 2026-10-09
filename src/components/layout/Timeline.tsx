import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { executionStages } from '../../data/instructions';
import { useCPUStore } from '../../store/cpuStore';
import type { CPUSpeed } from '../../types/cpu';

export function Timeline() {
  const { step, playing, speed, previous, next, play, pause, reset, setSpeed } = useCPUStore();
  return <section className="timeline" aria-label="执行时间线和播放控制">
    <div className="timeline-stages">{executionStages.map((stage, index) => <div className={`timeline-stage ${step === index ? 'current' : ''} ${step > index ? 'completed' : ''}`} key={stage.id}><span className="stage-circle">{String(index + 1).padStart(2, '0')}</span><div><strong>{stage.label}</strong><small>{stage.title}</small></div>{index < 4 && <span className="stage-connector" />}</div>)}</div>
    <div className="playback"><div className="playback-buttons"><button className="icon-button" onClick={previous} disabled={step < 0} aria-label="Previous Step" title="上一步"><ChevronLeft size={19} /></button><button className="button play-button" onClick={playing ? pause : play} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}<span>{playing ? '暂停' : step === 4 ? '重播' : '播放'}</span></button><button className="icon-button" onClick={next} disabled={step === 4} aria-label="Next Step" title="下一步"><ChevronRight size={19} /></button><span className="control-divider" /><button className="text-button reset-button" onClick={reset} aria-label="Reset"><RotateCcw size={15} /> 重置</button></div><div className="playback-right"><label className="speed-label">播放速度 <select aria-label="播放速度" value={speed} onChange={(event) => setSpeed(Number(event.target.value) as CPUSpeed)}><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label><span className="step-counter mono">{step < 0 ? 'READY' : `STEP ${step + 1} / 5`}</span></div></div>
  </section>;
}
