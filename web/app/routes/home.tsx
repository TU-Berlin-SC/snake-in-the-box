import { useEffect, useMemo, useRef, useState } from "react";
import ClientOnly from "../components/ClientOnly";
import SnakeCubeView from "~/components/SnakeCubeView";
import "../styles/Home.css";
import type { SnakeData } from "../types/snake";

const N_OPTIONS = [2, 3, 4, 5, 6];

const dataModules = import.meta.glob<{ default: SnakeData }>(
  "../data/snake_n*.json",
  { eager: true }
);

function getSnakeData(n: number): SnakeData | null {
  const entry = Object.entries(dataModules).find(([path]) =>
    path.endsWith(`snake_n${n}.json`)
  );
  return entry ? entry[1].default : null;
}

export default function Home() {
  const [n, setN] = useState(3);  // 기본값 3으로 변경
  const [revealCount, setRevealCount] = useState(1);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const snake = useMemo(() => getSnakeData(n), [n]);

  useEffect(() => {
    setRevealCount(1);
    setPlaying(false);
  }, [n]);

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
    }, 700);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, snake]);

  if (!snake) return null;

  return (
    <main className="home-container">
      <div className="header">
        <h1>
          🐍 Snake-in-the-box 3D viewer
          <span className="badge">d = 3</span>
        </h1>
        <p className="subtitle">
        The problem of a snake slithering on an {n}×{n}×{n} cube grid without touching itself.        </p>
      </div>

      {/* N selector */}
      <div className="n-selector">
        {N_OPTIONS.map((option) => (
          <button
            key={option}
            onClick={() => setN(option)}
            className={`n-button ${option === n ? 'active' : ''}`}
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

      {snake.is_dummy && (
        <p className="dummy-note">
          ⚠️ {snake.note}
        </p>
      )}
    </main>
  );
}
