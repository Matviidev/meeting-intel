import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ActionItem, MeetingDetail } from '../lib/types';

export const keys = {
  meetings: ['meetings'] as const,
  meeting: (id: string) => ['meetings', id] as const,
  actionItems: ['action-items'] as const,
  trace: (id: string) => ['trace', id] as const,
};

export const useMeetings = () => useQuery({ queryKey: keys.meetings, queryFn: api.meetings });
export const useMeeting = (id: string | null) =>
  useQuery({ queryKey: keys.meeting(id ?? ''), queryFn: () => api.meeting(id!), enabled: !!id });
export const useActionItems = () =>
  useQuery({ queryKey: keys.actionItems, queryFn: api.actionItems });
export const useTrace = (id: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: keys.trace(id ?? ''),
    queryFn: () => api.trace(id!),
    enabled: !!id && enabled,
  });

function useInvalidateAll() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.meetings }),
      qc.invalidateQueries({ queryKey: keys.actionItems }),
    ]);
}

export function useAddMeeting() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: api.addMeeting, onSuccess: invalidate });
}

export function useDeleteMeeting() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: api.deleteMeeting, onSuccess: invalidate });
}

export function useSetActionStatus() {
  const qc = useQueryClient();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: api.setActionStatus,
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: keys.actionItems });
      const patch = (a: ActionItem) => (a.id === id ? { ...a, status } : a);
      qc.setQueryData<ActionItem[]>(keys.actionItems, (items) => items?.map(patch));
      qc.setQueriesData<MeetingDetail>({ queryKey: keys.meetings }, (detail) =>
        detail && 'actionItems' in detail
          ? { ...detail, actionItems: detail.actionItems.map(patch) }
          : detail,
      );
    },
    onSettled: invalidate,
  });
}
