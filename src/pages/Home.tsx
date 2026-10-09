import { Suspense, lazy } from 'react';
import { ArrowDown, ArrowRight, Box, ChevronRight, Layers3, MousePointer2, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/layout/Brand';
import { SceneBoundary } from '../components/layout/SceneBoundary';
import { courseModules } from '../data/modules';

const CPUScene = lazy(() => import('../components/three/CPUScene'));

export default function Home() {
  return <div className="home-page">
    <header className="home-header container">
      <Brand />
      <nav aria-label="主导航"><a href="#courses" onClick={(event) => { event.preventDefault(); document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth' }); }}>课程模块</a><Link className="header-lab-link" to="/lab">打开实验室 <ArrowRight size={15} /></Link></nav>
    </header>
    <main>
      <section className="hero container" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow"><span className="status-dot" /> INTERACTIVE LEARNING LAB</div>
          <h1 id="hero-title">看见 CPU 内部<br />真正发生了<span className="title-accent">什么。</span></h1>
          <p className="hero-english">Computer Architecture<br />Visual Lab</p>
          <p className="hero-description">让抽象原理变得触手可及。走进三维数据通路，<br className="desktop-break" />跟随一条指令，理解每一次计算。</p>
          <div className="hero-actions"><Link to="/lab?module=instruction" className="button primary">开始探索 <ArrowRight size={17} /></Link><a href="#courses" className="text-button" onClick={(event) => { event.preventDefault(); document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth' }); }}>浏览课程 <ArrowDown size={15} /></a></div>
          <div className="hero-meta"><span><Box size={14} /> 可交互 3D 模型</span><span><Play size={13} /> 逐步指令执行</span></div>
        </div>
        <div className="hero-visual">
          <div className="scene-topline"><span><span className="tiny-square" /> CPU DATAPATH</span><span>MODEL 01 / 32-BIT</span></div>
          <div className="home-scene"><SceneBoundary><Suspense fallback={<div className="scene-loading">正在构建 CPU 场景…</div>}><CPUScene compact /></Suspense></SceneBoundary></div>
          <div className="scene-caption"><span><MousePointer2 size={13} /> 拖动旋转 · 滚轮缩放</span><span className="mono">PC → IR → ALU → REG</span></div>
        </div>
      </section>
      <section className="curriculum container" id="courses" aria-labelledby="courses-title">
        <div className="section-heading"><div><span className="eyebrow muted">FROM STRUCTURE TO EXECUTION</span><h2 id="courses-title">从一条指令，理解一台计算机。</h2></div><div className="course-count"><span>03</span> / 10 模块已开放</div></div>
        <div className="course-grid">
          {courseModules.map((module, index) => {
            const content = <><div className="course-card-top"><span className="course-number">{String(index + 1).padStart(2, '0')}</span>{module.available ? <ChevronRight size={16} /> : <span className="course-status">下一阶段</span>}</div><h3>{module.title}</h3><p>{module.subtitle}</p><div className="course-card-bottom">{module.available ? <><span className="available-dot" /> 进入实验</> : '课程规划'}</div></>;
            return module.available ? <Link className={`course-card available ${index === 2 ? 'featured' : ''}`} key={module.id} to={`/lab?module=${module.id}`}>{content}</Link> : <article className="course-card planned" key={module.id}>{content}</article>;
          })}
        </div>
      </section>
      <section className="learning-note container"><Layers3 size={24} /><div><h3>不止看模型，更要看懂过程。</h3><p>选择一个组件，观察一次数据流，用播放与单步控制把每个执行阶段拆开理解。</p></div><Link to="/lab?module=instruction">运行你的第一条 ADD <ArrowRight size={16} /></Link></section>
    </main>
    <footer className="home-footer container"><span>ARCHITECTURE VISUAL LAB</span><span>计算机组成原理 · 第一阶段</span><span>在浏览器中探索，无需后端</span></footer>
  </div>;
}
