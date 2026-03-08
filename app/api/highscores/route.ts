import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface HighscoreEntry {
  username: string;
  score: number;
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]{2,15}$/;
const LEADERBOARD_KEY = 'neondig:highscores';

export async function GET() {
  try {
    // zrange with rev:true returns highest scores first
    const raw = await kv.zrange<string[]>(LEADERBOARD_KEY, 0, 9, {
      rev: true,
      withScores: true,
    });

    // raw is [member, score, member, score, ...]
    const entries: HighscoreEntry[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      const username = raw[i];
      const score = Number(raw[i + 1]);
      if (typeof username === 'string') {
        entries.push({ username, score });
      }
    }

    return NextResponse.json({ highscores: entries });
  } catch (error) {
    console.error('GET /api/highscores error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch highscores' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, score } = body;

    if (typeof username !== 'string' || !USERNAME_REGEX.test(username)) {
      return NextResponse.json(
        { error: 'Invalid username. Use 2-15 alphanumeric characters or underscores.' },
        { status: 400 }
      );
    }

    if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 1_000_000) {
      return NextResponse.json(
        { error: 'Invalid score.' },
        { status: 400 }
      );
    }

    // Use the username as the member; use gt so score is only updated if the new one is higher
    await kv.zadd(LEADERBOARD_KEY, { gt: true }, { score, member: username });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/highscores error:', error);
    return NextResponse.json(
      { error: 'Failed to save highscore' },
      { status: 500 }
    );
  }
}
