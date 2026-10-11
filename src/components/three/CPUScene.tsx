import { Component, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Line, OrbitControls, RoundedBox } from '@react-three/drei';
import { ExtrudeGeometry, OrthographicCamera, Quaternion, Shape, Vector3, type Camera, type Mesh } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useCPUStore } from '../../store/cpuStore';
import { componentInfo } from '../../data/modules';
import { getStepDetails, PROGRAM_START_ADDRESS } from '../../data/instructions';
import { DATAPATH_MODULES, DATAPATH_ROUTES, getDatapathRoute, type DatapathModule, type DatapathPoint, type DatapathRoute } from '../../data/datapath';
import type { ComponentId, DataFlowSpec } from '../../types/cpu';
import './CPUScene.css';

type LabelRegistry = { current: Record<string, HTMLDivElement | null> };
export const flowColors = { data: '#eeb92b', address: '#1676e8', control: '#9659cc', memory: '#2b9b6e' };
const flowInk = { data: '#715000', address: '#0057ac', control: '#754098', memory: '#15714b' };
const modulePositions = Object.fromEntries(DATAPATH_MODULES.map(module => [module.id, module.position]));

// React owns these labels. Three only changes coordinates; no nested DOM roots
// are created or removed when tabs, routes, or the renderer are disposed.
function projectLabel(element: HTMLDivElement | null | undefined, point: Vector3, camera: Camera, size: { width: number; height: number }) {
  if (!element) return;
  const projected = point.clone().project(camera);
  element.style.visibility = projected.z >= -1 && projected.z <= 1 ? 'visible' : 'hidden';
  element.style.transform = `translate3d(${(projected.x + 1) * size.width / 2}px,${(1 - projected.y) * size.height / 2}px,0) translate(-50%,-50%)`;
}

function makePath(points: DatapathPoint[]) {
  const vectors = points.map(point => new Vector3(...point));
  const lengths = vectors.slice(1).map((point, index) => point.distanceTo(vectors[index]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  return { vectors, lengths, total };
}
function atPath(path: ReturnType<typeof makePath>, progress: number, output = new Vector3()) {
  let remaining = path.total * Math.min(1, Math.max(0, progress));
  for (let index = 0; index < path.lengths.length; index++) {
    const length = path.lengths[index];
    if (remaining <= length || index === path.lengths.length - 1) return output.copy(path.vectors[index]).lerp(path.vectors[index + 1], length ? remaining / length : 0);
    remaining -= length;
  }
  return output.copy(path.vectors[0]);
}

function RouteArrow({ route, color, active = false }: { route: DatapathRoute; color: string; active?: boolean }) {
  const arrow = useMemo(() => {
    const points = route.points;
    const end = new Vector3(...points[points.length - 1]);
    const previous = new Vector3(...points[points.length - 2]);
    const direction = end.clone().sub(previous).normalize();
    const point = end.clone().addScaledVector(direction, -.27);
    point.y = active ? .28 : .23;
    return { point, rotation: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction) };
  }, [route, active]);
  return <mesh position={arrow.point} quaternion={arrow.rotation}>
    <coneGeometry args={[active ? .105 : .075, active ? .32 : .25, 6]} />
    <meshBasicMaterial color={color} />
  </mesh>;
}

/** Each moving signal uses the exact same path as its permanent gray wire. */
export function DataFlow({ flow, index = 0, playing = false, speed = 1, labels, labelKey }: { flow: DataFlowSpec; index?: number; playing?: boolean; speed?: number; labels: LabelRegistry; labelKey: string }) {
  const route = getDatapathRoute(flow);
  const path = useMemo(() => route ? makePath(route.points) : null, [route]);
  const point = useMemo(() => new Vector3(), []);
  const labelPosition = useMemo(() => route ? new Vector3(...route.labelPoint) : new Vector3(), [route]);
  const dot = useRef<Mesh>(null);
  const progress = useRef(index * .12);
  const manualRemaining = useRef(playing ? 0 : 1.8 / speed);
  const wasPlaying = useRef(playing);
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    if (wasPlaying.current && !playing) manualRemaining.current = 0;
    wasPlaying.current = playing;
    invalidate();
  }, [playing, speed, invalidate]);
  useFrame(({ camera, size }, delta) => {
    if (!route || !path) return;
    // Demand rendering can resume after a long idle interval. Use the same
    // bounded delta for the transfer timer and its particle position.
    const dt = Math.min(delta, .1);
    if (playing) progress.current = (progress.current + dt * .7 * speed) % 1;
    else if (manualRemaining.current > 0) {
      manualRemaining.current -= dt;
      progress.current = Math.min(1, progress.current + dt * .65 * speed);
    }
    atPath(path, progress.current, point);
    point.y = .37;
    dot.current?.position.copy(point);
    projectLabel(labels.current[labelKey], labelPosition, camera, size);
    if (playing || manualRemaining.current > 0) invalidate();
  });
  if (!route) return null;
  return <group>
    <Line points={route.points.map(([x, , z]) => [x, .28, z] as DatapathPoint)} color={flowColors[flow.type]} lineWidth={3} dashed={flow.type === 'control'} dashSize={.24} gapSize={.12} />
    <RouteArrow route={route} color={flowColors[flow.type]} active />
    <mesh ref={dot}><sphereGeometry args={[.12, 10, 8]} /><meshBasicMaterial color={flowColors[flow.type]} /></mesh>
  </group>;
}

