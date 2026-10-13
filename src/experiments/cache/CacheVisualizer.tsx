import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Cpu, HardDrive, Info, Layers3, Pause, Play, RotateCcw, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../../components/layout/Brand';
import { Sidebar } from '../../components/layout/Sidebar';
import { formatByte, formatCacheAddress, getCacheStepDetails, PRESET_ADDRESSES, readMemoryBlock, splitAddress } from '../../data/cache';
import { useCacheStore } from '../../store/cacheStore';
import cacheCover from '../../assets/visuals/cache-cover.webp';
import './CacheVisualizer.css';

type CacheStoreState = ReturnType<typeof useCacheStore.getState>;
const phaseLabels: Record<string, string> = { address: 'ADDRESS', split: 'SPLIT', index: 'INDEX', compare: 'COMPARE', 'memory-request': 'MEMORY READ', 'memory-to-cache': 'FILL BLOCK', 'cache-to-cpu': 'RETURN BYTE' };
const phaseModule: Record<string, string> = { address: 'CPU', split: 'ADDRESS', index: 'L1 CACHE', compare: 'L1 CACHE', 'memory-request': 'MAIN MEMORY', 'memory-to-cache': 'L1 CACHE', 'cache-to-cpu': 'CPU' };
const bitsInGroups = (bits: string) => bits.match(/.{1,4}/g)?.join(' ') || bits;
const tagHex = (tag: number | null) => tag === null ? '—' : `0x${tag.toString(16).toUpperCase().padStart(3, '0')}`;

function useCachePlayback() {
  const { playing, phase, speed, revision, next } = useCacheStore();
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(next, 1700 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, phase, speed, revision, next]);
}

function AddressBreakdown({ state }: { state: CacheStoreState }) {
  const fields = state.fields;
  return <section className={`cache-address-breakdown ${state.steps[state.phase]?.id === 'split' ? 'is-splitting' : ''}`} aria-label="地址拆分">
    <div className="cache-binary-heading"><span>16-BIT ADDRESS</span><code className="cache-binary">{fields ? bitsInGroups(fields.binary) : '—'}</code></div>
    <div className="cache-bit-fields" key={`bits-${state.revision}`}>
      <div className="cache-field tag" data-field="tag"><span>TAG <small>12 bit</small></span><code>{fields ? bitsInGroups(fields.tagBits) : '—'}</code><strong>{fields ? tagHex(fields.tag) : '—'}</strong></div>
      <div className="cache-field index" data-field="index"><span>INDEX <small>2 bit</small></span><code>{fields?.indexBits ?? '—'}</code><strong>{fields ? `Line ${fields.index}` : '—'}</strong></div>
      <div className="cache-field offset" data-field="offset"><span>OFFSET <small>2 bit</small></span><code>{fields?.offsetBits ?? '—'}</code><strong>{fields ? `Byte ${fields.offset}` : '—'}</strong></div>
    </div>
    <div className="cache-address-rule"><span>Tag 识别块</span><span>Index 选择行</span><span>Offset 选择字节</span></div>
  </section>;
}

function Transfer({ route, active, direction, label, kind }: { route: string; active: boolean; direction: 'down' | 'up'; label: string; kind: 'address' | 'memory' | 'data' }) {
  return <div className={`cache-transfer ${kind} ${active ? 'is-transferring' : ''} ${direction}`} data-route={route} data-active={active}>
    <svg viewBox="0 0 20 54" role="img" aria-label={active ? `${route}: ${label}` : `${route} 等待传输`}>
      <path className="cache-wire" d={direction === 'down' ? 'M10 1V49' : 'M10 53V5'} />
      <path className="cache-wire-arrow" d={direction === 'down' ? 'M6 44L10 49L14 44' : 'M6 10L10 5L14 10'} />
      {active && <><path className="cache-wire-active" d={direction === 'down' ? 'M10 1V49' : 'M10 53V5'} /><circle className="cache-transfer-token cache-animated" cx="10" cy={direction === 'down' ? 3 : 51} r="4" /></>}
    </svg>
    <span className="cache-transfer-label">{label}</span>
  </div>;
}

