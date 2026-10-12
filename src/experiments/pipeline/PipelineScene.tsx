import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Line, OrbitControls, RoundedBox } from '@react-three/drei';
import { OrthographicCamera, Vector3, type Camera, type Group } from 'three';
import { PIPELINE_STAGES } from '../../data/pipeline';
import type { CycleSnapshot, PipelineExecution, PipelineInstruction, PipelineStage } from '../../types/pipeline';
import './PipelineScene.css';

export interface PipelineSceneProps {
  execution: PipelineExecution;
  snapshot: CycleSnapshot;
  selectedInstructionId: string | null;
  onSelectInstruction: (id: string) => void;
}

const MODULE_SPACING = 4.2;
const REGISTER_NAMES = ['IF / ID', 'ID / EX', 'EX / MEM', 'MEM / WB'];
const moduleX = (index: number) => (index - 2) * MODULE_SPACING;
type LabelRegistry = { current: Record<string, HTMLDivElement | null> };
type ModelProps = PipelineSceneProps & {
  labels: LabelRegistry;
  hoveredStage: PipelineStage | null;
  onHoverStage: (stage: PipelineStage | null) => void;
};

// React owns every label. Three only projects coordinates into this overlay;
// route changes never create nested React roots inside the canvas renderer.
function projectLabel(element: HTMLDivElement | null | undefined, point: Vector3, camera: Camera, size: { width: number; height: number }) {
  if (!element) return;
  const projected = point.clone().project(camera);
  element.style.visibility = projected.z >= -1 && projected.z <= 1 ? 'visible' : 'hidden';
  element.style.transform = `translate3d(${(projected.x + 1) * size.width / 2}px,${(1 - projected.y) * size.height / 2}px,0) translate(-50%,-50%)`;
}

/** A fixed, fitted camera keeps the five stage labels readable on narrow screens. */
function PipelineCamera() {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    camera.position.set(0, 14, 12);
    camera.lookAt(0, .3, 0);
    if (camera instanceof OrthographicCamera) {
      camera.zoom = Math.min(size.width / 22.4, size.height / 7.4);
      camera.updateProjectionMatrix();
    }
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  return <OrbitControls makeDefault enablePan={false} enableZoom={false} enableRotate={false} />;
}

function DirectionArrow({ x, z = 0, color, opacity = 1 }: { x: number; z?: number; color: string; opacity?: number }) {
  return <mesh position={[x, .43, z]} rotation={[0, 0, -Math.PI / 2]}>
    <coneGeometry args={[.095, .28, 6]} />
    <meshBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} />
  </mesh>;
}

function StageHousing({ stage, index, instruction, selected, anotherSelected, hazardRegisters, labels, hoveredStage, onHoverStage, onSelectInstruction }: {
  stage: typeof PIPELINE_STAGES[number];
  index: number;
  instruction: PipelineInstruction | undefined;
  selected: boolean;
  anotherSelected: boolean;
  hazardRegisters: number[];
  labels: LabelRegistry;
  hoveredStage: PipelineStage | null;
  onHoverStage: (stage: PipelineStage | null) => void;
  onSelectInstruction: (id: string) => void;
}) {
  const hovered = hoveredStage === stage.id;
  const occupied = Boolean(instruction);
  const hazard = hazardRegisters.length > 0;
  const muted = anotherSelected && occupied && !selected;
  const edgeColor = hazard ? '#d93645' : selected || hovered || occupied ? stage.color : '#c4ccd6';
  const opacity = muted ? .42 : 1;
  const labelPoint = useMemo(() => new Vector3(moduleX(index), 1.05, .05), [index]);
  useFrame(({ camera, size }) => projectLabel(labels.current[`stage-${stage.id}`], labelPoint, camera, size));
  const outline: [number, number, number][] = [[-1.43, .77, -1.24], [1.43, .77, -1.24], [1.43, .77, 1.24], [-1.43, .77, 1.24], [-1.43, .77, -1.24]];
  const select = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (instruction) onSelectInstruction(instruction.id);
  };

  return <group position={[moduleX(index), 0, 0]} onClick={select}
    onPointerOver={event => { event.stopPropagation(); if (instruction) onHoverStage(stage.id); }}
    onPointerOut={() => onHoverStage(null)}>
    <RoundedBox args={[3, .16, 2.65]} radius={.08} smoothness={2} position={[0, -.03, 0]}>
      <meshStandardMaterial color={edgeColor} roughness={.65} transparent={muted} opacity={opacity} />
    </RoundedBox>
    <RoundedBox args={[2.86, .72, 2.48]} radius={.12} smoothness={3} position={[0, .41, 0]}>
      <meshStandardMaterial color={hovered || selected ? '#eef5fc' : '#ffffff'} roughness={.68} metalness={.06}
        transparent={muted} opacity={opacity} depthWrite={!muted} />
    </RoundedBox>
    <Line points={outline} color={edgeColor} lineWidth={selected || hazard || hovered ? 2.8 : 1.6} transparent opacity={opacity} />
    {/* Front ports expose the flow direction without adding chip-level detail. */}
    {[-.62, 0, .62].map(port => <mesh key={port} position={[port, .25, 1.255]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[.08, .08, .055, 8]} />
      <meshStandardMaterial color={stage.color} roughness={.75} transparent={muted} opacity={opacity} />
    </mesh>)}
  </group>;
}

