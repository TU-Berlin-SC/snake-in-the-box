import { useEffect, useMemo, useRef, useState } from "react";
import ClientOnly from "../components/ClientOnly";
import SnakeCubeView from "~/components/SnakeCubeView";
import { ALGORITHMS } from "../data/algorithms";
import "../styles/Home.css";
import type { AlgorithmType, SnakeData } from "../types/snake";

const N_OPTIONS = [2, 3, 4, 5, 6];

// snake_n*.json, coil_n*.json 전부 번들에 포함
const dataModules = import.meta.glob<{ default: SnakeData }>(
  "../data/*_n*.json",
  { eager: true }
);

function getSnakeData(type: AlgorithmType, n: number): SnakeData | null {
  const entry = Object.entries(dataModules).find(([path]) =>
    path.endsWith(`${type}_n${n}.json`)
  );
  return entry ? entry[1].default : null;
}

export default function Home() {
  const [n, setN] = useState(3); // 기본값 3으로 변경
  const [algorithmId, setAlgorithmId] = useState(ALGORITHMS[0].id);
  const [revealCount, setRevealCount] = useState(1);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const algorithm = useMemo(
    () => ALGORITHMS.find((a) => a.id === algorithmId) ?? ALGORITHMS[0],
    [algorithmId]
  );
  const snake = useMemo(
    () => getSnakeData(algorithm.type, n),
    [algorithm.type, n]
  );

  useEffect(() => {
    setRevealCount(1);
    setPlaying(false);
  }, [n, algorithmId]);

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

  if (!snake) return null;

  return (
    <main className="home-container">
      <div className="header">
        <h1>
          🐍 Snake in the Box
          <span className="badge">d = 3</span>
        </h1>
        <p className="subtitle">
          {algorithm.type === "coil"
            ? `A coil looping around an ${n}×${n}×${n} cube grid without touching itself.`
            : `The problem of a snake slithering on an ${n}×${n}×${n} cube grid without touching itself.`}
        </p>
      </div>

      {/* N selector */}
      <div className="n-selector">
        {N_OPTIONS.map((option) => (
          <button
            key={option}
            onClick={() => setN(option)}
            className={`n-button ${option === n ? "active" : ""}`}
          >
            n = {option}
          </button>
        ))}
      </div>

      {/* algorithm selector (dropdown, tailwind) */}
      <div className="flex flex-col items-center gap-1 mt-3 mb-1">
        <label className="text-xs uppercase tracking-wide text-slate-400">
          Algorithm
        </label>
        <select
          value={algorithmId}
          onChange={(e) => setAlgorithmId(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 text-white text-sm px-3 py-2 min-w-[260px] focus:outline-none focus:ring-1 focus:ring-lime-400"
        >
          {ALGORITHMS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-slate-500">{algorithm.script}</span>
      </div>

      {/* cube view */}
      <ClientOnly
        fallback={
          <div className="loading-placeholder">
            <div className="loading-spinner"></div>
            <span>3D 뷰 불러오는 중...</span>
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
