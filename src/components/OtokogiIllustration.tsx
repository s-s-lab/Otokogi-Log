interface OtokogiIllustrationProps {
  stage: 0 | 1 | 2 | 3 | 4
  name: string
  level?: number
  compact?: boolean
}

export function OtokogiIllustration({
  stage,
  name,
  level,
  compact = false,
}: OtokogiIllustrationProps) {
  const rank = Math.max(1, Math.min(10, level ?? stage * 2 + 1))

  return (
    <div
      className={`otokogi-illustration stage-${stage} level-${rank} ${
        compact ? 'compact' : ''
      }`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 320 300" role="img" aria-label={`${name}の男気イラスト`}>
        <g className="sun-rays">
          {Array.from({ length: 16 }, (_, index) => (
            <path
              key={index}
              d="M160 8 L169 70 L151 70 Z"
              transform={`rotate(${index * 22.5} 160 150)`}
            />
          ))}
        </g>
        <circle className="sun-disc" cx="160" cy="148" r="102" />

        {rank >= 8 && (
          <g className="rank-flames">
            <path d="M71 235c-31-39 8-56-3-91 33 27 34 48 20 72 18-13 24-28 18-44 31 36 10 63-18 80z" />
            <path d="M249 235c31-39-8-56 3-91-33 27-34 48-20 72-18-13-24-28-18-44-31 36-10 63 18 80z" />
          </g>
        )}

        {rank >= 9 && (
          <g className="legend-stars">
            <path d="m89 70 5 13 14 1-11 9 3 14-11-8-12 8 4-14-11-9 14-1z" />
            <path d="m231 70 5 13 14 1-11 9 3 14-11-8-12 8 4-14-11-9 14-1z" />
            <path d="m160 21 4 10 11 1-9 7 3 11-9-6-10 6 3-11-8-7 11-1z" />
          </g>
        )}

        {rank >= 10 && (
          <g className="crown">
            <path d="M111 74 126 39l30 28 32-30 18 39-13 20h-69z" />
            <circle cx="126" cy="39" r="6" />
            <circle cx="188" cy="37" r="6" />
            <circle cx="156" cy="67" r="6" />
          </g>
        )}

        <g className="body">
          <path
            className="jacket"
            d="M83 277c5-50 21-74 56-82h42c35 8 52 32 57 82z"
          />
          <path className="shirt" d="m136 196 24 48 24-48-12-11h-25z" />
          <path className="neck" d="M140 170h40v36h-40z" />
          {rank >= 4 && (
            <g className="rank-shoulder-marks">
              <path d="M101 225c13-17 25-24 40-29l8 15c-17 6-27 13-37 29z" />
              <path d="M219 225c-13-17-25-24-40-29l-8 15c17 6 27 13 37 29z" />
            </g>
          )}
          {rank >= 6 && (
            <g className="haori-trim">
              <path d="m118 205 27 72h15l-31-82z" />
              <path d="m202 205-27 72h-15l31-82z" />
            </g>
          )}
        </g>

        <g className="head">
          <path
            className="ear left"
            d="M111 127c-19-7-24 11-15 29 6 11 17 13 25 4z"
          />
          <path
            className="ear right"
            d="M208 127c19-7 24 11 15 29-6 11-17 13-25 4z"
          />
          <path
            className="face"
            d="M111 119c3-47 26-66 49-66s46 19 49 66l-7 41c-8 28-25 42-42 42s-34-14-42-42z"
          />
          <path
            className="hair"
            d="M111 123c-8-40 10-78 49-78 36 0 58 30 49 78l-14-25-12 11-16-22-20 20-16-12z"
          />
          <path className="brow" d="m126 128 21-6 2 7-22 5zm47-6 21 6-1 6-22-5z" />
          <circle className="eye" cx="139" cy="138" r="4" />
          <circle className="eye" cx="181" cy="138" r="4" />
          <path className="nose" d="m160 138-5 17 10 1" />
          <path
            className="smile"
            d={stage === 0 ? 'M147 170 Q160 165 173 170' : 'M145 166 Q160 181 176 165'}
          />

          {rank >= 5 && (
            <path
              className="mustache"
              d="M160 160c-10-9-20-8-25 1 7-2 13 1 25 8 12-7 18-10 25-8-5-9-15-10-25-1z"
            />
          )}

          <g className="headband">
            <path d="M108 109c19-14 82-14 104 0l-3 17c-29-11-69-11-98 0z" />
            <circle cx="160" cy="114" r="12" />
            {rank >= 3 && <path className="headband-mark" d="m160 105 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />}
            <path d="m212 109 25-12-16 23 26 5-36 4z" />
          </g>
        </g>

        <g className="fists">
          <path
            className="arm left"
            d="M113 217c-20-14-38-22-47-10-9 13 10 31 34 44z"
          />
          <path
            className="arm right"
            d="M207 217c20-14 38-22 47-10 9 13-10 31-34 44z"
          />
          <path
            className="fist left"
            d="M51 197c-8-14-2-30 13-35 12-4 23 2 28 12 7 16-2 32-18 37-9 2-18-3-23-14z"
          />
          <path
            className="fist right"
            d="M269 197c8-14 2-30-13-35-12-4-23 2-28 12-7 16 2 32 18 37 9 2 18-3 23-14z"
          />
          <path className="fist-line left" d="m56 180 29 5m-27 8 27 3" />
          <path className="fist-line right" d="m264 180-29 5m27 8-27 3" />
        </g>

        {rank >= 2 && (
          <g className="sparkles">
            <path d="m72 89 4 12 12 4-12 4-4 12-4-12-12-4 12-4z" />
            {rank >= 7 && (
              <path d="m55 135 3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
            )}
            <path d="m249 101 3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
          </g>
        )}
      </svg>
    </div>
  )
}
