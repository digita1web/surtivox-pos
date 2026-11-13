import { useCallback, useEffect, useState } from 'react';
import { getSyncState, isConfigured } from './sync';

export function useCloudConnected(): { active: boolean; syncedAt: number | null; loading: boolean; refresh: () => void } {
  const [active, setActive] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(() => {
    getSyncState()
      .then((state) => { setActive(isConfigured(state)); setSyncedAt(state.last_synced_at); })
      .catch(() => { setActive(false); setSyncedAt(null); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { active, syncedAt, loading, refresh };
}
