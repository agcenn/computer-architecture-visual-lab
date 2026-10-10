import { Component, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Line, OrbitControls, RoundedBox } from '@react-three/drei';
import { Quaternion, Vector3, type Camera, type Mesh } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useCPUStore } from '../../store/cpuStore';
import { componentInfo } from '../../data/modules';
import { getStepDetails } from '../../data/instructions';
import type { ComponentId } from '../../types/cpu';
import './CPUScene.css';

type Point = [number, number, number];
type SceneFlow = { from: ComponentId; to: ComponentId; type: string; label: string };
type LabelRegistry = { current: Record<string, HTMLDivElement | null> };
const positions: Record<ComponentId, Point> = {
  pc: [-7.3, 0, -3.7], instructionMemory: [-3.9, 0, -3.7],
  instructionRegister: [-0.2, 0, -3.7], controlUnit: [4.3, 0, -3.7],
  registerFile: [-5.6, 0, 0.9], mux: [-1.9, 0, 0.9],
  alu: [1.5, 0, 0.9], dataMemory: [6.0, 0, 0.9],
  cache: [5.7, 0, 4.1], bus: [-3.5, 0, 4.2],
};
const colors: Record<ComponentId, string> = {
  pc: '#0071e3', instructionMemory: '#327ac1', instructionRegister: '#507dae',
  controlUnit: '#8064a8', registerFile: '#3d75aa', mux: '#ab7730',
  alu: '#0071e3', dataMemory: '#388b68', cache: '#328890', bus: '#ab7730',
};
const dimensions: Record<ComponentId, [number, number]> = {
  pc: [1.8, 1.7], instructionMemory: [2.7, 1.9], instructionRegister: [2.2, 1.6],
  controlUnit: [3, 1.9], registerFile: [2.7, 2.7], mux: [1.45, 1.5],
  alu: [2.5, 2.6], dataMemory: [2.7, 2.5], cache: [2.7, 1.4], bus: [6.0, 0.8],
};
const flowColors: Record<string, string> = {
  address: '#0071e3', data: '#9a641c', control: '#8064a8', memory: '#267049',
};

// Labels belong to the application's DOM tree. The Three renderer only updates
// their coordinates, so disposing a Canvas never creates or removes DOM roots.
function projectLabel(element: HTMLDivElement | null | undefined, point: Vector3, camera: Camera, size: { width: number; height: number }, distanceFactor = 19) {
  if (!element) return;
  camera.updateMatrixWorld();
  const projected = point.clone().project(camera);
  const visible = projected.z >= -1 && projected.z <= 1;
  element.style.visibility = visible ? 'visible' : 'hidden';
  if (!visible) return;
  const distance = point.distanceTo(camera.position);
  const scale = Math.max(0.2, Math.min(2, distanceFactor * camera.projectionMatrix.elements[5] / (2 * distance)));
  element.style.transform = `translate3d(${(projected.x + 1) * size.width / 2}px,${(1 - projected.y) * size.height / 2}px,0) translate(-50%,-50%) scale(${scale})`;
}

function pathBetween(from: ComponentId, to: ComponentId): Point[] {
  const a = positions[from], b = positions[to];
  const start: Point = [a[0], 0.3, a[2]], end: Point = [b[0], 0.3, b[2]];
  if (from === 'alu' && to === 'registerFile') {
    return [start, [a[0], 0.3, 3.0], [-5.6, 0.3, 3.0], end];
  }
  if (from === 'registerFile' && to === 'alu') {
    return [start, [a[0], 0.3, -0.9], [b[0], 0.3, -0.9], end];
  }
  if (from === 'controlUnit' && ['alu', 'registerFile', 'mux'].includes(to)) {
    return [start, [a[0], 0.3, -1.4], [b[0], 0.3, -1.4], end];
  }
  if (from === to) {
    return [[a[0] - 1.15, 0.3, a[2] - 1.3], [a[0] + 1.15, 0.3, a[2] - 1.3],
      [a[0] + 1.15, 0.3, a[2] + 1.3], [a[0] - 1.15, 0.3, a[2] + 1.3],
      [a[0] - 1.15, 0.3, a[2] - 1.3]];
  }
  if (Math.abs(a[2] - b[2]) < 0.2) return [start, end];
  return [start, [a[0], 0.3, (a[2] + b[2]) / 2], [b[0], 0.3, (a[2] + b[2]) / 2], end];
}