function housingOutline(module: DatapathModule): [number, number][] {
  const [width, , depth] = module.size;
  const x = width / 2, z = depth / 2;
  if (module.shape === 'alu') return [[-x, -z], [x - 1, -z], [x, -1], [x, 1], [x - 1, z], [-x, z], [-x, .35], [-x + .45, 0], [-x, -.35]];
  if (module.shape === 'mux') return [[-x, -z], [x, -.7], [x, .7], [-x, z]];
  return [[-x, -z], [x, -z], [x, z], [-x, z]];
}

function Module({ module, active, hovered, onHover, labels }: { module: DatapathModule; active: boolean; hovered: ComponentId | null; onHover: (id: ComponentId | null) => void; labels: LabelRegistry }) {
  const selected = useCPUStore(state => state.selectedComponent);
  const select = useCPUStore(state => state.selectComponent);
  const chosen = selected === module.id, muted = selected !== null && !chosen, over = hovered === module.id;
  const [width, height, depth] = module.size;
  const outline = useMemo(() => housingOutline(module), [module]);
  const geometry = useMemo(() => {
    const shape = new Shape();
    outline.forEach(([x, z], index) => index === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z));
    shape.closePath();
    return new ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelSize: .055, bevelThickness: .055, bevelSegments: 1, steps: 1 });
  }, [outline, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const labelPoint = useMemo(() => new Vector3(module.position[0], .8, module.position[2]), [module]);
  useFrame(({ camera, size }) => projectLabel(labels.current[`module-${module.id}`], labelPoint, camera, size));
  const click = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); select(chosen ? null : module.id); };
  const edgeColor = chosen ? '#0071e3' : over ? '#3b91eb' : active ? '#7197bc' : '#9ba9b8';
  return <group position={module.position} onClick={click}
    onPointerOver={event => { event.stopPropagation(); onHover(module.id); }} onPointerOut={() => onHover(null)}>
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, .07, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={chosen ? '#d8eaff' : over ? '#e4f1ff' : '#fcfdff'} metalness={.06} roughness={.62}
        transparent={muted} opacity={muted ? .24 : 1} depthWrite={!muted} emissive={chosen || over ? '#88baf3' : '#ffffff'} emissiveIntensity={chosen || over ? .12 : .015} />
    </mesh>
    <Line points={[...outline, outline[0]].map(([x, z]) => [x, .67, z] as DatapathPoint)} color={edgeColor} lineWidth={chosen || over ? 2.3 : 1.1} transparent opacity={muted ? .2 : 1} />
    {/* A shallow base makes the functional shapes read as 3D housings. */}
    <RoundedBox args={[width + .15, .12, depth + .15]} radius={.06} position={[0, -.005, 0]} receiveShadow>
      <meshStandardMaterial color={chosen ? '#6aa9eb' : '#c7d2de'} roughness={.65} transparent={muted} opacity={muted ? .22 : 1} depthWrite={!muted} />
    </RoundedBox>
  </group>;
}

