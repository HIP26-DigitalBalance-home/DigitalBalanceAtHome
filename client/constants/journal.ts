// Mood scale for the daily parent journal ("How are you feeling today?").
// Ordered worst → best; `score` drives bar heights in the analyze chart.
// Colors are a semantic scale shared across all themes (like emoji, not themed).

export type Mood = 'bad' | 'not_good' | 'okay' | 'good' | 'super';

export interface MoodDef {
  key: Mood;
  emoji: string;
  labelKey: string;
  color: string;
  score: number;
}

export const MOODS: MoodDef[] = [
  { key: 'bad', emoji: '😢', labelKey: 'journal.moods.bad', color: '#E8734A', score: 1 },
  { key: 'not_good', emoji: '😕', labelKey: 'journal.moods.not_good', color: '#F2B8AC', score: 2 },
  { key: 'okay', emoji: '🙂', labelKey: 'journal.moods.okay', color: '#F5D547', score: 3 },
  { key: 'good', emoji: '😄', labelKey: 'journal.moods.good', color: '#A5CB6C', score: 4 },
  { key: 'super', emoji: '😍', labelKey: 'journal.moods.super', color: '#4C9F5A', score: 5 },
];

export const MOOD_BY_KEY: Record<Mood, MoodDef> = Object.fromEntries(
  MOODS.map((m) => [m.key, m])
) as Record<Mood, MoodDef>;