function pointOnPath(points: Point[], progress: number): Vector3 {
  const distances = points.slice(1).map((p, i) => new Vector3(...p).distanceTo(new Vector3(...points[i])));
  const total = distances.reduce((sum, distance) => sum + distance, 0);
  let target = progress * total;
  for (let i = 0; i < distances.length; i++) {
    if (target <= distances[i] || i === distances.length - 1) {
      return new Vector3(...points[i]).lerp(new Vector3(...points[i + 1]), distances[i] ? target / distances[i] : 0);
    }
    target -= distances[i];
  }
  return new Vector3(...points[0]);
}

/** Animated values follow the actual signal route for the current instruction stage. */
export function DataFlow({ flow, index = 0, playing = false, speed = 1, labels, labelKey }: { flow: SceneFlow; index?: number; playing?: boolean; speed?: number; labels?: LabelRegistry; labelKey?: string }) {
  const points = useMemo(() => pathBetween(flow.from, flow.to), [flow.from, flow.to]);
  const dot = useRef<Mesh>(null);
  const progress = useRef(index * 0.18);
  const manualRemaining = useRef(playing ? 0 : 2 / speed);
  const wasPlaying = useRef(playing);
  const color = flowColors[flow.type] ?? flowColors.data;
  const arrow = useMemo(() => {
    const point = pointOnPath(points, 0.56);
    point.y = 0.52;
    const direction = pointOnPath(points, 0.57).sub(pointOnPath(points, 0.55)).normalize();
    return { point, rotation: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction) };
  }, [points]);
  useEffect(() => {
    if (wasPlaying.current && !playing) manualRemaining.current = 0;
    wasPlaying.current = playing;
  }, [playing]);
  useFrame(({ camera, size }, delta) => {
    // Manual Next shows one transfer; pausing autoplay freezes the current position.
    if (playing) progress.current = (progress.current + delta * 0.55 * speed) % 1;
    else if (manualRemaining.current > 0) {
      manualRemaining.current -= delta;
      progress.current = Math.min(1, progress.current + delta * 0.5 * speed);
    }
    const point = pointOnPath(points, progress.current);
    point.y = 0.7;
    if (dot.current) {
      dot.current.position.copy(point);
      dot.current.scale.setScalar(0.9 + Math.sin(progress.current * Math.PI) * 0.35);
    }
    if (labels && labelKey) projectLabel(labels.current[labelKey], new Vector3(point.x, 1.1, point.z - 0.2), camera, size, 17);
  });
  return <group>
    <Line points={points} color={color} lineWidth={3} transparent opacity={0.9} />
    <mesh position={arrow.point} quaternion={arrow.rotation}><coneGeometry args={[0.1, 0.28, 6]} /><meshBasicMaterial color={color} /></mesh>
    <mesh ref={dot}><sphereGeometry args={[0.12, 12, 12]} /><meshBasicMaterial color={color} /></mesh>
  </group>;
}

function Pins({ width, depth, muted }: { width: number; depth: number; muted: boolean }) {
  const count = Math.max(4, Math.round(width * 3));
  return <group>
    {Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * width / count).flatMap((x, i) =>
      [-1, 1].map(side => <mesh key={`${i}-${side}`} position={[x, 0.13, side * (depth / 2 + 0.13)]}>
        <boxGeometry args={[0.08, 0.11, 0.28]} /><meshStandardMaterial color={muted ? '#c0c2c6' : '#c6c8cd'} metalness={0.75} roughness={0.34} transparent={muted} opacity={muted ? 0.28 : 1} depthWrite={!muted} />
      </mesh>))}
  </group>;
}