function Wires() {
  const ports = useMemo(() => {
    const seen = new Set<string>();
    return DATAPATH_ROUTES.flatMap(route => [route.points[0], route.points[route.points.length - 1]]).filter(point => {
      const key = point.join(',');
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }, []);
  return <group>
    {DATAPATH_ROUTES.map(route => <group key={route.id}>
      <Line points={route.points.map(([x, , z]) => [x, .2, z] as DatapathPoint)} color="#8795a7" lineWidth={1.6} dashed={route.type === 'control'} dashSize={.24} gapSize={.12} />
      <RouteArrow route={route} color="#8795a7" />
    </group>)}
    {ports.map((point, index) => <mesh key={index} position={[point[0], .24, point[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[.085, 10]} /><meshBasicMaterial color="#8798ad" />
    </mesh>)}
    {/* Only this true Read data 2 split is a junction; wire crossings are not. */}
    <mesh position={[-1.8, .25, 1.6]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.105, 12]} /><meshBasicMaterial color="#8798ad" /></mesh>
  </group>;
}

function CameraRig({ selected, resetKey, topView }: { selected: ComponentId | null; resetKey: number; topView: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const moving = useRef(true);
  const goal = useRef(new Vector3());
  const target = useRef(new Vector3());
  const goalZoom = useRef(20);
  const { size, invalidate } = useThree();
  useEffect(() => {
    const position = selected ? modulePositions[selected] : null;
    const center = position ? new Vector3(...position) : new Vector3(0, 0, 1.5);
    target.current.copy(center);
    goal.current.copy(center).add(topView ? new Vector3(0, 38, .01) : new Vector3(0, 34, 10));
    const fit = Math.min(size.width / 31.4, size.height / 22.1);
    goalZoom.current = fit * (selected ? 1.85 : 1);
    moving.current = true; invalidate();
  }, [selected, resetKey, topView, size.width, size.height, invalidate]);
  useFrame(({ camera }, delta) => {
    if (!moving.current || !controls.current) return;
    const amount = 1 - Math.exp(-Math.max(.016, Math.min(delta, .1)) * 5);
    camera.position.lerp(goal.current, amount);
    controls.current.target.lerp(target.current, amount);
    if (camera instanceof OrthographicCamera) {
      camera.zoom += (goalZoom.current - camera.zoom) * amount;
      camera.updateProjectionMatrix();
    }
    controls.current.update();
    if (camera.position.distanceTo(goal.current) < .015 && (!(camera instanceof OrthographicCamera) || Math.abs(camera.zoom - goalZoom.current) < .015)) moving.current = false;
    else invalidate();
  });
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.12} minZoom={5} maxZoom={110}
    minPolarAngle={.001} maxPolarAngle={Math.PI / 2.8} onStart={() => { moving.current = false; }} />;
}

function Processor({ compact, resetKey, topView, hovered, onHover, labels }: { compact: boolean; resetKey: number; topView: boolean; hovered: ComponentId | null; onHover: (id: ComponentId | null) => void; labels: LabelRegistry }) {
  const state = useCPUStore();
  const details = getStepDetails(state);
  return <>
    <color attach="background" args={['#f6f8fb']} />
    <ambientLight intensity={1.6} />
    <directionalLight position={[-12, 30, 5]} intensity={2} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18} shadow-normalBias={.045} />
    <mesh position={[0, -.25, 1.65]} receiveShadow>
      <boxGeometry args={[30, .18, 21]} />
      <meshStandardMaterial color="#f8fbff" roughness={.85} />
    </mesh>
    <Wires />
    {DATAPATH_MODULES.map(module => <Module key={module.id} module={module} active={details.activeComponents.includes(module.id)} hovered={hovered} onHover={onHover} labels={labels} />)}
    {!compact && details.flows.map((flow, index) => <DataFlow key={`${state.step}-${flow.from}-${flow.to}`} flow={flow} index={index} playing={state.playing} speed={state.speed} labels={labels} labelKey={`flow-${state.step}-${index}`} />)}
    <CameraRig selected={state.selectedComponent} resetKey={resetKey} topView={topView} />
  </>;
}

function SceneFallback() {
  const state = useCPUStore();
  return <div className="scene-fallback">
    <span className="fallback-caption">Single-Cycle CPU Datapath</span>
    <p>浏览器未提供 WebGL。仍可选择组件查看说明，并逐步执行指令。</p>
    <div className="fallback-modules">{DATAPATH_MODULES.map(module => <button key={module.id} className={state.selectedComponent === module.id ? 'selected' : ''} onClick={() => state.selectComponent(state.selectedComponent === module.id ? null : module.id)}>
      <strong>{module.title}</strong><span>{module.subtitle}</span>
    </button>)}</div>
  </div>;
}

function SceneLabels({ compact, hovered, onHover, labels }: { compact: boolean; hovered: ComponentId | null; onHover: (id: ComponentId | null) => void; labels: LabelRegistry }) {
  const state = useCPUStore();
  const details = getStepDetails(state);
  const pc = `0x${(PROGRAM_START_ADDRESS + (state.step === 4 ? 4 : 0)).toString(16).padStart(8, '0').toUpperCase()}`;
  return <div className="cpu-scene-label-layer">
    {DATAPATH_MODULES.map(module => {
      const chosen = state.selectedComponent === module.id;
      const muted = state.selectedComponent !== null && !chosen;
      return <div key={module.id} ref={element => { labels.current[`module-${module.id}`] = element; }} className="cpu-scene-project-label">
        <button type="button" aria-label={`聚焦 ${componentInfo[module.id].shortLabel}`} aria-pressed={chosen}
          onPointerDown={event => event.stopPropagation()} onPointerEnter={() => onHover(module.id)} onPointerLeave={() => onHover(null)}
          onFocus={() => onHover(module.id)} onBlur={() => onHover(null)}
          onClick={event => { event.stopPropagation(); state.selectComponent(chosen ? null : module.id); }}
          className={`chip-label ${chosen ? 'is-selected' : ''} ${muted ? 'is-muted' : ''} ${hovered === module.id ? 'is-hovered' : ''} ${compact ? 'is-compact' : ''}`}>
          <span className="chip-label-name">{module.title}</span><span className="chip-label-short">{componentInfo[module.id].shortLabel}</span>
          <span className="chip-label-sub">{module.subtitle}</span>
          {module.id === 'pc' && <span className="chip-label-detail">{pc}</span>}
          {module.id === 'alu' && state.step === 3 && <span className="chip-label-detail">{details.operandA} + {details.operandB} = {details.result}</span>}
          {module.id === 'dataMemory' && <span className="chip-label-detail">{state.step >= 0 ? 'ADD 不读写' : 'LOAD / STORE'}</span>}
          {details.activeComponents.includes(module.id) && !compact && <i />}
        </button>
      </div>;
    })}
    {!compact && details.flows.map((flow, index) => <div key={`${state.step}-${index}`} ref={element => { labels.current[`flow-${state.step}-${index}`] = element; }} className="cpu-scene-project-label cpu-scene-flow-label" data-signal-type={flow.type}>
      <span className="signal-value" style={{ '--signal': flowColors[flow.type], '--signal-ink': flowInk[flow.type] } as CSSProperties}>{flow.label}</span>
    </div>)}
  </div>;
}

class SceneErrorBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? <SceneFallback /> : this.props.children; }
}

