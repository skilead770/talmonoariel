import { BarMitzvahRecord } from '../types';

/**
 * Parse a Gregorian date string (supports both Hebrew and English months)
 * and return a JavaScript Date object.
 */
export function parseGregorianToDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Try direct Date parsing first (handles ISO, standard English strings)
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d;
  }
  
  // Handle formatted Hebrew or English dates like "24 באוקטובר 2026" or "24 Oct 2026"
  const cleanStr = dateStr.trim().replace(/\s+/g, ' ');
  const parts = cleanStr.split(' ');
  
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1].toLowerCase();
    const year = parseInt(parts[2], 10);
    
    if (!isNaN(day) && !isNaN(year)) {
      let monthIndex = -1;
      
      const hebrewMonths = [
        'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
      ];
      
      // Match Hebrew months (e.g. "אוקטובר" or with prefix "באוקטובר")
      for (let i = 0; i < hebrewMonths.length; i++) {
        if (monthStr === hebrewMonths[i] || monthStr === 'ב' + hebrewMonths[i]) {
          monthIndex = i;
          break;
        }
      }
      
      // Fallback to English month names
      if (monthIndex === -1) {
        const englishMonths = [
          ['jan'], ['feb'], ['mar'], ['apr'], ['may'], ['jun'],
          ['jul'], ['aug'], ['sep'], ['oct'], ['nov'], ['dec']
        ];
        for (let i = 0; i < englishMonths.length; i++) {
          if (englishMonths[i].some(prefix => monthStr.startsWith(prefix))) {
            monthIndex = i;
            break;
          }
        }
      }
      
      if (monthIndex !== -1) {
        return new Date(year, monthIndex, day);
      }
    }
  }
  
  return null;
}

/**
 * Converts a numeric Hebrew year (e.g. 5787) into its Hebrew letters representation (e.g. תשפ"ז)
 */
export function convertYearToHebrewLetters(year: number): string {
  const num = year % 1000;
  const h = Math.floor(num / 100) * 100;
  const t = Math.floor((num % 100) / 10) * 10;
  const o = num % 10;
  
  let hundredsStr = '';
  if (h === 100) hundredsStr = 'ק';
  else if (h === 200) hundredsStr = 'ר';
  else if (h === 300) hundredsStr = 'ש';
  else if (h === 400) hundredsStr = 'ת';
  else if (h === 500) hundredsStr = 'תק';
  else if (h === 600) hundredsStr = 'תר';
  else if (h === 700) hundredsStr = 'תש';
  else if (h === 800) hundredsStr = 'תת';
  else if (h === 900) hundredsStr = 'תתק';

  let tensAndOnesStr = '';
  const lastTwo = t + o;
  if (lastTwo === 15) {
    tensAndOnesStr = 'טו';
  } else if (lastTwo === 16) {
    tensAndOnesStr = 'טז';
  } else {
    const tensMap: Record<number, string> = {
      10: 'י', 20: 'כ', 30: 'ל', 40: 'מ', 50: 'נ', 60: 'ס', 70: 'ע', 80: 'פ', 90: 'צ'
    };
    const onesMap: Record<number, string> = {
      1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט'
    };
    tensAndOnesStr = (tensMap[t] || '') + (onesMap[o] || '');
  }

  const combined = hundredsStr + tensAndOnesStr;
  if (!combined) return '';

  if (combined.length === 1) {
    return combined + "'";
  }
  
  // Insert double quotes before the last letter
  return combined.slice(0, -1) + '"' + combined.slice(-1);
}

/**
 * Converts a numeric day of the month (1-30) into its Hebrew letters representation (e.g. 17 -> י"ז)
 */
export function convertDayToHebrewLetters(day: number): string {
  if (day < 1 || day > 30) return day.toString();
  
  if (day === 15) return 'ט"ו';
  if (day === 16) return 'ט"ז';
  
  const tens = Math.floor(day / 10) * 10;
  const ones = day % 10;
  
  const tensMap: Record<number, string> = {
    10: 'י', 20: 'כ', 30: 'ל'
  };
  const onesMap: Record<number, string> = {
    1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט'
  };
  
  const tensStr = tensMap[tens] || '';
  const onesStr = onesMap[ones] || '';
  
  const combined = tensStr + onesStr;
  if (combined.length === 1) {
    return combined + "'";
  }
  return combined.slice(0, -1) + '"' + combined.slice(-1);
}

