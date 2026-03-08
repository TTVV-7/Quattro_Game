'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import Leaderboard from '@/components/Leaderboard';
import UsernameModal from '@/components/UsernameModal';
import { submitHighscore } from '@/lib/highscores';

/* ── constants ─────────────────────────────────────────────────── */
const COLS = 22, ROWS = 18, TS = 32;
const EMPTY = 0, DIRT = 1, ROCK = 2, PIPE = 3, CABLE = 4, REBAR = 5, CONCRETE = 6, ZONE = 7;
const MAT_COLORS: Record<number, string> = {
  [PIPE]: '#00bfff',
  [CABLE]: '#ff8800',
  [REBAR]: '#ff3355',
  [CONCRETE]: '#44ff88',
};
const MAT_NAMES: Record<number, string> = {
  [PIPE]: 'PIPE',
  [CABLE]: 'CABLE',
  [REBAR]: 'REBAR',
  [CONCRETE]: 'CONCR',
};
const MAT_LABELS: Record<number, string> = {
  [PIPE]: 'Pipe',
  [CABLE]: 'Cable',
  [REBAR]: 'Rebar',
  [CONCRETE]: 'Concrete',
};
const MATS = [PIPE, CABLE, REBAR, CONCRETE];

/* ── types ──────────────────────────────────────────────────────── */
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; color: string;
}
interface Zone { col: number; mat: number; }
interface Player { col: number; row: number; dir: number; }

/* ── icon drawing helper ────────────────────────────────────────── */
function drawMatIcon(
  c2d: CanvasRenderingContext2D,
  mat: number,
  x: number, y: number,
  size: number,
  alpha = 1
) {
  c2d.save();
  c2d.globalAlpha = alpha;
  const cx = x + size / 2, cy = y + size / 2, col = MAT_COLORS[mat];
  c2d.strokeStyle = col; c2d.fillStyle = col; c2d.lineWidth = size * 0.1;
  if (mat === PIPE) {
    c2d.beginPath(); c2d.arc(cx, cy, size * 0.38, 0, Math.PI * 2);
    c2d.strokeStyle = col; c2d.lineWidth = size * 0.12; c2d.stroke();
    c2d.beginPath(); c2d.arc(cx, cy, size * 0.14, 0, Math.PI * 2);
    c2d.fillStyle = col + '88'; c2d.fill();
    c2d.strokeStyle = col + '66'; c2d.lineWidth = size * 0.07;
    c2d.beginPath(); c2d.moveTo(x + size * 0.15, cy - size * 0.32); c2d.lineTo(x + size * 0.85, cy - size * 0.32); c2d.stroke();
    c2d.beginPath(); c2d.moveTo(x + size * 0.15, cy + size * 0.32); c2d.lineTo(x + size * 0.85, cy + size * 0.32); c2d.stroke();
  } else if (mat === CABLE) {
    c2d.beginPath();
    c2d.moveTo(cx + size * 0.1, y + size * 0.1);
    c2d.lineTo(cx - size * 0.08, cy - size * 0.02);
    c2d.lineTo(cx + size * 0.06, cy);
    c2d.lineTo(cx - size * 0.12, y + size * 0.9);
    c2d.lineWidth = size * 0.13; c2d.strokeStyle = col;
    c2d.lineJoin = 'round'; c2d.lineCap = 'round'; c2d.stroke();
    c2d.beginPath(); c2d.arc(cx + size * 0.1, y + size * 0.12, size * 0.07, 0, Math.PI * 2);
    c2d.fillStyle = col; c2d.fill();
  } else if (mat === REBAR) {
    c2d.lineWidth = size * 0.1; c2d.strokeStyle = col; c2d.lineCap = 'round';
    c2d.beginPath(); c2d.moveTo(x + size * 0.15, y + size * 0.15); c2d.lineTo(x + size * 0.85, y + size * 0.85); c2d.stroke();
    c2d.beginPath(); c2d.moveTo(x + size * 0.85, y + size * 0.15); c2d.lineTo(x + size * 0.15, y + size * 0.85); c2d.stroke();
    ([[0.15, 0.15], [0.85, 0.85], [0.85, 0.15], [0.15, 0.85]] as [number, number][]).forEach(([rx, ry]) => {
      c2d.beginPath(); c2d.arc(x + size * rx, y + size * ry, size * 0.1, 0, Math.PI * 2);
      c2d.fillStyle = col; c2d.fill();
    });
    c2d.beginPath(); c2d.arc(cx, cy, size * 0.1, 0, Math.PI * 2);
    c2d.fillStyle = '#fff'; c2d.fill();
  } else if (mat === CONCRETE) {
    const bw = size * 0.42, bh = size * 0.22, pad = size * 0.04;
    c2d.fillStyle = col + '33'; c2d.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);
    c2d.strokeStyle = col; c2d.lineWidth = size * 0.07; c2d.lineJoin = 'miter';
    c2d.strokeRect(x + pad, y + pad, bw, bh);
    c2d.strokeRect(x + pad + bw + pad, y + pad, size - bw - pad * 3, bh);
    const off = bw * 0.5;
    c2d.strokeRect(x + pad - off * 0.5, y + pad + bh + pad, bw * 0.55, bh);
    c2d.strokeRect(x + pad - off * 0.5 + bw * 0.55 + pad, y + pad + bh + pad, bw, bh);
    c2d.strokeRect(x + pad, y + pad + (bh + pad) * 2, bw, bh);
    c2d.strokeRect(x + pad + bw + pad, y + pad + (bh + pad) * 2, size - bw - pad * 3, bh);
  }
  c2d.restore();
}