function RegisterHousing({ index, selected, labels }: { index: number; selected: boolean; labels: LabelRegistry }) {
  const x = moduleX(index) + MODULE_SPACING / 2;
  const color = selected ? PIPELINE_STAGES[index + 1].color : '#aebac9';
  const labelPoint = useMemo(() => new Vector3(x, .18, 1.56), [x]);
  useFrame(({ camera, size }) => projectLabel(labels.current[`register-${index}`], labelPoint, camera, size));
  return <group position={[x, 0, 0]}>
    <Line points={[[-.61, .43, 0], [.61, .43, 0]]} color={color} lineWidth={selected ? 3 : 2} />
    <DirectionArrow x={.54} color={color} />
    <RoundedBox args={[.34, .95, 1.52]} radius={.04} smoothness={2} position={[0, .42, 0]}>
      <meshStandardMaterial color="#dce3ec" roughness={.72} />
    </RoundedBox>
    <mesh position={[0, .91, 0]}>
      <boxGeometry args={[.35, .045, 1.54]} />
      <meshBasicMaterial color={color} />
    </mesh>
  </group>;
}

function PipelineRegisters({ selected, labels }: { selected: boolean; labels: LabelRegistry }) {
  return <>{REGISTER_NAMES.map((label, index) => {
    return <RegisterHousing key={label} index={index} selected={selected} labels={labels} />;
  })}</>;
}

/** A selected instruction highlights its complete five-stage route, including later stages. */
function SelectedPath({ visible }: { visible: boolean }) {
  return <group visible={visible}>
    {PIPELINE_STAGES.map((stage, index) => <group key={stage.id}>
      <Line points={[[moduleX(index) - 1.6, .08, -1.83], [moduleX(index) + (index === 4 ? 1.6 : 2.6), .08, -1.83]]}
        color={stage.color} lineWidth={3} />
      <mesh position={[moduleX(index), .09, -1.83]}>
        <sphereGeometry args={[.1, 8, 6]} /><meshBasicMaterial color={stage.color} />
      </mesh>
    </group>)}
  </group>;
}

/** The clock edge pulses all five stages together; instructions move only by snapshot. */
function CyclePulse({ cycle }: { cycle: number }) {
  const markers = useRef<Group>(null);
  const progress = useRef(1);
  const invalidate = useThree(state => state.invalidate);
  const reducedMotion = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  useEffect(() => {
    progress.current = cycle > 0 && !reducedMotion ? 0 : 1;
    invalidate();
  }, [cycle, reducedMotion, invalidate]);
  useFrame((_, delta) => {
    if (!markers.current) return;
    const active = progress.current < 1;
    markers.current.visible = active;
    if (!active) return;
    progress.current = Math.min(1, progress.current + Math.min(delta, .05) / .7);
    markers.current.children.forEach(marker => marker.scale.setScalar(.4 + Math.sin(progress.current * Math.PI) * .8));
    invalidate();
  });
  return <group ref={markers} visible={false}>{PIPELINE_STAGES.map((stage, index) => <mesh key={stage.id} position={[moduleX(index), .1, 1.85]}>
    <sphereGeometry args={[.09, 10, 8]} /><meshBasicMaterial color="#8494a9" />
  </mesh>)}</group>;
}

