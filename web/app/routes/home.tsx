import { useEffect, useMemo, useRef, useState } from "react";
import ClientOnly from "../components/ClientOnly";
import SnakeCubeView from "~/components/SnakeCubeView";
import "../styles/Home.css";
import type { AlgorithmType, SnakeData } from "../types/snake";

const N_OPTIONS = [2, 3, 4, 5, 6];
const TYPE_OPTIONS: { value: AlgorithmType; label: string }[] = [
  { value: "coil", label: "Coil" },
  { value: "snake", label: "Snake" },
];

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
  const [n, setN] = useState(3);
  const [type, setType] = useState<AlgorithmType>("coil"); // 실제 solve 결과가 있는 coil을 기본값으로
  const [revealCount, setRevealCount] = useState(1);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const snake = useMemo(() => getSnakeData(type, n), [type, n]);

  // n/type이 바뀌면 재생 중이던 걸 멈추고, 완성된 최종 결과를 바로 보여줌
  // (Tim: "the user should see the result immediately", 재생은 원하면 누르는 옵션)
  useEffect(() => {
    setPlaying(false);
    setRevealCount(snake ? snake.path.length : 1);
  }, [n, type, snake]);

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

  if (!snake) {
    return (
      <main className="home-container">
        <div className="header">
          <h1>
            🐍 Snake in the Box
            <span className="badge">d = 3</span>
          </h1>
        </div>
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
        <p className="dummy-note">
          ⚠️ No {type} solution file found for n = {n} (app/data/{type}_n
          {n}.json is missing).
        </p>
      </main>
    );
  }

  return (
    <main className="home-container">
      <div className="header">
        <h1>
          🐍 Snake in the Box
          <span className="badge">d = 3</span>
        </h1>
        {/* TODO(Tim): swap for the exact mathematical description once he sends it */}
        <p className="subtitle">
          {type === "coil"
            ? `Closed loop of ${snake.path.length} points on a ${n}×${n}×${n} grid, no two non-consecutive points adjacent.`
            : `Open path of ${snake.path.length} points on a ${n}×${n}×${n} grid, no two non-consecutive points adjacent.`}
        </p>
      </div>

      {/* type dropdown + N selector, same row */}
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
