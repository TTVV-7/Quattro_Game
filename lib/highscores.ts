export interface HighscoreEntry {
  username: string;
  score: number;
}

export async function getHighscores(): Promise<HighscoreEntry[]> {
  const res = await fetch('/api/highscores', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Failed to fetch highscores');
  }
  const data = await res.json();
  return data.highscores as HighscoreEntry[];
}

export async function submitHighscore(
  username: string,
  score: number
): Promise<void> {
  const res = await fetch('/api/highscores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, score }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? 'Failed to submit highscore');
  }
}
