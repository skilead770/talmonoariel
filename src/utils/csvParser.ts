import { BarMitzvahRecord, CsvMapping } from '../types';
import { resolveDateForParsha } from './hebrewDate';

export function detectSeparator(headerLine: string): string {
  const counts = {
    ',': (headerLine.match(/,/g) || []).length,
    ';': (headerLine.match(/;/g) || []).length,
    '\t': (headerLine.match(/\t/g) || []).length,
  };
  
  let bestSep = ',';
  let maxCount = 0;
  for (const [sep, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      bestSep = sep;
    }
  }
  return bestSep;
}

export function parseCsvLine(line: string, separator: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  // Normalize line endings
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  
  const separator = detectSeparator(lines[0]);
  const headers = parseCsvLine(lines[0], separator);
  const rows = lines.slice(1).map(line => parseCsvLine(line, separator));
  
  return { headers, rows };
}

export function autoDetectMapping(headers: string[]): CsvMapping {
  let parshaKey = '';
  let kidKey = '';
  let dateKey = '';
  let notesKey = '';
  
  // Parsha indicators
  const parshaTerms = ['parsha', 'parshat', 'shabbat', 'torah', 'portion', 'sidra', 'week', 'parshat hashavua', 'פרשה', 'פרשת השבוע', 'שבת', 'תורה', 'סדרה', 'בר מצווה', 'בר-מצווה', 'בר מצוה'];
  // Kid indicators
  const kidTerms = ['kid', 'child', 'name', 'boy', 'student', 'celebrant', 'candidate', 'youth', 'person', 'ילד', 'שם', 'שם הילד', 'חתן', 'חוגג'];
  // Date indicators
  const dateTerms = ['date', 'time', 'shabbat date', 'gregorian', 'hebrew date', 'תאריך', 'יום', 'שבת תאריך', 'תאריך שבת'];
  // Notes indicators
  const notesTerms = ['note', 'notes', 'comment', 'comments', 'info', 'details', 'הערה', 'הערות', 'מידע', 'פרטים'];
  
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  // Try to find parsha column
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const h = normalizedHeaders[i];
    if (parshaTerms.some(term => h.includes(term))) {
      parshaKey = headers[i];
      break;
    }
  }
  
  // Try to find kid column
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const h = normalizedHeaders[i];
    if (headers[i] === parshaKey) continue; // skip parsha column
    if (kidTerms.some(term => h.includes(term))) {
      kidKey = headers[i];
      break;
    }
  }
  
  // Try to find date column
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const h = normalizedHeaders[i];
    if (headers[i] === parshaKey || headers[i] === kidKey) continue;
    if (dateTerms.some(term => h.includes(term))) {
      dateKey = headers[i];
      break;
    }
  }

  // Try to find notes column
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const h = normalizedHeaders[i];
    if (headers[i] === parshaKey || headers[i] === kidKey || headers[i] === dateKey) continue;
    if (notesTerms.some(term => h.includes(term))) {
      notesKey = headers[i];
      break;
    }
  }
  
  // Fallback defaults if not found
  if (!parshaKey && headers.length > 0) parshaKey = headers[0];
  if (!kidKey && headers.length > 1) kidKey = headers[1];
  else if (!kidKey && headers.length > 0) kidKey = headers[0]; // fallback to same
  if (!dateKey && headers.length > 2) dateKey = headers[2];
  if (!notesKey && headers.length > 3) notesKey = headers[3];
  
  return { parshaKey, kidKey, dateKey, notesKey };
}

export function mapRowsToRecords(
  headers: string[],
  rows: string[][],
  mapping: CsvMapping
): BarMitzvahRecord[] {
  const parshaIdx = headers.indexOf(mapping.parshaKey);
  const kidIdx = headers.indexOf(mapping.kidKey);
  const dateIdx = mapping.dateKey ? headers.indexOf(mapping.dateKey) : -1;
  const notesIdx = mapping.notesKey ? headers.indexOf(mapping.notesKey) : -1;
  
  return rows
    .filter(row => row.length > 0)
    .map((row, index) => {
      const parsha = parshaIdx !== -1 ? row[parshaIdx] || '' : '';
      const kidName = kidIdx !== -1 ? row[kidIdx] || '' : '';
      let date = dateIdx !== -1 ? row[dateIdx] || '' : '';
      let notes = notesIdx !== -1 ? row[notesIdx] || '' : '';
      
      // Auto-resolve date and default notes if not present
      if (!date && parsha) {
        const resolved = resolveDateForParsha(parsha);
        date = resolved.date;
        if (!notes) {
          notes = resolved.notes;
        }
      }
      
      return {
        id: `row-${index}-${Date.now()}`,
        parsha,
        kidName,
        date,
        notes,
      };
    })
    .filter(record => record.parsha || record.kidName); // keep if has either
}