function CacheDiagram({ state, animationPaused }: { state: CacheStoreState; animationPaused: boolean }) {
  const details = getCacheStepDetails(state);
  const id: string = state.steps[state.phase]?.id ?? 'ready';
  const fields = state.currentAddress === null ? state.fields : splitAddress(state.currentAddress);
  const lineIndex = state.fields?.index ?? fields?.index;
  const comparisonLines = state.result ? state.accessHistory[state.accessIndex]?.baseline.lines ?? state.lines : state.lines;
  const candidate = fields ? comparisonLines[fields.index] : undefined;
  const selectedBlock = fields ? readMemoryBlock(fields.blockStart) : [];
  const activeCPU = id === 'address' || id === 'cache-to-cpu';
  const activeCache = ['split', 'index', 'compare', 'memory-to-cache', 'cache-to-cpu'].includes(id);
  const activeMemory = id === 'memory-request' || id === 'memory-to-cache';
  const blockText = details.block?.map(formatByte).join(' · ') || selectedBlock.map(formatByte).join(' · ');
  return <section className="cache-diagram" aria-label="CPU、L1 Cache 与主存数据通路" data-phase={id} data-animation-paused={animationPaused} key={`diagram-${state.revision}`}>
    <div className={`cache-cpu cache-shell ${activeCPU ? 'is-active' : ''}`} data-module="cpu">
      <div className="cache-chip-icon"><Cpu size={28} strokeWidth={1.5} /></div><div><h2>CPU</h2></div>
      <div className={`cache-cpu-data ${id === 'cache-to-cpu' ? 'is-returned' : ''}`}><span>{id === 'address' ? '发出地址' : id === 'ready' ? '最近收到的字节' : '收到的字节'}</span><code data-cpu-data={state.cpuData ?? ''}>{id === 'address' && fields ? formatCacheAddress(fields.address) : state.cpuData === null ? '—' : formatByte(state.cpuData)}</code></div>
    </div>
    <Transfer route={id === 'cache-to-cpu' ? 'cache-cpu' : 'cpu-cache'} active={details.route === 'cpu-cache' || details.route === 'cache-cpu'} direction={id === 'cache-to-cpu' ? 'up' : 'down'} label={id === 'cache-to-cpu' && state.cpuData !== null ? `${formatByte(state.cpuData)} → CPU` : fields ? `Address ${formatCacheAddress(fields.address)}` : 'Address'} kind={id === 'cache-to-cpu' ? 'data' : 'address'} />
    <div className={`cache-l1 cache-shell ${activeCache ? 'is-active' : ''} ${id === 'compare' ? 'is-comparing' : ''}`} data-module="cache">
      <div className="cache-shell-heading"><div><span className="cache-shell-eyebrow">DIRECT-MAPPED · 16 BYTES</span><h2>L1 Cache</h2></div><span className={`cache-verdict cache-result ${state.result ?? 'pending'}`} data-result={state.result ?? 'pending'}>{state.result === 'hit' ? <><Check size={13} /> CACHE HIT</> : state.result === 'miss' ? 'CACHE MISS' : id === 'compare' ? 'COMPARING' : '4 LINES'}</span></div>
      <table className="cache-lines" aria-label="Cache 内容"><thead><tr><th scope="col">Line</th><th scope="col">Valid</th><th scope="col">Tag</th><th scope="col">Data <small>4 bytes</small></th></tr></thead><tbody>{state.lines.map(line => <tr className={`cache-line ${lineIndex === line.line ? 'is-selected' : ''} ${lineIndex === line.line && id === 'index' ? 'is-indexing' : ''} ${lineIndex === line.line && id === 'memory-to-cache' ? 'is-filling' : ''}`} data-line={line.line} data-valid={line.valid ? 1 : 0} data-tag={line.tag ?? ''} aria-label={`Cache Line ${line.line}${lineIndex === line.line ? ' 已选中' : ''}`} key={line.line}>
        <th scope="row"><span className="cache-line-number">{line.line}</span>{lineIndex === line.line && <span className="cache-line-pointer"><ArrowRight size={13} /></span>}</th><td><span className={`cache-valid ${line.valid ? 'valid' : ''}`}>{line.valid ? '1' : '0'}</span></td><td className={`cache-line-tag ${lineIndex === line.line && id === 'compare' ? 'cache-animated' : ''}`}><code>{tagHex(line.tag)}</code></td><td><div className="cache-line-bytes">{line.data.map((byte, offset) => <code data-byte={offset} className={lineIndex === line.line && fields?.offset === offset ? 'selected-byte' : ''} key={offset}>{line.valid ? formatByte(byte) : '—'}</code>)}</div></td>
      </tr>)}</tbody></table>
      <div className="cache-compare-strip" aria-live="polite">{id === 'compare' || state.result ? <><span>比较时 Line {fields?.index}: Valid = {candidate?.valid ? '1' : '0'}</span><span><code>{candidate ? tagHex(candidate.tag) : '—'}</code><b>{state.result === 'hit' ? '=' : state.result === 'miss' ? '≠' : '?'}</b><code>{fields ? tagHex(fields.tag) : '—'}</code></span></> : <><span>{fields ? `Index ${fields.indexBits} → Line ${fields.index}` : 'Index 决定唯一的 Cache Line'}</span><span>Valid = 1 且 Tag 相同才命中</span></>}</div>
    </div>
    <div className="cache-memory-connection"><Transfer route="memory-request" active={details.route === 'memory-request'} direction="down" label={fields ? `Read block ${formatCacheAddress(fields.blockStart)}` : 'Read block'} kind="address" /><Transfer route="memory-cache" active={details.route === 'memory-cache'} direction="up" label={id === 'memory-to-cache' ? blockText : '4-byte block'} kind="memory" /></div>
    <div className={`cache-main-memory cache-shell ${activeMemory ? 'is-active' : ''}`} data-module="memory">
      <div className="cache-shell-heading"><div><span className="cache-shell-eyebrow">BYTE-ADDRESSED · 64 KB</span><h2><HardDrive size={17} /> Main Memory</h2></div><span className="cache-memory-note">{activeMemory ? '正在读取主存' : '保存完整数据'}</span></div>
      <div className="cache-memory-block" aria-label="请求的主存块">{selectedBlock.map((byte, offset) => <div className={fields?.offset === offset ? 'selected-byte' : ''} key={offset}><span>{fields ? formatCacheAddress(fields.blockStart + offset) : '—'}</span><code>{formatByte(byte)}</code></div>)}</div>
      <p>{fields ? `块 ${formatCacheAddress(fields.blockStart)} — ${formatCacheAddress(fields.blockStart + 3)}` : '输入地址，查看所在数据块'}</p>
    </div>
    <div className="cache-legend"><span><i className="address" /> 地址</span><span><i className="memory" /> 主存块</span><span><i className="data" /> 返回数据</span><span>灰色线路：当前未使用</span></div>
  </section>;
}

