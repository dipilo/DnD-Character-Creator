import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE, waitForServerReady } from '../api';

// A lightweight, client-only overlay shown while the backend wakes up.
// Includes a tiny D&D-themed mini-game to pass the time.
export default function WakeOverlay({ open, message = '', onClose }) {
  const [status, setStatus] = useState('Warming up the server...');
  const [checking, setChecking] = useState(false);
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [autoPoll, setAutoPoll] = useState(true);

  // Mini-game: Whack-a-Goblin + Dice roller
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [goblinPos, setGoblinPos] = useState({ x: 50, y: 50 });
  const [running, setRunning] = useState(true);
  const boardRef = useRef(null);

  // High score persisted in localStorage
  const [highScore, setHighScore] = useState(() => {
    try { const s = localStorage.getItem('wakeGoblinHighScore'); return s ? parseInt(s, 10) : 0; } catch(_) { return 0; }
  });

  useEffect(() => {
    if (!open) return;
    setStatus('Warming up the server...');
    setReady(false);
    setScore(0); setTimeLeft(30); setRunning(true);
    setAutoPoll(true);
  }, [open]);

  // Auto-poll /health while open
  useEffect(() => {
    if (!open || !autoPoll) return;
    let cancelled = false;
    (async () => {
      setChecking(true);
      const ok = await waitForServerReady({ interval: 3000, maxWait: 120000 });
      if (!cancelled) {
        setChecking(false);
        setReady(ok);
        setStatus(ok ? 'Server is awake!' : 'Still waking...');
      }
    })();
    return () => { cancelled = true; };
  }, [open, autoPoll]);

  // Simple countdown nudges (for fun UX)
  useEffect(() => {
    if (!open || ready) return;
    const t = setInterval(() => setCountdown(c => (c + 1) % 4), 1000);
    return () => clearInterval(t);
  }, [open, ready]);

  // Goblin game timers
  const lastHitAtRef = useRef(0);
  useEffect(() => {
    if (!open || !running) return;
    // move goblin randomly every 900ms
    const moveT = setInterval(() => {
      const el = boardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = Math.max(20, Math.min(rect.width - 40, Math.random() * rect.width));
      const ny = Math.max(20, Math.min(rect.height - 40, Math.random() * rect.height));
      setGoblinPos({ x: nx, y: ny });
    }, 900);
    // countdown game timer
    const gameT = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(moveT);
          clearInterval(gameT);
          setRunning(false);
          try {
            setHighScore(hs => {
              const best = Math.max(hs, score);
              localStorage.setItem('wakeGoblinHighScore', String(best));
              return best;
            });
          } catch(_) {}
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { clearInterval(moveT); clearInterval(gameT); };
  }, [open, running]);

  const rollDice = (sides) => Math.floor(Math.random() * sides) + 1;

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', color: 'white', zIndex: 2147483646,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <div style={{
        width: 'min(960px, 96vw)', background: 'linear-gradient(135deg, #111827, #1f2937)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 16,
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>🛠️ Waking up the server</h2>
          <button onClick={() => onClose && onClose()} title="Close" style={{
            background: 'transparent', color: 'rgba(255,255,255,0.8)', border: 'none', fontSize: 22, cursor: 'pointer'
          }}>×</button>
        </div>

        <p style={{ marginTop: 8, color: 'rgba(255,255,255,0.85)' }}>
          {message || 'Render free tier sleeps when idle. It can take 20–60s to wake up.'}{' '}
          <span style={{ opacity: 0.8 }}>
            {status}{Array.from({ length: countdown }).map((_, i) => '.').join('')}
          </span>
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Mini-game */}
          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>🧌 Whack-a-Goblin</h3>
              <div style={{ fontSize: 13, opacity: 0.8 }}>Time: {timeLeft}s • Score: {score} • Best: {highScore}</div>
            </div>
            <div ref={boardRef} style={{ position: 'relative', height: 220, marginTop: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8, overflow: 'hidden' }}>
              <button
                onClick={() => {
                  const now = Date.now();
                  if (now - lastHitAtRef.current < 250) return; // basic debounce to prevent spam
                  lastHitAtRef.current = now;
                  setScore(s => s + 1);
                  // hop to a new random spot immediately after a hit
                  const el = boardRef.current;
                  if (el) {
                    const rect = el.getBoundingClientRect();
                    const nx = Math.max(20, Math.min(rect.width - 40, Math.random() * rect.width));
                    const ny = Math.max(20, Math.min(rect.height - 40, Math.random() * rect.height));
                    setGoblinPos({ x: nx, y: ny });
                  }
                }}
                style={{
                  position: 'absolute', left: goblinPos.x, top: goblinPos.y,
                  transform: 'translate(-50%, -50%)', background: 'transparent', border: 'none',
                  cursor: 'pointer', fontSize: 36, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))'
                }}
                aria-label="Whack the goblin"
                title="Whack!"
              >
                🧌
              </button>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={() => { setScore(0); setTimeLeft(30); setRunning(true); }} style={{ padding: '6px 12px' }}>Restart</button>
              <button onClick={() => { try { localStorage.removeItem('wakeGoblinHighScore'); setHighScore(0); } catch(_){} }} style={{ padding: '6px 12px' }}>Reset Best</button>
            </div>
          </div>

          {/* Dice roller */}
          <DiceRoller
            apiBase={API_BASE}
            checking={checking}
            onTryNow={async () => {
              setAutoPoll(false);
              setChecking(true);
              try {
                const ok = await waitForServerReady({ interval: 2000, maxWait: 10000 });
                setReady(ok);
                setStatus(ok ? 'Server is awake!' : 'Still waking...');
              } finally {
                setChecking(false);
              }
            }}
            ready={ready}
            onContinue={() => onClose && onClose()}
          />
        </div>

        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
          Tip: If it takes longer than a minute, try again — the server may still be provisioning.
        </div>
      </div>
    </div>
  );
}

