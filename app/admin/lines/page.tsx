// Ruta: app/admin/lines/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { createAuthClient } from '@/lib/supabase'; // Ajusta la ruta si es necesario
import LoadingAnimation from '@/components/LoadingAnimation'; // Ajusta la ruta si es necesario
import { Howl } from 'howler';
import { toast } from 'sonner';
import { Switch } from '@headlessui/react';

// --- @dnd-kit Imports ---
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Icons
import { FaKey, FaEye, FaSave, FaToggleOn, FaToggleOff, FaFire, FaTag, FaSpinner, FaGripVertical } from 'react-icons/fa';
import { LuClipboardList, LuEye } from "react-icons/lu";

// --- Interfaces ---
interface GpSchedule { gp_name: string; race_time: string; }
interface LineData { driver: string; line: number; }
interface LineState { [key: string]: string | number } // Estado local para inputs de líneas
interface DriverVisibilityData {
  driver: string;
  qualy_visible: boolean;
  race_visible: boolean;
  qualy_order: number;
  race_order: number;
  is_hot: boolean;
  is_promo: boolean;
}

// --- Sounds ---
const soundManager = {
  click: new Howl({ src: ['/sounds/f1-click.mp3'], volume: 0.2, preload: true }),
  // drop: new Howl({ src: ['/sounds/drop.mp3'], volume: 0.3, preload: true }), // Opcional: sonido al soltar
};

// --- Drivers List & Mapping (Constants) ---
const drivers: ReadonlyArray<string> = [ 'Max Verstappen', 'Yuki Tsunoda', 'Lando Norris', 'Oscar Piastri', 'Lewis Hamilton', 'Charles Leclerc', 'George Russell', 'Kimi Antonelli', 'Fernando Alonso', 'Lance Stroll', 'Liam Lawson', 'Isack Hadjar', 'Nico Hulkenberg', 'Gabriel Bortoleto', 'Pierre Gasly', 'Franco Colapinto', 'Alex Albon', 'Carlos Sainz', 'Oliver Bearman', 'Esteban Ocon' ];
const driverToTeam: Readonly<Record<string, string>> = { 'Max Verstappen': 'Red Bull', 'Yuki Tsunoda': 'Red Bull', 'Lando Norris': 'McLaren', 'Oscar Piastri': 'McLaren', 'Lewis Hamilton': 'Ferrari', 'Charles Leclerc': 'Ferrari', 'George Russell': 'Mercedes', 'Kimi Antonelli': 'Mercedes', 'Fernando Alonso': 'Aston Martin', 'Lance Stroll': 'Aston Martin', 'Liam Lawson': 'RB', 'Isack Hadjar': 'RB', 'Nico Hulkenberg': 'Sauber', 'Gabriel Bortoleto': 'Sauber', 'Pierre Gasly': 'Alpine', 'Franco Colapinto': 'Alpine', 'Alex Albon': 'Williams', 'Carlos Sainz': 'Williams', 'Oliver Bearman': 'Haas F1 Team', 'Esteban Ocon': 'Haas F1 Team' };


// --- Sortable Item Component (using dnd-kit) ---
interface SortableDriverItemProps {
  id: string; // Driver name acts as ID
  driverData: DriverVisibilityData;
  handleVisibilityChange: (driver: string, field: keyof Omit<DriverVisibilityData, 'driver' | 'qualy_order' | 'race_order'>, value: any) => void;
  // Pass Tailwind classes for consistency
  cardClasses: string;
  checkboxLabelClasses: string;
  switchBaseClasses: string;
  switchEnabledClasses: string;
  switchDisabledClasses: string;
  switchKnobClasses: string;
  switchKnobEnabledClasses: string;
  switchKnobDisabledClasses: string;
  index: number; // Current index for display
}

