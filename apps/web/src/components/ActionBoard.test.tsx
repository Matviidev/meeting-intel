import { describe, expect, it } from 'vitest';
import type { ActionItem } from '../lib/types';
import { groupByOwner } from './ActionBoard';

const item = (id: string, owner: string | null): ActionItem => ({
  id,
  meetingId: 'm',
  meetingNumber: 1,
  meetingTitle: 'Kickoff',
  owner,
  task: id,
  due: null,
  atSec: null,
  status: 'open',
});

describe('groupByOwner', () => {
  it('groups by owner, busiest first, unassigned last', () => {
    const groups = groupByOwner([
      item('a', 'Tom'),
      item('b', null),
      item('c', 'Lena'),
      item('d', 'Tom'),
    ]);
    expect(groups.map(([owner, items]) => [owner, items.length])).toEqual([
      ['Tom', 2],
      ['Lena', 1],
      ['Unassigned', 1],
    ]);
  });
});
