import { Suspense, lazy, useEffect, type CSSProperties, type MouseEvent } from 'react';
import { ArrowRight, ChevronRight, MousePointer2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/layout/Brand';
import { SceneBoundary } from '../components/layout/SceneBoundary';
import { courseModules } from '../data/modules';
import './Home.css';

const CPUScene = lazy(() => import('../components/three/CPUScene'));

const courseDescriptions: Record<string, string> = {
  overview: '从整体开始。认识 CPU 中的每个组件，了解它们如何一起工作。',
  datapath: '让数据流动起来。沿着连接，观察地址、数据与控制信号的传递。',
  instruction: '跟随一条 ADD 指令。从取指到写回，亲手走完一次计算。',
  cache: '理解一次命中。拆分地址，观察缓存查找、主存回填与数据返回。',
  pipeline: '让指令并行前进。逐周期观察五级流水，发现寄存器之间的数据依赖。',
};

function scrollToCourses(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth' });
}

function CourseIllustration({ moduleId }: { moduleId: string }) {
  if (moduleId === 'pipeline') return <div className="apple-course-art apple-pipeline-art" aria-hidden="true"><div className="apple-pipeline-stages">{['IF','ID','EX','MEM','WB'].map((stage, index) => <span key={stage} style={{ '--pipeline-art-color': ['#1676e8','#9659cc','#d68b21','#28946c','#249aab'][index] } as CSSProperties}>{stage}</span>)}</div><div className="apple-pipeline-waves"><i /><i /><i /></div><span>ONE CYCLE. MULTIPLE INSTRUCTIONS.</span></div>;
  if (moduleId === 'cache') return <div className="apple-course-art apple-cache-art" aria-hidden="true"><div className="apple-cache-cpu">CPU</div><span className="apple-cache-arrow">↓</span><div className="apple-cache-mini"><span>L1 CACHE</span><div><i /><i className="hit" /><i /><i /></div></div><span className="apple-cache-hit">CACHE HIT</span></div>;
  if (moduleId === 'overview') {
    return <div className="apple-course-art apple-overview-art" aria-hidden="true">
      <div className="apple-mini-board">
        <span className="apple-mini-chip apple-mini-chip-cpu">CPU</span>
        <span className="apple-mini-chip apple-mini-chip-memory">MEMORY</span>
        <span className="apple-mini-chip apple-mini-chip-io">I/O</span>
        <span className="apple-mini-trace apple-mini-trace-one" />
        <span className="apple-mini-trace apple-mini-trace-two" />
      </div>
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
    <div className="apple-instruction-progress"><i /><i /><i /><i /><i /><i /></div>
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
        <div className="apple-hero-copy">
          <p className="apple-eyebrow">Computer Architecture Visual Lab</p>
          <h1 id="hero-title">让计算机组成，<br />一目了然。</h1>
          <p className="apple-hero-description">走进 CPU 的内部。<br className="apple-mobile-break" />让抽象的原理，成为看得见的过程。</p>
          <div className="apple-hero-actions">
            <Link to="/lab?module=instruction" className="apple-primary-link">开始探索 <ArrowRight size={16} /></Link>
            <a href="#courses" className="apple-inline-link" onClick={scrollToCourses}>了解课程 <ChevronRight size={17} /></a>
          </div>
        </div>
        <div className="apple-product-showcase">
          <div className="apple-product-scene">
            <SceneBoundary><Suspense fallback={<div className="apple-scene-loading">正在构建 CPU 场景…</div>}><CPUScene compact /></Suspense></SceneBoundary>
          </div>
          <div className="apple-product-caption"><span>你的第一台，透明的 CPU。</span><span><MousePointer2 size={13} /> 拖动旋转 · 滚轮缩放 · 点击组件</span></div>
        </div>
        <p className="apple-hero-footnote">可交互的 3D 教学模型。直接在浏览器中探索。</p>
      </section>

      <section className="apple-courses" id="courses" aria-labelledby="courses-title">
        <div className="apple-section-copy">
          <p className="apple-eyebrow">从理解，到亲手验证。</p>
          <h2 id="courses-title">以探索的方式，学习。</h2>
          <p>{availableCourses.length} 个起点。由你选择。</p>
        </div>
        <div className="apple-course-grid">
          {availableCourses.map((module, index) => <Link className="apple-course-card" key={module.id} to={`/lab?module=${module.id}`}>
            <div className="apple-course-copy">
              <p className="apple-course-kicker">{String(index + 1).padStart(2, '0')} / 已开放</p>
              <h3>{module.subtitle}</h3>
              <p className="apple-course-english">{module.title}</p>
              <p className="apple-course-description">{courseDescriptions[module.id]}</p>
            </div>
            <CourseIllustration moduleId={module.id} />
            <span className="apple-course-link">开始探索 <ChevronRight size={15} /></span>
          </Link>)}
        </div>
      </section>

      <section className="apple-learning" aria-labelledby="learning-title">
        <div className="apple-learning-inner">
          <div className="apple-learning-copy">
            <p className="apple-eyebrow">每一步，都可以慢下来。</p>
            <h2 id="learning-title">一条指令。<br />六步看懂执行。</h2>
            <p>取指、译码、读寄存器、执行、访存、写回。<br />用播放与单步控制，把每个阶段拆开看懂。</p>
            <Link className="apple-inline-link" to="/lab?module=instruction">运行你的第一条 ADD <ChevronRight size={17} /></Link>
          </div>
          <div className="apple-learning-diagram" aria-label="ADD 指令的六个教学阶段">
            <code>ADD R1, R2, R3</code>
            <ol>
              {['取指', '译码', '读寄存器', '执行', '访存', '写回'].map((stage, index) => <li key={stage}><span>{index + 1}</span><strong>{stage}</strong>{index < 5 && <ChevronRight size={16} />}</li>)}
            </ol>
            <div className="apple-learning-result"><span>R2 = 5</span><span>R3 = 7</span><strong>R1 = 12</strong></div>
          </div>
        </div>
      </section>

      <section className="apple-roadmap" aria-labelledby="roadmap-title">
        <div className="apple-section-copy">
          <p className="apple-eyebrow">课程路线</p>
          <h2 id="roadmap-title">接下来，继续深入。</h2>
          <p>{courseModules.length} 个课程模块，{availableCourses.length} 个已开放。<br className="apple-mobile-break" />以下 {plannedCourses.length} 个模块将在后续阶段提供。</p>
        </div>
        <div className="apple-roadmap-list">
          {plannedCourses.map((module, index) => <article className="apple-roadmap-row" key={module.id}>
            <span className="apple-roadmap-number">{String(index + availableCourses.length + 1).padStart(2, '0')}</span>
            <div><h3>{module.subtitle}</h3><p>{module.title}</p></div>
            <span className="apple-roadmap-status">规划中</span>
          </article>)}
        </div>
      </section>
    </main>

    <footer className="apple-footer">
      <div className="apple-footer-inner"><p>Computer Architecture Visual Lab</p><span>计算机组成原理 · 第一阶段</span><Link to="/lab">打开实验室 <ChevronRight size={12} /></Link></div>
    </footer>
  </div>;
}
