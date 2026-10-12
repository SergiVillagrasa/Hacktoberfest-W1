import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { SubmitFlow } from '../src/components/game/SubmitFlow';

const props = { code: 'ABCDE', token: 'tok', clueId: 'c1', label: 'Found it? Take a photo', onSending: () => {}, onResult: () => {}, onProblem: () => {} };

describe('SubmitFlow pending submission', () => {
  test('a pending submission disables capture and shows an accessible status line', () => {
    const html = renderToString(createElement(SubmitFlow, { ...props, submission: { id: 's1', pending: true, result: null } }));
    expect(html).toContain('role="status"');
    expect(html).toContain('Still checking your photo. The result will appear automatically.');
    expect(html).toContain('Still checking...');
    expect(html).toMatch(/<label[^>]*aria-disabled="true"/);
    expect(html).toMatch(/<input[^>]*type="file"[^>]*disabled/);
    expect(html).not.toContain('Found it? Take a photo');
  });

  test('without a pending submission the capture button stays ready', () => {
    const html = renderToString(createElement(SubmitFlow, props));
    expect(html).toContain('Found it? Take a photo');
    expect(html).not.toContain('Still checking');
  });

  test('a final submission result lets the player shoot again', () => {
    const html = renderToString(createElement(SubmitFlow, { ...props, submission: { id: 's1', pending: false, result: { outcome: 'no_match', submissionId: 's1', pending: false, attemptsLeft: 4, message: 'Nope' } } }));
    expect(html).toContain('Found it? Take a photo');
    expect(html).not.toContain('Still checking');
  });
});
