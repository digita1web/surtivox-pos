import { useCallback, useEffect, useState } from 'react';
import { getSyncState, isConfigured } from './sync';

export function useCloudConnected(): { active: boolean; loading: boolean; refresh: () => void } {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(() => {
    getSyncState()
      .then((state) => setActive(isConfigured(state)))
      .catch(() => setActive(false))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { active, loading, refresh };
}
