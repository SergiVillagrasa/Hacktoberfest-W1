'use client';

import type { ClueView, SubmitResult } from '@snaphunt/contracts';
import { useEffect, useRef, useState } from 'react';
import { CaptureButton } from '@/components/camera/CaptureButton';
import { ApiError } from '@/lib/api';
import { api, errorMessage } from '@/lib/client';
import { isJudging, reconcileAwaitedJudgement } from '@/lib/judgements';

interface SubmitFlowProps {
  code: string;
  token: string;
  clueId: string;
  label: string;
  disabled?: boolean;
  submission?: ClueView['submission'];
  onSending: (sending: boolean) => void;
  onResult: (result: SubmitResult) => void;
  onProblem: (message: string) => void;
}

/** Takes the proof photo and submits it. A dropped connection can be retried with the same key, so it never counts twice. */
export function SubmitFlow({ code, token, clueId, label, disabled, submission, onSending, onResult, onProblem }: SubmitFlowProps) {
  const [sending, setSending] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [awaitedId, setAwaitedId] = useState<string | null>(null);
  const pending = useRef<{ photo: Blob; key: string } | null>(null);
  const judging = isJudging(submission, awaitedId);

  useEffect(() => {
    const next = reconcileAwaitedJudgement(submission, awaitedId);
    if (next !== awaitedId) setAwaitedId(next);
  }, [submission?.id, submission?.pending, awaitedId]);

  async function send(photo: Blob, key: string) {
    setSending(true);
    onSending(true);
    try {
      const result = await api.submitFind(code, token, clueId, photo, key);
      pending.current = null;
      setCanRetry(false);
      setAwaitedId(result.pending ? (result.submissionId ?? null) : null);
      onResult(result);
    } catch (error) {
      const offline = error instanceof ApiError && error.status === 0;
      pending.current = offline ? { photo, key } : null;
      setCanRetry(offline);
      onProblem(errorMessage(error));
    } finally {
      setSending(false);
      onSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {canRetry && pending.current ? (
        <button type="button" className="chunky chunky-info" disabled={disabled || sending || judging} onClick={() => pending.current && void send(pending.current.photo, pending.current.key)}>
          Try sending again
        </button>
      ) : null}
      {judging ? <p role="status" className="text-center text-sm font-semibold text-ink-soft">Still checking your photo. The result will appear automatically.</p> : null}
      <CaptureButton variant={canRetry ? 'secondary' : 'primary'} disabled={disabled || sending || judging} onError={onProblem} onPhoto={(photo) => void send(photo, crypto.randomUUID())}>
        {sending ? 'Checking...' : judging ? 'Still checking...' : label}
      </CaptureButton>
    </div>
  );
}
