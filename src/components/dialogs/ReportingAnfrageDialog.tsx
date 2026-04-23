import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReportingAnfrage } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId, createRecordUrl, cleanFieldsForApi, uploadFile, getUserProfile } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { IconArrowBigDownLinesFilled, IconCamera, IconCircleCheck, IconClipboard, IconFileText, IconLoader2, IconPhotoPlus, IconSparkles, IconUpload, IconX } from '@tabler/icons-react';
import { fileToDataUri, extractFromInput, extractPhotoMeta, reverseGeocode, dataUriToBlob } from '@/lib/ai';
import { lookupKey, lookupKeys } from '@/lib/formatters';

interface ReportingAnfrageDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: ReportingAnfrage['fields']) => Promise<void>;
  defaultValues?: ReportingAnfrage['fields'];
  enablePhotoScan?: boolean;
  enablePhotoLocation?: boolean;
}

export function ReportingAnfrageDialog({ open, onClose, onSubmit, defaultValues, enablePhotoScan = true, enablePhotoLocation = true }: ReportingAnfrageDialogProps) {
  const [fields, setFields] = useState<Partial<ReportingAnfrage['fields']>>({});
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [usePersonalInfo, setUsePersonalInfo] = useState(() => {
    try { return localStorage.getItem('ai-use-personal-info') === 'true'; } catch { return false; }
  });
  const [showProfileInfo, setShowProfileInfo] = useState(false);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  useEffect(() => {
    if (open) {
      setFields(defaultValues ?? {});
      setPreview(null);
      setScanSuccess(false);
      setAiText('');
    }
  }, [open, defaultValues]);
  useEffect(() => {
    try { localStorage.setItem('ai-use-personal-info', String(usePersonalInfo)); } catch {}
  }, [usePersonalInfo]);
  async function handleShowProfileInfo() {
    if (showProfileInfo) { setShowProfileInfo(false); return; }
    setProfileLoading(true);
    try {
      const p = await getUserProfile();
      setProfileData(p);
    } catch {
      setProfileData(null);
    } finally {
      setProfileLoading(false);
      setShowProfileInfo(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const clean = cleanFieldsForApi({ ...fields }, 'reporting_anfrage');
      await onSubmit(clean as ReportingAnfrage['fields']);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleAiExtract(file?: File) {
    if (!file && !aiText.trim()) return;
    setScanning(true);
    setScanSuccess(false);
    try {
      let uri: string | undefined;
      let gps: { latitude: number; longitude: number } | null = null;
      let geoAddr = '';
      const parts: string[] = [];
      if (file) {
        const [dataUri, meta] = await Promise.all([fileToDataUri(file), extractPhotoMeta(file)]);
        uri = dataUri;
        if (file.type.startsWith('image/')) setPreview(uri);
        gps = enablePhotoLocation ? meta?.gps ?? null : null;
        if (gps) {
          geoAddr = await reverseGeocode(gps.latitude, gps.longitude);
          parts.push(`Location coordinates: ${gps.latitude}, ${gps.longitude}`);
          if (geoAddr) parts.push(`Reverse-geocoded address: ${geoAddr}`);
        }
        if (meta?.dateTime) {
          parts.push(`Date taken: ${meta.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')}`);
        }
      }
      const contextParts: string[] = [];
      if (parts.length) {
        contextParts.push(`<photo-metadata>\nThe following metadata was extracted from the photo\'s EXIF data:\n${parts.join('\n')}\n</photo-metadata>`);
      }
      if (usePersonalInfo) {
        try {
          const profile = await getUserProfile();
          contextParts.push(`<user-profile>\nThe following is the logged-in user\'s personal information. Use this to pre-fill relevant fields like name, email, address, company etc. when appropriate:\n${JSON.stringify(profile, null, 2)}\n</user-profile>`);
        } catch (err) {
          console.warn('Failed to fetch user profile:', err);
        }
      }
      const photoContext = contextParts.length ? contextParts.join('\n') : undefined;
      const schema = `{\n  "titel": string | null, // Titel der Anfrage\n  "berichtstyp": LookupValue | null, // Berichtstyp (select one key: "monatsbericht" | "quartalsbericht" | "jahresbericht" | "ad_hoc_bericht" | "kpi_bericht" | "sonstiges") mapping: monatsbericht=Monatsbericht, quartalsbericht=Quartalsbericht, jahresbericht=Jahresbericht, ad_hoc_bericht=Ad-hoc-Bericht, kpi_bericht=KPI-Bericht, sonstiges=Sonstiges\n  "bereich": LookupValue | null, // Bereich / Abteilung (select one key: "vertrieb" | "marketing" | "finanzen" | "personal" | "it" | "produktion" | "einkauf" | "sonstiges_bereich") mapping: vertrieb=Vertrieb, marketing=Marketing, finanzen=Finanzen, personal=Personal, it=IT, produktion=Produktion, einkauf=Einkauf, sonstiges_bereich=Sonstiges\n  "zeitraum_von": string | null, // YYYY-MM-DD\n  "zeitraum_bis": string | null, // YYYY-MM-DD\n  "anforderer_vorname": string | null, // Vorname des Anforderers\n  "anforderer_nachname": string | null, // Nachname des Anforderers\n  "anforderer_email": string | null, // E-Mail des Anforderers\n  "verantwortlicher_vorname": string | null, // Vorname des Verantwortlichen\n  "verantwortlicher_nachname": string | null, // Nachname des Verantwortlichen\n  "prioritaet": LookupValue | null, // Priorität (select one key: "niedrig" | "mittel" | "hoch" | "kritisch") mapping: niedrig=Niedrig, mittel=Mittel, hoch=Hoch, kritisch=Kritisch\n  "status": LookupValue | null, // Status (select one key: "offen" | "in_bearbeitung" | "abgeschlossen" | "abgelehnt") mapping: offen=Offen, in_bearbeitung=In Bearbeitung, abgeschlossen=Abgeschlossen, abgelehnt=Abgelehnt\n  "faelligkeitsdatum": string | null, // YYYY-MM-DD\n  "kennzahlen": LookupValue[] | null, // Relevante Kennzahlen (select one or more keys: "umsatz" | "kosten" | "gewinn" | "kundenzahl" | "mitarbeiterzahl" | "conversion_rate" | "nps" | "sonstiges_kz") mapping: umsatz=Umsatz, kosten=Kosten, gewinn=Gewinn, kundenzahl=Kundenzahl, mitarbeiterzahl=Mitarbeiterzahl, conversion_rate=Conversion Rate, nps=NPS, sonstiges_kz=Sonstiges\n  "beschreibung": string | null, // Beschreibung / Anforderungen\n}`;
      const raw = await extractFromInput<Record<string, unknown>>(schema, {
        dataUri: uri,
        userText: aiText.trim() || undefined,
        photoContext,
        intent: DIALOG_INTENT,
      });
      setFields(prev => {
        const merged = { ...prev } as Record<string, unknown>;
        function matchName(name: string, candidates: string[]): boolean {
          const n = name.toLowerCase().trim();
          return candidates.some(c => c.toLowerCase().includes(n) || n.includes(c.toLowerCase()));
        }
        for (const [k, v] of Object.entries(raw)) {
          if (v != null) merged[k] = v;
        }
        return merged as Partial<ReportingAnfrage['fields']>;
      });
      // Upload scanned file to file fields
      if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
        try {
          const blob = dataUriToBlob(uri!);
          const fileUrl = await uploadFile(blob, file.name);
          setFields(prev => ({ ...prev, anhang: fileUrl }));
        } catch (uploadErr) {
          console.error('File upload failed:', uploadErr);
        }
      }
      setAiText('');
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 3000);
    } catch (err) {
      console.error('Scan fehlgeschlagen:', err);
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleAiExtract(f);
    e.target.value = '';
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      handleAiExtract(file);
    }
  }, []);

  const DIALOG_INTENT = defaultValues ? 'Reporting-Anfrage bearbeiten' : 'Reporting-Anfrage hinzufügen';

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{DIALOG_INTENT}</DialogTitle>
        </DialogHeader>

        {enablePhotoScan && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div>
              <div className="flex items-center gap-1.5 font-medium">
                <IconSparkles className="h-4 w-4 text-primary" />
                KI-Assistent
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Versteht Fotos, Dokumente und Text und füllt alles für dich aus</p>
            </div>
            <div className="flex items-start gap-2 pl-0.5">
              <Checkbox
                id="ai-use-personal-info"
                checked={usePersonalInfo}
                onCheckedChange={(v) => setUsePersonalInfo(!!v)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground leading-snug">
                <Label htmlFor="ai-use-personal-info" className="text-xs font-normal text-muted-foreground cursor-pointer inline">
                  KI-Assistent darf zusätzlich Informationen zu meiner Person verwenden
                </Label>
                {' '}
                <button type="button" onClick={handleShowProfileInfo} className="text-xs text-primary hover:underline whitespace-nowrap">
                  {profileLoading ? 'Lade...' : '(mehr Infos)'}
                </button>
              </span>
            </div>
            {showProfileInfo && (
              <div className="rounded-md border bg-muted/50 p-2 text-xs max-h-40 overflow-y-auto">
                <p className="font-medium mb-1">Folgende Infos über dich können von der KI genutzt werden:</p>
                {profileData ? Object.values(profileData).map((v, i) => (
                  <span key={i}>{i > 0 && ", "}{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                )) : (
                  <span className="text-muted-foreground">Profil konnte nicht geladen werden</span>
                )}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !scanning && fileInputRef.current?.click()}
              className={`
                relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
                ${scanning
                  ? 'border-primary/40 bg-primary/5'
                  : scanSuccess
                    ? 'border-green-500/40 bg-green-50/50 dark:bg-green-950/20'
                    : dragOver
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              {scanning ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconLoader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">KI analysiert...</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Felder werden automatisch ausgefüllt</p>
                  </div>
                </div>
              ) : scanSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <IconCircleCheck className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Felder ausgefüllt!</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Prüfe die Werte und passe sie ggf. an</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/8 flex items-center justify-center">
                    <IconPhotoPlus className="h-7 w-7 text-primary/70" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Foto oder Dokument hierher ziehen oder auswählen</p>
                  </div>
                </div>
              )}

              {preview && !scanning && (
                <div className="absolute top-2 right-2">
                  <div className="relative group">
                    <img src={preview} alt="" className="h-10 w-10 rounded-md object-cover border shadow-sm" />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setPreview(null); }}
                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-muted-foreground/80 text-white flex items-center justify-center"
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}>
                <IconCamera className="h-3.5 w-3.5 mr-1" />Kamera
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <IconUpload className="h-3.5 w-3.5 mr-1" />Foto wählen
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => {
                  e.stopPropagation();
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'application/pdf,.pdf';
                    fileInputRef.current.click();
                    setTimeout(() => { if (fileInputRef.current) fileInputRef.current.accept = 'image/*,application/pdf'; }, 100);
                  }
                }}>
                <IconFileText className="h-3.5 w-3.5 mr-1" />Dokument
              </Button>
            </div>

            <div className="relative">
              <Textarea
                placeholder="Text eingeben oder einfügen, z.B. Notizen, E-Mails, Beschreibungen..."
                value={aiText}
                onChange={e => {
                  setAiText(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = Math.min(Math.max(el.scrollHeight, 56), 96) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && aiText.trim() && !scanning) {
                    e.preventDefault();
                    handleAiExtract();
                  }
                }}
                disabled={scanning}
                rows={2}
                className="pr-12 resize-none text-sm overflow-y-auto"
              />
              <button
                type="button"
                className="absolute right-2 top-2 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                disabled={scanning}
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setAiText(prev => prev ? prev + '\n' + text : text);
                  } catch {}
                }}
                title="Paste"
              >
                <IconClipboard className="h-4 w-4" />
              </button>
            </div>
            {aiText.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs"
                disabled={scanning}
                onClick={() => handleAiExtract()}
              >
                <IconSparkles className="h-3.5 w-3.5 mr-1.5" />Analysieren
              </Button>
            )}
            <div className="flex justify-center pt-1">
              <IconArrowBigDownLinesFilled className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titel">Titel der Anfrage</Label>
            <Input
              id="titel"
              value={fields.titel ?? ''}
              onChange={e => setFields(f => ({ ...f, titel: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="berichtstyp">Berichtstyp</Label>
            <Select
              value={lookupKey(fields.berichtstyp) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, berichtstyp: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="berichtstyp"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="monatsbericht">Monatsbericht</SelectItem>
                <SelectItem value="quartalsbericht">Quartalsbericht</SelectItem>
                <SelectItem value="jahresbericht">Jahresbericht</SelectItem>
                <SelectItem value="ad_hoc_bericht">Ad-hoc-Bericht</SelectItem>
                <SelectItem value="kpi_bericht">KPI-Bericht</SelectItem>
                <SelectItem value="sonstiges">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bereich">Bereich / Abteilung</Label>
            <Select
              value={lookupKey(fields.bereich) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, bereich: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="bereich"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="vertrieb">Vertrieb</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="finanzen">Finanzen</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="it">IT</SelectItem>
                <SelectItem value="produktion">Produktion</SelectItem>
                <SelectItem value="einkauf">Einkauf</SelectItem>
                <SelectItem value="sonstiges_bereich">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="zeitraum_von">Zeitraum von</Label>
            <Input
              id="zeitraum_von"
              type="date"
              value={fields.zeitraum_von ?? ''}
              onChange={e => setFields(f => ({ ...f, zeitraum_von: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zeitraum_bis">Zeitraum bis</Label>
            <Input
              id="zeitraum_bis"
              type="date"
              value={fields.zeitraum_bis ?? ''}
              onChange={e => setFields(f => ({ ...f, zeitraum_bis: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="anforderer_vorname">Vorname des Anforderers</Label>
            <Input
              id="anforderer_vorname"
              value={fields.anforderer_vorname ?? ''}
              onChange={e => setFields(f => ({ ...f, anforderer_vorname: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="anforderer_nachname">Nachname des Anforderers</Label>
            <Input
              id="anforderer_nachname"
              value={fields.anforderer_nachname ?? ''}
              onChange={e => setFields(f => ({ ...f, anforderer_nachname: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="anforderer_email">E-Mail des Anforderers</Label>
            <Input
              id="anforderer_email"
              type="email"
              value={fields.anforderer_email ?? ''}
              onChange={e => setFields(f => ({ ...f, anforderer_email: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="verantwortlicher_vorname">Vorname des Verantwortlichen</Label>
            <Input
              id="verantwortlicher_vorname"
              value={fields.verantwortlicher_vorname ?? ''}
              onChange={e => setFields(f => ({ ...f, verantwortlicher_vorname: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="verantwortlicher_nachname">Nachname des Verantwortlichen</Label>
            <Input
              id="verantwortlicher_nachname"
              value={fields.verantwortlicher_nachname ?? ''}
              onChange={e => setFields(f => ({ ...f, verantwortlicher_nachname: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prioritaet">Priorität</Label>
            <Select
              value={lookupKey(fields.prioritaet) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, prioritaet: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="prioritaet"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="niedrig">Niedrig</SelectItem>
                <SelectItem value="mittel">Mittel</SelectItem>
                <SelectItem value="hoch">Hoch</SelectItem>
                <SelectItem value="kritisch">Kritisch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={lookupKey(fields.status) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, status: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="status"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="offen">Offen</SelectItem>
                <SelectItem value="in_bearbeitung">In Bearbeitung</SelectItem>
                <SelectItem value="abgeschlossen">Abgeschlossen</SelectItem>
                <SelectItem value="abgelehnt">Abgelehnt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="faelligkeitsdatum">Fälligkeitsdatum</Label>
            <Input
              id="faelligkeitsdatum"
              type="date"
              value={fields.faelligkeitsdatum ?? ''}
              onChange={e => setFields(f => ({ ...f, faelligkeitsdatum: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kennzahlen">Relevante Kennzahlen</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="kennzahlen_umsatz"
                  checked={lookupKeys(fields.kennzahlen).includes('umsatz')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.kennzahlen);
                      const next = checked ? [...current, 'umsatz'] : current.filter(k => k !== 'umsatz');
                      return { ...f, kennzahlen: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="kennzahlen_umsatz" className="font-normal">Umsatz</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="kennzahlen_kosten"
                  checked={lookupKeys(fields.kennzahlen).includes('kosten')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.kennzahlen);
                      const next = checked ? [...current, 'kosten'] : current.filter(k => k !== 'kosten');
                      return { ...f, kennzahlen: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="kennzahlen_kosten" className="font-normal">Kosten</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="kennzahlen_gewinn"
                  checked={lookupKeys(fields.kennzahlen).includes('gewinn')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.kennzahlen);
                      const next = checked ? [...current, 'gewinn'] : current.filter(k => k !== 'gewinn');
                      return { ...f, kennzahlen: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="kennzahlen_gewinn" className="font-normal">Gewinn</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="kennzahlen_kundenzahl"
                  checked={lookupKeys(fields.kennzahlen).includes('kundenzahl')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.kennzahlen);
                      const next = checked ? [...current, 'kundenzahl'] : current.filter(k => k !== 'kundenzahl');
                      return { ...f, kennzahlen: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="kennzahlen_kundenzahl" className="font-normal">Kundenzahl</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="kennzahlen_mitarbeiterzahl"
                  checked={lookupKeys(fields.kennzahlen).includes('mitarbeiterzahl')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.kennzahlen);
                      const next = checked ? [...current, 'mitarbeiterzahl'] : current.filter(k => k !== 'mitarbeiterzahl');
                      return { ...f, kennzahlen: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="kennzahlen_mitarbeiterzahl" className="font-normal">Mitarbeiterzahl</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="kennzahlen_conversion_rate"
                  checked={lookupKeys(fields.kennzahlen).includes('conversion_rate')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.kennzahlen);
                      const next = checked ? [...current, 'conversion_rate'] : current.filter(k => k !== 'conversion_rate');
                      return { ...f, kennzahlen: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="kennzahlen_conversion_rate" className="font-normal">Conversion Rate</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="kennzahlen_nps"
                  checked={lookupKeys(fields.kennzahlen).includes('nps')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.kennzahlen);
                      const next = checked ? [...current, 'nps'] : current.filter(k => k !== 'nps');
                      return { ...f, kennzahlen: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="kennzahlen_nps" className="font-normal">NPS</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="kennzahlen_sonstiges_kz"
                  checked={lookupKeys(fields.kennzahlen).includes('sonstiges_kz')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.kennzahlen);
                      const next = checked ? [...current, 'sonstiges_kz'] : current.filter(k => k !== 'sonstiges_kz');
                      return { ...f, kennzahlen: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="kennzahlen_sonstiges_kz" className="font-normal">Sonstiges</Label>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="beschreibung">Beschreibung / Anforderungen</Label>
            <Textarea
              id="beschreibung"
              value={fields.beschreibung ?? ''}
              onChange={e => setFields(f => ({ ...f, beschreibung: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="anhang">Anhang</Label>
            {fields.anhang ? (
              <div className="flex items-center gap-3 rounded-lg border p-2">
                <div className="relative h-14 w-14 shrink-0 rounded-md bg-muted overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <IconFileText size={20} className="text-muted-foreground" />
                  </div>
                  <img
                    src={fields.anhang}
                    alt=""
                    className="relative h-full w-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate text-foreground">{fields.anhang.split("/").pop()}</p>
                  <div className="flex gap-2 mt-1">
                    <label
                      className="text-xs text-primary hover:underline cursor-pointer"
                    >
                      Ändern
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const fileUrl = await uploadFile(file, file.name);
                            setFields(f => ({ ...f, anhang: fileUrl }));
                          } catch (err) { console.error('Upload failed:', err); }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setFields(f => ({ ...f, anhang: undefined }))}
                    >
                      Entfernen
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <label
                className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
              >
                <IconUpload size={20} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Datei hochladen</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const fileUrl = await uploadFile(file, file.name);
                      setFields(f => ({ ...f, anhang: fileUrl }));
                    } catch (err) { console.error('Upload failed:', err); }
                  }}
                />
              </label>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Speichern...' : defaultValues ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}