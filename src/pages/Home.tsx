import { Suspense, lazy, useEffect, type MouseEvent } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, MousePointer2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/layout/Brand';
import { SceneBoundary } from '../components/layout/SceneBoundary';
import { courseModules } from '../data/modules';
import architectureCover from '../assets/visuals/architecture-cover.webp';
import cacheCover from '../assets/visuals/cache-cover.webp';
import pipelineCover from '../assets/visuals/pipeline-cover.webp';
import './Home.css';

const CPUScene = lazy(() => import('../components/three/CPUScene'));

const courseDescriptions: Record<string, string> = {
  overview: '认识组件，理解它们如何协作。',
  datapath: '沿着连线，观察信号如何传递。',
  instruction: '单步运行指令，看清每次状态变化。',
  cache: '拆分地址，观察命中与主存回填。',
  pipeline: '逐周期推进，理解并行与数据依赖。',
};

const courseCovers: Record<string, string> = {
  overview: architectureCover,
  cache: cacheCover,
  pipeline: pipelineCover,
};

function scrollToCourses(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth' });
}

function CourseIllustration({ moduleId }: { moduleId: string }) {
  if (courseCovers[moduleId]) {
    return <div className={`apple-course-art apple-course-image apple-cover-${moduleId}`}>
      <img src={courseCovers[moduleId]} alt="" width={1600} height={900} loading="lazy" decoding="async" />
    </div>;
  }
  if (moduleId === 'datapath') {
    return <div className="apple-course-art apple-datapath-art" aria-hidden="true">
      <div className="apple-data-node">R2 · R3</div>
      <span className="apple-data-line" />
      <div className="apple-data-node apple-data-node-main">ALU</div>
      <span className="apple-data-line" />
      <div className="apple-data-node">R1</div>
    </div>;
  }
  return <div className="apple-course-art apple-instruction-art" aria-hidden="true">
    <div className="apple-add-equation"><span>5</span><span>+</span><span>7</span><span>=</span><strong>12</strong></div>
    <code>ADD R1, R2, R3</code>
  </div>;
}

export default function Home() {
  useEffect(() => { document.title = 'Computer Architecture Visual Lab · 计算机组成原理实验室'; }, []);
  const availableCourses = courseModules.filter((module) => module.available);
  const plannedCourses = courseModules.filter((module) => !module.available);

  return <div className="apple-home">
    <header className="apple-header">
      <div className="apple-header-inner">
        <Brand />
        <nav aria-label="主导航">
          <a className="apple-nav-courses" href="#courses" onClick={scrollToCourses}>课程</a>
          <Link className="apple-nav-lab" to="/lab">打开实验室 <ChevronRight size={14} /></Link>
        </nav>
      </div>
    </header>

    <main>
      <section className="apple-hero" aria-labelledby="hero-title">
        <div className="apple-hero-inner">
          <div className="apple-hero-copy">
            <p className="apple-eyebrow">计算机组成原理 · 可视化实验</p>
            <h1 id="hero-title">看见计算，<br />理解原理。</h1>
            <p className="apple-hero-description">从 CPU 到缓存与流水线，边看边学。</p>
            <div className="apple-hero-actions">
              <Link to="/lab?module=instruction" className="apple-primary-link">开始探索 <ArrowRight size={16} /></Link>
              <a href="#courses" className="apple-inline-link" onClick={scrollToCourses}>选择课程 <ChevronRight size={16} /></a>
            </div>
          </div>
          <div className="apple-hero-media" aria-hidden="true">
            <img src={architectureCover} alt="" width={1600} height={900} fetchPriority="high" decoding="async" />
          </div>
        </div>
      </section>

      <section className="apple-courses" id="courses" aria-labelledby="courses-title">
        <div className="apple-section-heading">
          <h2 id="courses-title">选择你的探索起点。</h2>
          <span>{availableCourses.length} 个实验已开放</span>
        </div>
        <div className="apple-course-grid">
          {availableCourses.map((module) => <Link className={`apple-course-card apple-course-${module.id}`} key={module.id} to={`/lab?module=${module.id}`} data-course={module.id}>
            <CourseIllustration moduleId={module.id} />
            <div className="apple-course-copy">
              <h3>{module.subtitle}</h3>
              <p className="apple-course-description">{courseDescriptions[module.id]}</p>
              <span className="apple-course-link">进入实验 <ChevronRight size={15} /></span>
            </div>
          </Link>)}
        </div>
      </section>

      <section className="apple-interactive" aria-labelledby="interactive-title">
        <div className="apple-interactive-inner">
          <div className="apple-interactive-copy">
            <p className="apple-eyebrow">3D 教学模型</p>
            <h2 id="interactive-title">看清 CPU 内部。</h2>
            <p>拖动模型，点击组件。</p>
            <Link className="apple-inline-link" to="/lab?module=datapath">打开数据通路 <ChevronRight size={16} /></Link>
          </div>
          <div className="apple-product-showcase">
            <div className="apple-product-scene">
              <SceneBoundary><Suspense fallback={<div className="apple-scene-loading">正在构建 CPU 场景…</div>}><CPUScene compact /></Suspense></SceneBoundary>
            </div>
            <div className="apple-product-caption"><MousePointer2 size={12} /><span>拖动旋转 · 滚轮缩放</span></div>
          </div>
        </div>
      </section>

      <section className="apple-roadmap" aria-label="课程规划">
        <details className="apple-roadmap-details">
          <summary><span><strong>后续课程</strong><small>{plannedCourses.length} 个模块规划中</small></span><ChevronDown size={17} /></summary>
          <div className="apple-roadmap-list">
            {plannedCourses.map((module) => <article className="apple-roadmap-row" key={module.id}>
              <h3>{module.subtitle}</h3>
              <span className="apple-roadmap-status">规划中</span>
            </article>)}
          </div>
        </details>
      </section>
    </main>

    <footer className="apple-footer">
      <div className="apple-footer-inner"><p>Computer Architecture Visual Lab</p><span>{courseModules.length} 个模块 · {availableCourses.length} 个已开放</span><Link to="/lab">打开实验室 <ChevronRight size={12} /></Link></div>
    </footer>
  </div>;
}
