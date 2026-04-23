import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { lookupKey, lookupKeys } from '@/lib/formatters';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'altcha-widget': {
        ref?: unknown;
        challengeurl?: string;
        auto?: string;
        hidelogo?: boolean;
        hidefooter?: boolean;
        class?: string;
      };
    }
  }
}

// Empty PROXY_BASE → relative URLs (dashboard and form-proxy share the domain).
const PROXY_BASE = '';
const APP_ID = '69e9f472b5a446e7391ec863';
const SUBMIT_PATH = `/rest/apps/${APP_ID}/records`;
const ALTCHA_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/altcha/dist/altcha.min.js';

async function submitPublicForm(fields: Record<string, unknown>, captchaToken: string) {
  const res = await fetch(`${PROXY_BASE}/api${SUBMIT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Captcha-Token': captchaToken,
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Submission failed');
  }
  return res.json();
}


function cleanFields(fields: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (typeof value === 'object' && !Array.isArray(value) && 'key' in (value as any)) {
      cleaned[key] = (value as any).key;
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map(item =>
        typeof item === 'object' && item !== null && 'key' in item ? item.key : item
      );
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export default function PublicFormReportingAnfrage() {
  const [fields, setFields] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captchaRef = useRef<HTMLElement | null>(null);

  // Load the ALTCHA web component script once per page.
  useEffect(() => {
    if (document.querySelector(`script[src="${ALTCHA_SCRIPT_SRC}"]`)) return;
    const s = document.createElement('script');
    s.src = ALTCHA_SCRIPT_SRC;
    s.defer = true;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    const qIdx = hash.indexOf('?');
    if (qIdx === -1) return;
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    const prefill: Record<string, any> = {};
    params.forEach((value, key) => { prefill[key] = value; });
    if (Object.keys(prefill).length) setFields(prev => ({ ...prefill, ...prev }));
  }, []);

  function readCaptchaToken(): string | null {
    const el = captchaRef.current as any;
    if (!el) return null;
    return el.value || el.getAttribute('value') || null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = readCaptchaToken();
    if (!token) {
      setError('Bitte warte auf die Spam-Prüfung und versuche es erneut.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitPublicForm(cleanFields(fields), token);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Etwas ist schiefgelaufen. Bitte versuche es erneut.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Vielen Dank!</h2>
          <p className="text-muted-foreground">Deine Eingabe wurde erfolgreich übermittelt.</p>
          <Button variant="outline" className="mt-4" onClick={() => { setSubmitted(false); setFields({}); }}>
            Weitere Eingabe
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Reporting-Anfrage — Formular</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-6 shadow-md">
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

          <altcha-widget
            ref={captchaRef as any}
            challengeurl={`${PROXY_BASE}/api/_challenge?path=${encodeURIComponent(SUBMIT_PATH)}`}
            auto="onsubmit"
            hidefooter
          />

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Wird gesendet...' : 'Absenden'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Powered by Klar
        </p>
      </div>
    </div>
  );
}