export function CPUScene({ compact = false }: { compact?: boolean }) {
  const selected = useCPUStore(state => state.selectedComponent);
  const select = useCPUStore(state => state.selectComponent);
  const [resetKey, setResetKey] = useState(0);
  const [topView, setTopView] = useState(false);
  const [hovered, setHovered] = useState<ComponentId | null>(null);
  const [sceneFailed, setSceneFailed] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const labels = useRef<Record<string, HTMLDivElement | null>>({});
  const reset = () => { select(null); setHovered(null); setTopView(false); setResetKey(key => key + 1); };
  return <div ref={container} className={`cpu-scene ${compact ? 'cpu-scene-compact' : ''}`} data-view={selected ? 'focus' : topView ? 'top' : 'overview'} data-selected={selected ?? ''} aria-label="单周期 CPU 三维数据通路。点击模块查看说明，箭头表示信号方向。">
    <SceneErrorBoundary onFailure={() => setSceneFailed(true)}>
      <Canvas orthographic frameloop="demand" shadows dpr={[1, 1.5]} camera={{ position: [0, 34, 11.5], zoom: 20, near: .1, far: 120 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} fallback={<span aria-hidden="true">CPU 数据通路</span>} onPointerMissed={() => select(null)}>
        <Processor compact={compact} resetKey={resetKey} topView={topView} hovered={hovered} onHover={setHovered} labels={labels} />
      </Canvas>
    </SceneErrorBoundary>
    {!sceneFailed && <SceneLabels compact={compact} hovered={hovered} onHover={setHovered} labels={labels} />}
    {!compact && <>
      <div className="cpu-scene-status"><span /><strong>Single-Cycle Datapath</strong><span className="cpu-scene-status-note">32-bit · 教学模型</span></div>
      <div className="cpu-scene-tools">
        <button onClick={reset} title="重置视角" aria-label="重置视角"><svg viewBox="0 0 24 24"><path d="M4 10a8 8 0 1 1 1.5 7M4 4v6h6" /></svg></button>
        <button onClick={() => setTopView(value => !value)} title="切换俯视" aria-label="切换俯视" aria-pressed={topView}><svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" /></svg></button>
        <button onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void container.current?.requestFullscreen(); }} title="全屏模型" aria-label="全屏模型"><svg viewBox="0 0 24 24"><path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5" /></svg></button>
      </div>
      <div className="cpu-scene-legend">{(['data', 'address', 'control', 'memory'] as const).map(type => <span key={type}><i style={{ background: flowColors[type] }} />{type.toUpperCase()}</span>)}</div>
      <span className="cpu-scene-help">灰线为完整通路 <b>·</b> 彩线为当前步骤 <b>·</b> 点击聚焦</span>
    </>}
  </div>;
}

export default CPUScene;