function ChipContents({ id, color }: { id: ComponentId; color: string }) {
  if (id === 'registerFile') return <group position={[0, 0.58, 0]}>
    {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[0, 0, (i - 3.5) * 0.22]}>
      <boxGeometry args={[1.8, 0.05, 0.1]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.015} metalness={0.45} roughness={0.48} />
    </mesh>)}
  </group>;
  if (id === 'dataMemory' || id === 'instructionMemory' || id === 'cache') return <group position={[0, 0.61, 0]}>
    {Array.from({ length: id === 'cache' ? 6 : 9 }, (_, i) => <mesh key={i} position={[(i % 3 - 1) * 0.54, 0, (Math.floor(i / 3) - (id === 'cache' ? 0.5 : 1)) * 0.37]}>
      <boxGeometry args={[0.4, 0.055, 0.24]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.015} metalness={0.5} roughness={0.4} />
    </mesh>)}
  </group>;
  if (id === 'bus') return <group position={[0, 0.52, 0]}>
    {[-1, 0, 1].map((z, i) => <mesh key={z} position={[0, 0, z * 0.13]}>
      <boxGeometry args={[5.4, 0.035, 0.035]} /><meshStandardMaterial color={['#327ac1', '#ab7730', '#8064a8'][i]} emissive={color} emissiveIntensity={0.025} />
    </mesh>)}
  </group>;
  if (id === 'mux') return <mesh position={[0, 0.58, 0]} rotation={[0, Math.PI / 4, 0]}>
    <boxGeometry args={[0.5, 0.08, 0.5]} /><meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
  </mesh>;
  if (id === 'alu') return <group position={[0, 0.58, 0]}>
    <RoundedBox args={[1.3, 0.08, 1.3]} radius={0.14}><meshStandardMaterial color="#858b94" emissive={color} emissiveIntensity={0.025} metalness={0.65} roughness={0.34} /></RoundedBox>
    <mesh position={[0, 0.06, 0]}><boxGeometry args={[0.7, 0.035, 0.7]} /><meshStandardMaterial color="#c6cbd2" metalness={0.65} roughness={0.25} /></mesh>
    {[-1, 1].map(x => <mesh key={x} position={[x * 0.87, 0, 0]}><boxGeometry args={[0.11, 0.05, 1.2]} /><meshStandardMaterial color={color} /></mesh>)}
  </group>;
  return <group position={[0, 0.58, 0]}>
    {[-1, 0, 1].map(i => <mesh key={i} position={[i * 0.43, 0, 0]}>
      <boxGeometry args={[0.27, 0.05, 0.66]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.015} />
    </mesh>)}
  </group>;
}

function Module({ id, active, labels }: { id: ComponentId; active: boolean; labels: LabelRegistry }) {
  const selected = useCPUStore(state => state.selectedComponent);
  const select = useCPUStore(state => state.selectComponent);
  const glow = useRef<Mesh>(null);
  const chosen = selected === id;
  const muted = selected !== null && !chosen;
  const [width, depth] = dimensions[id];
  const color = colors[id];
  const labelPosition = useMemo(() => new Vector3(positions[id][0], id === 'bus' ? 0.85 : 1.02, positions[id][2] + depth / 2 + (id === 'bus' ? 0.2 : 0.3)), [id, depth]);
  useFrame(({ clock, camera, size }) => {
    if (glow.current) glow.current.scale.setScalar(1 + (chosen || active ? Math.sin(clock.elapsedTime * 3) * 0.015 : 0));
    projectLabel(labels.current[`module-${id}`], labelPosition, camera, size);
  });
  const click = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); select(chosen ? null : id); };
  return <group position={positions[id]} onClick={click}
    onPointerOver={event => { event.stopPropagation(); document.body.style.cursor = 'pointer'; }}
    onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
    <RoundedBox ref={glow} args={[width + 0.12, 0.12, depth + 0.12]} radius={0.1} position={[0, 0.1, 0]}>
      <meshStandardMaterial color={chosen ? '#0071e3' : active ? color : '#b9bec5'} metalness={0.45} roughness={0.38} emissive={chosen ? '#0071e3' : color} emissiveIntensity={muted ? 0 : chosen ? 0.12 : active ? 0.06 : 0} transparent={muted} opacity={muted ? 0.28 : 1} depthWrite={!muted} />
    </RoundedBox>
    <RoundedBox args={[width, id === 'bus' ? 0.26 : 0.46, depth]} radius={0.13} position={[0, 0.3, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={muted ? '#72767e' : chosen ? '#3b414b' : '#34373c'} roughness={0.42} metalness={0.48} transparent={muted} opacity={muted ? 0.28 : 1} depthWrite={!muted} />
    </RoundedBox>
    <Pins width={width} depth={depth} muted={muted} />
    <group visible={!muted}><ChipContents id={id} color={color} /></group>
    <mesh position={[-width / 2 + 0.16, 0.56, -depth / 2 + 0.16]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.035, 10]} /><meshBasicMaterial color={color} transparent={muted} opacity={muted ? 0.28 : 1} />
    </mesh>
  </group>;
}

