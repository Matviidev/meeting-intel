import { describe, expect, it, vi } from 'vitest';
import { dispatch, type StreamHandlers } from './api';

function handlers(): StreamHandlers {
  return { onMeta: vi.fn(), onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() };
}

describe('dispatch', () => {
  it('routes SSE events to handlers', () => {
    const h = handlers();
    const done = { cited: ['M1.1'], unknownCitations: [], unverifiedAttributions: [], flags: [] };
    dispatch('event: delta\ndata: {"text":"Hi"}', h);
    dispatch(`event: done\ndata: ${JSON.stringify(done)}`, h);
    dispatch('event: error\ndata: {"message":"boom"}', h);
    expect(h.onDelta).toHaveBeenCalledWith('Hi');
    expect(h.onDone).toHaveBeenCalledWith(done);
    expect(h.onError).toHaveBeenCalledWith('boom');
  });

  it('ignores malformed blocks', () => {
    const h = handlers();
    dispatch(': keep-alive', h);
    expect(
      Object.values(h).every((fn) => !(fn as ReturnType<typeof vi.fn>).mock.calls.length),
    ).toBe(true);
  });
});