/* ── game state refs (mutable, not reactive) ─────────────────────── */
interface GameState {
  grid: number[][];
  player: Player;
  zones: Zone[];
  score: number;
  timeLeft: number;
  gameActive: boolean;
  carried: number | null;
  particles: Particle[];
}

function createInitialState(): GameState {
  const grid: number[][] = [];
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      if (r === 0) { grid[r][c] = EMPTY; }
      else {
        const rng = Math.random();
        if (rng < 0.16) grid[r][c] = ROCK;
        else if (rng < 0.25) grid[r][c] = MATS[Math.floor(Math.random() * 4)];
        else grid[r][c] = DIRT;
      }
    }
  }
  const zones: Zone[] = [];
  const zPos = [2, 7, 12, 17];
  MATS.forEach((mat, i) => { const c = zPos[i]; grid[0][c] = ZONE; zones.push({ col: c, mat }); });
  return {
    grid,
    player: { col: Math.floor(COLS / 2), row: 0, dir: 1 },
    zones,
    score: 0,
    timeLeft: 60,
    gameActive: true,
    carried: null,
    particles: [],
  };
}

/* ── component ────────────────────────────────────────────────────── */
export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // React-state for HUD and overlays
  const [scoreDisplay, setScoreDisplay] = useState(0);
  const [timeDisplay, setTimeDisplay] = useState(60);
  const [carriedMat, setCarriedMat] = useState<number | null>(null);
  const [highScore, setHighScore] = useState(0);
  const [phase, setPhase] = useState<'start' | 'playing' | 'gameover'>('start');
  const [finalScore, setFinalScore] = useState(0);
  const [isNewHi, setIsNewHi] = useState(false);

  // username modal & leaderboard
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedUsername, setSubmittedUsername] = useState<string | undefined>();
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0);

  /* ── spawn material helper ──────────────────────────────────────── */
  const spawnMaterial = useCallback((mat: number) => {
    const gs = stateRef.current;
    for (let i = 0; i < 60; i++) {
      const r = 3 + Math.floor(Math.random() * (ROWS - 4));
      const c = Math.floor(Math.random() * COLS);
      if (gs.grid[r][c] === DIRT) { gs.grid[r][c] = mat; return; }
    }
  }, []);

  /* ── particle spawner ───────────────────────────────────────────── */
  const spawnParticles = useCallback((col: number, row: number, color: string, count: number) => {
    const gs = stateRef.current;
    for (let i = 0; i < count; i++) {
      gs.particles.push({
        x: col * TS + TS / 2, y: row * TS + TS / 2,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 1, color,
      });
    }
  }, []);

  /* ── end game ───────────────────────────────────────────────────── */
  const endGame = useCallback(() => {
    const gs = stateRef.current;
    gs.gameActive = false;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    const newHi = gs.score > highScore;
    if (newHi) {
      setHighScore(gs.score);
    }
    setFinalScore(gs.score);
    setIsNewHi(newHi);
    setPhase('gameover');
    setShowModal(true);
  }, [highScore]);

  /* ── move player ────────────────────────────────────────────────── */
  const movePlayer = useCallback((dc: number, dr: number) => {
    const gs = stateRef.current;
    if (!gs.gameActive) return;
    const nc = gs.player.col + dc, nr = gs.player.row + dr;
    if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) return;
    const cell = gs.grid[nr][nc];
    if (cell === ROCK) { spawnParticles(nc, nr, '#666', 5); return; }
    if (cell === DIRT) { gs.grid[nr][nc] = EMPTY; spawnParticles(nc, nr, '#7a5c2e', 7); }
    else if (MATS.includes(cell)) {
      if (!gs.carried) {
        gs.carried = cell;
        gs.grid[nr][nc] = EMPTY;
        spawnParticles(nc, nr, MAT_COLORS[cell], 10);
        setCarriedMat(cell);
      } else return;
    } else if (cell === ZONE) {
      const z = gs.zones.find(z => z.col === nc);
      if (z && gs.carried === z.mat) {
        gs.score += 100 + (nr + 1) * 10;
        setScoreDisplay(gs.score);
        gs.carried = null;
        setCarriedMat(null);
        spawnParticles(nc, nr, MAT_COLORS[z.mat], 20);
        spawnParticles(nc, nr, '#e8a020', 8);
        spawnMaterial(z.mat);
      } else if (z && gs.carried && gs.carried !== z.mat) return;
    }
    if (dc > 0) gs.player.dir = 1;
    if (dc < 0) gs.player.dir = -1;
    gs.player.col = nc;
    gs.player.row = nr;
  }, [spawnParticles, spawnMaterial]);

  /* ── draw ───────────────────────────────────────────────────────── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const gs = stateRef.current;
    const t = Date.now();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // sky row
    const sky = ctx.createLinearGradient(0, 0, 0, TS);
    sky.addColorStop(0, '#1a1200'); sky.addColorStop(1, '#0d0d0d');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, canvas.width, TS);
    // underground
    const ug = ctx.createLinearGradient(0, TS, 0, canvas.height);
    ug.addColorStop(0, '#1a0f00'); ug.addColorStop(1, '#120800');
    ctx.fillStyle = ug; ctx.fillRect(0, TS, canvas.width, canvas.height - TS);
    // divider
    ctx.strokeStyle = '#e8a02033'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, TS); ctx.lineTo(canvas.width, TS); ctx.stroke();
    // grid lines
    ctx.strokeStyle = '#ffffff06'; ctx.lineWidth = 1;
    for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * TS); ctx.lineTo(canvas.width, r * TS); ctx.stroke(); }
    for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * TS, 0); ctx.lineTo(c * TS, canvas.height); ctx.stroke(); }

    // cells
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * TS, y = r * TS, cell = gs.grid[r][c];
        if (cell === DIRT) {
          const d = r / ROWS;
          ctx.fillStyle = `rgb(${Math.floor(50 - d * 15)},${Math.floor(35 - d * 10)},${Math.floor(18 - d * 5)})`;
          ctx.fillRect(x, y, TS, TS);
          ctx.fillStyle = '#00000022'; ctx.fillRect(x, y, TS, 2);
        } else if (cell === ROCK) {
          ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x, y, TS, TS);
          ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x + 2, y + 2, TS - 4, TS - 4);
          ctx.fillStyle = '#4a4a4a'; ctx.fillRect(x + 8, y + 10, 6, 5);
          ctx.save(); ctx.globalAlpha = 0.6;
          ctx.font = `${TS - 10}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#aaa'; ctx.fillText('🪨', x + TS / 2, y + TS / 2 + 1);
          ctx.restore();
        } else if (MATS.includes(cell)) {
          const col = MAT_COLORS[cell];
          const glow = 0.5 + 0.5 * Math.sin(t / 400 + c + r);
          ctx.fillStyle = col + '18'; ctx.fillRect(x, y, TS, TS);
          ctx.shadowBlur = 10 + glow * 8; ctx.shadowColor = col;
          ctx.strokeStyle = col; ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 1.5, y + 1.5, TS - 3, TS - 3);
          ctx.shadowBlur = 0; ctx.lineWidth = 1;
          drawMatIcon(ctx, cell, x + 2, y + 2, TS - 4);
        } else if (cell === ZONE) {
          const z = gs.zones.find(z => z.col === c);
          if (z) {
            const zc = MAT_COLORS[z.mat];
            const pulse = 0.4 + 0.6 * Math.abs(Math.sin(t / 350));
            ctx.fillStyle = zc + Math.floor(pulse * 50 + 15).toString(16).padStart(2, '0');
            ctx.fillRect(x, y, TS, TS);
            ctx.shadowBlur = 10 + pulse * 8; ctx.shadowColor = zc;
            ctx.strokeStyle = zc; ctx.lineWidth = 2;
            ctx.strokeRect(x + 2, y + 2, TS - 4, TS - 4);
            ctx.shadowBlur = 0; ctx.lineWidth = 1;
            drawMatIcon(ctx, z.mat, x + 4, y + 3, TS - 10);
            ctx.fillStyle = zc; ctx.font = 'bold 8px Barlow Condensed,monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('▼', x + TS / 2, y + TS - 1);
          }
        }
      }
    }

    // particles
    gs.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color; ctx.shadowBlur = 5; ctx.shadowColor = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;

    // player
    const px = gs.player.col * TS, py = gs.player.row * TS;
    ctx.save();
    ctx.translate(px + TS / 2, py + TS / 2);
    ctx.scale(gs.player.dir, 1);
    ctx.shadowBlur = 16; ctx.shadowColor = '#e8a020';
    ctx.fillStyle = '#e8a020'; ctx.fillRect(-13, -8, 26, 14);
    ctx.fillStyle = '#f0b840'; ctx.fillRect(-3, -16, 13, 10);
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(-1, -14, 9, 7);
    ctx.fillStyle = '#00ccff33'; ctx.fillRect(-1, -14, 9, 7);
    ctx.fillStyle = '#555'; ctx.fillRect(-14, 5, 28, 6);
    ctx.fillStyle = '#e8a020';
    for (let i = -12; i < 14; i += 5) ctx.fillRect(i, 5, 3, 6);
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 4;
    ctx.fillStyle = '#ccc'; ctx.fillRect(9, -5, 11, 3);
    ctx.fillStyle = '#e8a020'; ctx.shadowColor = '#e8a020'; ctx.shadowBlur = 8;
    ctx.fillRect(19, -8, 7, 10);
    ctx.fillStyle = '#c07010'; ctx.fillRect(19, 0, 7, 2);

    if (gs.carried) {
      ctx.shadowBlur = 12; ctx.shadowColor = MAT_COLORS[gs.carried];
      ctx.strokeStyle = MAT_COLORS[gs.carried] + '88'; ctx.lineWidth = 1.5;
      ctx.strokeRect(-10, -30, 20, 20);
      ctx.fillStyle = MAT_COLORS[gs.carried] + '22'; ctx.fillRect(-10, -30, 20, 20);
      ctx.shadowBlur = 0;
      ctx.translate(-10, -30);
      drawMatIcon(ctx, gs.carried, 0, 0, 20);
    }
    ctx.restore();
  }, []);

  /* ── game loop ──────────────────────────────────────────────────── */
  const loop = useCallback(() => {
    const gs = stateRef.current;
    gs.particles = gs.particles.filter(p => p.life > 0);
    gs.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      p.life -= 0.045;
      p.vx *= 0.9; p.vy *= 0.9;
    });
    draw();
    animFrameRef.current = requestAnimationFrame(loop);
  }, [draw]);

  /* ── start game ─────────────────────────────────────────────────── */
  const startGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    stateRef.current = createInitialState();
    setScoreDisplay(0);
    setTimeDisplay(60);
    setCarriedMat(null);
    setPhase('playing');
    setShowModal(false);
    setSubmitError(null);
    setSubmittedUsername(undefined);

    timerRef.current = setInterval(() => {
      const gs = stateRef.current;
      if (!gs.gameActive) return;
      gs.timeLeft--;
      setTimeDisplay(gs.timeLeft);
      if (gs.timeLeft <= 0) endGame();
    }, 1000);

    animFrameRef.current = requestAnimationFrame(loop);
  }, [loop, endGame]);

  /* ── keyboard handler ───────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
        e.preventDefault();
      }
      if (phase !== 'playing') return;
      if (e.key === 'ArrowUp' || e.key === 'w') movePlayer(0, -1);
      else if (e.key === 'ArrowDown' || e.key === 's') movePlayer(0, 1);
      else if (e.key === 'ArrowLeft' || e.key === 'a') movePlayer(-1, 0);
      else if (e.key === 'ArrowRight' || e.key === 'd') movePlayer(1, 0);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, movePlayer]);

  /* ── touch handler ───────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let tx = 0, ty = 0;
    const onTouchStart = (e: TouchEvent) => {
      tx = e.touches[0].clientX; ty = e.touches[0].clientY;
      e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (phase !== 'playing') return;
      const dx = e.changedTouches[0].clientX - tx;
      const dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) > Math.abs(dy)) movePlayer(dx > 0 ? 1 : -1, 0);
      else movePlayer(0, dy > 0 ? 1 : -1);
      e.preventDefault();
    };
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [phase, movePlayer]);

  /* ── cleanup on unmount ─────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  /* ── username submission ─────────────────────────────────────────── */
  const handleSubmit = useCallback(async (username: string) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitHighscore(username, finalScore);
      setSubmittedUsername(username);
      setShowModal(false);
      setLeaderboardRefresh(n => n + 1);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save score');
    } finally {
      setSubmitting(false);
    }
  }, [finalScore]);

  const handleSkip = useCallback(() => {
    setShowModal(false);
  }, []);

  /* ── render ──────────────────────────────────────────────────────── */
  const gameMsg =
    finalScore >= 500 ? 'Outstanding work on site! 🏆' :
    finalScore >= 250 ? 'Solid shift — keep building! 💪' :
    'Keep digging, the crew needs you! 🚧';

  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logoQ}>QUATTRO <span style={{ color: '#e8a020' }}>CONSTRUCTORS</span></div>
        <div style={styles.tagline}>Partnering for Success</div>
        <div style={styles.gameTitle}>⚙ Neon Dig ⚙</div>
      </div>

      {/* HUD */}
      <div style={styles.hud}>
        <div style={styles.hudItem}>
          <div style={styles.hudLabel}>Score</div>
          <div style={{ ...styles.hudVal, color: '#e8a020', textShadow: '0 0 8px #e8a02088' }}>
            {scoreDisplay.toLocaleString()}
          </div>
        </div>
        <div style={styles.hudItem}>
          <div style={styles.hudLabel}>Best</div>
          <div style={{ ...styles.hudVal, color: '#aaffaa', textShadow: '0 0 8px #aaffaa66' }}>
            {highScore > 0 ? highScore.toLocaleString() : '—'}
          </div>
        </div>
        <div style={styles.hudItem}>
          <div style={styles.hudLabel}>Time Left</div>
          <div style={{ ...styles.hudVal, color: timeDisplay <= 10 ? '#ff2222' : '#ff4444', textShadow: '0 0 8px #ff444488' }}>
            {timeDisplay}
          </div>
        </div>
        <div style={styles.hudItem}>
          <div style={styles.hudLabel}>Carrying</div>
          <div style={styles.carriedWrap}>
            {carriedMat ? (
              <>
                <CarriedIcon mat={carriedMat} />
                <span style={{ color: MAT_COLORS[carriedMat], fontWeight: 700, fontSize: '1em' }}>
                  {MAT_NAMES[carriedMat]}
                </span>
              </>
            ) : <span style={{ color: '#555' }}>—</span>}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={COLS * TS}
        height={ROWS * TS}
        style={{ border: '1px solid #ffffff15', display: 'block' }}
      />

      {/* Legend */}
      <div style={styles.legend}>
        {MATS.map(mat => (
          <div key={mat} style={styles.legItem}>
            <div style={{ ...styles.legSwatch, background: MAT_COLORS[mat] + '22', border: `1.5px solid ${MAT_COLORS[mat]}66` }}>
              <LegendIcon mat={mat} />
            </div>
            <span style={{ color: MAT_COLORS[mat] }}>{MAT_LABELS[mat]}</span>
          </div>
        ))}
        <div style={styles.legItem}>
          <div style={{ ...styles.legSwatch, background: '#2a2a2a', border: '1px solid #555' }}>🪨</div>
          <span style={{ color: '#888' }}>Rock</span>
        </div>
      </div>

      <div style={styles.controlsHint}>↑ ↓ ← → or W A S D &nbsp;|&nbsp; Swipe on mobile</div>

      {/* Start Overlay */}
      {phase === 'start' && (
        <div style={styles.overlay}>
          <div style={styles.ovLogo}>QUATTRO <span style={{ color: '#e8a020' }}>CONSTRUCTORS</span></div>
          <div style={styles.ovTagline}>Partnering for Success</div>
          <div style={styles.ovGamename}>⚙ Neon Dig ⚙</div>
          <div style={styles.ovDivider} />
          <div style={styles.ovInstructions}>
            Drive your excavator underground to uncover buried materials<br />
            and deliver them to the <strong style={{ color: '#fff' }}>matching glowing zones</strong> above.<br />
            Deeper finds score <strong style={{ color: '#fff' }}>bigger bonuses</strong>. Rocks block your path!
          </div>
          <div style={styles.ovMats}>
            {MATS.map(mat => (
              <div key={mat} style={styles.ovMat}>
                <div style={{ ...styles.ovMatSwatch, background: MAT_COLORS[mat] + '22', border: `1.5px solid ${MAT_COLORS[mat]}` }}>
                  <OverlayIcon mat={mat} />
                </div>
                <span style={{ color: MAT_COLORS[mat], fontWeight: 700, fontSize: '0.8em' }}>{MAT_LABELS[mat]}</span>
              </div>
            ))}
          </div>
          <button onClick={startGame} style={styles.btn}>START SHIFT</button>
          <div style={styles.ovFooter}>Vancouver, BC · quattroconstructors.com</div>
        </div>
      )}

      {/* Game Over Overlay */}
      {phase === 'gameover' && !showModal && (
        <div style={styles.overlay}>
          <div style={styles.ovLogo}>QUATTRO <span style={{ color: '#e8a020' }}>CONSTRUCTORS</span></div>
          <div style={styles.ovTagline}>Partnering for Success</div>
          <div style={styles.ovDivider} />
          <div style={{ fontSize: '0.9em', color: '#888', letterSpacing: 3, textTransform: 'uppercase' }}>Shift Complete</div>
          <div style={styles.finalScore}>{finalScore.toLocaleString()}</div>
          <div style={{ fontSize: '0.7em', color: '#888', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>Points Scored</div>
          {isNewHi
            ? <div style={styles.newHi}>🏆 NEW HIGH SCORE!</div>
            : <div style={styles.hiRow}>Best: <span style={{ fontWeight: 700 }}>{highScore > 0 ? highScore.toLocaleString() : '—'}</span></div>
          }
          <div style={{ fontSize: '0.82em', color: '#aaa', fontFamily: 'Barlow, sans-serif', marginBottom: 8 }}>{gameMsg}</div>

          <Leaderboard currentUsername={submittedUsername} refreshTrigger={leaderboardRefresh} />

          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button onClick={() => setShowModal(true)} style={styles.btn}>
              Save Score
            </button>
            <button onClick={startGame} style={{ ...styles.btn, borderColor: '#ffffff44', color: '#aaa' }}>
              Another Shift
            </button>
          </div>
          <div style={styles.ovFooter}>Vancouver, BC · quattroconstructors.com</div>
        </div>
      )}

      {/* Username Modal */}
      {showModal && phase === 'gameover' && (
        <UsernameModal
          score={finalScore}
          onSubmit={handleSubmit}
          onSkip={handleSkip}
          submitting={submitting}
          submitError={submitError}
        />
      )}
    </div>
  );
}