function CacheInspector({ state }: { state: CacheStoreState }) {
  const details = getCacheStepDetails(state);
  const fields = state.currentAddress === null ? state.fields : splitAddress(state.currentAddress);
  const comparisonLines = state.result ? state.accessHistory[state.accessIndex]?.baseline.lines ?? state.lines : state.lines;
  const line = fields ? comparisonLines[fields.index] : undefined;
  const comparisonsVisible = state.result !== null;
  const complete = state.phase >= 0 && state.phase === state.steps.length - 1;
  const history = state.accessHistory.filter((_, index) => index < state.accessIndex || index === state.accessIndex && (complete || state.phase < 0));
  const hitRate = state.hits + state.misses ? (state.hits / (state.hits + state.misses) * 100).toFixed(1).replace(/\.0$/, '') : '0';
  return <aside className="inspector cache-inspector" aria-label="Cache Inspector">
    <div className="inspector-heading"><span>Inspector</span><Layers3 size={16} /></div>
    <section className="cache-live-state"><div className="cache-inspector-stage"><span className="component-type">当前步骤</span><strong>{state.phase < 0 ? 'READY' : phaseLabels[details.id] || details.id}</strong></div><h2>{state.result === 'hit' ? 'Cache Hit' : state.result === 'miss' ? 'Cache Miss' : '等待访问'}</h2><p className="cache-inspector-description">{state.phase < 0 ? 'Index 选行，Offset 选字节。' : details.description}</p>
      <dl className="cache-state-list"><div><dt>Address</dt><dd data-inspector-address={fields?.address ?? ''}>{fields ? formatCacheAddress(fields.address) : '—'}</dd></div><div className="tag"><dt>Tag</dt><dd>{fields ? tagHex(fields.tag) : '—'}</dd></div><div className="index"><dt>Index</dt><dd>{fields ? `${fields.index} · Line ${fields.index}` : '—'}</dd></div><div className="offset"><dt>Offset</dt><dd>{fields ? `${fields.offset} · Byte ${fields.offset}` : '—'}</dd></div></dl>
    </section>
    <section className="cache-candidate"><div className="cache-inspector-section-heading"><h3>{comparisonsVisible ? '比较时的 Cache Line' : '候选 Cache Line'}</h3><span>{fields ? `LINE ${fields.index}` : '—'}</span></div><div className="cache-candidate-values"><div><span>Valid</span><code>{line?.valid ? '1' : '0'}</code></div><div><span>Stored Tag</span><code>{line ? tagHex(line.tag) : '—'}</code></div></div><p>{comparisonsVisible ? state.result === 'hit' ? 'Valid = 1，Tag 相同：直接返回。' : !line?.valid ? 'Valid = 0：从主存读取。' : 'Tag 不同：读取主存并替换此行。' : '等待 Valid 与 Tag 比较。'}</p></section>
    <section className="cache-statistics" aria-label="Cache 访问统计"><div className="cache-inspector-section-heading"><h3>访问统计</h3><span>已完成访问</span></div><div className="cache-stat-grid"><div className="cache-stat" data-stat="hits"><span>Hit</span><strong>{state.hits}</strong></div><div className="cache-stat" data-stat="misses"><span>Miss</span><strong>{state.misses}</strong></div><div className="cache-stat rate" data-stat="hit-rate"><span>Hit Rate</span><strong>{hitRate}%</strong></div></div><div className="cache-rate-track"><span style={{ width: `${state.hits + state.misses ? state.hits / (state.hits + state.misses) * 100 : 0}%` }} /></div><p>Hit / (Hit + Miss) · 返回 CPU 后计数</p></section>
    <section className="cache-inspector-lesson"><Info size={16} /><div><h3>为什么需要 Cache？</h3><p>就近取数，减少等待主存。</p><details className="cache-concept-details"><summary>原理与模型说明</summary><figure><img src={cacheCover} alt="Cache 与主存的概念插画" loading="lazy" decoding="async" width={1600} height={900} /><figcaption>概念插画</figcaption></figure><p>Cache 小而快。命中需 Valid = 1 且 Tag 相同；未命中时读取完整块，同块的其他字节也可能命中。</p><p className="cache-model-note">本模型只读，使用固定教学数据，不模拟真实访存延迟。</p></details></div></section>
    {history.length > 0 && <section className="cache-access-log"><div className="cache-inspector-section-heading"><h3>访问记录</h3><span>按完成顺序</span></div>{history.map((access, index) => { const last = access.steps[access.steps.length - 1].state; return <div key={`${index}-${access.address}`}><span>{String(index + 1).padStart(2, '0')}</span><code>{formatCacheAddress(access.address)}</code><strong className={last.result ?? ''}>{last.result === 'hit' ? 'HIT' : 'MISS'}</strong></div>; })}</section>}
  </aside>;
}

