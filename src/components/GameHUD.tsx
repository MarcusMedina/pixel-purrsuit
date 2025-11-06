interface GameHUDProps {
  score: number;
  lives: number;
  level: number;
}

export const GameHUD = ({ score, lives, level }: GameHUDProps) => {
  return (
    <div className="flex justify-between w-full max-w-[800px] px-4 py-3 retro-border" 
         style={{ borderColor: "hsl(var(--c64-magenta))", backgroundColor: "hsl(var(--card))" }}>
      <div className="pixel-font text-lg" style={{ color: "hsl(var(--c64-yellow))" }}>
        SCORE: <span className="retro-glow">{score.toString().padStart(6, '0')}</span>
      </div>
      <div className="pixel-font text-lg" style={{ color: "hsl(var(--c64-green))" }}>
        LEVEL: <span className="retro-glow">{level}</span>
      </div>
      <div className="pixel-font text-lg" style={{ color: "hsl(var(--c64-magenta))" }}>
        LIVES: <span className="retro-glow">{"♥".repeat(lives)}</span>
      </div>
    </div>
  );
};