/* ── tiny canvas icon sub-components ──────────────────────────────── */
function LegendIcon({ mat }: { mat: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    drawMatIcon(ctx, mat, 0, 0, 14);
  }, [mat]);
  return <canvas ref={ref} width={14} height={14} />;
}

function CarriedIcon({ mat }: { mat: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    drawMatIcon(ctx, mat, 0, 0, 20);
  }, [mat]);
  return <canvas ref={ref} width={20} height={20} />;
}

function OverlayIcon({ mat }: { mat: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    drawMatIcon(ctx, mat, 0, 0, 20);
  }, [mat]);
  return <canvas ref={ref} width={20} height={20} />;
}

/* ── styles ──────────────────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: "'Barlow Condensed', sans-serif",
    color: '#fff',
  },
  header: { textAlign: 'center', marginBottom: 6 },
  logoQ: { fontSize: '1.8em', fontWeight: 900, color: '#fff', letterSpacing: -1 },
  tagline: { fontSize: '0.6em', color: '#e8a020', letterSpacing: 3, textTransform: 'uppercase', fontWeight: 600 },
  gameTitle: { fontSize: '1em', color: '#ffffff55', letterSpacing: 4, textTransform: 'uppercase' },
  hud: { display: 'flex', gap: 14, marginBottom: 6 },
  hudItem: { textAlign: 'center', background: '#ffffff08', border: '1px solid #ffffff15', padding: '4px 12px', borderRadius: 3 },
  hudLabel: { color: '#888', fontSize: '0.6em', letterSpacing: 2, textTransform: 'uppercase' },
  hudVal: { fontSize: '1.3em', fontWeight: 700 },
  carriedWrap: { display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', minWidth: 80 },
  legend: { display: 'flex', gap: 12, marginTop: 5, fontSize: '0.6em' },
  legItem: { display: 'flex', alignItems: 'center', gap: 4 },
  legSwatch: { width: 14, height: 14, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 },
  controlsHint: { fontSize: '0.55em', color: '#444', marginTop: 3, letterSpacing: 1 },
  overlay: {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.92)', zIndex: 10,
  },
  ovLogo: { fontSize: '2.6em', fontWeight: 900, color: '#fff' },
  ovTagline: { fontSize: '0.7em', color: '#e8a020', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 6 },
  ovGamename: { fontSize: '1.3em', color: '#ffffff55', letterSpacing: 6, textTransform: 'uppercase', marginBottom: 12 },
  ovDivider: { width: 200, height: 1, background: 'linear-gradient(90deg,transparent,#e8a020,transparent)', margin: '8px 0 14px' },
  ovInstructions: { color: '#aaa', fontSize: '0.78em', lineHeight: 1.9, textAlign: 'center', fontFamily: 'Barlow, sans-serif' },
  ovMats: { display: 'flex', gap: 16, margin: '12px 0' },
  ovMat: { display: 'flex', alignItems: 'center', gap: 5 },
  ovMatSwatch: { width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 },
  finalScore: { fontSize: '2.8em', fontWeight: 900, color: '#e8a020', textShadow: '0 0 20px #e8a02066', margin: '8px 0 2px' },
  newHi: { color: '#aaffaa', fontSize: '0.85em', letterSpacing: 2, animation: 'pulse 0.6s infinite alternate', marginBottom: 4 },
  hiRow: { fontSize: '0.8em', color: '#aaffaa', letterSpacing: 2, marginBottom: 10 },
  btn: {
    marginTop: 14, padding: '11px 36px', background: 'transparent', border: '2px solid #e8a020',
    color: '#e8a020', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '1em', fontWeight: 700,
    cursor: 'pointer', letterSpacing: 3, textTransform: 'uppercase', transition: 'all 0.2s',
  },
  ovFooter: { fontSize: '0.55em', color: '#444', marginTop: 14, letterSpacing: 2 },
};
