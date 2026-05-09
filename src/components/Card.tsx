import type { CSSProperties } from 'react';
import type { Card as CardType, CardColor, CardValue } from '../types';

interface CardProps {
  card?: CardType | null;
  faceDown?: boolean;
  className?: string;
  onClick?: () => void;
  style?: CSSProperties;
}

export default function Card({ card, faceDown, className = '', onClick, style }: CardProps) {
  if (faceDown || !card) {
    return (
      <div className={`card card-back ${className}`} style={style} onClick={onClick}>
        <div className="card-inner">
          <div className="card-ellipse">
            <div className="card-back-text">UNO</div>
          </div>
        </div>
      </div>
    );
  }

  const { color, value } = card;
  const isWild = color === 'wild';
  const cornerLabel = formatCorner(value);

  return (
    <div
      className={`card ${className}`}
      data-color={color}
      data-value={String(value)}
      style={style}
      onClick={onClick}
    >
      <div className="card-inner">
        {!isWild && <div className="card-corner tl">{cornerLabel}</div>}
        <div className="card-ellipse">
          {isWild ? (
            <>
              <div className="wild-quadrants">
                <div />
                <div />
                <div />
                <div />
              </div>
              <CenterContent value={value} color={color} />
            </>
          ) : (
            <CenterContent value={value} color={color} />
          )}
        </div>
        {!isWild && <div className="card-corner br">{cornerLabel}</div>}
        {isWild && <WildCorners value={value} />}
      </div>
    </div>
  );
}

function formatCorner(value: CardValue): string {
  if (value === 'skip') return '⦸';
  if (value === 'reverse') return '↺';
  if (value === '+2') return '+2';
  if (value === '+4') return '+4';
  if (value === 'wild') return '';
  return String(value);
}

function WildCorners({ value }: { value: CardValue }) {
  const label = value === '+4' ? '+4' : '';
  return (
    <>
      <div className="card-corner tl" style={{ color: '#fff' }}>
        {label || <MiniWildSwatch />}
      </div>
      <div className="card-corner br" style={{ color: '#fff' }}>
        {label || <MiniWildSwatch />}
      </div>
    </>
  );
}

function MiniWildSwatch() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '1em',
        height: '1em',
        borderRadius: '50%',
        background:
          'conic-gradient(from 0deg, var(--uno-red) 0 25%, var(--uno-yellow) 25% 50%, var(--uno-green) 50% 75%, var(--uno-blue) 75% 100%)',
        border: '1px solid #fff',
        verticalAlign: 'middle',
      }}
    />
  );
}

function CenterContent({ value, color }: { value: CardValue; color: CardColor }) {
  if (value === 'skip') return <SkipGlyph color={color} />;
  if (value === 'reverse') return <ReverseGlyph color={color} />;
  if (value === '+2') return <span className="card-value smaller">+2</span>;
  if (value === '+4')
    return (
      <span className="card-value smaller" style={{ color: '#fff' }}>
        +4
      </span>
    );
  if (value === 'wild') {
    return (
      <span
        className="card-value smaller"
        style={{ color: '#fff', fontSize: 'calc(var(--card-w) * 0.28)' }}
      >
        WILD
      </span>
    );
  }
  return <span className="card-value">{value}</span>;
}

function SkipGlyph({ color }: { color: CardColor }) {
  const stroke = colorVar(color);
  return (
    <svg className="glyph-svg" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="38" fill="none" stroke={stroke} strokeWidth="10" />
      <line
        x1="22"
        y1="22"
        x2="78"
        y2="78"
        stroke={stroke}
        strokeWidth="10"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ReverseGlyph({ color }: { color: CardColor }) {
  const stroke = colorVar(color);
  return (
    <svg className="glyph-svg" viewBox="0 0 100 100" aria-hidden="true">
      <path
        d="M20 35 H 60 A 18 18 0 0 1 60 71 H 50"
        fill="none"
        stroke={stroke}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon points="50,62 50,80 38,71" fill={stroke} />
      <path
        d="M80 65 H 40 A 18 18 0 0 1 40 29 H 50"
        fill="none"
        stroke={stroke}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon points="50,38 50,20 62,29" fill={stroke} />
    </svg>
  );
}

function colorVar(c: CardColor): string {
  switch (c) {
    case 'red':
      return 'var(--uno-red)';
    case 'yellow':
      return 'var(--uno-yellow)';
    case 'green':
      return 'var(--uno-green)';
    case 'blue':
      return 'var(--uno-blue)';
    default:
      return 'var(--uno-black)';
  }
}
