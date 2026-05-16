import type { APIRoute } from 'astro';
import { kv } from '@vercel/kv';

export const prerender = false;

const STANDARD_DIFFICULTIES = new Set(['beginner', 'intermediate', 'expert']);
const MAX_NAME_LENGTH = 32;

type ScoreEntry = {
  id: string;
  name: string;
  difficulty: string;
  time_seconds: number;
  date: string;
};

function hasKvConfig() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function keyForDifficulty(difficulty: string) {
  return `games:minesweeper:scores:${difficulty}`;
}

function normalizeName(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_NAME_LENGTH);
}

function parseScoreTuple(value: unknown, fallbackRank: number): ScoreEntry | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Partial<ScoreEntry>;
      if (!parsed.name || !parsed.difficulty || typeof parsed.time_seconds !== 'number') return null;
      return {
        id: parsed.id ?? `score-${fallbackRank}`,
        name: parsed.name,
        difficulty: parsed.difficulty,
        time_seconds: parsed.time_seconds,
        date: parsed.date ?? new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    const parsed = value as Partial<ScoreEntry>;
    if (!parsed.name || !parsed.difficulty || typeof parsed.time_seconds !== 'number') return null;
    return {
      id: parsed.id ?? `score-${fallbackRank}`,
      name: parsed.name,
      difficulty: parsed.difficulty,
      time_seconds: parsed.time_seconds,
      date: parsed.date ?? new Date().toISOString(),
    };
  }
  return null;
}

export const GET: APIRoute = async ({ url }) => {
  const difficulty = (url.searchParams.get('difficulty') ?? 'beginner').toLowerCase();
  if (!STANDARD_DIFFICULTIES.has(difficulty)) {
    return json({ error: 'Invalid difficulty' }, 400);
  }

  if (!hasKvConfig()) {
    return json({ scores: [], warning: 'Leaderboard storage is not configured.' });
  }

  try {
    const rawScores = await kv.zrange(keyForDifficulty(difficulty), 0, 9);
    const scores = (rawScores as unknown[])
      .map((entry, index) => parseScoreTuple(entry, index + 1))
      .filter((entry): entry is ScoreEntry => Boolean(entry))
      .map((entry, index) => ({ rank: index + 1, ...entry }));
    return json({ scores });
  } catch (error) {
    console.error('[minesweeper] leaderboard GET failed', error);
    return json({ scores: [], warning: 'Leaderboard is temporarily unavailable.' }, 200);
  }
};

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const name = normalizeName(body.name);
  const difficulty = String(body.difficulty ?? '').toLowerCase();
  const timeSeconds = Number(body.time_seconds);

  if (!name) return json({ error: 'Name is required' }, 400);
  if (!STANDARD_DIFFICULTIES.has(difficulty)) return json({ error: 'Scores are only accepted for standard difficulties' }, 400);
  if (!Number.isFinite(timeSeconds) || timeSeconds < 1 || timeSeconds > 9999) return json({ error: 'Invalid time_seconds' }, 400);

  if (!hasKvConfig()) {
    return json({ error: 'Leaderboard storage is not configured.' }, 503);
  }

  const entry: ScoreEntry = {
    id: crypto.randomUUID(),
    name,
    difficulty,
    time_seconds: Math.round(timeSeconds),
    date: new Date().toISOString(),
  };

  try {
    const key = keyForDifficulty(difficulty);
    await kv.zadd(key, { score: entry.time_seconds, member: JSON.stringify(entry) });
    await kv.zremrangebyrank(key, 100, -1);
    return json({ ok: true, score: entry }, 201);
  } catch (error) {
    console.error('[minesweeper] leaderboard POST failed', error);
    return json({ error: 'Leaderboard is temporarily unavailable.' }, 503);
  }
};
