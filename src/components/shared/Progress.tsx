interface ProgressBarProps {
  percent: number;
}

export function ProgressBar({ percent }: ProgressBarProps) {
  return (
    <div className="progress-bar-track">
      <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

interface ProgressRingProps {
  percent: number;
  size?: number;
  thickness?: number;
}

export function ProgressRing({ percent, size = 48, thickness = 5 }: ProgressRingProps) {
  return (
    <div
      className="progress-ring"
      style={{
        width: size,
        height: size,
        backgroundImage: `conic-gradient(var(--teal) ${percent * 3.6}deg, var(--border) 0deg)`,
      }}
    >
      <div
        className="progress-ring-inner"
        style={{
          width: size - thickness * 2,
          height: size - thickness * 2,
          fontSize: size * 0.24,
        }}
      >
        {percent}
      </div>
    </div>
  );
}