function Board({ labels }: { labels: LabelRegistry }) {
  const silkscreenPosition = useMemo(() => new Vector3(-7.2, 0.08, 5.05), []);
  useFrame(({ camera, size }) => projectLabel(labels.current.board, silkscreenPosition, camera, size, 8));
  const staticRoutes: [ComponentId, ComponentId, string][] = [
    ['pc', 'instructionMemory', '#7294b8'], ['instructionMemory', 'instructionRegister', '#7294b8'],
    ['instructionRegister', 'controlUnit', '#9a8dad'], ['controlUnit', 'registerFile', '#9a8dad'],
    ['controlUnit', 'alu', '#9a8dad'], ['registerFile', 'mux', '#ab9679'],
    ['registerFile', 'alu', '#ab9679'],
    ['mux', 'alu', '#ab9679'], ['alu', 'dataMemory', '#81a594'],
    ['dataMemory', 'cache', '#82a6a9'], ['alu', 'registerFile', '#ab9679'],
  ];
  return <group>
    <RoundedBox args={[20, 0.45, 12.8]} radius={0.35} position={[0, -0.32, 0.15]} castShadow receiveShadow>
      <meshStandardMaterial color="#b7bbc2" roughness={0.35} metalness={0.55} />
    </RoundedBox>
    <RoundedBox args={[19.65, 0.07, 12.45]} radius={0.3} position={[0, -0.075, 0.15]} receiveShadow>
      <meshStandardMaterial color="#e0e2e6" roughness={0.48} metalness={0.32} />
    </RoundedBox>
    {staticRoutes.map(([from, to, color]) => <Line key={`${from}-${to}`} points={pathBetween(from, to)} color={color} lineWidth={1.2} transparent opacity={0.68} />)}
    {[-9.2, 9.2].flatMap(x => [-5.6, 5.8].map(z => <mesh key={`${x}-${z}`} position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.12, 0.21, 24]} /><meshStandardMaterial color="#989da5" metalness={0.85} roughness={0.2} />
    </mesh>))}
    {Array.from({ length: 28 }, (_, i) => <mesh key={`contact-${i}`} position={[-6.9 + i * 0.5, -0.02, 6.27]}>
      <boxGeometry args={[0.25, 0.045, 0.34]} /><meshStandardMaterial color="#b39d7d" roughness={0.36} metalness={0.65} />
    </mesh>)}
    {Array.from({ length: 16 }, (_, i) => <mesh key={`resistor-${i}`} position={[-8.2 + (i % 8) * 0.25, 0.03, 2.7 + Math.floor(i / 8) * 0.25]}>
      <boxGeometry args={[0.11, 0.08, 0.12]} /><meshStandardMaterial color={i % 4 === 0 ? '#b4a591' : '#7b8088'} roughness={0.5} metalness={0.4} />
    </mesh>)}
  </group>;
}

