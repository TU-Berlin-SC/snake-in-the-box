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

// n이 몇이든 큐브가 차지하는 월드 크기는 항상 이 값으로 고정.
// (예전엔 좌표에 SCALE만 곱해서 n이 커질수록 큐브가 화면을 뚫고 나갔음)
const BOX_SIZE = 4.4;

// [이동 로직 1] 격자 좌표 -> 3D 공간 좌표 변환
// JSON에는 [0,1,2] 같은 "격자 위 정수 좌표"만 들어있음 (실제 이동 계산 없음).
// (v / (n-1))로 0..1 범위로 정규화한 뒤 -0.5 해서 중심을 원점에 맞추고,
// BOX_SIZE를 곱해 고정된 크기로 스케일링 — n이 커져도 큐브 크기/중심 동일.
//
// 축 순서 주의: matplotlib(원본 solutions/*.png)는 Z축이 "위"인 관례를 쓰는데,
// Three.js는 Y축이 "위"인 관례를 씀. 그래서 격자의 z좌표를 Three.js의 y(위)에,
// 격자의 y좌표를 Three.js의 z(안쪽/바깥쪽)에 매핑해서 png랑 위아래가 맞게 함.
function makeToPos(n: number) {
  const span = Math.max(n - 1, 1);
  return (v: Vertex): [number, number, number] => [
    (v[0] / span - 0.5) * BOX_SIZE, // grid x -> three.js x
    (v[2] / span - 0.5) * BOX_SIZE, // grid z (matplotlib 기준 "위") -> three.js y (위)
    (v[1] / span - 0.5) * BOX_SIZE, // grid y -> three.js z
  ];
}

const generateAllVertices = (n: number): Vertex[] => {
  const vertices: Vertex[] = [];
  for (let x = 0; x < n; x++)
    for (let y = 0; y < n; y++)
      for (let z = 0; z < n; z++)
        vertices.push([x, y, z]);
  return vertices;
};

// 격자에서 진짜 "이웃"인지 판정. 정확히 한 축에서만 1칸 차이나야 함.
// (hamming distance는 n=2 이진 큐브에서만 우연히 맞았던 버그가 있어서 교체)
const isGridNeighbor = (a: Vertex, b: Vertex) => {
  let diffAxes = 0;
  for (let i = 0; i < 3; i++) {
    const diff = Math.abs(a[i] - b[i]);
    if (diff === 0) continue;
    if (diff !== 1) return false;
    diffAxes++;
  }
  return diffAxes === 1;
};

const generateAllEdges = (vertices: Vertex[]): [Vertex, Vertex][] => {
  const edges: [Vertex, Vertex][] = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      if (isGridNeighbor(vertices[i], vertices[j])) {
        edges.push([vertices[i], vertices[j]]);
      }
    }
  }
  return edges;
};

const SNAKE_GREEN = "#7CC28E";
const SNAKE_GREEN_DARK = "#59B270";
const BELLY_CREAM = "#f5f0dc";

// [이동 로직 3] 잘라낸 점들을 부드러운 곡선(튜브)으로 이어붙임.
// points는 이미 순서가 정해진 좌표 리스트라서, "점 A에서 B로 이동" 계산이 아니라
// 그 점들을 지나는 곡선을 한 번에 만들어 관(tube) 지오메트리를 씌우는 것뿐.
// closed=true면 마지막 점과 첫 점을 이어 고리로 닫음 (coil용).
// radius는 격자 간격에 비례 — n이 커져도 파이프가 상대적으로 두꺼워지지 않음.
function SnakeTube({
  points,
  closed,
  radius,
}: {
  points: THREE.Vector3[];
  closed: boolean;
  radius: number;
}) {
  const { body, belly } = useMemo(() => {
    if (points.length < 2) return { body: null, belly: null };
    const curve = new THREE.CatmullRomCurve3(points, closed, "catmullrom", 0.1);
    const segments = Math.max(points.length * 8, 24);
    const body = new THREE.TubeGeometry(curve, segments, radius, 12, closed);
    // 배 부분: 살짝 얇은 크림색 튜브를 아래로 조금 내려 겹쳐서 배 비늘 느낌
    const belly = new THREE.TubeGeometry(curve, segments, radius * 0.82, 12, closed);
    belly.translate(0, -radius * 0.28, 0);
    return { body, belly };
  }, [points, closed, radius]);

  if (!body) return null;
  return (
    <group>
      <mesh geometry={body}>
        <meshStandardMaterial color={SNAKE_GREEN} roughness={0.55} metalness={0.05} />
      </mesh>
      {belly && (
        <mesh geometry={belly}>
          <meshStandardMaterial color={BELLY_CREAM} roughness={0.7} />
        </mesh>
      )}
    </group>
  );
}

