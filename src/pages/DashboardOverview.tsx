import { useDashboardData } from '@/hooks/useDashboardData';
import type { ReportingAnfrage } from '@/types/app';
import { LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ReportingAnfrageDialog } from '@/components/dialogs/ReportingAnfrageDialog';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck,
  IconPlus, IconPencil, IconTrash, IconCalendar, IconUser,
  IconFlag, IconFileText, IconClock, IconChartBar,
} from '@tabler/icons-react';

const APPGROUP_ID = '69e9f483616a9bd02931b490';
const REPAIR_ENDPOINT = '/claude/build/repair';

const STATUS_COLUMNS = [
  { key: 'offen', label: 'Offen', color: 'bg-blue-500/10 border-blue-200 text-blue-700', dot: 'bg-blue-500', headerBg: 'bg-blue-50 border-blue-200' },
  { key: 'in_bearbeitung', label: 'In Bearbeitung', color: 'bg-amber-500/10 border-amber-200 text-amber-700', dot: 'bg-amber-500', headerBg: 'bg-amber-50 border-amber-200' },
  { key: 'abgeschlossen', label: 'Abgeschlossen', color: 'bg-green-500/10 border-green-200 text-green-700', dot: 'bg-green-500', headerBg: 'bg-green-50 border-green-200' },
  { key: 'abgelehnt', label: 'Abgelehnt', color: 'bg-red-500/10 border-red-200 text-red-700', dot: 'bg-red-500', headerBg: 'bg-red-50 border-red-200' },
] as const;

const PRIORITAET_COLORS: Record<string, string> = {
  niedrig: 'bg-slate-100 text-slate-600 border-slate-200',
  mittel: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  hoch: 'bg-orange-100 text-orange-700 border-orange-200',
  kritisch: 'bg-red-100 text-red-700 border-red-200',
};

const BERICHTSTYP_ICONS: Record<string, string> = {
  monatsbericht: 'M',
  quartalsbericht: 'Q',
  jahresbericht: 'J',
  ad_hoc_bericht: 'A',
  kpi_bericht: 'K',
  sonstiges: 'S',
};

