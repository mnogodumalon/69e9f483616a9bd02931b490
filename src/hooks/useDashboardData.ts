import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ReportingAnfrage } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [reportingAnfrage, setReportingAnfrage] = useState<ReportingAnfrage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [reportingAnfrageData] = await Promise.all([
        LivingAppsService.getReportingAnfrage(),
      ]);
      setReportingAnfrage(reportingAnfrageData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [reportingAnfrageData] = await Promise.all([
          LivingAppsService.getReportingAnfrage(),
        ]);
        setReportingAnfrage(reportingAnfrageData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  return { reportingAnfrage, setReportingAnfrage, loading, error, fetchAll };
}