// 뱀 머리: 진행 방향을 바라보는 둥근 머리 + 눈 2개 + 빨간 혀
function SnakeHead({
  position,
  direction,
  radius,
}: {
  position: THREE.Vector3;
  direction: THREE.Vector3;
  radius: number;
}) {
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    // 머리 지오메트리는 +Z를 "앞"으로 만들어놨으므로 +Z를 진행 방향으로 회전
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.clone().normalize());
    return q;
  }, [direction]);

  const r = radius;
  return (
    <group position={position} quaternion={quaternion}>
      {/* 머리통: 몸통보다 살짝 크고 앞뒤로 길쭉 */}
      <mesh scale={[1.35, 1.2, 1.7]}>
        <sphereGeometry args={[r, 20, 20]} />
        <meshStandardMaterial color={SNAKE_GREEN} roughness={0.5} />
      </mesh>
      {/* 눈: 까만 단추 눈 + 작은 하이라이트 (귀여움 담당) */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * r * 0.62, r * 0.72, r * 0.55]}>
          <mesh>
            <sphereGeometry args={[r * 0.26, 12, 12]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.25} />
          </mesh>
          <mesh position={[side * r * 0.07, r * 0.09, r * 0.16]}>
            <sphereGeometry args={[r * 0.07, 8, 8]} />
            <meshStandardMaterial color="#ffffff" roughness={0.1} />
          </mesh>
        </group>
      ))}
      {/* 혀: 빨간 원기둥 + 끝 두 갈래 */}
      <group position={[0, -r * 0.15, r * 1.8]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r * 0.07, r * 0.07, r * 0.9, 8]} />
          <meshStandardMaterial color="#e53935" roughness={0.4} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * r * 0.12, 0, r * 0.55]}
            rotation={[Math.PI / 2, 0, -side * 0.5]}
          >
            {/* radiusTop(앞쪽 끝)을 얇게 해서 끝으로 갈수록 가늘어지는 갈래 */}
            <cylinderGeometry args={[r * 0.02, r * 0.05, r * 0.35, 6]} />
            <meshStandardMaterial color="#e53935" roughness={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// 꼬리: 뒤쪽(진행 반대 방향)으로 갈수록 뾰족해지는 원뿔
function SnakeTail({
  position,
  direction,
  radius,
}: {
  position: THREE.Vector3;
  direction: THREE.Vector3; // 꼬리에서 몸통 쪽으로 향하는 방향
  radius: number;
}) {
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    // cone은 +Y가 뾰족한 끝. 뾰족한 끝이 몸통 반대(진행 반대) 방향을 향하게
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize().negate());
    return q;
  }, [direction]);

  return (
    <group position={position} quaternion={quaternion}>
      <mesh position={[0, radius * 1.1, 0]}>
        <coneGeometry args={[radius * 0.95, radius * 2.6, 12]} />
        <meshStandardMaterial color={SNAKE_GREEN_DARK} roughness={0.55} />
      </mesh>
    </group>
  );
}

