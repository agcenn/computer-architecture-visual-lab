import { Component, type ErrorInfo, type ReactNode } from 'react';

export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Lab rendering error', error, info); }
  render() {
    if (this.state.failed) return (
      <div className="render-error" role="alert">
        <strong>暂时无法显示这个视图</strong>
        <p>请使用支持 WebGL 2 的浏览器并开启硬件加速，再重新加载。</p>
        <button className="button secondary" onClick={() => window.location.reload()}>重新加载</button>
      </div>
    );
    return this.props.children;
  }
}