function PipelineModel({ execution, snapshot, selectedInstructionId, onSelectInstruction, labels, hoveredStage, onHoverStage }: ModelProps) {
  const instructionById = useMemo(() => new Map(execution.instructions.map((instruction, index) => [instruction.id, { instruction, index }])), [execution]);
  return <>
    <color attach="background" args={['#f6f8fb']} />
    <ambientLight intensity={1.6} />
    <directionalLight position={[-8, 12, 7]} intensity={2} />
    <RoundedBox args={[21.6, .16, 5.4]} radius={.22} smoothness={3} position={[0, -.25, 0]}>
      <meshStandardMaterial color="#eaf0f6" roughness={.82} />
    </RoundedBox>
    <SelectedPath visible={selectedInstructionId !== null} />
    <PipelineRegisters selected={selectedInstructionId !== null} labels={labels} />
    {PIPELINE_STAGES.map((stage, index) => {
      const instructionId = snapshot.occupants[stage.id as PipelineStage];
      const occupant = instructionId ? instructionById.get(instructionId) : undefined;
      const hazardRegisters = stage.id === 'ID' ? snapshot.activeHazards.filter(hazard => hazard.consumerId === instructionId).map(hazard => hazard.register) : [];
      return <StageHousing key={stage.id} stage={stage} index={index} instruction={occupant?.instruction}
        selected={Boolean(instructionId && instructionId === selectedInstructionId)} anotherSelected={selectedInstructionId !== null}
        hazardRegisters={hazardRegisters} labels={labels} hoveredStage={hoveredStage} onHoverStage={onHoverStage} onSelectInstruction={onSelectInstruction} />;
    })}
    <CyclePulse cycle={snapshot.cycle} />
    <PipelineCamera />
  </>;
}

export function PipelineScene(props: PipelineSceneProps) {
  const labels = useRef<Record<string, HTMLDivElement | null>>({});
  const [hoveredStage, setHoveredStage] = useState<PipelineStage | null>(null);
  const selected = props.execution.instructions.find(instruction => instruction.id === props.selectedInstructionId);
  return <div className="pipeline-scene" data-pipeline-cycle={props.snapshot.cycle}>
    <Canvas orthographic camera={{ position: [0, 14, 12], zoom: 26, near: .1, far: 100 }} frameloop="demand" dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }}>
      <PipelineModel {...props} labels={labels} hoveredStage={hoveredStage} onHoverStage={setHoveredStage} />
    </Canvas>
    <div className="pipeline-scene-label-layer">
      {PIPELINE_STAGES.map(stage => {
        const instructionId = props.snapshot.occupants[stage.id];
        const ordinal = props.execution.instructions.findIndex(instruction => instruction.id === instructionId);
        const instruction = props.execution.instructions[ordinal];
        const chosen = Boolean(instructionId && instructionId === props.selectedInstructionId);
        const muted = Boolean(props.selectedInstructionId && instructionId && !chosen);
        const hazardRegisters = stage.id === 'ID' ? props.snapshot.activeHazards.filter(hazard => hazard.consumerId === instructionId).map(hazard => hazard.register) : [];
        return <div key={stage.id} ref={node => { labels.current[`stage-${stage.id}`] = node; }} className="pipeline-scene-project-label">
          <div className={`pipeline-stage-label${instruction ? ' is-occupied' : ''}${chosen ? ' is-selected' : ''}${muted ? ' is-muted' : ''}${hazardRegisters.length ? ' has-hazard' : ''}`}
            data-stage={stage.id} data-instruction-id={instructionId ?? ''} data-hazard={hazardRegisters.length ? 'RAW' : ''}
            style={{ '--pipeline-stage-color': stage.color } as CSSProperties}>
            <strong className="pipeline-stage-abbreviation">{stage.id}</strong>
            <span className="pipeline-stage-name">{stage.label}</span>
            {instruction ? <button type="button" className="pipeline-stage-instruction" onClick={() => props.onSelectInstruction(instruction.id)}
              onMouseEnter={() => setHoveredStage(stage.id)} onMouseLeave={() => setHoveredStage(null)}
              aria-label={`选择流水线指令 ${ordinal + 1}: ${instruction.text}`} aria-pressed={chosen} title={instruction.text}>
              <span className="pipeline-stage-ordinal">I{ordinal + 1}</span>
              <span className="pipeline-stage-instruction-full">{instruction.text}</span>
              <span className="pipeline-stage-instruction-short">{instruction.opcode}</span>
            </button> : <span className="pipeline-stage-empty">空闲</span>}
            {hazardRegisters.length > 0 && <span className="pipeline-stage-hazard">RAW {hazardRegisters.map(register => `R${register}`).join(', ')}</span>}
          </div>
        </div>;
      })}
      {REGISTER_NAMES.map((label, index) => <div key={label} ref={node => { labels.current[`register-${index}`] = node; }} className="pipeline-scene-project-label pipeline-scene-register-project-label">
        <span className="pipeline-register-label">{label}</span>
      </div>)}
    </div>
    <div className="pipeline-scene-overlay-caption" aria-live="polite">
      <span className={selected ? 'has-selection' : ''}>{selected ? `${selected.text} · 完整五级路径` : '点击指令，查看完整五级路径'}</span>
      <span>级间寄存器在时钟边沿传递状态</span>
    </div>
  </div>;
}
