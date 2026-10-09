import { Cpu } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Brand() {
  return <Link to="/" className="brand" aria-label="Computer Architecture Visual Lab 首页">
    <span className="brand-mark"><Cpu size={23} strokeWidth={1.6} /></span>
    <span>Architecture<span className="brand-secondary">Visual Lab</span></span>
  </Link>;
}
