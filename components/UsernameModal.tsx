'use client';

import { useState, useEffect } from 'react';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{2,15}$/;
const STORAGE_KEY = 'neondig-username';

interface UsernameModalProps {
  score: number;
  onSubmit: (username: string) => void;
  onSkip: () => void;
  submitting: boolean;
  submitError: string | null;
}

export default function UsernameModal({
  score,
  onSubmit,
  onSkip,
  submitting,
  submitError,
}: UsernameModalProps) {
  const [username, setUsername] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setUsername(saved);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setUsername(val);
    if (val && !USERNAME_REGEX.test(val)) {
      setValidationError('2–15 characters, letters/numbers/underscores only');
    } else {
      setValidationError(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!USERNAME_REGEX.test(username)) {
      setValidationError('2–15 characters, letters/numbers/underscores only');
      return;
    }
    localStorage.setItem(STORAGE_KEY, username);
    onSubmit(username);
  }

  const displayError = validationError || submitError;

  return (
    <div style={styles.backdrop}>
      <div style={styles.modal}>
        <div style={styles.heading}>Save Your Score</div>
        <div style={styles.scoreDisplay}>{score.toLocaleString()}</div>
        <div style={styles.scoreLabel}>POINTS</div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label} htmlFor="username-input">
            Your Name
          </label>
          <input
            id="username-input"
            type="text"
            value={username}
            onChange={handleChange}
            placeholder="Enter username…"
            maxLength={15}
            autoComplete="username"
            style={styles.input}
            disabled={submitting}
          />
          {displayError && (
            <div style={styles.error}>{displayError}</div>
          )}
          <div style={styles.hint}>2–15 characters, letters, numbers, underscores</div>
          <button
            type="submit"
            disabled={submitting || !username || !!validationError}
            style={{
              ...styles.submitBtn,
              opacity: submitting || !username || !!validationError ? 0.5 : 1,
            }}
          >
            {submitting ? 'Saving…' : 'Submit Score'}
          </button>
        </form>
        <button
          type="button"
          onClick={onSkip}
          disabled={submitting}
          style={styles.skipBtn}
        >
          Skip
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  modal: {
    background: '#0d0d0d',
    border: '1px solid #e8a02055',
    borderRadius: 6,
    padding: '28px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 280,
    maxWidth: 360,
    boxShadow: '0 0 40px #e8a02022',
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  heading: {
    color: '#fff',
    fontWeight: 700,
    fontSize: '1.2em',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  scoreDisplay: {
    color: '#e8a020',
    fontSize: '2.4em',
    fontWeight: 900,
    textShadow: '0 0 20px #e8a02066',
    lineHeight: 1.1,
  },
  scoreLabel: {
    color: '#666',
    fontSize: '0.6em',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    gap: 6,
  },
  label: {
    color: '#888',
    fontSize: '0.65em',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  input: {
    background: '#ffffff0d',
    border: '1px solid #e8a02066',
    borderRadius: 3,
    color: '#fff',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '1em',
    fontWeight: 600,
    letterSpacing: 1,
    padding: '8px 12px',
    outline: 'none',
    width: '100%',
  },
  hint: {
    color: '#444',
    fontSize: '0.6em',
    letterSpacing: 1,
    marginBottom: 4,
  },
  error: {
    color: '#ff4444',
    fontSize: '0.7em',
    letterSpacing: 1,
  },
  submitBtn: {
    marginTop: 8,
    padding: '10px 20px',
    background: 'transparent',
    border: '2px solid #e8a020',
    color: '#e8a020',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '0.95em',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: 3,
    textTransform: 'uppercase',
    transition: 'all 0.2s',
    width: '100%',
  },
  skipBtn: {
    marginTop: 10,
    padding: '6px 20px',
    background: 'transparent',
    border: '1px solid #ffffff22',
    color: '#555',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '0.75em',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: 2,
    textTransform: 'uppercase',
    transition: 'all 0.2s',
  },
};