function CameraRig({ selected, resetKey, topView, compact }: { selected: ComponentId | null; resetKey: number; topView: boolean; compact: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const moving = useRef(true);
  const goal = useRef(new Vector3(12, 15, 19));
  const target = useRef(new Vector3(0, 0, 0));
  useEffect(() => {
    const center = selected ? new Vector3(...positions[selected]) : new Vector3(0, 0, 0);
    target.current.copy(center);
    goal.current.copy(center).add(topView ? new Vector3(0, selected ? 13 : 23, 0.01) : selected ? new Vector3(6.6, 8.2, 10.2) : new Vector3(12, 15, 19));
    moving.current = true;
  }, [selected, resetKey, topView]);
  useFrame(({ camera }, delta) => {
    if (moving.current && controls.current) {
      const t = 1 - Math.exp(-delta * 3.4);
      camera.position.lerp(goal.current, t);
      controls.current.target.lerp(target.current, t);
      controls.current.update();
      if (camera.position.distanceTo(goal.current) < 0.01) moving.current = false;
    }
    if (controls.current) controls.current.autoRotate = compact && !moving.current;
  });
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={7} maxDistance={38}
    minPolarAngle={0.05} maxPolarAngle={Math.PI / 2 - 0.08} autoRotate={compact && !moving.current} autoRotateSpeed={0.3}
    onStart={() => { moving.current = false; }} />;
}

function Processor({ compact, resetKey, topView, labels }: { compact: boolean; resetKey: number; topView: boolean; labels: LabelRegistry }) {
  const state = useCPUStore();
  const details = getStepDetails(state);
  const activeComponents = details.activeComponents;
  return <>
    <color attach="background" args={['#f5f5f7']} />
    <fog attach="fog" args={['#f5f5f7', 42, 72]} />
    <ambientLight intensity={1.05} />
    <hemisphereLight args={['#ffffff', '#c8cbd1', 1.65]} />
    <directionalLight position={[-6, 18, 9]} intensity={2.5} color="#ffffff" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} shadow-normalBias={0.04} shadow-radius={4} />
    <directionalLight position={[8, 7, -9]} intensity={1.25} color="#e7ebf3" />
    <Board labels={labels} />
    {(Object.keys(positions) as ComponentId[]).map(id => <Module key={id} id={id} active={activeComponents.includes(id)} labels={labels} />)}
    {!compact && details.flows.map((flow, i) => <DataFlow key={`${state.step}-${flow.from}-${flow.to}-${i}`} flow={flow} index={i} playing={state.playing} speed={state.speed} labels={labels} labelKey={`flow-${state.step}-${i}`} />)}
    {!compact && state.step === 3 && <DataFlow flow={{ from: 'alu', to: 'alu', type: 'data', label: `${details.operandA} + ${details.operandB} = ${details.result}` }} playing={state.playing} speed={state.speed} labels={labels} labelKey="flow-execute-result" />}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.57, 0]} receiveShadow>
      <planeGeometry args={[200, 200]} /><meshStandardMaterial color="#f5f5f7" roughness={0.96} metalness={0} />
    </mesh>
    <CameraRig selected={compact ? null : state.selectedComponent} resetKey={resetKey} topView={topView} compact={compact} />
  </>;
}

function SceneFallback() {
  const selected = useCPUStore(state => state.selectedComponent);
  const select = useCPUStore(state => state.selectComponent);
  return <div className="scene-fallback">
    <span className="fallback-caption">CPU 结构图</span>
    <p>当前浏览器未提供 WebGL。你仍可选择模块，查看原理并逐步执行指令。</p>
    <div className="fallback-modules">{(Object.keys(positions) as ComponentId[]).map(id =>
      <button key={id} className={selected === id ? 'selected' : ''} style={{ '--chip': colors[id] } as CSSProperties} onClick={() => select(selected === id ? null : id)}>
        <strong>{componentInfo[id].shortLabel}</strong><span>{componentInfo[id].name}</span>
      </button>)}</div>
  </div>;
}