export default function DashboardOverview() {
  const { reportingAnfrage, loading, error, fetchAll } = useDashboardData();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<ReportingAnfrage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReportingAnfrage | null>(null);
  const [filterBereich, setFilterBereich] = useState<string>('all');
  const [filterPrioritaet, setFilterPrioritaet] = useState<string>('all');

  const stats = useMemo(() => {
    const total = reportingAnfrage.length;
    const offen = reportingAnfrage.filter(r => r.fields.status?.key === 'offen').length;
    const kritisch = reportingAnfrage.filter(r => r.fields.prioritaet?.key === 'kritisch').length;
    const today = new Date().toISOString().slice(0, 10);
    const ueberfaellig = reportingAnfrage.filter(r => {
      const fd = r.fields.faelligkeitsdatum;
      return fd && fd < today && r.fields.status?.key !== 'abgeschlossen' && r.fields.status?.key !== 'abgelehnt';
    }).length;
    return { total, offen, kritisch, ueberfaellig };
  }, [reportingAnfrage]);

  const filtered = useMemo(() => {
    return reportingAnfrage.filter(r => {
      if (filterBereich !== 'all' && r.fields.bereich?.key !== filterBereich) return false;
      if (filterPrioritaet !== 'all' && r.fields.prioritaet?.key !== filterPrioritaet) return false;
      return true;
    });
  }, [reportingAnfrage, filterBereich, filterPrioritaet]);

  const byStatus = useMemo(() => {
    const map: Record<string, ReportingAnfrage[]> = {};
    STATUS_COLUMNS.forEach(col => { map[col.key] = []; });
    filtered.forEach(r => {
      const key = r.fields.status?.key ?? 'offen';
      if (map[key]) map[key].push(r);
      else map['offen'].push(r);
    });
    return map;
  }, [filtered]);

  const handleCreate = async (fields: ReportingAnfrage['fields']) => {
    await LivingAppsService.createReportingAnfrageEntry(fields);
    fetchAll();
  };

  const handleEdit = async (fields: ReportingAnfrage['fields']) => {
    if (!editRecord) return;
    await LivingAppsService.updateReportingAnfrageEntry(editRecord.record_id, fields);
    fetchAll();
    setEditRecord(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await LivingAppsService.deleteReportingAnfrageEntry(deleteTarget.record_id);
    fetchAll();
    setDeleteTarget(null);
  };

  const handleStatusChange = async (record: ReportingAnfrage, newStatusKey: string) => {
    await LivingAppsService.updateReportingAnfrageEntry(record.record_id, { status: newStatusKey as any });
    fetchAll();
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const bereiche = LOOKUP_OPTIONS['reporting_anfrage']?.bereich ?? [];
  const prioritaeten = LOOKUP_OPTIONS['reporting_anfrage']?.prioritaet ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reporting-Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Alle Berichtsanfragen im Überblick</p>
        </div>
        <Button onClick={() => { setEditRecord(null); setDialogOpen(true); }} className="shrink-0 gap-2">
          <IconPlus size={16} className="shrink-0" />
          <span>Neue Anfrage</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Gesamt"
          value={String(stats.total)}
          description="Alle Anfragen"
          icon={<IconFileText size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Offen"
          value={String(stats.offen)}
          description="Warten auf Bearbeitung"
          icon={<IconChartBar size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Kritisch"
          value={String(stats.kritisch)}
          description="Hohe Priorität"
          icon={<IconFlag size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Überfällig"
          value={String(stats.ueberfaellig)}
          description="Frist abgelaufen"
          icon={<IconClock size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Filter:</span>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterBereich('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${filterBereich === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}
          >
            Alle Bereiche
          </button>
          {bereiche.map(b => (
            <button
              key={b.key}
              onClick={() => setFilterBereich(b.key === filterBereich ? 'all' : b.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${filterBereich === b.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap ml-2">
          {prioritaeten.map(p => (
            <button
              key={p.key}
              onClick={() => setFilterPrioritaet(p.key === filterPrioritaet ? 'all' : p.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${filterPrioritaet === p.key ? 'bg-primary text-primary-foreground border-primary' : `${PRIORITAET_COLORS[p.key]} hover:opacity-80`}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {STATUS_COLUMNS.map(col => {
          const cards = byStatus[col.key] ?? [];
          return (
            <div key={col.key} className="flex flex-col gap-3 min-w-0">
              {/* Column Header */}
              <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${col.headerBg}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
                  <span className="font-semibold text-sm truncate">{col.label}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.color} border`}>{cards.length}</span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2">
                {cards.map(record => {
                  const f = record.fields;
                  const isOverdue = f.faelligkeitsdatum && f.faelligkeitsdatum < today && col.key !== 'abgeschlossen' && col.key !== 'abgelehnt';
                  const berichtsAbbr = BERICHTSTYP_ICONS[f.berichtstyp?.key ?? ''] ?? '?';
                  return (
                    <div
                      key={record.record_id}
                      className="bg-card rounded-2xl border border-border shadow-sm p-3 flex flex-col gap-2 overflow-hidden"
                    >
                      {/* Top row: type abbr + title + actions */}
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                          {berichtsAbbr}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm leading-tight truncate text-foreground">{f.titel ?? '—'}</p>
                          {f.berichtstyp && (
                            <p className="text-xs text-muted-foreground truncate">{f.berichtstyp.label}</p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => { setEditRecord(record); setDialogOpen(true); }}
                            className="p-1 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                            title="Bearbeiten"
                          >
                            <IconPencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(record)}
                            className="p-1 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                            title="Löschen"
                          >
                            <IconTrash size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {f.prioritaet && (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${PRIORITAET_COLORS[f.prioritaet.key] ?? 'bg-muted text-muted-foreground border-border'}`}>
                            <IconFlag size={9} className="shrink-0" />
                            {f.prioritaet.label}
                          </span>
                        )}
                        {f.bereich && (
                          <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full border border-border">
                            {f.bereich.label}
                          </span>
                        )}
                      </div>

                      {/* Requester */}
                      {(f.anforderer_vorname || f.anforderer_nachname) && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                          <IconUser size={11} className="shrink-0" />
                          <span className="truncate">{[f.anforderer_vorname, f.anforderer_nachname].filter(Boolean).join(' ')}</span>
                        </div>
                      )}

                      {/* Dates */}
                      {(f.faelligkeitsdatum || (f.zeitraum_von && f.zeitraum_bis)) && (
                        <div className="flex items-center gap-1.5 text-xs min-w-0">
                          <IconCalendar size={11} className={`shrink-0 ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`} />
                          {f.faelligkeitsdatum && (
                            <span className={`truncate ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                              Fällig: {formatDate(f.faelligkeitsdatum)}
                              {isOverdue && ' (überfällig)'}
                            </span>
                          )}
                          {!f.faelligkeitsdatum && f.zeitraum_von && f.zeitraum_bis && (
                            <span className="text-muted-foreground truncate">
                              {formatDate(f.zeitraum_von)} – {formatDate(f.zeitraum_bis)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Status move buttons */}
                      <div className="flex gap-1 flex-wrap pt-1 border-t border-border/50">
                        {STATUS_COLUMNS.filter(c => c.key !== col.key).map(targetCol => (
                          <button
                            key={targetCol.key}
                            onClick={() => handleStatusChange(record, targetCol.key)}
                            className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors hover:opacity-80 ${targetCol.color}`}
                          >
                            → {targetCol.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Empty column placeholder */}
                {cards.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-4 flex flex-col items-center gap-2 text-center">
                    <span className="text-xs text-muted-foreground">Keine Anfragen</span>
                    {col.key === 'offen' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={() => { setEditRecord(null); setDialogOpen(true); }}
                      >
                        <IconPlus size={12} />
                        Hinzufügen
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dialogs */}
      <ReportingAnfrageDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRecord(null); }}
        onSubmit={editRecord ? handleEdit : handleCreate}
        defaultValues={editRecord?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['ReportingAnfrage']}
        enablePhotoLocation={AI_PHOTO_LOCATION['ReportingAnfrage']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Anfrage löschen"
        description={`Soll die Anfrage „${deleteTarget?.fields.titel ?? ''}" wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
