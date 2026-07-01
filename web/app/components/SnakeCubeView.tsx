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

// 몸통 연결 (튜브)
function SnakeTube({ points }: { points: THREE.Vector3[] }) {
  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.1);
    return new THREE.TubeGeometry(curve, Math.max(points.length * 6, 12), 0.12, 8, false);
  }, [points]);

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
          color="#4a5568"
          lineWidth={1}
          transparent
          opacity={0.3}
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

  const revealed = useMemo(
    () => data.path.slice(0, Math.max(1, Math.min(revealCount, data.path.length))),
    [data.path, revealCount]
  );
  
  const revealedPositions = useMemo(
    () => revealed.map((v) => new THREE.Vector3(...toPos(v))),
    [revealed]
  );

  return (
    <div className="snake-view-container">
      <Canvas camera={{ position: [5, 4, 5], fov: 40 }}>
        <color attach="background" args={["#0a0e1a"]} />
        <OrbitControls enableDamping dampingFactor={0.08} />
        
        <ambientLight intensity={0.7} />
        <pointLight position={[5, 5, 5]} intensity={1.2} />
        <pointLight position={[-5, -3, -5]} intensity={0.4} />
        
        <Stars />
        <GridLines vertices={gridData.vertices} />

        {/* 뱀 몸통 (튜브) */}
        {revealedPositions.length >= 2 && (
          <SnakeTube points={revealedPositions} />
        )}

        {/* 머리 (초록색 점) */}
        {revealedPositions.length > 0 && (
          <mesh position={revealedPositions[revealedPositions.length - 1]}>
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshStandardMaterial color="#4CAF50" emissive="#4CAF50" emissiveIntensity={0.2} />
          </mesh>
        )}

        {/* 꼬리 (빨간색 점) */}
        {revealedPositions.length > 0 && (
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