function PresetSequence({ state, onLoad, onNext }: { state: CacheStoreState; onLoad: () => void; onNext: () => void }) {
  const presetMode = state.presetIndex >= 0;
  const complete = state.phase >= 0 && state.phase === state.steps.length - 1;
  const lastPreset = presetMode && state.presetIndex === PRESET_ADDRESSES.length - 1;
  return <section className="cache-preset"><div className="cache-preset-heading"><div><h3>预设访问</h3><p>0x1000 / 0x2000 → Line 0；0x1004 → Line 1。</p></div><button className="text-button" onClick={onLoad} aria-label="Cache Preset"><RotateCcw size={13} /> 清空并载入预设</button></div><ol className="cache-preset-addresses" aria-label="预设访问序列">{PRESET_ADDRESSES.map((address, index) => { const execution = state.accessHistory.find(access => access.presetIndex === index); const finished = presetMode && execution && (index < state.presetIndex || index === state.presetIndex && complete); const result = finished ? execution.steps[execution.steps.length - 1].state.result : null; return <li className={`${presetMode && state.presetIndex === index ? 'current' : ''} ${result || ''}`} data-access={index} key={`${address}-${index}`}><span>{index + 1}</span><code>{formatCacheAddress(address)}</code><small>{result ? result.toUpperCase() : presetMode && state.presetIndex === index ? '当前访问' : '待访问'}</small></li>; })}</ol><button className="cache-next-access" onClick={onNext} disabled={!complete || lastPreset} aria-label="Cache Next Access">{presetMode ? lastPreset ? '预设访问已完成' : '下一次访问' : '再次访问这个地址'}<ArrowRight size={14} /></button></section>;
}

