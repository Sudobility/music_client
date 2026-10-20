/**
 * The site-admin flag review queue: the submitted reports, and resolving one.
 *
 * Reject dismisses a report and leaves the snapshot alone; Confirm upholds it
 * and the server hides the snapshot from the Community. Both re-read the queue,
 * so a resolved flag drops out of the list. The server enforces admin access —
 * this hook only draws what it returns.
 */
import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SnapshotFlag } from '@sudobility/music_types';
import { musicQueryKeys } from './query-keys';
import { hookAuthEnabled, requireHookToken, type MusicHookContext } from './hook-context';
import { useMusicClient } from './use-projects';

export type ReviewFlags = {
  /** The submitted flags, newest first; null until loaded. */
  flags: SnapshotFlag[] | null;
  isLoading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
  /** Dismiss a flag; the snapshot is untouched. */
  reject: (id: string) => Promise<SnapshotFlag>;
  /** Uphold a flag; the snapshot leaves the Community. */
  confirm: (id: string) => Promise<SnapshotFlag>;
};

export function useReviewFlags(ctx: MusicHookContext): ReviewFlags {
  const client = useMusicClient(ctx.networkClient, ctx.baseUrl);
  const queryClient = useQueryClient();
  const enabled = hookAuthEnabled(ctx);
  const listKey = useMemo(() => musicQueryKeys.flags.list(ctx.userId), [ctx.userId]);

  const query = useQuery({
    queryKey: listKey,
    enabled,
    queryFn: async () => client.listFlags(await requireHookToken(ctx)),
    staleTime: 0,
  });

  const reread = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: listKey });
  }, [queryClient, listKey]);

  const reject = useCallback(
    async (id: string): Promise<SnapshotFlag> => {
      const resolved = await client.rejectFlag(id, await requireHookToken(ctx));
      await reread();
      return resolved;
    },
    [client, ctx, reread]
  );

  const confirm = useCallback(
    async (id: string): Promise<SnapshotFlag> => {
      const resolved = await client.confirmFlag(id, await requireHookToken(ctx));
      await reread();
      return resolved;
    },
    [client, ctx, reread]
  );

  const refresh = useCallback(async () => {
    if (enabled) await reread();
  }, [enabled, reread]);

  return {
    flags: enabled ? query.data ?? null : null,
    isLoading: enabled && query.isLoading,
    error: query.error,
    refresh,
    reject,
    confirm,
  };
}