function SortableDriverItem({
    id,
    driverData,
    handleVisibilityChange,
    cardClasses,
    checkboxLabelClasses,
    switchBaseClasses,
    switchEnabledClasses,
    switchDisabledClasses,
    switchKnobClasses,
    switchKnobEnabledClasses,
    switchKnobDisabledClasses,
    index
}: SortableDriverItemProps) {
    const {
        attributes,
        listeners, // These are the drag handle props
        setNodeRef, // Ref for the draggable element
        transform,
        transition,
        isDragging, // State to know if currently dragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 100 : 'auto',
        opacity: isDragging ? 0.8 : 1,
    };

    const config = driverData;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes} // Apply attributes for a11y etc.
            className={`${cardClasses} p-3 space-y-2.5 flex items-center gap-2 ${isDragging ? 'shadow-xl shadow-amber-500/30 ring-2 ring-amber-500/70' : 'shadow-md'}`}
        >
             {/* Dedicated Drag Handle */}
             <button
                {...listeners} // Apply listeners ONLY to the handle
                aria-label={`Arrastrar ${config.driver}`}
                className="p-2 text-gray-400 hover:text-white cursor-grab focus:outline-none focus:ring-1 focus:ring-amber-500 rounded touch-none flex-shrink-0"
            >
                <FaGripVertical />
            </button>

            {/* Card Content */}
            <div className="flex-grow space-y-2.5">
                {/* Card Header */}
                <div className="flex justify-between items-center border-b border-gray-700/50 pb-1.5 mb-2">
                    <p className="text-sm font-semibold text-gray-100 truncate pr-2">{config.driver}</p>
                    <span className="text-xs font-mono text-amber-300 bg-gray-700/50 px-1.5 py-0.5 rounded flex-shrink-0">#{index + 1}</span>
                </div>

                {/* Toggles */}
                <div className="flex justify-between items-center">
                    <span className={checkboxLabelClasses}>Qualy Visible</span>
                    <Switch
                        checked={config.qualy_visible}
                        onChange={(checked) => handleVisibilityChange(config.driver, 'qualy_visible', checked)}
                        className={`${switchBaseClasses} ${config.qualy_visible ? switchEnabledClasses : switchDisabledClasses}`}
                    >
                        <span className={`${switchKnobClasses} ${config.qualy_visible ? switchKnobEnabledClasses : switchKnobDisabledClasses}`}/>
                    </Switch>
                </div>
                <div className="flex justify-between items-center">
                    <span className={checkboxLabelClasses}>Race Visible</span>
                    <Switch
                        checked={config.race_visible}
                        onChange={(checked) => handleVisibilityChange(config.driver, 'race_visible', checked)}
                        className={`${switchBaseClasses} ${config.race_visible ? switchEnabledClasses : switchDisabledClasses}`}
                    >
                        <span className={`${switchKnobClasses} ${config.race_visible ? switchKnobEnabledClasses : switchKnobDisabledClasses}`}/>
                    </Switch>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-700/50">
                    <span className={checkboxLabelClasses}><FaFire className="text-orange-500"/> HOT</span>
                     <Switch
                        checked={config.is_hot}
                        onChange={(checked) => handleVisibilityChange(config.driver, 'is_hot', checked)}
                        className={`${switchBaseClasses} ${config.is_hot ? 'bg-orange-500' : switchDisabledClasses}`}
                    >
                        <span className={`${switchKnobClasses} ${config.is_hot ? switchKnobEnabledClasses : switchKnobDisabledClasses}`}/>
                    </Switch>
                </div>
                <div className="flex justify-between items-center">
                    <span className={checkboxLabelClasses}><FaTag className="text-purple-500"/> PROMO</span>
                    <Switch
                        checked={config.is_promo}
                        onChange={(checked) => handleVisibilityChange(config.driver, 'is_promo', checked)}
                        className={`${switchBaseClasses} ${config.is_promo ? 'bg-purple-500' : switchDisabledClasses}`}
                    >
                        <span className={`${switchKnobClasses} ${config.is_promo ? switchKnobEnabledClasses : switchKnobDisabledClasses}`}/>
                    </Switch>
                </div>
            </div> {/* End Card Content */}
        </div> // End Draggable Container
    );
}


