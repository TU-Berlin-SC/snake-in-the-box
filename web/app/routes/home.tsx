import { useEffect, useMemo, useRef, useState } from "react";
import ClientOnly from "../components/ClientOnly";
import SnakeCubeView from "~/components/SnakeCubeView";
import "../styles/Home.css";
import type { AlgorithmType, SnakeData } from "../types/snake";

const TYPE_OPTIONS: { value: AlgorithmType; label: string }[] = [
  { value: "coil", label: "Coil" },
  { value: "snake", label: "Snake" },
];

// {type}_d{d}_n{n}.json 전부 번들에 포함
const dataModules = import.meta.glob<{ default: SnakeData }>(
  "../data/*_d*_n*.json",
  { eager: true }
);

// 파일명에서 (type, d, n) 조합을 파싱해서 "실제로 존재하는 데이터"만 옵션으로 노출.
// 파일이 없는 조합은 버튼 자체가 안 생기므로 missing-file 상태가 원천 차단됨.
const FILE_RE = /(snake|coil)_d(\d+)_n(\d+)\.json$/;

function getAvailable() {
  const map = new Map<string, Set<number>>(); // `${type}:${d}` -> Set<n>
  for (const path of Object.keys(dataModules)) {
    const m = path.match(FILE_RE);
    if (!m) continue;
    const key = `${m[1]}:${m[2]}`;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(Number(m[3]));
  }
  return map;
}

function getSnakeData(type: AlgorithmType, d: number, n: number): SnakeData | null {
  const entry = Object.entries(dataModules).find(([path]) =>
    path.endsWith(`${type}_d${d}_n${n}.json`)
  );
  return entry ? entry[1].default : null;
}

export default function Home() {
  const available = useMemo(getAvailable, []);

  const [type, setType] = useState<AlgorithmType>("coil");
  const [d, setD] = useState(3);
  const [n, setN] = useState(3);
  const [revealCount, setRevealCount] = useState(1);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 현재 type에서 사용 가능한 차원 목록 (예: coil -> [3], snake -> [2, 3])
  const dOptions = useMemo(() => {
    const dims = new Set<number>();
    for (const key of available.keys()) {
      const [t, dim] = key.split(":");
      if (t === type) dims.add(Number(dim));
    }
    return [...dims].sort((a, b) => a - b);
  }, [available, type]);

  // 현재 type+d에서 사용 가능한 n 목록 (d=2는 n이 커질 수 있으므로 동적으로)
  const nOptions = useMemo(() => {
    const set = available.get(`${type}:${d}`);
    return set ? [...set].sort((a, b) => a - b) : [];
  }, [available, type, d]);

  // type이 바뀌었는데 현재 d가 그 type에 없으면 첫 번째 가능한 d로
  useEffect(() => {
    if (dOptions.length > 0 && !dOptions.includes(d)) setD(dOptions[0]);
  }, [dOptions, d]);

  // type/d가 바뀌었는데 현재 n이 없으면 첫 번째 가능한 n으로
  useEffect(() => {
    if (nOptions.length > 0 && !nOptions.includes(n)) setN(nOptions[0]);
  }, [nOptions, n]);

  const snake = useMemo(() => getSnakeData(type, d, n), [type, d, n]);

  // n/d/type이 바뀌면 재생 중이던 걸 멈추고, 완성된 최종 결과를 바로 보여줌
  // (Tim: "the user should see the result immediately", 재생은 원하면 누르는 옵션)
  useEffect(() => {
    setPlaying(false);
    setRevealCount(snake ? snake.path.length : 1);
  }, [n, d, type, snake]);

  useEffect(() => {
    if (!playing || !snake) return;
    timerRef.current = setInterval(() => {
      setRevealCount((c) => {
        if (c >= snake.path.length) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, 800); // 800ms마다 한 칸씩 이동
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, snake]);

  const selectors = (
    <div className="n-selector">
      <select
        value={type}
        onChange={(e) => setType(e.target.value as AlgorithmType)}
        className="rounded-lg border border-slate-700 bg-slate-900 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-lime-400"
      >
        {TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select
        value={d}
        onChange={(e) => setD(Number(e.target.value))}
        className="rounded-lg border border-slate-700 bg-slate-900 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-lime-400"
      >
        {dOptions.map((dim) => (
          <option key={dim} value={dim}>
            d = {dim}
          </option>
        ))}
      </select>
      {nOptions.map((option) => (
        <button
          key={option}
          onClick={() => setN(option)}
          className={`n-button ${option === n ? "active" : ""}`}
        >
          n = {option}
        </button>
      ))}
    </div>
  );

  if (!snake) {
    return (
      <main className="home-container">
        <div className="header">
          <h1>
            🐍 Snake in the Box
            <span className="badge">d = {d}</span>
          </h1>
        </div>
        {selectors}
        <p className="dummy-note">
          ⚠️ No {type} solution file found for d = {d}, n = {n}.
        </p>
      </main>
    );
  }

  const gridLabel = d === 2 ? `${n}×${n}` : `${n}×${n}×${n}`;

  return (
    <main className="home-container">
      <div className="header">
        <h1>
          🐍 Snake in the Box
          <span className="badge">d = {d}</span>
        </h1>
        {/* TODO(Tim): swap for the exact mathematical description once he sends it */}
        <p className="subtitle">
          {type === "coil"
            ? `Longest induced cycle on the ${n} x ${n} x ${n} grid graph.`
            : `Longest induced path on the ${n} x ${n} x ${n} grid graph.`}
        </p>
      </div>

      {/* type + dimension dropdowns + N selector, same row */}
      {selectors}

      {/* cube view */}
      <ClientOnly
        fallback={
          <div className="loading-placeholder">
            <div className="loading-spinner"></div>
            <span>Loading 3D View...</span>
          </div>
        }
      >
        {() => <SnakeCubeView data={snake} revealCount={revealCount} />}
      </ClientOnly>

      {/* controls */}
      <div className="controls">
        <button
          onClick={() => {
            if (revealCount >= snake.path.length) setRevealCount(1);
            setPlaying((p) => !p);
          }}
          className="control-button"
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <div className="slider-container">
          <input
            type="range"
            min={1}
            max={snake.path.length}
            value={revealCount}
            onChange={(e) => {
              setPlaying(false);
              setRevealCount(Number(e.target.value));
            }}
            className="step-slider"
          />
          <span className="step-info">
            {revealCount} / {snake.path.length}
          </span>
        </div>
        <button
          onClick={() => {
            setPlaying(false);
            setRevealCount(snake.path.length);
          }}
          className="control-button"
        >
          ⏩ Skip
        </button>
      </div>

      {snake.is_dummy && <p className="dummy-note">⚠️ {snake.note}</p>}
    </main>
  );
}
