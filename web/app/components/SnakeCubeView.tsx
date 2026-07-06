import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import type { SnakeData, Vertex } from "../types/snake";
import "../styles/SnakeCubeView.css";

interface SnakeCubeViewProps {
  data: SnakeData;
  revealCount: number;
}

const SCALE = 2.2;
// to test

// [이동 로직 1] 격자 좌표 -> 3D 공간 좌표 변환
// JSON에는 [0,1,2] 같은 "격자 위 정수 좌표"만 들어있음 (실제 이동 계산 없음).
// 여기서 하는 건 그 정수 좌표를 Three.js 씬에서 쓸 실수 좌표로 스케일링 +
// 중심 이동만 하는 것 —> 좌표계 변환일 뿐, 뱀이 움직이는 계산은 없음.
// (x,y) convertion
const toPos = (v: Vertex): [number, number, number] => [
  (v[0] - 1) * SCALE,
  (v[1] - 1) * SCALE,
  (v[2] - 1) * SCALE,
];

const generateAllVertices = (n: number): Vertex[] => {
  const vertices: Vertex[] = [];
  for (let x = 0; x < n; x++)
    for (let y = 0; y < n; y++)
      for (let z = 0; z < n; z++)
        vertices.push([x, y, z]);
  return vertices;
};

const hamming = (a: Vertex, b: Vertex) =>
  a.reduce((acc, val, i) => acc + (val !== b[i] ? 1 : 0), 0);

const generateAllEdges = (vertices: Vertex[]): [Vertex, Vertex][] => {
  const edges: [Vertex, Vertex][] = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      if (hamming(vertices[i], vertices[j]) === 1) {
        edges.push([vertices[i], vertices[j]]);
      }
    }
  }
  return edges;
};

// [이동 로직 3] 잘라낸 점들을 부드러운 곡선(튜브)으로 이어붙임.
// points는 이미 순서가 정해진 좌표 리스트(revealedPositions)라서,
// 여기서 하는 건 "점 A에서 점 B로 이동"이 아니라 그 점들을 지나는
// 곡선을 한 번에 계산해서 관(tube) 모양 지오메트리를 만드는 것뿐.
// closed=true면 마지막 점과 첫 점을 다시 이어서 고리로 닫음 (coil용).
// 몸통 연결 (튜브). closed=true면 마지막 점을 첫 점과 이어서 고리로 닫음 (coil용)
function SnakeTube({ points, closed }: { points: THREE.Vector3[]; closed: boolean }) {
  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(points, closed, "catmullrom", 0.1);
    return new THREE.TubeGeometry(curve, Math.max(points.length * 6, 12), 0.12, 8, closed);
  }, [points, closed]);

  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#4CAF50" roughness={0.4} metalness={0.1} />
    </mesh>
  );
}

// Grid
function GridLines({ vertices }: { vertices: Vertex[] }) {
  const edges = useMemo(() => generateAllEdges(vertices), [vertices]);
  
  return (
    <>
      {edges.map(([a, b], i) => (
        <Line
          key={`grid-${i}`}
          points={[toPos(a), toPos(b)]}
          color="#64748b"
          lineWidth={1}
          transparent
          opacity={0.5}
        />
      ))}
    </>
  );
}

// 별 배경
function Stars() {
  const stars = useMemo(() => {
    const positions = [];
    for (let i = 0; i < 300; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 20 + Math.random() * 15;
      positions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
    }
    return new Float32Array(positions);
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={300}
          array={stars}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.06} transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

const SnakeCubeView: React.FC<SnakeCubeViewProps> = ({ data, revealCount }) => {
  const gridData = useMemo(() => {
    const n = data.n || 3;
    const vertices = generateAllVertices(n);
    return { vertices, n };
  }, [data.n]);

  // [이동 로직 2] 몇 걸음 왔는지로 전체 경로를 앞에서부터 잘라냄.
  // data.path는 이미 solver가 정해놓은 전체 순서(고정된 배열)이고,
  // revealCount가 바뀔 때마다 이 배열의 앞부분만 다시 잘라서 보여줌.
  // 즉 재생/애니메이션은 실제 이동 계산이 아니라 이 slice 길이를
  // 타이머로 늘리는 것뿐 (Home.tsx의 setInterval 참고).
  const revealed = useMemo(
    () => data.path.slice(0, Math.max(1, Math.min(revealCount, data.path.length))),
    [data.path, revealCount]
  );

  // coil(닫힌 루프)이고 전체 경로가 다 드러난 시점에만 첫 점을 다시 이어붙여서 고리를 닫음.
  // 재생 도중에는 열린 뱀처럼 계속 자라나다가 마지막에 스냅되어 닫힘.
  const isFullyRevealed = revealed.length === data.path.length;
  const shouldClose = data.is_cycle && isFullyRevealed && revealed.length > 2;

  const revealedPositions = useMemo(
    () => revealed.map((v) => new THREE.Vector3(...toPos(v))),
    [revealed]
  );

  return (
    <div className="snake-view-container">
      <Canvas camera={{ position: [5, 4, 5], fov: 40 }}>
        <color attach="background" args={["#121a2e"]} />
        <OrbitControls enableDamping dampingFactor={0.08} />
        
        <ambientLight intensity={0.7} />
        <pointLight position={[5, 5, 5]} intensity={1.2} />
        <pointLight position={[-5, -3, -5]} intensity={0.4} />
        
        <Stars />
        <GridLines vertices={gridData.vertices} />

        {/* 뱀 몸통 (튜브) */}
        {revealedPositions.length >= 2 && (
          <SnakeTube points={revealedPositions} closed={shouldClose} />
        )}

        {/* 머리 (초록색 점) */}
        {revealedPositions.length > 0 && (
          <mesh position={revealedPositions[revealedPositions.length - 1]}>
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshStandardMaterial color="#4CAF50" emissive="#4CAF50" emissiveIntensity={0.2} />
          </mesh>
        )}

        {/* 꼬리 (빨간색 점). coil이 닫히면 머리와 겹쳐서 하나의 고리로 보임 */}
        {revealedPositions.length > 0 && !shouldClose && (
          <mesh position={revealedPositions[0]}>
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.3} />
          </mesh>
        )}

        {/* 중간 방문한 꼭지점 (작은 점) */}
        {revealed.map((v, i) => {
          const isHead = i === revealed.length - 1;
          const isTail = i === 0;
          if (isHead || isTail) return null;
          return (
            <mesh key={`dot-${i}`} position={toPos(v)}>
              <sphereGeometry args={[0.05, 6, 6]} />
              <meshStandardMaterial color="#66BB6A" transparent opacity={0.4} />
            </mesh>
          );
        })}
      </Canvas>
    </div>
  );
};

export default SnakeCubeView;