function DiceRoller({ apiBase, checking, onTryNow, ready, onContinue }) {
  const [rolling, setRolling] = useState(false);
  const [preview, setPreview] = useState(null);
  const [last, setLast] = useState(null); // { sides, value }
  const animRef = useRef(null);

  const roll = (sides) => {
    if (rolling) return;
    setRolling(true);
    // Animate with quick previews
    let ticks = 0;
    animRef.current = setInterval(() => {
      ticks++;
      setPreview({ sides, value: Math.floor(Math.random() * sides) + 1 });
      if (ticks > 12) { // ~1s at 80ms per tick
        clearInterval(animRef.current);
        animRef.current = null;
        const finalValue = Math.floor(Math.random() * sides) + 1;
        setLast({ sides, value: finalValue });
        setPreview(null);
        setRolling(false);
      }
    }, 80);
  };

  useEffect(() => () => { if (animRef.current) clearInterval(animRef.current); }, []);

  return (
    <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 12 }}>
      <h3 style={{ margin: 0 }}>🎲 Quick Dice</h3>
      <p style={{ marginTop: 8, opacity: 0.9 }}>Roll while you wait:</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {[4, 6, 8, 10, 12, 20, 100].map(sides => (
          <button key={sides} onClick={() => roll(sides)} disabled={rolling} style={{
            padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)'
          }}>
            d{sides}
          </button>
        ))}
      </div>
      {/* Result display */}
      <div style={{ marginTop: 12, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: 12, minHeight: 72, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {preview ? (
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 1, animation: 'diceWobble 0.2s ease-in-out' }}>
            d{preview.sides} → {preview.value}
          </div>
        ) : last ? (
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 1 }}>
            d{last.sides} → {last.value}
          </div>
        ) : (
          <div style={{ opacity: 0.7 }}>Tap a die to roll</div>
        )}
      </div>
      <style>{`@keyframes diceWobble { 0% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(6deg) scale(1.05);} 100% { transform: rotate(0deg) scale(1);} }`}</style>
      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
        Server: <code>{apiBase}</code>
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button disabled={checking} onClick={onTryNow}>Try now</button>
        {ready && (
          <button onClick={onContinue} style={{ background: 'var(--accent, #10b981)', color: '#0b1b12', fontWeight: 700 }}>Continue</button>
        )}
      </div>
    </div>
  );
}