function SceneLabels({ compact, labels }: { compact: boolean; labels: LabelRegistry }) {
  const state = useCPUStore();
  const details = getStepDetails(state);
  return <div className="cpu-scene-label-layer">
    {(Object.keys(positions) as ComponentId[]).map(id => {
      const chosen = state.selectedComponent === id;
      const muted = state.selectedComponent !== null && !chosen;
      const info = componentInfo[id];
      return <div key={id} ref={element => { labels.current[`module-${id}`] = element; }} className="cpu-scene-project-label">
        <button type="button" aria-label={`聚焦 ${info.shortLabel}`} aria-pressed={chosen}
          onPointerDown={event => event.stopPropagation()}
          onClick={event => { event.stopPropagation(); state.selectComponent(chosen ? null : id); }}
          className={`chip-label ${chosen ? 'is-selected' : ''} ${muted ? 'is-muted' : ''} ${compact ? 'is-compact' : ''}`} style={{ '--chip': colors[id] } as CSSProperties}>
          <span className="chip-label-name">{info.shortLabel}</span>
          {!compact && <span className="chip-label-sub">{info.name}</span>}
          {details.activeComponents.includes(id) && <i />}
        </button>
      </div>;
    })}
    <div ref={element => { labels.current.board = element; }} className="cpu-scene-project-label cpu-scene-board-label" aria-hidden="true">
      <div className="board-silkscreen"><strong>CAVL / 08</strong><span>TEACHING PROCESSOR · 32 BIT</span></div>
    </div>
    {!compact && details.flows.map((flow, i) => <div key={`${state.step}-${i}`} ref={element => { labels.current[`flow-${state.step}-${i}`] = element; }} className="cpu-scene-project-label cpu-scene-flow-label">
      <span className="signal-value" style={{ '--signal': flowColors[flow.type] ?? flowColors.data } as CSSProperties}>{flow.label}</span>
    </div>)}
    {!compact && state.step === 3 && <div ref={element => { labels.current['flow-execute-result'] = element; }} className="cpu-scene-project-label cpu-scene-flow-label">
      <span className="signal-value" style={{ '--signal': flowColors.data } as CSSProperties}>{details.operandA} + {details.operandB} = {details.result}</span>
    </div>}
  </div>;
}

class SceneErrorBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? <SceneFallback /> : this.props.children; }
}

export function CPUScene({ compact = false }: { compact?: boolean }) {
  const select = useCPUStore(state => state.selectComponent);
  const [resetKey, setResetKey] = useState(0);
  const [topView, setTopView] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const labels = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => () => { document.body.style.cursor = 'auto'; }, []);
  const reset = () => { select(null); setTopView(false); setResetKey(key => key + 1); };
  return <div ref={container} className={`cpu-scene ${compact ? 'cpu-scene-compact' : ''}`} aria-label="交互式 CPU 三维结构。点击模块查看说明，拖动旋转，滚轮缩放。">
    <SceneErrorBoundary onFailure={() => setSceneFailed(true)}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [12, 15, 19], fov: 39, near: 0.1, far: 120 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} fallback={<span aria-hidden="true">CPU 三维结构</span>}
        onPointerMissed={() => select(null)}>
        <Processor compact={compact} resetKey={resetKey} topView={topView} labels={labels} />
      </Canvas>
    </SceneErrorBoundary>
    {!sceneFailed && <SceneLabels compact={compact} labels={labels} />}
    {!compact && <>
      <div className="cpu-scene-status"><span /><strong>CPU 结构</strong><span className="cpu-scene-status-note">32-bit · 8 registers</span></div>
      <div className="cpu-scene-tools">
        <button onClick={reset} title="重置视角" aria-label="重置视角"><svg viewBox="0 0 24 24"><path d="M4 10a8 8 0 1 1 1.5 7M4 4v6h6" /></svg></button>
        <button onClick={() => setTopView(value => !value)} title="切换俯视" aria-label="切换俯视" aria-pressed={topView}><svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" /></svg></button>
        <button onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void container.current?.requestFullscreen(); }} title="全屏模型" aria-label="全屏模型"><svg viewBox="0 0 24 24"><path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5" /></svg></button>
      </div>
      <div className="cpu-scene-legend"><span><i style={{ background: flowColors.data }} />数据</span><span><i style={{ background: flowColors.address }} />地址</span><span><i style={{ background: flowColors.control }} />控制</span><span><i style={{ background: flowColors.memory }} />存储</span></div>
      <span className="cpu-scene-help">拖动旋转 <b>·</b> 滚轮缩放 <b>·</b> 右键平移</span>
    </>}
  </div>;
}

export default CPUScene;
