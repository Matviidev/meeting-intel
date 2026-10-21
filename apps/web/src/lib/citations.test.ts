import { describe, expect, it } from 'vitest';
import { citationLabel, linkCitations } from './citations';

describe('linkCitations', () => {
  it('turns single and grouped citations into anchor links', () => {
    expect(linkCitations('We chose Stripe [M1.2]. Moved to the 20th [M2.1, M2.4].')).toBe(
      'We chose Stripe [M1.2](#cite-M1.2). Moved to the 20th [M2.1](#cite-M2.1)[M2.4](#cite-M2.4).',
    );
  });

  it('leaves ordinary brackets alone', () => {
    expect(linkCitations('[optional] and [link](https://x.y) and [M1]')).toBe(
      '[optional] and [link](https://x.y) and [M1]',
    );
  });

  it('reads labels from hrefs', () => {
    expect(citationLabel('#cite-M2.1')).toBe('M2.1');
    expect(citationLabel('https://example.com')).toBeNull();
  });
});
