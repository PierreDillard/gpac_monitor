import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SessionRow from '../SessionRow';
import type { SessionInfo } from '@/services/historyService/sessionFileReader/types';

const incompleteSession: SessionInfo = {
  sessionId: 'session-2026-07-23',
  hasSnapshot: true,
  hasEvents: true,
  hasManifest: true,
  hasCheckpoints: false,
  sizeBytes: 1024,
  isComplete: false,
};

describe('SessionRow in-progress marker', () => {
  it('does NOT mark an incomplete session as in progress unless it is the recording one', () => {
    render(
      <SessionRow
        session={incompleteSession}
        onSelect={vi.fn()}
        disabled={false}
        isRecording={false}
      />,
    );
    expect(screen.queryByText(/in progress/i)).toBeNull();
  });

  it('marks the incomplete session as in progress only when isRecording is true', () => {
    render(
      <SessionRow
        session={incompleteSession}
        onSelect={vi.fn()}
        disabled={false}
        isRecording={true}
      />,
    );
    expect(screen.getByText(/in progress/i)).toBeTruthy();
  });
});