/**
 * Dynamically converts a Gregorian date string into a formatted Hebrew calendar date.
 */
export function convertToHebrewDate(dateStr: string): string {
  const date = parseGregorianToDate(dateStr);
  if (!date) return '';
  
  try {
    const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    let formatted = formatter.format(date);
    
    // Replace any 1-2 digit numbers (which represent the day) with Hebrew letters
    formatted = formatted.replace(/\b\d{1,2}\b/g, (match) => {
      const dayNum = parseInt(match, 10);
      return convertDayToHebrewLetters(dayNum);
    });

    // Replace any 4-digit Hebrew year starting with 5 (e.g., 5787) with Hebrew letters (e.g., תשפ"ז)
    formatted = formatted.replace(/5\d{3}/g, (match) => {
      const yearNum = parseInt(match, 10);
      return convertYearToHebrewLetters(yearNum);
    });
    
    return formatted;
  } catch (e) {
    return '';
  }
}

/**
 * Helper to resolve the correct date and default note for a given Torah portion in the 5786-5787 cycle
 */
export function resolveDateForParsha(parshaName: string): { date: string; notes: string } {
  if (!parshaName) return { date: '', notes: '' };
  
  // Clean up the name for matching (remove "פרשת", spaces, quotes, hyphens)
  const clean = parshaName
    .replace(/^פרשת\s+/, '')
    .replace(/["']/g, '')
    .trim();
  
  const PARSHA_DATES_5786_5787: Record<string, string> = {
    'מטות מסעי': '11 ביולי 2026',
    'מטות-מסעי': '11 ביולי 2026',
    'דברים': '18 ביולי 2026',
    'ואתחנן': '25 ביולי 2026',
    'עקב': '1 באוגוסט 2026',
    'ראה': '8 באוגוסט 2026',
    'שופטים': '15 באוגוסט 2026',
    'כי תצא': '22 באוגוסט 2026',
    'כי-תצא': '22 באוגוסט 2026',
    'כי תבוא': '29 באוגוסט 2026',
    'כי-תבוא': '29 באוגוסט 2026',
    'ניצבים וילך': '5 בספטמבר 2026',
    'ניצבים-וילך': '5 בספטמבר 2026',
    'ניצבים': '5 בספטמבר 2026',
    'וילך': '5 בספטמבר 2026',
    'האזינו': '19 בספטמבר 2026',
    'בראשית': '10 באוקטובר 2026',
    'נח': '17 באוקטובר 2026',
    'לך לך': '24 באוקטובר 2026',
    'לך-לך': '24 באוקטובר 2026',
    'וירא': '31 באוקטובר 2026',
    'חיי שרה': '7 בנובמבר 2026',
    'חיי-שרה': '7 בנובמבר 2026',
    'תולדות': '14 בנובמבר 2026',
    'ויצא': '21 בנובמבר 2026',
    'וישלח': '28 בנובמבר 2026',
    'וישב': '5 בדצמבר 2026',
    'מקץ': '12 בדצמבר 2026',
    'ויגש': '19 בדצמבר 2026',
    'ויחי': '26 בדצמבר 2026',
    'שמות': '2 בינואר 2027',
    'וארא': '9 בינואר 2027',
    'ןארא': '9 בינואר 2027',
    'בא': '16 בינואר 2027',
    'בשלח': '23 בינואר 2027',
    'יתרו': '30 בינואר 2027',
    'משפטים': '6 בפברואר 2027',
    'תרומה': '13 בפברואר 2027',
    'תצוה': '20 בפברואר 2027',
    'תצווה': '20 בפברואר 2027',
    'כי תשא': '27 בפברואר 2027',
    'כי-תשא': '27 בפברואר 2027',
    'ויקהל': '6 במרץ 2027',
    'ויקהל פקודי': '13 במרץ 2027',
    'ויקהל-פקודי': '13 במרץ 2027',
    'פקודי': '13 במרץ 2027',
    'ויקרא': '20 במרץ 2027',
    'צו': '27 במרץ 2027',
    'פסח': '24 באפריל 2027',
    'חוה"מ פסח': '24 באפריל 2027',
    'חוהמ פסח': '24 באפריל 2027',
    'חול המועד פסח': '24 באפריל 2027',
    'שמיני': '3 באפריל 2027',
    'שמני': '3 באפריל 2027',
    'תזריע': '10 באפריל 2027',
    'מצורע': '17 באפריל 2027',
    'תזריע מצורע': '17 באפריל 2027',
    'תזריע-מצורע': '17 באפריל 2027',
    'אחרי מות': '1 במאי 2027',
    'אחרי מות קדושים': '1 במאי 2027',
    'אחרי-מות-קדושים': '1 במאי 2027',
    'קדושים': '8 במאי 2027',
    'אמור': '15 במאי 2027',
    'בהר': '22 במאי 2027',
    'בחוקותי': '29 במאי 2027',
    'במדבר': '5 ביוני 2027',
    'נשא': '19 ביוני 2027',
    'בהעלותך': '26 ביוני 2027',
    'שלח': '3 ביולי 2027',
    'קרח': '10 ביולי 2027',
    'קורח': '10 ביולי 2027',
    'חקת': '17 ביולי 2027',
    'חוקת': '17 ביולי 2027',
    'בלק': '24 ביולי 2027',
    'פנחס': '31 ביולי 2027'
  };

  const matchedDate = PARSHA_DATES_5786_5787[clean];
  if (matchedDate) {
    let notes = '';
    if (clean === 'וישב' || clean === 'מקץ') notes = 'שבת חנוכה';
    else if (clean === 'בשלח') notes = 'שבת שירה';
    return { date: matchedDate, notes };
  }
  
  // Try fuzzy matching or parts
  for (const [key, dateStr] of Object.entries(PARSHA_DATES_5786_5787)) {
    if (clean.includes(key) || key.includes(clean)) {
      let notes = '';
      if (key === 'וישב' || key === 'מקץ') notes = 'שבת חנוכה';
      else if (key === 'בשלח') notes = 'שבת שירה';
      return { date: dateStr, notes };
    }
  }

  return { date: '', notes: '' };
}

export const CANONICAL_PARSHAS_LIST = [
  'מטות מסעי',
  'דברים',
  'ואתחנן',
  'עקב',
  'ראה',
  'שופטים',
  'כי תצא',
  'כי תבוא',
  'ניצבים',
  'וילך',
  'ניצבים וילך',
  'האזינו',
  'בראשית',
  'נח',
  'לך לך',
  'וירא',
  'חיי שרה',
  'תולדות',
  'ויצא',
  'וישלח',
  'וישב',
  'מקץ',
  'ויגש',
  'ויחי',
  'שמות',
  'וארא',
  'בא',
  'בשלח',
  'יתרו',
  'משפטים',
  'תרומה',
  'תצוה',
  'כי תשא',
  'ויקהל',
  'ויקהל פקודי',
  'ויקרא',
  'צו',
  'שמיני',
  'תזריע',
  'מצורע',
  'תזריע מצורע',
  'אחרי מות',
  'אחרי מות קדושים',
  'קדושים',
  'אמור',
  'בהר',
  'בחוקותי',
  'במדבר',
  'נשא',
  'בהעלותך',
  'שלח',
  'קרח',
  'חקת',
  'בלק',
  'פנחס'
];

/**
 * Sorts records chronologically by their parsed Gregorian date
 */
export function sortRecordsChronologically(records: BarMitzvahRecord[]): BarMitzvahRecord[] {
  return [...records].sort((a, b) => {
    const dateA = parseGregorianToDate(a.date);
    const dateB = parseGregorianToDate(b.date);
    
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1; // Put records without dates at the end
    if (!dateB) return -1;
    
    return dateA.getTime() - dateB.getTime();
  });
}
