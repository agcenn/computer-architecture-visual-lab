import { ArrowUpRight, BookOpen, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { courseModules } from '../../data/modules';

export function Sidebar({ moduleId }: { moduleId: string }) {
  return <aside className="sidebar" aria-label="课程导航">
    <div className="sidebar-heading"><BookOpen size={15} /><span>学习路径</span><span className="sidebar-count">10</span></div>
    <nav>{courseModules.map((module, index) => module.available ?
      <Link key={module.id} to={`/lab?module=${module.id}`} className={`module-link ${module.id === moduleId ? 'active' : ''}`} aria-current={module.id === moduleId ? 'page' : undefined}><span className="module-index">{String(index + 1).padStart(2, '0')}</span><span><strong>{module.subtitle}</strong><small>{module.title}</small></span><ChevronRight size={13} /></Link> :
      <div key={module.id} className="module-link unavailable" title="第二阶段课程规划"><span className="module-index">{String(index + 1).padStart(2, '0')}</span><span><strong>{module.subtitle}</strong><small>{module.title}</small></span><span className="planned-dot" /></div>
    )}</nav>
    <div className="sidebar-bottom"><span className="eyebrow muted">YOUR FIRST INSTRUCTION</span><code>ADD R1, R2, R3</code><p>5 + 7，经历了哪些步骤？</p><Link to="/lab?module=instruction">开始逐步执行 <ArrowUpRight size={14} /></Link></div>
  </aside>;
}
