import { useEffect, useRef, useState } from "react";
import { GameEngine } from "@/lib/gameEngine";
import { GameHUD } from "./GameHUD";

export const Game = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameStarted, setGameStarted] = useState(false);
  const [highScore, setHighScore] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem('catsHighScore');
    if (stored) setHighScore(parseInt(stored));
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !gameStarted) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const engine = new GameEngine(canvas, ctx, {
      onScoreChange: setScore,
      onLivesChange: setLives,
      onLevelChange: setLevel,
    });

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.stop();
    };
  }, [gameStarted]);

  const handleStart = () => {
    setGameStarted(true);
  };

  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4">
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-bold pixel-font retro-glow" style={{ color: "hsl(var(--c64-cyan))" }}>
            C.A.T.S.
          </h1>
          <p className="text-2xl pixel-font" style={{ color: "hsl(var(--c64-magenta))" }}>
            Chase • Attack • Teleport • Survive
          </p>
        </div>

        <div className="retro-border p-8 space-y-4" style={{ borderColor: "hsl(var(--c64-yellow))", color: "hsl(var(--c64-yellow))" }}>
          <h2 className="text-xl pixel-font text-center mb-4">HOW TO PLAY</h2>
          <div className="space-y-2 text-sm pixel-font">
            <p>← → : MOVE LEFT/RIGHT</p>
            <p>↑ : CLIMB LADDERS</p>
            <p>SPACE : JUMP</p>
            <p></p>
            <p style={{ color: "hsl(var(--c64-green))" }}>• EAT MICE FROM BEHIND FOR POINTS</p>
            <p style={{ color: "hsl(var(--c64-red))" }}>• AVOID MICE BITING FROM FRONT</p>
            <p style={{ color: "hsl(var(--c64-orange))" }}>• AVOID THE DOG AT BOTTOM</p>
            <p style={{ color: "hsl(var(--c64-magenta))" }}>• USE TELEPORTERS TO MOVE</p>
            <p style={{ color: "hsl(var(--c64-cyan))" }}>• COLLECT POWER-UPS</p>
          </div>
        </div>

        {highScore > 0 && (
          <div className="retro-border px-8 py-4" style={{ borderColor: "hsl(var(--c64-cyan))", color: "hsl(var(--c64-cyan))" }}>
            <div className="text-2xl pixel-font text-center retro-glow">
              HIGH SCORE: {highScore.toString().padStart(6, '0')}
            </div>
          </div>
        )}

        <button
          onClick={handleStart}
          className="px-12 py-4 text-2xl pixel-font retro-border hover:opacity-80 transition-opacity"
          style={{ 
            backgroundColor: "hsl(var(--c64-cyan))", 
            color: "hsl(var(--background))",
            borderColor: "hsl(var(--c64-cyan))"
          }}
        >
          START GAME
        </button>

        <div className="text-xs pixel-font text-center mt-8" style={{ color: "hsl(var(--c64-cyan))" }}>
          <p>A LOVABLE PRODUCTION • 2025</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
      <GameHUD score={score} lives={lives} level={level} />
      <div className="scanlines retro-border" style={{ borderColor: "hsl(var(--c64-cyan))" }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="block"
          style={{ backgroundColor: "#1a1a2e" }}
        />
      </div>
      <div className="text-xs pixel-font" style={{ color: "hsl(var(--c64-yellow))" }}>
        PRESS ESC TO PAUSE
      </div>
    </div>
  );
};
