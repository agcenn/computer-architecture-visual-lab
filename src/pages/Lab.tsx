import { Suspense, lazy, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, Info } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Brand } from '../components/layout/Brand';
import { Inspector } from '../components/layout/Inspector';
import { Sidebar } from '../components/layout/Sidebar';
import { Timeline } from '../components/layout/Timeline';
import { SceneBoundary } from '../components/layout/SceneBoundary';
import { executionStages, getStepDetails } from '../data/instructions';
import { courseModules } from '../data/modules';
import { useCPUStore } from '../store/cpuStore';
import { InstructionInput, OperandEditor, useInstructionPlayback } from '../experiments/instruction/InstructionVisualizer';

const CPUScene = lazy(() => import('../components/three/CPUScene'));
const CacheVisualizer = lazy(() => import('../experiments/cache/CacheVisualizer'));
const PipelineVisualizer = lazy(() => import('../experiments/pipeline/PipelineVisualizer'));
type TeachingTab = 'concept' | 'visualization' | 'experiment';
const concepts: Record<string, { title: string; intro: string; cards: [string, string][] }> = {
  overview: { title: '计算机，如何协作？', intro: '认识 CPU、存储器和总线，观察它们如何协作。', cards: [['CPU', '控制单元调度，ALU 运算，寄存器保存当前数据。'], ['存储', '保存指令与数据；Cache 减少主存访问。'], ['总线', '传递地址、数据与控制信号。']] },
  datapath: { title: '沿着线路，跟随数据。', intro: '看数据如何进入 ALU，再回到寄存器。', cards: [['取指与译码', 'PC 指出地址，IR 展示指令，控制单元生成信号。'], ['读取与执行', '寄存器提供操作数，MUX 选择输入，ALU 完成运算。'], ['结果写回', '选择 ALU 或内存结果，写入目标寄存器。']] },
  instruction: { title: '一条指令，六个观察点。', intro: '逐步观察寄存器、内存和 PC 的变化。', cards: [['取指与译码', 'PC 指出地址，IR 展示指令，控制单元生成执行信号。'], ['读取与执行', '寄存器提供操作数，ALU 运算或计算访存地址。'], ['访存与写回', 'LOAD 读取、STORE 写入；其余指令跳过访存。完成后 PC 前进 4 字节。']] },
};

export default function Lab() {
  const [searchParams] = useSearchParams();
  const requestedModule = searchParams.get('module') || 'instruction';
  const moduleId = courseModules.some(module => module.id === requestedModule && module.available) ? requestedModule : 'instruction';
  const module = courseModules.find(item => item.id === moduleId)!;
  const [tab, setTab] = useState<TeachingTab>('visualization');
  const state = useCPUStore();
  const details = getStepDetails(state);
  const independentModule = moduleId === 'cache' || moduleId === 'pipeline';
  useInstructionPlayback(!independentModule);
  useEffect(() => { if (independentModule) state.pause(); }, [independentModule, state.pause]);
  useEffect(() => { document.title = `${module.subtitle} · Architecture Visual Lab`; }, [module.subtitle]);
  if (moduleId === 'cache') return <SceneBoundary><Suspense fallback={<div className="page-loading"><span className="loading-dot" />正在加载 Cache 实验室…</div>}><CacheVisualizer /></Suspense></SceneBoundary>;
  if (moduleId === 'pipeline') return <SceneBoundary><Suspense fallback={<div className="page-loading"><span className="loading-dot" />正在加载 Pipeline 实验室…</div>}><PipelineVisualizer /></Suspense></SceneBoundary>;
  const concept = concepts[moduleId];
  const tabs: [TeachingTab, string][] = [['concept', '原理'], ['visualization', '可视化'], ['experiment', '实验']];
  return <div className="lab-page">
    <header className="lab-header"><Brand /><div className="lab-breadcrumb"><span>实验室</span><ChevronRight size={14} /><strong>{module.subtitle}</strong></div><Link to="/" className="back-home"><ArrowLeft size={14} /> 返回课程</Link></header>
    <div className="lab-layout"><Sidebar moduleId={moduleId} /><main className="lab-main">
      <div className="lab-title"><div><h1>{module.subtitle}</h1><p>{module.title}</p></div><span className="model-badge"><span className="status-dot" /> 交互式模型</span></div>
      <div className="teaching-tabs" role="tablist" aria-label="教学模式">{tabs.map(([id, label]) => <button id={`tab-${id}`} key={id} role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`} tabIndex={tab === id ? 0 : -1} className={tab === id ? 'active' : ''} onClick={() => setTab(id)} onKeyDown={event => { if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { event.preventDefault(); const index = tabs.findIndex(item => item[0] === id); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3; setTab(tabs[next][0]); document.getElementById(`tab-${tabs[next][0]}`)?.focus(); } }}><span>{label}</span></button>)}</div>
      <InstructionInput />
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className={`teaching-panel ${tab === 'concept' ? 'concept-panel' : ''}`}>
        {tab === 'concept' ? <article className="concept-content"><h2>{concept.title}</h2><p>{concept.intro}</p><div className="concept-cards">{concept.cards.map(([title, description]) => <section key={title}><h3>{title}</h3><p>{description}</p></section>)}</div><button className="button secondary" onClick={() => setTab('visualization')}>进入 3D 可视化 <ArrowRight size={15} /></button><details className="lab-model-details"><summary>模型说明</summary><p className="model-note">六步是同一条单周期指令的观察点，并非六个时钟周期。IR 用于教学展示；Previous 恢复完整 CPU 状态。</p></details></article> : <>
          {tab === 'experiment' && <OperandEditor />}
          <div className="lab-scene"><SceneBoundary><Suspense fallback={<div className="scene-loading">正在加载 3D 数据通路…</div>}><CPUScene /></Suspense></SceneBoundary></div>
          <div className="teaching-hint" aria-live="polite"><span className="hint-icon"><Info size={16} /></span><div><strong>{state.step < 0 ? '跟随一条指令。' : `${String(state.step + 1).padStart(2, '0')} / ${details.label}`}</strong><p>{state.step < 0 ? '选择指令，点击 Run 或下一步。' : details.description}</p>{state.step >= 0 && <code className="hint-values">{details.lines.join(' · ')}</code>}</div><span className={`execution-status ${state.playing ? 'playing' : ''}`}><span className="status-dot" />{state.step === executionStages.length - 1 ? 'COMPLETE' : state.playing ? 'RUNNING' : state.step < 0 ? 'READY' : 'PAUSED'}</span></div>
        </>}
      </div>
    </main><Inspector /></div><Timeline />
  </div>;
}
