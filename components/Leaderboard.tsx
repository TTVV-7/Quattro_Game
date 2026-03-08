'use client';

import { useEffect, useState, useCallback } from 'react';
import { getHighscores, HighscoreEntry } from '@/lib/highscores';

interface LeaderboardProps {
  currentUsername?: string;
  refreshTrigger?: number;
}

export default function Leaderboard({ currentUsername, refreshTrigger }: LeaderboardProps) {
  const [entries, setEntries] = useState<HighscoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScores = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getHighscores();
      setEntries(data);
    } catch {
      setError('Could not load leaderboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
  }, [fetchScores, refreshTrigger]);

  return (
    <div style={styles.container}>
      <div style={styles.title}>🏆 LEADERBOARD</div>
      {loading && (
        <div style={styles.status}>Loading…</div>
      )}
      {error && (
        <div style={styles.error}>{error}</div>
      )}
      {!loading && !error && entries.length === 0 && (
        <div style={styles.status}>No scores yet — be the first!</div>
      )}
      {!loading && !error && entries.length > 0 && (
        <table style={styles.table}>
          <tbody>
            {entries.map((entry, i) => {
              const isMe = currentUsername && entry.username === currentUsername;
              return (
                <tr key={i} style={isMe ? styles.myRow : styles.row}>
                  <td style={styles.rank}>#{i + 1}</td>
                  <td style={{ ...styles.name, color: isMe ? '#e8a020' : '#fff' }}>
                    {entry.username}
                    {isMe && ' ★'}
                  </td>
                  <td style={styles.score}>{entry.score.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#ffffff08',
    border: '1px solid #ffffff15',
    borderRadius: 4,
    padding: '10px 16px',
    minWidth: 240,
    maxWidth: 320,
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  title: {
    color: '#e8a020',
    fontWeight: 700,
    fontSize: '0.85em',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'center',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  row: {
    borderBottom: '1px solid #ffffff0a',
  },
  myRow: {
    borderBottom: '1px solid #ffffff0a',
    background: '#e8a02011',
  },
  rank: {
    color: '#666',
    fontSize: '0.75em',
    paddingRight: 8,
    paddingTop: 4,
    paddingBottom: 4,
    width: 30,
  },
  name: {
    fontSize: '0.85em',
    fontWeight: 600,
    letterSpacing: 1,
  },
  score: {
    color: '#aaffaa',
    fontSize: '0.85em',
    fontWeight: 700,
    textAlign: 'right',
  },
  status: {
    color: '#666',
    fontSize: '0.75em',
    textAlign: 'center',
    padding: '8px 0',
  },
  error: {
    color: '#ff4444',
    fontSize: '0.75em',
    textAlign: 'center',
    padding: '8px 0',
  },
};
