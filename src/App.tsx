import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  BookOpen, 
  Upload, 
  Calendar, 
  Search, 
  FileText, 
  CheckCircle, 
  Settings, 
  Sparkles, 
  RefreshCw, 
  FileSpreadsheet, 
  Users, 
  Check, 
  X, 
  ChevronDown, 
  Info,
  ArrowLeft,
  ArrowRight,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarMitzvahRecord, CsvMapping } from './types';
import { parseSampleData, SAMPLE_CSV_CONTENT } from './data/sampleData';
import { parseCsv, autoDetectMapping, mapRowsToRecords } from './utils/csvParser';
import { convertToHebrewDate, sortRecordsChronologically, resolveDateForParsha, CANONICAL_PARSHAS_LIST } from './utils/hebrewDate';

const LOCAL_STORAGE_KEY = 'bar_mitzvah_schedule_data';
const LOCAL_STORAGE_MAPPING_KEY = 'bar_mitzvah_schedule_mapping';
const LOCAL_STORAGE_RAW_CSV = 'bar_mitzvah_raw_csv';

export default function App() {
  // --- States ---
  const [records, setRecords] = useState<BarMitzvahRecord[]>([]);
  const [isUsingSample, setIsUsingSample] = useState(true);
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  
  // Navigation
  const [activeTab, setActiveTab] = useState<'finder' | 'schedule'>('finder');
  
  // Search / Selection in Dropdown
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  
  // Schedule View Search
  const [scheduleSearch, setScheduleSearch] = useState('');

  // Parsha Assignment for unassigned kids
  const [assigningKidId, setAssigningKidId] = useState<string | null>(null);
  const [assigningSearch, setAssigningSearch] = useState<string>('');
  
  // CSV Management Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'mapping'>('upload');
  
  // Parsing Temp State
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [currentMapping, setCurrentMapping] = useState<CsvMapping>({
    parshaKey: '',
    kidKey: '',
    dateKey: '',
    notesKey: ''
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Load Initial Data ---
  useEffect(() => {
    const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData) as BarMitzvahRecord[];
        if (parsed.length > 0) {
          const sorted = sortRecordsChronologically(parsed);
          setRecords(sorted);
          setIsUsingSample(false);
          // Pre-select first record
          setSelectedRecordId(sorted[0].id);
        } else {
          loadSampleData();
        }
      } catch (e) {
        loadSampleData();
      }
    } else {
      loadSampleData();
    }
  }, []);

  const loadSampleData = () => {
    const samples = parseSampleData();
    const sorted = sortRecordsChronologically(samples);
    setRecords(sorted);
    setIsUsingSample(true);
    if (sorted.length > 0) {
      setSelectedRecordId(sorted[0].id);
    }
  };

  // --- Click outside dropdown logic ---
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Currently selected record ---
  const currentRecord = records.find(r => r.id === selectedRecordId) || records[0];

  // --- Distinct Shabbats (first record of each unique parsha) ---
  const distinctShabbats = useMemo(() => {
    const seen = new Set<string>();
    const result: BarMitzvahRecord[] = [];
    for (const r of records) {
      if (!r.parsha || r.parsha.trim() === '') continue;
      const key = r.parsha.trim();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(r);
      }
    }
    return result;
  }, [records]);

  // --- Unassigned Kids (records without any parsha) ---
  const unassignedKids = useMemo(() => {
    return records.filter(r => !r.parsha || r.parsha.trim() === '');
  }, [records]);

  // --- Parsha options for assignment ---
  const parshaOptions = useMemo(() => {
    return CANONICAL_PARSHAS_LIST.map(p => {
      const resolved = resolveDateForParsha(p);
      const hebDate = resolved.date ? convertToHebrewDate(resolved.date) : '';
      return {
        parsha: p,
        date: resolved.date,
        hebrewDate: hebDate,
        notes: resolved.notes
      };
    });
  }, []);

  const filteredAssignOptions = useMemo(() => {
    if (!assigningSearch) return parshaOptions;
    const s = assigningSearch.toLowerCase();
    return parshaOptions.filter(opt => 
      opt.parsha.toLowerCase().includes(s) || 
      (opt.date && opt.date.toLowerCase().includes(s)) ||
      (opt.hebrewDate && opt.hebrewDate.toLowerCase().includes(s))
    );
  }, [parshaOptions, assigningSearch]);

  const assignParshaToKid = (kidId: string, selectedParsha: string) => {
    const resolved = resolveDateForParsha(selectedParsha);
    const updatedRecords = records.map(r => {
      if (r.id === kidId) {
        return {
          ...r,
          parsha: selectedParsha,
          date: resolved.date || r.date,
          notes: resolved.notes || r.notes || ''
        };
      }
      return r;
    });
    
    const sorted = sortRecordsChronologically(updatedRecords);
    setRecords(sorted);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sorted));
    
    // Clear selection state
    setAssigningKidId(null);
    setAssigningSearch('');
    
    // Also set current select record to this newly assigned one so they can see the finder details!
    setSelectedRecordId(kidId);
  };

  // --- All celebrants celebrating on the current record's Shabbat ---
  const currentCelebrants = useMemo(() => {
    if (!currentRecord) return [];
    if (!currentRecord.parsha) {
      return [currentRecord];
    }
    return records.filter(r => r.parsha === currentRecord.parsha && r.kidName);
  }, [records, currentRecord]);

  // --- Dropdown Filtering ---
  const filteredDropdownOptions = useMemo(() => {
    return distinctShabbats.filter(shabbat => {
      const parshaMatch = shabbat.parsha.toLowerCase().includes(dropdownSearch.toLowerCase());
      
      const kids = records.filter(r => r.parsha === shabbat.parsha && r.kidName);
      const kidMatch = kids.some(k => k.kidName.toLowerCase().includes(dropdownSearch.toLowerCase()));
      
      return parshaMatch || kidMatch;
    });
  }, [distinctShabbats, records, dropdownSearch]);

  // --- Schedule Table Filtering ---
  const filteredScheduleRecords = records.filter(r => 
    r.parsha.toLowerCase().includes(scheduleSearch.toLowerCase()) ||
    r.kidName.toLowerCase().includes(scheduleSearch.toLowerCase()) ||
    (r.date && r.date.toLowerCase().includes(scheduleSearch.toLowerCase())) ||
    (r.notes && r.notes.toLowerCase().includes(scheduleSearch.toLowerCase()))
  );

  // --- Drag and Drop Handlers ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      processRawCsvText(text);
    };
    reader.readAsText(file);
  };

  const processRawCsvText = (text: string) => {
    if (!text.trim()) {
      setErrorMsg('תוכן קובץ ה-CSV ריק.');
      return;
    }
    
    try {
      const { headers, rows } = parseCsv(text);
      if (headers.length === 0) {
        setErrorMsg('לא נמצאו עמודות כלשהן בקובץ ה-CSV.');
        return;
      }
      
      setParsedHeaders(headers);
      setParsedRows(rows);
      
      // Auto detect columns
      const detected = autoDetectMapping(headers);
      setCurrentMapping(detected);
      
      setErrorMsg('');
      setImportStep('mapping');
      setPasteContent(text); // Store raw text
    } catch (err: any) {
      setErrorMsg(`שגיאה בניתוח הקובץ: ${err.message || err}`);
    }
  };

  const saveImportedData = () => {
    if (!currentMapping.parshaKey || !currentMapping.kidKey) {
      setErrorMsg('חובה לשייך לפחות את עמודת פרשת השבוע ועמודת שם הילד.');
      return;
    }

    try {
      const mappedRecords = mapRowsToRecords(parsedHeaders, parsedRows, currentMapping);
      if (mappedRecords.length === 0) {
        setErrorMsg('לא נוצרו רשומות תקינות. אנא ודאו את תוכן ה-CSV והמיפוי שנבחר.');
        return;
      }

      // Sort chronologically
      const sorted = sortRecordsChronologically(mappedRecords);

      // Save to localStorage
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sorted));
      localStorage.setItem(LOCAL_STORAGE_MAPPING_KEY, JSON.stringify(currentMapping));
      localStorage.setItem(LOCAL_STORAGE_RAW_CSV, pasteContent);

      setRecords(sorted);
      setIsUsingSample(false);
      setSelectedRecordId(sorted[0].id);
      
      setSuccessMsg('לוח שבתות בר המצווה האישי שלך יובא והוחל בהצלחה!');
      setErrorMsg('');
      
      setTimeout(() => {
        setIsDrawerOpen(false);
        setSuccessMsg('');
        // Reset drawer state
        setImportStep('upload');
        setPasteContent('');
        setParsedHeaders([]);
        setParsedRows([]);
      }, 1500);

    } catch (err: any) {
      setErrorMsg(`שגיאה בשמירת הנתונים: ${err.message || err}`);
    }
  };

  const handleResetToSample = () => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק את הנתונים שהעלית ולחזור ללוח השנה לדוגמה?')) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem(LOCAL_STORAGE_MAPPING_KEY);
      localStorage.removeItem(LOCAL_STORAGE_RAW_CSV);
      loadSampleData();
      setIsDrawerOpen(false);
      setImportStep('upload');
      setPasteContent('');
      setErrorMsg('');
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#FAF9F6] text-stone-800 font-sans antialiased selection:bg-amber-100 selection:text-amber-900 pb-16">
      {/* Decorative top bar */}
      <div className="h-1.5 bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 w-full" />
      
      {/* Header Container */}
      <header className="max-w-4xl mx-auto px-4 pt-8 pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-200/60 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5 animate-fade-in">
              <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-amber-200/50">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                שמחות שבת ובר מצווה
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-stone-900" id="app-title">
              משבץ בר המצווה לשבתות השנה
            </h1>
            <p className="text-sm text-stone-500 mt-1 max-w-xl">
              בחרו את פרשת השבוע כדי לגלות איזה ילד חוגג את בר המצווה שלו, או הציגו את לוח השנה המלא והמפורט.
            </p>
          </div>
          
          {/* Data controls & status */}
          <div className="flex items-center gap-3 self-start md:self-center">
            {isUsingSample ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50/75 border border-amber-200 px-3 py-1.5 rounded-lg">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>מציג נתוני דוגמה</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span>הקובץ האישי שלך פעיל</span>
              </span>
            )}
            
            <button
              onClick={() => {
                setIsDrawerOpen(true);
                setImportStep('upload');
                setErrorMsg('');
              }}
              id="btn-manage-csv"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg px-3.5 py-1.5 shadow-2xs transition duration-150 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              ניהול קובץ CSV
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <main className="max-w-4xl mx-auto px-4 mt-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-stone-200 mb-8" id="tab-navigation">
          <button
            onClick={() => setActiveTab('finder')}
            id="tab-btn-finder"
            className={`py-3 px-6 text-sm font-medium border-b-2 transition duration-200 flex items-center gap-2 cursor-pointer ${
              activeTab === 'finder'
                ? 'border-amber-500 text-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-300'
            }`}
          >
            <Search className="w-4 h-4" />
            מאתר פרשות
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            id="tab-btn-schedule"
            className={`py-3 px-6 text-sm font-medium border-b-2 transition duration-200 flex items-center gap-2 cursor-pointer ${
              activeTab === 'schedule'
                ? 'border-amber-500 text-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-300'
            }`}
          >
            <Calendar className="w-4 h-4" />
            לוח השנה המלא ({records.length})
          </button>
        </div>

        {/* TAB CONTENTS */}
        <AnimatePresence mode="wait">
          {activeTab === 'finder' ? (
            <motion.div
              key="finder-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Portion Selector Box */}
              <div className="bg-white rounded-2xl border border-stone-200 p-6 md:p-8 shadow-xs">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                  בחרו פרשה / קטע קריאה בתורה
                </label>
                
                {/* Searchable Combobox Select */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    id="parsha-select-btn"
                    className="w-full flex items-center justify-between bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl px-4 py-3.5 text-right text-base text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition cursor-pointer"
                  >
                    <span className="font-semibold text-stone-900">
                      {currentRecord ? `פרשת ${currentRecord.parsha}` : 'בחירת פרשה...'}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-stone-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-30 mt-2 w-full bg-white border border-stone-200 rounded-xl shadow-lg max-h-80 overflow-hidden flex flex-col text-right"
                      >
                        {/* Search input in dropdown */}
                        <div className="p-2 border-b border-stone-100 flex items-center gap-2 bg-stone-50">
                          <Search className="w-4 h-4 text-stone-400 shrink-0 mr-1" />
                          <input
                            type="text"
                            placeholder="הקלידו לחיפוש פרשה או שם הילד..."
                            value={dropdownSearch}
                            onChange={(e) => setDropdownSearch(e.target.value)}
                            className="w-full bg-transparent text-sm text-stone-800 py-1.5 px-1 border-none focus:outline-hidden text-right"
                            autoFocus
                          />
                          {dropdownSearch && (
                            <button 
                              onClick={() => setDropdownSearch('')}
                              className="p-1 hover:bg-stone-200 rounded-full text-stone-400 hover:text-stone-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* List items */}
                        <div className="overflow-y-auto divide-y divide-stone-50" id="parsha-dropdown-list">
                          {filteredDropdownOptions.length > 0 ? (
                            filteredDropdownOptions.map((record) => {
                              // Find all kids celebrating on this Shabbat
                              const kidsOnShabbat = records.filter(
                                r => r.parsha === record.parsha && r.kidName
                              );
                              const isSelected = currentRecord && currentRecord.parsha === record.parsha;

                              return (
                                <button
                                  key={record.id}
                                  onClick={() => {
                                    setSelectedRecordId(record.id);
                                    setIsDropdownOpen(false);
                                    setDropdownSearch('');
                                  }}
                                  className={`w-full text-right px-4 py-3 text-sm flex items-center justify-between transition cursor-pointer ${
                                    isSelected
                                      ? 'bg-amber-50/75 text-amber-900 font-medium'
                                      : 'hover:bg-stone-50 text-stone-700'
                                  }`}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-semibold">פרשת {record.parsha}</span>
                                    {record.date && (
                                      <span className="flex flex-col leading-tight mt-1 text-right">
                                        <span className="text-stone-800 text-xs font-semibold">{convertToHebrewDate(record.date)}</span>
                                        <span className="text-[10px] text-stone-400 font-normal">{record.date}</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-left flex items-center gap-1.5 max-w-[60%]">
                                    <span className="text-xs text-stone-500 italic truncate text-left">
                                      {kidsOnShabbat.length > 0 
                                        ? kidsOnShabbat.map(k => k.kidName).join(', ') 
                                        : 'אין חתנים קבועים'}
                                    </span>
                                    {isSelected && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <div className="p-4 text-center text-sm text-stone-400 italic">
                              לא נמצאו פרשות מתאימות
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Celebration Name Card */}
              {currentRecord && (
                <motion.div
                  key={currentRecord.parsha || currentRecord.id}
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  id="celebration-card"
                  className="bg-radial from-amber-50 to-[#FCFAF2] rounded-3xl border border-amber-200/60 p-8 text-center shadow-md relative overflow-hidden"
                >
                  {/* Backdrop subtle graphics */}
                  <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-200/20 rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-amber-300/10 rounded-full blur-2xl pointer-events-none" />
                  
                  <span className="text-amber-700 text-xs font-bold uppercase tracking-widest bg-amber-100/50 border border-amber-200/30 px-3.5 py-1 rounded-full inline-block mb-4">
                    {currentCelebrants.length > 1 ? 'חתני בר המצווה החוגגים בשבת זו' : 'חתן בר המצווה החוגג בשבת זו'}
                  </span>

                  {/* Gigantic kid name(s) - all in the exact same view and size */}
                  {currentCelebrants.length > 0 ? (
                    <div className={`grid gap-4 my-6 justify-center w-full ${
                      currentCelebrants.length === 1 
                        ? 'grid-cols-1 max-w-md mx-auto' 
                        : currentCelebrants.length === 2 
                        ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto' 
                        : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-w-4xl mx-auto'
                    }`}>
                      {currentCelebrants.map((celebrant, idx) => (
                        <div 
                          key={celebrant.id}
                          className="bg-white/85 backdrop-blur-xs border border-amber-200/40 rounded-2xl p-6 shadow-xs flex flex-col items-center justify-center relative min-h-[120px] transition-all hover:shadow-md hover:border-amber-300/60"
                        >
                          {/* Sequence indicator */}
                          <div className="absolute top-3 right-3 bg-amber-100 text-amber-800 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                            {idx + 1}
                          </div>
                          <span className="text-2xl md:text-3xl font-extrabold text-stone-900 font-sans tracking-tight">
                            {celebrant.kidName}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-stone-900 my-4 font-sans leading-tight">
                      <span className="text-stone-400 italic font-normal text-3xl">לא נקבע בר מצווה לשבת זו</span>
                    </h2>
                  )}

                  {/* Portion subtitle */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 mt-4 text-stone-600 font-medium">
                    <span className="flex items-center gap-1.5 text-stone-800 bg-stone-100 px-3.5 py-1 rounded-full text-sm">
                      <BookOpen className="w-4 h-4 text-stone-500" />
                      שבת פרשת <strong className="font-semibold text-stone-900">{currentRecord.parsha}</strong>
                    </span>
                    
                    {currentRecord.date && (
                      <span className="flex items-center gap-2.5 text-stone-800 bg-stone-100 px-4 py-1.5 rounded-full text-sm">
                        <Calendar className="w-4 h-4 text-amber-600 shrink-0 self-center" />
                        <span className="flex flex-col text-right leading-tight">
                          <span className="font-bold text-stone-900 text-[13px]">
                            {convertToHebrewDate(currentRecord.date)}
                          </span>
                          <span className="text-[10px] text-stone-400 font-medium animate-pulse-slow">
                            {currentRecord.date}
                          </span>
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Notes Callout */}
                  {(() => {
                    const allNotes = records
                      .filter(r => r.parsha === currentRecord.parsha && r.notes)
                      .map(r => r.notes);
                    const uniqueNotes = Array.from(new Set(allNotes));
                    
                    if (uniqueNotes.length === 0) return null;
                    
                    return (
                      <div className="mt-8 max-w-lg mx-auto bg-amber-100/30 border border-amber-200/40 rounded-xl p-4 text-stone-700 text-sm flex flex-col gap-2 text-right">
                        <div className="flex items-center gap-2">
                          <Info className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="font-bold text-amber-950">הערות לשבת:</span>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-xs md:text-sm text-stone-800 leading-relaxed pr-1">
                          {uniqueNotes.map((note, idx) => (
                            <li key={idx} className="list-none md:list-item">{note}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}

                  {/* Simple Prev / Next Portions */}
                  {(() => {
                    const currentShabbatIndex = distinctShabbats.findIndex(s => s.parsha === currentRecord.parsha);
                    return (
                      <div className="flex items-center justify-between border-t border-stone-200/50 mt-8 pt-6">
                        <button
                          disabled={currentShabbatIndex <= 0}
                          onClick={() => {
                            if (currentShabbatIndex > 0) {
                              setSelectedRecordId(distinctShabbats[currentShabbatIndex - 1].id);
                            }
                          }}
                          className="text-xs font-semibold text-stone-500 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 cursor-pointer"
                        >
                          שבוע קודם ←
                        </button>
                        
                        <span className="text-xs text-stone-400">
                          שבת {currentShabbatIndex !== -1 ? currentShabbatIndex + 1 : 1} מתוך {distinctShabbats.length}
                        </span>

                        <button
                          disabled={currentShabbatIndex === -1 || currentShabbatIndex === distinctShabbats.length - 1}
                          onClick={() => {
                            if (currentShabbatIndex !== -1 && currentShabbatIndex < distinctShabbats.length - 1) {
                              setSelectedRecordId(distinctShabbats[currentShabbatIndex + 1].id);
                            }
                          }}
                          className="text-xs font-semibold text-stone-500 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 cursor-pointer"
                        >
                          שבוע הבא →
                        </button>
                      </div>
                    );
                  })()}
                </motion.div>
              )}

              {/* Unassigned Waiting List Section */}
              {unassignedKids.length > 0 && (
                <div className="bg-white rounded-2xl border border-stone-200 p-6 md:p-8 shadow-xs">
                  <div className="flex items-center gap-2 mb-4 border-b border-stone-100 pb-3">
                    <Users className="w-5 h-5 text-amber-600" />
                    <h3 className="font-bold text-stone-950 text-base">
                      שמות הממתינים לשיבוץ ({unassignedKids.length} ילדים)
                    </h3>
                    <span className="text-xs text-stone-400 font-normal mr-auto">
                      לחצו על "שבץ לפרשה" כדי לבחור פרשה ולשייך להם שבת חגיגה
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {unassignedKids.map((kid) => {
                      const isAssigning = assigningKidId === kid.id;
                      
                      return (
                        <div 
                          key={kid.id}
                          className={`border rounded-xl p-3.5 flex flex-col justify-between transition-all duration-200 shadow-2xs ${
                            isAssigning 
                              ? 'bg-amber-50/20 border-amber-400 ring-2 ring-amber-400/20 col-span-1 sm:col-span-2 md:col-span-1' 
                              : 'bg-stone-50/50 hover:bg-stone-50 border-stone-200/60 hover:border-amber-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-stone-900 text-sm">{kid.kidName}</span>
                              {isAssigning ? (
                                <button
                                  onClick={() => {
                                    setAssigningKidId(null);
                                    setAssigningSearch('');
                                  }}
                                  className="text-[10px] font-bold text-stone-500 hover:text-stone-800 bg-stone-100 hover:bg-stone-200/80 border border-stone-200 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                                >
                                  ביטול
                                </button>
                              ) : (
                                <span className="shrink-0 inline-flex items-center text-[10px] font-semibold text-amber-800 bg-amber-100/50 border border-amber-200/30 px-2 py-0.5 rounded-md">
                                  טרם שובץ
                                </span>
                              )}
                            </div>
                            
                            {!isAssigning && kid.notes && (
                              <div className="text-[10px] text-stone-500 mt-2 leading-relaxed bg-white border border-stone-100/50 rounded-lg p-1.5 font-normal truncate" title={kid.notes}>
                                {kid.notes}
                              </div>
                            )}
                          </div>

                          {isAssigning ? (
                            <div className="mt-3">
                              <div className="relative mb-2">
                                <input
                                  type="text"
                                  autoFocus
                                  value={assigningSearch}
                                  onChange={(e) => setAssigningSearch(e.target.value)}
                                  placeholder="חפשו פרשה או תאריך..."
                                  className="w-full px-2.5 py-1.5 pr-8 text-xs border border-stone-300 rounded-lg bg-white placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-medium"
                                />
                                <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                {assigningSearch && (
                                  <button
                                    onClick={() => setAssigningSearch('')}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 bg-transparent border-none p-0 cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              <div className="max-h-40 overflow-y-auto border border-stone-200/80 rounded-lg bg-white divide-y divide-stone-100/60 shadow-inner">
                                {filteredAssignOptions.length > 0 ? (
                                  filteredAssignOptions.map((opt) => (
                                    <button
                                      key={opt.parsha}
                                      onClick={() => assignParshaToKid(kid.id, opt.parsha)}
                                      className="w-full text-right px-3 py-2 text-xs hover:bg-amber-50/50 hover:text-amber-900 transition-colors flex items-center justify-between gap-2 cursor-pointer font-medium"
                                    >
                                      <div className="flex flex-col text-right">
                                        <span className="font-bold text-stone-900">פרשת {opt.parsha}</span>
                                        <span className="text-[10px] text-stone-500">{opt.hebrewDate || opt.date}</span>
                                      </div>
                                      {opt.notes && (
                                        <span className="shrink-0 text-[9px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/30">
                                          {opt.notes}
                                        </span>
                                      )}
                                    </button>
                                  ))
                                ) : (
                                  <div className="text-center text-[10px] text-stone-400 py-4 font-normal">
                                    לא נמצאה פרשה תואמת
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setAssigningKidId(kid.id);
                                setAssigningSearch('');
                              }}
                              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-100/50 hover:bg-amber-100/80 border border-amber-200/30 hover:border-amber-200/60 rounded-lg transition-colors cursor-pointer"
                            >
                              שבץ לפרשה
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="schedule-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="חיפוש לפי ילד, פרשה, תאריך או הערות..."
                    value={scheduleSearch}
                    onChange={(e) => setScheduleSearch(e.target.value)}
                    className="w-full bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg pr-9 pl-4 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                  />
                  {scheduleSearch && (
                    <button
                      onClick={() => setScheduleSearch('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-stone-200 rounded-full text-stone-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg px-3.5 py-2 cursor-pointer shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    הדפסת לוח שנה
                  </button>
                </div>
              </div>

              {/* Table / List */}
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse" id="schedule-table">
                    <thead>
                      <tr className="bg-stone-50/75 border-b border-stone-200 text-stone-500 font-semibold text-xs uppercase tracking-wider">
                        <th className="py-3 px-4 w-12 text-center">מס'</th>
                        <th className="py-3 px-4 text-right">פרשת השבוע</th>
                        <th className="py-3 px-4 text-right">חתן בר המצווה</th>
                        <th className="py-3 px-4 text-right">תאריך השבת</th>
                        <th className="py-3 px-4 text-right hidden md:table-cell">הערות לשבת</th>
                        <th className="py-3 px-4 text-left">פעולה</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-sm">
                      {filteredScheduleRecords.length > 0 ? (
                        filteredScheduleRecords.map((record, index) => {
                          const isSelected = record.id === selectedRecordId;
                          return (
                            <tr 
                              key={record.id}
                              className={`group hover:bg-stone-50/50 transition duration-150 ${isSelected ? 'bg-amber-50/20' : ''}`}
                            >
                              <td className="py-3.5 px-4 text-center text-xs font-mono text-stone-400">
                                {index + 1}
                              </td>
                              <td className="py-3.5 px-4 font-semibold text-stone-950">
                                {record.parsha ? (
                                  `פרשת ${record.parsha}`
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded-md text-xs font-semibold">
                                    טרם שובץ
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 font-medium text-stone-900">
                                {record.kidName || (
                                  <span className="text-stone-400 italic font-normal">לא נקבע חתן</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                {record.date ? (
                                  <div className="flex flex-col leading-tight">
                                    <span className="text-stone-950 font-bold text-xs">{convertToHebrewDate(record.date)}</span>
                                    <span className="text-stone-400 text-[10px]">{record.date}</span>
                                  </div>
                                ) : (
                                  <span className="text-stone-400 italic text-xs">—</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-stone-500 text-xs max-w-xs truncate hidden md:table-cell">
                                {record.notes || <span className="text-stone-300">—</span>}
                              </td>
                              <td className="py-3.5 px-4 text-left">
                                {record.parsha ? (
                                  <button
                                    onClick={() => {
                                      setSelectedRecordId(record.id);
                                      setActiveTab('finder');
                                    }}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 hover:underline bg-transparent border-none cursor-pointer"
                                  >
                                    הצג התאמה
                                    <ArrowLeft className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </button>
                                ) : (
                                  <span className="text-stone-400 text-xs italic">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-stone-400 italic">
                            לא נמצאו רשומות המתאימות ל-" {scheduleSearch} "
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* CSV IMPORTER DRAWER OVERLAY */}
      <AnimatePresence>
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-start" id="csv-management-drawer" dir="rtl">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="absolute inset-0 bg-stone-900 cursor-pointer"
            />
            
            {/* Drawer Body */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md md:max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 border-r border-stone-200"
            >
              {/* Header */}
              <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                <div>
                  <h3 className="text-lg font-bold text-stone-900">ניהול קובץ CSV של שבתות בר המצווה</h3>
                  <p className="text-xs text-stone-500 mt-1">העלו, ערכו או התאימו אישית את רשימת חתני בר המצווה שלכם.</p>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 hover:bg-stone-200 rounded-full text-stone-400 hover:text-stone-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-right">
                
                {errorMsg && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex gap-2">
                    <X className="w-5 h-5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex gap-2">
                    <CheckCircle className="w-5 h-5 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {importStep === 'upload' ? (
                  <div className="space-y-6">
                    {/* Drag and Drop Zone */}
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-2xl p-8 text-center transition duration-200 ${
                        dragActive 
                          ? 'border-amber-400 bg-amber-50/30' 
                          : 'border-stone-200 hover:border-stone-400 bg-stone-50/50'
                      }`}
                    >
                      <FileSpreadsheet className="w-10 h-10 text-stone-400 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-stone-800">
                        גררו והשליכו את קובץ ה-CSV שלכם לכאן
                      </p>
                      <p className="text-xs text-stone-500 mt-1 mb-4">
                        תומך בקבצי .csv ו- .txt סטנדרטיים
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/60 rounded-lg px-4 py-2 transition cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        בחירת קובץ מהמחשב
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileInput}
                        accept=".csv,.txt"
                        className="hidden"
                      />
                    </div>

                    {/* Or Paste Area */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider">
                        או הדביקו את תוכן קובץ ה-CSV ישירות כאן:
                      </label>
                      <textarea
                        value={pasteContent}
                        onChange={(e) => setPasteContent(e.target.value)}
                        placeholder={`פרשה,שם הילד,תאריך,הערות
בראשית,נועם גולדשטיין,24 באוקטובר 2026,קרובי משפחה מחו"ל מגיעים
נח,בנימין לוי,31 באוקטובר 2026,`}
                        rows={10}
                        className="w-full bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl p-3 text-xs font-mono text-stone-700 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-amber-400 text-right"
                      />
                      <p className="text-[11px] text-stone-400">
                        ודאו כי השורה הראשונה מכילה את שמות העמודות (כמו "פרשה" ו-"שם הילד").
                      </p>
                    </div>

                    {/* Submit parsing */}
                    <button
                      disabled={!pasteContent.trim()}
                      onClick={() => processRawCsvText(pasteContent)}
                      className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-semibold text-sm transition duration-150 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>ניתוח עמודות הקובץ</span>
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  // Step 2: Mapping columns
                  <div className="space-y-6">
                    <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-amber-900 flex items-center gap-1.5 mb-1">
                        <Check className="w-4 h-4 text-emerald-600" />
                        הקובץ נותח בהצלחה!
                      </h4>
                      <p className="text-xs text-amber-800">
                        מצאנו <strong className="font-semibold">{parsedHeaders.length} עמודות</strong> ו- <strong className="font-semibold">{parsedRows.length} שורות</strong>. אנא שייכו את העמודות המתאימות:
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Parsha Column Selector */}
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider">
                          עמודת פרשת השבוע <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={currentMapping.parshaKey}
                          onChange={(e) => setCurrentMapping({ ...currentMapping, parshaKey: e.target.value })}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-amber-400 cursor-pointer text-right"
                        >
                          <option value="">-- בחרו עמודה --</option>
                          {parsedHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      {/* Kid Column Selector */}
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider">
                          עמודת שם חתן בר המצווה <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={currentMapping.kidKey}
                          onChange={(e) => setCurrentMapping({ ...currentMapping, kidKey: e.target.value })}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-amber-400 cursor-pointer text-right"
                        >
                          <option value="">-- בחרו עמודה --</option>
                          {parsedHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      {/* Date Column Selector */}
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider">
                          עמודת תאריך השבת (אופציונלי)
                        </label>
                        <select
                          value={currentMapping.dateKey}
                          onChange={(e) => setCurrentMapping({ ...currentMapping, dateKey: e.target.value })}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-amber-400 cursor-pointer text-right"
                        >
                          <option value="">-- ללא / דלג --</option>
                          {parsedHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      {/* Notes Column Selector */}
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider">
                          עמודת הערות לשבת (אופציונלי)
                        </label>
                        <select
                          value={currentMapping.notesKey}
                          onChange={(e) => setCurrentMapping({ ...currentMapping, notesKey: e.target.value })}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-amber-400 cursor-pointer text-right"
                        >
                          <option value="">-- ללא / דלג --</option>
                          {parsedHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-stone-100 flex gap-3">
                      <button
                        onClick={() => setImportStep('upload')}
                        className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs rounded-xl transition cursor-pointer text-center"
                      >
                        חזור
                      </button>
                      <button
                        onClick={saveImportedData}
                        className="flex-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer text-center"
                      >
                        ייבוא והחלת הלוח
                      </button>
                    </div>
                  </div>
                )}

                {/* Reset to Sample Section */}
                {!isUsingSample && (
                  <div className="pt-6 border-t border-stone-100 mt-8">
                    <p className="text-xs text-stone-500 mb-3">
                      רוצים להסיר את הקובץ שלכם ולחזור ללוח הדוגמה?
                    </p>
                    <button
                      onClick={handleResetToSample}
                      className="w-full py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      שחזור נתוני דוגמה
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