// Grid
function GridLines({ vertices, toPos }: { vertices: Vertex[]; toPos: (v: Vertex) => [number, number, number] }) {
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

// 별 배경 (adjusted size and location)
function Stars() {
  const stars = useMemo(() => {
    const positions = [];
    for (let i = 0; i < 300; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
    //   const r = 20 + Math.random() * 15;
     // 카메라보다 살짝 먼 거리에 별 배치
     const r = BOX_SIZE * 2 + Math.random() * 5;  // 8.8 ~ 13.8 (카메라 6.82보다 약간 밖)
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
      <pointsMaterial color="#ffffff" size={0.09} transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

const SnakeCubeView: React.FC<SnakeCubeViewProps> = ({ data, revealCount }) => {
  const n = data.n || 3;
  const toPos = useMemo(() => makeToPos(n), [n]);

  const gridData = useMemo(() => {
    const vertices = generateAllVertices(n);
    return { vertices, n };
  }, [n]);

  // 튜브 반지름을 격자 간격에 비례시켜서 n이 커져도 부담스럽게 두꺼워지지 않게 (camera view)
  const spacing = BOX_SIZE / Math.max(n - 1, 1);
  const tubeRadius = Math.min(spacing * 0.17, 0.24);

  // [이동 로직 2] "몇 걸음 왔는지"로 전체 경로를 앞에서부터 잘라냄.
  // data.path는 solver가 정해놓은 전체 순서(고정 배열)이고, revealCount가
  // 바뀔 때마다 앞부분만 다시 잘라서 보여줌. 애니메이션 = slice 길이 증가.
  const revealed = useMemo(
    () => data.path.slice(0, Math.max(1, Math.min(revealCount, data.path.length))),
    [data.path, revealCount]
  );

  // coil이고 전체가 다 드러났는지 (머리가 첫 점을 바라보게 하는 용도).
  // 튜브 자체는 절대 완전히 닫지 않음: 마지막 한 칸은 머리(코+혀)와 꼬리(원뿔)가
  // 마주보며 채우는 "우로보로스" 스타일 — 완성돼도 머리/꼬리가 뭉개지지 않고 구분됨.
  const isFullyRevealed = revealed.length === data.path.length;
  const isChasingTail = data.is_cycle && isFullyRevealed && revealed.length > 2;

  const revealedPositions = useMemo(() => {
    const positions = revealed.map((v) => new THREE.Vector3(...toPos(v)));
    // coil 완성 시: 머리쪽·꼬리쪽 양 끝을 상대방 쪽으로 85%까지 늘려서
    // 한 칸짜리 갭을 아주 작은 틈으로 줄임 (우로보로스 느낌)
    // if (data.is_cycle && positions.length === data.path.length && positions.length > 2) {
    //   const first = positions[0];
    //   const last = positions[positions.length - 1];
    //   // 조절 구간
    //   // 꼬리 앞에 first에서 last 쪽으로 85% 간 점 삽입
    //   const nearTail = first.clone().lerp(last.clone(), 0.05);
    //   // 머리 뒤에 last에서 first 쪽으로 85% 간 점 추가
    //   const nearHead = last.clone().lerp(first.clone(), 0.2);
    //   return [nearTail, ...positions, nearHead];
    // }
    if (data.is_cycle && positions.length === data.path.length && positions.length > 2) {
        const first = positions[0];
        const last = positions[positions.length - 1];
        
        if (n === 2) {
          // n=2 전용: 아주 작은 비율로 갭을 크게
          const nearTail = first.clone().lerp(last.clone(), 0.1);
          const nearHead = last.clone().lerp(first.clone(), 0.6);
          return [nearTail, ...positions, nearHead];
        }
        
        // n>=3: 기존 비율
        const nearTail = first.clone().lerp(last.clone(), 0.05);
        const nearHead = last.clone().lerp(first.clone(), 0.2);
        return [nearTail, ...positions, nearHead];
      }
    return positions;
  }, [revealed, toPos, data.is_cycle, data.path.length]);

  // 머리 방향: 마지막 두 점의 차. coil이 닫힌 상태면 "다음 점 = 첫 점"이므로 그쪽으로
  const headDir = useMemo(() => {
    const m = revealedPositions.length;
    if (m < 2) return new THREE.Vector3(0, 0, 1);
    if (isChasingTail) {
      return revealedPositions[0].clone().sub(revealedPositions[m - 1]);
    }
    return revealedPositions[m - 1].clone().sub(revealedPositions[m - 2]);
  }, [revealedPositions, isChasingTail]);

  // 꼬리 방향: 첫 점 -> 두 번째 점 (몸통 쪽)
  const tailDir = useMemo(() => {
    if (revealedPositions.length < 2) return new THREE.Vector3(0, 0, 1);
    return revealedPositions[1].clone().sub(revealedPositions[0]);
  }, [revealedPositions]);

  // 카메라: 고정 크기 큐브가 처음부터 한 화면에 다 들어오는 거리
  const camDist = BOX_SIZE * 1.55;

  return (
    <div className="snake-view-container">
      <Canvas camera={{ position: [camDist, camDist * 0.8, camDist], fov: 40 }}>
        <color attach="background" args={["#121a2e"]} />
        <OrbitControls enableDamping dampingFactor={0.08} />

        <ambientLight intensity={0.7} />
        <pointLight position={[5, 5, 5]} intensity={1.2} />
        <pointLight position={[-5, -3, -5]} intensity={0.4} />

        <Stars />
        <GridLines vertices={gridData.vertices} toPos={toPos} />

        {/* 뱀 몸통 (튜브 + 배) */}
        {revealedPositions.length >= 2 && (
          <SnakeTube points={revealedPositions} closed={false} radius={tubeRadius} />
        )}

        {/* 머리 (눈 + 혀). coil이 닫혀도 머리는 계속 보여줌 */}
        {revealedPositions.length >= 2 && (
          <SnakeHead
            position={revealedPositions[revealedPositions.length - 1]}
            direction={headDir}
            radius={tubeRadius * 1.15}
          />
        )}

        {/* 꼬리 (뾰족, 짙은 초록 = 머리와 명암 구분). 우로보로스 스타일이라 항상 표시 */}
        {revealedPositions.length >= 2 && (
          <SnakeTail
            position={revealedPositions[0]}
            direction={tailDir}
            radius={tubeRadius}
          />
        )}

        {/* 아직 한 점뿐일 때는 그냥 작은 머리만 */}
        {revealedPositions.length === 1 && (
          <mesh position={revealedPositions[0]}>
            <sphereGeometry args={[tubeRadius * 1.2, 16, 16]} />
            <meshStandardMaterial color={SNAKE_GREEN} roughness={0.5} />
          </mesh>
        )}

        {/* 중간 방문한 꼭지점 (작은 점) */}
        {revealed.map((v, i) => {
          const isHead = i === revealed.length - 1;
          const isTail = i === 0;
          if (isHead || isTail) return null;
          return (
            <mesh key={`dot-${i}`} position={toPos(v)}>
              <sphereGeometry args={[tubeRadius * 0.4, 6, 6]} />
              <meshStandardMaterial color="#66BB6A" transparent opacity={0.4} />
            </mesh>
          );
        })}
      </Canvas>
    </div>
  );
};

export default SnakeCubeView;