// --- Main Page Component ---
export default function AdminLinesPage() {
  const { getToken } = useAuth();

  // --- State ---
  const [tab, setTab] = useState<'lines' | 'visibility'>('lines');
  const [password, setPassword] = useState('');
  const correctPassword = process.env.ADMIN_PASSWORD || 'gamot62.72'; // NECESITA ser NEXT_PUBLIC_ para acceso en cliente
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lines, setLines] = useState<LineState>({});
  const [currentGp, setCurrentGp] = useState<GpSchedule | null>(null);
  const [sessionType, setSessionType] = useState<'qualy' | 'race'>('qualy');
  const [qualyEnabled, setQualyEnabled] = useState(false);
  const [raceEnabled, setRaceEnabled] = useState(false);
  const [visibilityData, setVisibilityData] = useState<Record<string, DriverVisibilityData>>({});
  const [orderedVisibilityDrivers, setOrderedVisibilityDrivers] = useState<string[]>([]);

  // --- Password Handling ---
   const handlePasswordSubmit = (e: React.FormEvent): void => { // Explicit void return
    e.preventDefault();
    setAuthError(false);
    if (password === correctPassword) {
      setIsAuthenticated(true);
      soundManager.click.play();
      toast.success("Acceso concedido");
    } else {
      setAuthError(true);
      toast.error('Contraseña incorrecta');
      setPassword('');
    }
  };

  // --- Data Fetching ---
   const fetchData = useCallback(async (): Promise<void> => { // Explicit Promise<void> return
    if (!isAuthenticated) return;
    setIsLoading(true);
    setIsDataLoaded(false);
    let gpNameForToast = '';
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('Authentication token missing.');
      const supabase = createAuthClient(token);

      const { data: scheduleData, error: scheduleError } = await supabase
        .from('gp_schedule').select('gp_name, race_time').order('race_time');
      if (scheduleError) throw scheduleError;
      const now = new Date();
      const current = scheduleData?.find((gp: GpSchedule) => new Date(gp.race_time) > now);
      if (!current && tab === 'lines') {
          throw new Error("No se encontró próximo GP para cargar líneas.");
      }
      setCurrentGp(current || null);
      gpNameForToast = current?.gp_name || '';

      toast.info(`Cargando ${tab === 'lines' ? `líneas ${sessionType}` : 'visibilidad'} ${gpNameForToast ? `para ${gpNameForToast}` : ''}...`);

      if (tab === 'lines') {
        if (!current) {
             toast.error("No se puede cargar líneas sin un GP futuro definido.");
             setIsLoading(false);
             return; // Added return here
        }
        const { data: linesData, error: linesError } = await supabase.from('lines')
          .select('driver, line').eq('gp_name', current.gp_name).eq('session_type', sessionType);
        if (linesError) throw linesError;
        const mappedLines: LineState = {};
        drivers.forEach(driver => {
            const foundLine = linesData?.find((l: LineData) => l.driver === driver);
            mappedLines[driver] = foundLine ? foundLine.line : '';
        });
        setLines(mappedLines);

        const { data: configData, error: configError } = await supabase.from('picks_config').select('is_qualy_enabled, is_race_enabled').eq('id', 'main').single();
        if (configError) throw configError;
        setQualyEnabled(configData.is_qualy_enabled);
        setRaceEnabled(configData.is_race_enabled);
        setOrderedVisibilityDrivers([]); // Reset

      } else if (tab === 'visibility') {
        const { data: visData, error: visError } = await supabase.from('driver_visibility').select('*');
        if (visError) throw visError;
        const mappedVis: Record<string, DriverVisibilityData> = {};
        drivers.forEach(driver => {
            const existing = visData?.find(item => item.driver === driver);
            mappedVis[driver] = existing || { driver, qualy_visible: true, race_visible: true, qualy_order: 99, race_order: 99, is_hot: false, is_promo: false };
        });
        setVisibilityData(mappedVis);
        // Initial sort for dnd-kit based on qualy_order
        const sortedDrivers = [...drivers].sort((a, b) => {
             const orderA = mappedVis[a]?.qualy_order ?? 99;
             const orderB = mappedVis[b]?.qualy_order ?? 99;
             return (isNaN(orderA) ? 99 : orderA) - (isNaN(orderB) ? 99 : orderB);
        });
        setOrderedVisibilityDrivers(sortedDrivers);
      }
      setIsDataLoaded(true);
      toast.success(`Datos de ${tab} cargados ${gpNameForToast ? `para ${gpNameForToast}` : ''}.`);

    } catch (err: any) {
      console.error(`Error fetching ${tab} data:`, err);
      toast.error(`Error cargando ${tab}: ${err.message}`);
      setIsDataLoaded(false);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, tab, getToken, sessionType]);

   // Fetch data effect
   useEffect(() => {
    if (isAuthenticated) { fetchData(); }
   }, [isAuthenticated, tab, fetchData]); // Keep fetchData as dependency

  // --- Update Handlers ---

  // Toggle config
  const toggleConfig = async (field: 'is_qualy_enabled' | 'is_race_enabled'): Promise<void> => { // Explicit Promise<void> return
    const currentValue = field === 'is_qualy_enabled' ? qualyEnabled : raceEnabled;
    const newValue = !currentValue;
    field === 'is_qualy_enabled' ? setQualyEnabled(newValue) : setRaceEnabled(newValue);
    soundManager.click.play();
    const actionText = `${field === 'is_qualy_enabled' ? 'Qualy' : 'Carrera'} ${newValue ? 'Activados' : 'Desactivados'}`;
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('Token missing');
      const supabase = createAuthClient(token);
      const { error } = await supabase.from('picks_config').update({ [field]: newValue }).eq('id', 'main');
      if (error) throw error;
      toast.success(`Picks ${actionText}`);
    } catch (err: any) {
      toast.error(`Error actualizando config: ${err.message}`);
      field === 'is_qualy_enabled' ? setQualyEnabled(currentValue) : setRaceEnabled(currentValue); // Revert on error
    }
  };

  // Handle line change
  const handleLineChange = (driver: string, value: string): void => { // Explicit void return
      if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
          setLines(prev => ({ ...prev, [driver]: value }));
      }
  };

  // Prepare lines
  const prepareLinesForSubmit = (): Record<string, number> => { // Explicit return type (correct)
    const preparedLines: Record<string, number> = {};
    for (const driver of drivers) {
        const value = lines[driver];
        let numValue = parseFloat(value as string);
        preparedLines[driver] = isNaN(numValue) ? 0 : numValue;
    }
    return preparedLines;
  };

  // Submit lines
  const handleSubmitLines = async (): Promise<void> => { // Explicit Promise<void> return
    if (!currentGp) { toast.error("GP actual no definido."); return; }
    setIsSaving(true);
    soundManager.click.play();
    const linesToSave = prepareLinesForSubmit();
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('Token missing');
      const supabase = createAuthClient(token);
      const inserts = drivers.map(driver => ({ gp_name: currentGp.gp_name, driver, line: linesToSave[driver] ?? 0, session_type: sessionType }));
      const { error } = await supabase.from('lines').upsert(inserts, { onConflict: 'gp_name,driver,session_type' });
      if (error) throw error;
      toast.success(`Líneas ${sessionType} guardadas para ${currentGp.gp_name}`);
      setLines(linesToSave); // Update state with parsed values
    } catch (err: any) {
      toast.error(`Error guardando líneas: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle visibility change
  const handleVisibilityChange = (driver: string, field: keyof Omit<DriverVisibilityData, 'driver' | 'qualy_order' | 'race_order'>, value: any): void => { // Explicit void return
        setVisibilityData(prev => {
            const currentDriverData = prev[driver] || { driver, qualy_visible: true, race_visible: true, qualy_order: 99, race_order: 99, is_hot: false, is_promo: false };
            return { ...prev, [driver]: { ...currentDriverData, [field]: value } };
        });
    };

  // --- @dnd-kit Drag End Handler ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDndKitDragEnd = useCallback((event: DragEndEvent): void => { // Explicit void via useCallback inference is fine, but explicit is ok too
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // soundManager.drop?.play(); // Optional

      setOrderedVisibilityDrivers((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);

        setVisibilityData(prevVisData => {
            const updatedVisData = { ...prevVisData };
            newOrder.forEach((driverName, index) => {
                if (updatedVisData[driverName]) {
                    updatedVisData[driverName] = {
                        ...updatedVisData[driverName],
                        qualy_order: index,
                        race_order: index
                    };
                }
            });
            return updatedVisData;
        });

        return newOrder; // Return new order for setOrderedVisibilityDrivers
      });
    }
  }, []); // No external dependencies needed if using state updater functions

  // Submit visibility
  const handleSubmitVisibility = async (): Promise<void> => { // Explicit Promise<void> return
    setIsSaving(true);
    soundManager.click.play();
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('Token missing');
      const supabase = createAuthClient(token);
      const payload = drivers.map(driver => visibilityData[driver] || { driver, qualy_visible: true, race_visible: true, qualy_order: 99, race_order: 99, is_hot: false, is_promo: false });
      const { error } = await supabase.from('driver_visibility').upsert(payload, { onConflict: 'driver' });
      if (error) throw error;
      toast.success('Visibilidad/Orden guardado');
    } catch (err: any) {
      toast.error(`Error guardando visibilidad: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Tailwind Classes ---
  const mainContainerClasses = "min-h-screen bg-gradient-to-b from-gray-950 via-[#0b121c] to-black text-white font-exo2";
  const contentWrapperClasses = "container mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16";
  const sectionWrapperClasses = "bg-gradient-to-br from-gray-900/60 via-gray-850/50 to-black/60 p-5 sm:p-6 rounded-xl shadow-lg border border-gray-700/50 backdrop-blur-sm mb-8";
  const sectionTitleClasses = "text-xl sm:text-2xl font-bold text-amber-400 mb-5 pb-2 border-b border-amber-500/30 flex items-center gap-2";
  const buttonBaseClasses = "px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center";
  const tabButtonActiveClasses = "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow focus:ring-cyan-400";
  const tabButtonInactiveClasses = "bg-gray-700/70 text-gray-300 hover:bg-gray-600/80 focus:ring-gray-500";
  const saveButtonClasses = `${buttonBaseClasses} bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white focus:ring-emerald-500 active:scale-[0.98] gap-2`;
  const toggleButtonBaseClasses = `${buttonBaseClasses} flex items-center justify-center gap-1.5 text-xs`;
  const toggleButtonActiveClasses = "bg-green-600 hover:bg-green-700 text-white focus:ring-green-500";
  const toggleButtonInactiveClasses = "bg-red-700 hover:bg-red-800 text-white focus:ring-red-600";
  const cardClasses = "bg-gray-800/70 rounded-lg border border-gray-700/60"; // Base card class (shadow applied in SortableItem)
  const inputBaseClasses = "px-2 py-1 rounded bg-gray-900/80 border border-gray-600/70 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition duration-150 shadow-sm w-full";
  const checkboxLabelClasses = "text-xs text-gray-300 select-none cursor-pointer flex items-center gap-2";
  const switchBaseClasses = "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-gray-900";
  const switchEnabledClasses = "bg-green-500";
  const switchDisabledClasses = "bg-gray-600";
  const switchKnobClasses = "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out";
  const switchKnobEnabledClasses = "translate-x-4";
  const switchKnobDisabledClasses = "translate-x-0";

  // --- Password Prompt ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="bg-gradient-to-br from-gray-800 to-black p-6 sm:p-8 rounded-xl shadow-2xl border border-amber-500/40 w-full max-w-sm"
        >
          <h2 className="text-xl font-bold mb-5 text-center text-amber-400 font-exo2">Panel de Administración</h2>
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <label htmlFor="admin-password" className="sr-only">Contraseña</label>
            <div className="relative">
               <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><FaKey /></span>
               <input
                 id="admin-password"
                 type="password"
                 value={password}
                 onChange={e => setPassword(e.target.value)}
                 placeholder="Contraseña"
                 className={`w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-700/50 border ${authError ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-600'} text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition shadow-inner`}
                 required
                 autoFocus
               />
            </div>
             {authError && <p className="text-red-400 text-xs text-center -mt-2">Contraseña incorrecta.</p>}
            <button type="submit" className={`${buttonBaseClasses} bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:shadow-md hover:shadow-amber-500/30 focus:ring-amber-400 active:scale-95 mt-2`}>
              Acceder
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // --- Main Authenticated Render ---
  return (
    // Enclose everything including potential StrictMode here if needed at top level
    // <React.StrictMode> // <-- Ensure this is NOT here if using react-beautiful-dnd
    <div className={mainContainerClasses}>
      <div className={contentWrapperClasses}>
        {/* Tab Navigation */}
         <div className="flex justify-center gap-2 mb-8 p-1 bg-gray-800/70 rounded-lg max-w-sm mx-auto shadow-md">
          <button onClick={() => { soundManager.click.play(); setTab('lines'); }} className={`${buttonBaseClasses} flex-1 ${tab === 'lines' ? tabButtonActiveClasses : tabButtonInactiveClasses}`}>
            <LuClipboardList className="mr-1.5"/> Líneas
          </button>
          <button onClick={() => { soundManager.click.play(); setTab('visibility'); }} className={`${buttonBaseClasses} flex-1 ${tab === 'visibility' ? tabButtonActiveClasses : tabButtonInactiveClasses}`}>
            <LuEye className="mr-1.5"/> Visibilidad
          </button>
        </div>

        {/* Content Area based on Tab */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
          >
            {/* Loading / Error States */}
            {isLoading ? ( <LoadingAnimation text={`Cargando ${tab}...`} /> )
            : !isDataLoaded && tab !== 'lines' ? ( <div className={`${sectionWrapperClasses} text-center text-red-400`}>Error al cargar datos. Intenta recargar.</div> )
            : !isDataLoaded && tab === 'lines' && !currentGp ? ( <div className={`${sectionWrapperClasses} text-center text-yellow-400`}>No se encontró un próximo GP para cargar líneas. Verifica el calendario.</div> )
            : tab === 'lines' ? (
              // --- Lines Editor ---
              <div className={sectionWrapperClasses}>
                <h1 className={sectionTitleClasses}>
                  <LuClipboardList /> Editor de Líneas {currentGp ? `- ${currentGp.gp_name}` : ''} (<span className='capitalize'>{sessionType}</span>)
                </h1>
                {/* Session Toggle */}
                <div className="flex justify-center gap-2 mb-5 p-1 bg-gray-800/50 rounded-lg max-w-[220px]">
                   <button onClick={() => { soundManager.click.play(); setSessionType('qualy'); }} className={`${buttonBaseClasses} flex-1 text-xs ${sessionType==='qualy' ? tabButtonActiveClasses : tabButtonInactiveClasses}`}>Qualy</button>
                   <button onClick={() => { soundManager.click.play(); setSessionType('race'); }} className={`${buttonBaseClasses} flex-1 text-xs ${sessionType==='race' ? tabButtonActiveClasses : tabButtonInactiveClasses}`}>Carrera</button>
                </div>
                {/* Enable/Disable Toggles */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <button onClick={() => toggleConfig('is_qualy_enabled')} className={`${toggleButtonBaseClasses} ${qualyEnabled ? toggleButtonActiveClasses : toggleButtonInactiveClasses}`}>
                    {qualyEnabled ? <FaToggleOn size="1.2em"/> : <FaToggleOff size="1.2em"/>} Picks Qualy: {qualyEnabled ? 'Activos' : 'Inactivos'}
                  </button>
                  <button onClick={() => toggleConfig('is_race_enabled')} className={`${toggleButtonBaseClasses} ${raceEnabled ? toggleButtonActiveClasses : toggleButtonInactiveClasses}`}>
                     {raceEnabled ? <FaToggleOn size="1.2em"/> : <FaToggleOff size="1.2em"/>} Picks Carrera: {raceEnabled ? 'Activos' : 'Inactivos'}
                  </button>
                </div>

                {/* Driver Lines Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mb-6">
                  {drivers.map(driver => (
                    <div key={`${sessionType}-${driver}`} className={`${cardClasses} p-3`}>
                      <label htmlFor={`line-${driver}`} className="block text-sm font-semibold text-gray-200 mb-1.5 truncate">{driver}</label>
                      <input
                        id={`line-${driver}`}
                        type="text"
                        inputMode="decimal"
                        step="0.5"
                        className={`${inputBaseClasses} text-center text-lg font-mono`}
                        value={lines[driver] ?? ''}
                        onChange={e => handleLineChange(driver, e.target.value)}
                        placeholder="0.0"
                      />
                      <p className="text-xs text-indigo-400 mt-1 text-center truncate">{driverToTeam[driver] || 'Equipo Desconocido'}</p>
                    </div>
                  ))}
                </div>
                 {/* Lines Save Button */}
                <div className="flex justify-end">
                    <button onClick={handleSubmitLines} disabled={isSaving || isLoading} className={`${saveButtonClasses} min-w-[180px]`}>
                      {isSaving ? <FaSpinner className="animate-spin mr-2"/> : <FaSave className="mr-2"/>}
                      Guardar Líneas (<span className='capitalize'>{sessionType}</span>)
                    </button>
                </div>
              </div> // End Lines Editor Section
            ) : (
              // --- Visibility Editor (Using @dnd-kit) ---
              <div className={sectionWrapperClasses}>
                <h1 className={sectionTitleClasses}><LuEye /> Editor de Visibilidad y Orden (Arrastrable)</h1>

                {/* @dnd-kit Context */}
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDndKitDragEnd}
                >
                    {/* Sortable Context */}
                    <SortableContext
                        items={orderedVisibilityDrivers}
                        strategy={verticalListSortingStrategy}
                    >
                        {/* Grid container for the sortable items */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                            {orderedVisibilityDrivers.map((driverId, index) => {
                                const driverData = visibilityData[driverId];
                                return driverData ? (
                                    <SortableDriverItem
                                        key={driverId}
                                        id={driverId}
                                        driverData={driverData}
                                        handleVisibilityChange={handleVisibilityChange}
                                        index={index}
                                        // Pass Tailwind classes
                                        cardClasses={cardClasses}
                                        checkboxLabelClasses={checkboxLabelClasses}
                                        switchBaseClasses={switchBaseClasses}
                                        switchEnabledClasses={switchEnabledClasses}
                                        switchDisabledClasses={switchDisabledClasses}
                                        switchKnobClasses={switchKnobClasses}
                                        switchKnobEnabledClasses={switchKnobEnabledClasses}
                                        switchKnobDisabledClasses={switchKnobDisabledClasses}
                                    />
                                ) : (
                                    // Render placeholder or log error if data missing unexpectedly
                                     <div key={driverId} className={`${cardClasses} p-3 opacity-50`}>Cargando datos para {driverId}...</div>
                                );
                            })}
                        </div>
                    </SortableContext>
                </DndContext>

                {/* Visibility Save Button */}
                <div className="flex justify-end mt-6">
                    <button
                      onClick={handleSubmitVisibility}
                      disabled={isSaving || isLoading}
                      className={`${saveButtonClasses} min-w-[180px]`}
                    >
                      {isSaving ? <FaSpinner className="animate-spin mr-2"/> : <FaSave className="mr-2"/>}
                      Guardar Visibilidad
                    </button>
                </div>
              </div> // End Visibility Editor Section
            )}
          </motion.div>
        </AnimatePresence>
      </div> {/* End contentWrapperClasses */}
    </div> // End mainContainerClasses
    // </React.StrictMode> // <-- Ensure this is NOT here if using react-beautiful-dnd
  );
} // --- End of AdminLinesPage component ---