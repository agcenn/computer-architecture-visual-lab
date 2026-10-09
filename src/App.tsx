import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SceneBoundary } from './components/layout/SceneBoundary';

const Home = lazy(() => import('./pages/Home'));
const Lab = lazy(() => import('./pages/Lab'));

export default function App() {
  return (
    <SceneBoundary>
      <Suspense fallback={<div className="page-loading"><span className="loading-dot" />正在加载实验室…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </SceneBoundary>
  );
}
