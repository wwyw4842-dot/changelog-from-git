import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { ReviewMode } from './ReviewMode';
import { dueLabel } from './utils';
import type { VocabularyEntry } from '@shared/types';

const current: VocabularyEntry = { word: 'harbor', translation: '港口', addedAt: 0, nextReviewAt: 0, easeFactor: 2.5, interval: 0, reps: 0, lapses: 0 };

describe('Folio review controls', () => {
  it('offers four recall grades after revealing and sends their distinct FSRS ratings', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    const grades: string[] = [];
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    await act(async () => root.render(<ReviewMode current={current} progress="1 / 1" revealed onReveal={() => undefined} onGrade={rating => grades.push(rating)} />));
    const buttons = Array.from(host.querySelectorAll('button')).filter(button => !button.disabled);
    expect(buttons.map(button => button.textContent)).toEqual(['忘记', '吃力想起', '正常想起', '轻松想起']);
    for (const button of buttons) await act(async () => button.click());
    expect(grades).toEqual(['again', 'hard', 'good', 'easy']);
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  });

  it('does not display a guessed due time for unsynced grades or legacy cards', () => {
    expect(dueLabel({ ...current, pendingReview: true })).toBe('待同步排期');
    expect(dueLabel(current)).toBe('等待 Folio 排期');
  });
});
