export interface BarMitzvahRecord {
  id: string;
  parsha: string;
  kidName: string;
  date?: string;
  notes?: string;
}

export interface CsvMapping {
  parshaKey: string;
  kidKey: string;
  dateKey?: string;
  notesKey?: string;
}
