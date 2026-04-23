// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface ReportingAnfrage {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    titel?: string;
    berichtstyp?: LookupValue;
    bereich?: LookupValue;
    zeitraum_von?: string; // Format: YYYY-MM-DD oder ISO String
    zeitraum_bis?: string; // Format: YYYY-MM-DD oder ISO String
    anforderer_vorname?: string;
    anforderer_nachname?: string;
    anforderer_email?: string;
    verantwortlicher_vorname?: string;
    verantwortlicher_nachname?: string;
    prioritaet?: LookupValue;
    status?: LookupValue;
    faelligkeitsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    kennzahlen?: LookupValue[];
    beschreibung?: string;
    anhang?: string;
  };
}

export const APP_IDS = {
  REPORTING_ANFRAGE: '69e9f472b5a446e7391ec863',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'reporting_anfrage': {
    berichtstyp: [{ key: "monatsbericht", label: "Monatsbericht" }, { key: "quartalsbericht", label: "Quartalsbericht" }, { key: "jahresbericht", label: "Jahresbericht" }, { key: "ad_hoc_bericht", label: "Ad-hoc-Bericht" }, { key: "kpi_bericht", label: "KPI-Bericht" }, { key: "sonstiges", label: "Sonstiges" }],
    bereich: [{ key: "vertrieb", label: "Vertrieb" }, { key: "marketing", label: "Marketing" }, { key: "finanzen", label: "Finanzen" }, { key: "personal", label: "Personal" }, { key: "it", label: "IT" }, { key: "produktion", label: "Produktion" }, { key: "einkauf", label: "Einkauf" }, { key: "sonstiges_bereich", label: "Sonstiges" }],
    prioritaet: [{ key: "niedrig", label: "Niedrig" }, { key: "mittel", label: "Mittel" }, { key: "hoch", label: "Hoch" }, { key: "kritisch", label: "Kritisch" }],
    status: [{ key: "offen", label: "Offen" }, { key: "in_bearbeitung", label: "In Bearbeitung" }, { key: "abgeschlossen", label: "Abgeschlossen" }, { key: "abgelehnt", label: "Abgelehnt" }],
    kennzahlen: [{ key: "umsatz", label: "Umsatz" }, { key: "kosten", label: "Kosten" }, { key: "gewinn", label: "Gewinn" }, { key: "kundenzahl", label: "Kundenzahl" }, { key: "mitarbeiterzahl", label: "Mitarbeiterzahl" }, { key: "conversion_rate", label: "Conversion Rate" }, { key: "nps", label: "NPS" }, { key: "sonstiges_kz", label: "Sonstiges" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'reporting_anfrage': {
    'titel': 'string/text',
    'berichtstyp': 'lookup/select',
    'bereich': 'lookup/select',
    'zeitraum_von': 'date/date',
    'zeitraum_bis': 'date/date',
    'anforderer_vorname': 'string/text',
    'anforderer_nachname': 'string/text',
    'anforderer_email': 'string/email',
    'verantwortlicher_vorname': 'string/text',
    'verantwortlicher_nachname': 'string/text',
    'prioritaet': 'lookup/radio',
    'status': 'lookup/select',
    'faelligkeitsdatum': 'date/date',
    'kennzahlen': 'multiplelookup/checkbox',
    'beschreibung': 'string/textarea',
    'anhang': 'file',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateReportingAnfrage = StripLookup<ReportingAnfrage['fields']>;