export default function CacheVisualizer() {
  const state = useCacheStore();
  const [animationPaused, setAnimationPaused] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const details = getCacheStepDetails(state);
  const complete = state.phase >= 0 && state.phase === state.steps.length - 1;
  const displayedSteps = state.result ? state.steps : state.steps.slice(0, 4);
  const canNextAccess = state.accessIndex + 1 < state.accessHistory.length || state.presetIndex >= 0 && state.presetIndex + 1 < state.presetAddresses.length;
  useCachePlayback();
  useEffect(() => { document.title = 'Cache Visualizer · Architecture Visual Lab'; return () => useCacheStore.getState().pause(); }, []);
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main || state.phase < 0) return;
    const phase = state.steps[state.phase]?.id;
    const selectors = phase === 'split' ? ['.cache-address-breakdown'] : phase === 'index' || phase === 'compare' ? ['.cache-l1'] : phase === 'memory-request' || phase === 'memory-to-cache' ? ['.cache-memory-connection', '.cache-main-memory'] : ['.cache-cpu', '.cache-diagram > .cache-transfer'];
    const rectangles = selectors.map(selector => main.querySelector(selector)?.getBoundingClientRect()).filter((rectangle): rectangle is DOMRect => !!rectangle);
    if (!rectangles.length) return;
    const columnScrolls = window.getComputedStyle(main).overflowY === 'auto';
    const column = main.getBoundingClientRect();
    const controls = document.querySelector('.cache-timeline')?.getBoundingClientRect();
    const viewport = columnScrolls ? { top: column.top, bottom: column.bottom } : { top: 0, bottom: Math.min(window.innerHeight, controls?.top ?? window.innerHeight) };
    const top = Math.min(...rectangles.map(rectangle => rectangle.top));
    const bottom = Math.max(...rectangles.map(rectangle => rectangle.bottom));
    // Reveal the current transfer before its animation paints. Desktop has a
    // separate scroll column; smaller screens scroll the document.
    const distance = top < viewport.top + 12 ? top - viewport.top - 12 : bottom > viewport.bottom - 12 ? bottom - viewport.bottom + 12 : 0;
    if (distance && columnScrolls) main.scrollTop += distance;
    else if (distance) window.scrollBy({ top: distance, behavior: 'auto' });
  }, [state.revision, state.phase, state.steps]);
  const move = (action: () => void) => { setAnimationPaused(false); action(); };
  const pause = () => { setAnimationPaused(true); state.pause(); };
  return <div className="lab-page cache-page" data-visualizer="cache" data-animation-paused={animationPaused} style={{ '--cache-animation-duration': `${1400 / state.speed}ms` } as CSSProperties}>
    <header className="lab-header"><Brand /><div className="lab-breadcrumb"><span>实验室</span><ChevronRight size={14} /><strong>Cache Visualizer</strong></div><Link to="/" className="back-home"><ArrowLeft size={14} /> 返回课程</Link></header>
    <div className="lab-layout"><Sidebar moduleId="cache" /><main className="lab-main cache-main" ref={mainRef}>
      <div className="lab-title"><div><h1>Cache Visualizer</h1><p>高速缓存 <span>· Direct-Mapped Cache</span></p></div><span className="model-badge"><span className="status-dot" /> 逐步访问模型</span></div>
      <div className="cache-parameters" aria-label="Cache 参数"><div><span>ADDRESS WIDTH</span><strong>16 <small>bit</small></strong></div><div><span>CACHE LINES</span><strong>4 <small>lines</small></strong></div><div><span>BLOCK SIZE</span><strong>4 <small>bytes</small></strong></div></div>
      <div className="cache-request-controls"><section className="instruction-bar cache-input"><form onSubmit={event => { event.preventDefault(); move(state.startAccess); }}><label htmlFor="cache-address"><Search size={15} /><span>Address</span></label><input id="cache-address" aria-label="Cache Address" aria-describedby="cache-address-help" className="mono" autoComplete="off" spellCheck={false} value={state.addressText} onChange={event => { setAnimationPaused(false); state.setAddressText(event.target.value); }} /><button className="button run-button" aria-label="Cache Start Access" type="submit"><ArrowDown size={13} /> 发起访问</button></form><div id="cache-address-help" className={state.error ? 'instruction-error' : 'instruction-helper'} role={state.error ? 'alert' : undefined}>{state.error || <><span>十六进制 0x0000 — 0xFFFF · 按字节寻址</span><span>初始 Cache 为空</span></>}</div></section>
      <AddressBreakdown state={state} /></div>
      <div className="cache-step-current" data-phase={state.phase < 0 ? 'ready' : details.id} aria-live="polite"><span className="cache-phase-number">{state.phase < 0 ? '—' : String(state.phase + 1).padStart(2, '0')}</span><div><strong>{state.phase < 0 ? '输入地址，开始访问。' : details.title}</strong><p>{state.phase < 0 ? '点击发起访问或下一步。' : details.description}</p></div><span className="cache-phase-module">{state.phase < 0 ? 'READY' : phaseModule[details.id]}</span></div>
      <CacheDiagram state={state} animationPaused={animationPaused} />
      <PresetSequence state={state} onLoad={() => move(state.loadPreset)} onNext={() => move(state.nextAccess)} />
    </main><CacheInspector state={state} /></div>
    <section className="timeline cache-timeline" aria-label="Cache 执行步骤与播放控制"><div className="cache-timeline-stages">{(displayedSteps.length ? displayedSteps : [{ id: 'address', title: 'CPU 发出地址' }, { id: 'split', title: '拆分地址' }, { id: 'index', title: '选择行' }, { id: 'compare', title: '比较 Tag' }]).map((step, index) => <div className={`cache-timeline-stage ${state.phase === index ? 'current' : ''} ${state.phase > index ? 'completed' : ''}`} data-stage={step.id} aria-current={state.phase === index ? 'step' : undefined} key={step.id}><span>{index + 1}</span><strong>{phaseLabels[step.id]}</strong></div>)}</div><div className="playback"><div className="playback-buttons"><button className="icon-button" disabled={state.phase < 0 && state.accessIndex < 0} onClick={() => move(state.previous)} aria-label="Cache Previous Step" title="上一步 · 恢复 Cache 状态"><ChevronLeft size={19} /></button><button className="button play-button" onClick={state.playing ? pause : () => move(state.play)} aria-label={state.playing ? 'Cache Pause' : 'Cache Play'}><>{state.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</><span>{state.playing ? '暂停' : '播放'}</span></button><button className="icon-button" onClick={() => move(state.next)} disabled={complete && !canNextAccess} aria-label="Cache Next Step" title="下一步"><ChevronRight size={19} /></button><span className="control-divider" /><button className="text-button reset-button" onClick={() => move(state.reset)} aria-label="Cache Reset"><RotateCcw size={15} /> 重置</button></div><div className="playback-right"><label className="speed-label">播放速度<select aria-label="Cache Playback Speed" value={state.speed} onChange={event => state.setSpeed(Number(event.target.value))}><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label><span className="cache-step-counter mono">{state.phase < 0 ? 'READY' : `${state.phase + 1} / ${displayedSteps.length}`}</span></div></div></section>
  </div>;
}
