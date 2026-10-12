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
  overview: { title: '一台计算机，如何协同工作？', intro: 'CPU 执行指令，存储器保存指令与数据，总线连接各个模块。这个模型把它们拆开，让连接和数据流可见。', cards: [['CPU', '控制单元决定做什么，ALU 完成运算，寄存器保存当前需要的数据。'], ['存储', '指令存储器提供程序；数据存储器保存运算需要的内容。Cache 缩短访存等待。'], ['总线', '地址指出去哪里，数据承载传输内容，控制信号决定何时读写。']] },
  datapath: { title: '数据通路，就是数据走过的路。', intro: '一条 ADD 指令把两个寄存器的值送入 ALU，再把结果送回目标寄存器。控制单元根据指令产生控制信号，决定 MUX 选择、ALU 操作和寄存器写入。', cards: [['取指与译码', 'PC 给出指令地址，Instruction Memory 提供指令；IR 显示指令字段，Control Unit 内的 Decoder 完成译码。'], ['读取与执行', 'Register File 的读端口 A 直接送入 ALU；读端口 B 经过 ALUSrc MUX，ADD 选择寄存器值进行 32 位加法。'], ['结果写回', 'Write Back 根据 MemtoReg 选择 ALU 结果或内存读数。ADD 选择 ALU 结果写入 rd，PC 前进 4 字节，Data Memory 保持未启用。']] },
  instruction: { title: '一条指令，六个可观察的步骤。', intro: '选择 ADD、SUB、LOAD、STORE 或 MOV，观察一条指令如何改变真实的 CPU 状态。默认 R2 = 5、R3 = 7，内存 0x1000 = 42。', cards: [['01 · FETCH / 02 · DECODE', 'PC 指定本次取指地址，指令进入 IR。译码得到寄存器编号、地址与控制信号。'], ['03 · REGISTER READ / 04 · EXECUTE', '读取操作数，展示 ALU 输入、操作与结果。ADD 得到 5 + 7 = 12，SUB 得到 5 − 7 = −2；访存指令计算地址。'], ['05 · MEMORY / 06 · WRITE BACK', 'LOAD 读取内存后写回寄存器；STORE 修改内存；算术和 MOV 跳过访存。指令完成后 PC 前进 4。Previous 恢复上一观察点的完整状态。']] },
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
  const tabs: [TeachingTab, string, string][] = [['concept', 'Concept', '原理'], ['visualization', 'Visualization', '可视化'], ['experiment', 'Experiment', '实验']];
  return <div className="lab-page">
    <header className="lab-header"><Brand /><div className="lab-breadcrumb"><span>实验室</span><ChevronRight size={14} /><strong>{module.subtitle}</strong></div><Link to="/" className="back-home"><ArrowLeft size={14} /> 返回课程</Link></header>
    <div className="lab-layout"><Sidebar moduleId={moduleId} /><main className="lab-main">
      <div className="lab-title"><div><span className="eyebrow muted">COMPUTER ARCHITECTURE</span><h1>{module.subtitle}</h1><p>{module.title} <span>· 教学型 32-bit CPU</span></p></div><span className="model-badge"><span className="status-dot" /> 交互式模型</span></div>
      <div className="teaching-tabs" role="tablist" aria-label="教学模式">{tabs.map(([id, label, chinese]) => <button id={`tab-${id}`} key={id} role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`} tabIndex={tab === id ? 0 : -1} className={tab === id ? 'active' : ''} onClick={() => setTab(id)} onKeyDown={event => { if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { event.preventDefault(); const index = tabs.findIndex(item => item[0] === id); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3; setTab(tabs[next][0]); document.getElementById(`tab-${tabs[next][0]}`)?.focus(); } }}><span>{chinese}</span><small>{label}</small></button>)}</div>
      <InstructionInput />
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className={`teaching-panel ${tab === 'concept' ? 'concept-panel' : ''}`}>
        {tab === 'concept' ? <article className="concept-content"><span className="eyebrow">THE BIG IDEA</span><h2>{concept.title}</h2><p>{concept.intro}</p><div className="concept-cards">{concept.cards.map(([title, description]) => <section key={title}><h3>{title}</h3><p>{description}</p></section>)}</div><button className="button secondary" onClick={() => setTab('visualization')}>进入 3D 可视化 <ArrowRight size={15} /></button><p className="model-note">六步动画用于分步观察一条指令，不代表六个时钟周期或六级流水线。IR 是教学展示点。Previous 会恢复寄存器、内存、PC 与执行中的状态。</p></article> : <>
          {tab === 'experiment' && <OperandEditor />}
          <div className="lab-scene"><SceneBoundary><Suspense fallback={<div className="scene-loading">正在加载 3D 数据通路…</div>}><CPUScene /></Suspense></SceneBoundary></div>
          <div className="teaching-hint" aria-live="polite"><span className="hint-icon"><Info size={16} /></span><div><strong>{state.step < 0 ? '准备好，跟随一条指令。' : `${String(state.step + 1).padStart(2, '0')} / ${details.label}`}</strong><p>{state.step < 0 ? '选择指令，点击 Run 或下一步开始。当前步骤会同步更新 3D 数据通路与右侧 CPU 状态。' : details.description}</p>{state.step >= 0 && <code className="hint-values">{details.lines.join(' · ')}</code>}</div><span className={`execution-status ${state.playing ? 'playing' : ''}`}><span className="status-dot" />{state.step === executionStages.length - 1 ? 'COMPLETE' : state.playing ? 'RUNNING' : state.step < 0 ? 'READY' : 'PAUSED'}</span></div>
        </>}
      </div>
    </main><Inspector /></div><Timeline />
  </div>;
}
