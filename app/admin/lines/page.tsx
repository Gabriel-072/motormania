'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import Header from '@/components/Header';
import { createAuthClient } from '@/lib/supabase';
import { Howl } from 'howler';

interface GpSchedule {
  gp_name: string;
  race_time: string;
}

interface LineData {
  driver: string;
  line: number;
}

const soundManager = {
  click: new Howl({ src: ['/sounds/f1-click.mp3'], volume: 0.2 }),
  rev: new Howl({ src: ['/sounds/f1-rev.mp3'], volume: 0.3 }),
};

const drivers = [
  'Max Verstappen', 'Yuki Tsunoda', 'Lando Norris', 'Oscar Piastri', 'Lewis Hamilton',
  'Charles Leclerc', 'George Russell', 'Kimi Antonelli', 'Fernando Alonso', 'Lance Stroll',
  'Liam Lawson', 'Isack Hadjar', 'Nico Hülkenberg', 'Gabriel Bortoleto', 'Pierre Gasly',
  'Jack Doohan', 'Alex Albon', 'Carlos Sainz', 'Oliver Bearman', 'Esteban Ocon'
];

const driverToTeam: Record<string, string> = {
  'Max Verstappen': 'Red Bull Racing', 'Yuki Tsunoda': 'Red Bull Racing', 'Lando Norris': 'McLaren',
  'Oscar Piastri': 'McLaren', 'Lewis Hamilton': 'Ferrari', 'Charles Leclerc': 'Ferrari',
  'George Russell': 'Mercedes', 'Kimi Antonelli': 'Mercedes', 'Fernando Alonso': 'Aston Martin',
  'Lance Stroll': 'Aston Martin', 'Liam Lawson': 'RB', 'Isack Hadjar': 'RB',
  'Nico Hülkenberg': 'Sauber', 'Gabriel Bortoleto': 'Sauber', 'Pierre Gasly': 'Alpine',
  'Jack Doohan': 'Alpine', 'Alex Albon': 'Williams', 'Carlos Sainz': 'Williams',
  'Oliver Bearman': 'Haas F1 Team', 'Esteban Ocon': 'Haas F1 Team'
};

export default function AdminLinesPage() {
  const { getToken } = useAuth();
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [lines, setLines] = useState<Record<string, number>>({});
  const [currentGp, setCurrentGp] = useState<GpSchedule | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [sessionType, setSessionType] = useState<'qualy' | 'race'>('qualy');
  const [status, setStatus] = useState('');
  const [qualyEnabled, setQualyEnabled] = useState(false);
  const [raceEnabled, setRaceEnabled] = useState(false);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Password protection
  const correctPassword = 'Gamot62.72';

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === correctPassword) {
      setIsAuthenticated(true);
    } else {
      alert('Contraseña incorrecta. Intenta de nuevo.');
      setPassword('');
    }
  };

  // Fetch inicial de datos
  useEffect(() => {
    if (!isAuthenticated) return; // Solo carga datos si está autenticado

    const fetchData = async () => {
      try {
        const token = await getToken({ template: 'supabase' });
        if (!token) throw new Error('No se pudo obtener el token');
        const supabase = createAuthClient(token);

        const { data: scheduleData, error: scheduleError } = await supabase
          .from('gp_schedule')
          .select('*')
          .order('race_time');

        if (scheduleError) throw new Error(`Error cargando GP: ${scheduleError.message}`);
        const now = new Date();
        const current = scheduleData?.find((gp: GpSchedule) => new Date(gp.race_time) > now);
        if (!current?.gp_name) throw new Error('No se encontró el GP actual.');
        setCurrentGp(current);

        const { data: linesData, error: linesError } = await supabase
          .from('lines')
          .select('driver, line')
          .eq('gp_name', current.gp_name)
          .eq('session_type', sessionType);

        if (linesError) throw new Error(`Error cargando líneas: ${linesError.message}`);

        const mapped: Record<string, number> = {};
        linesData?.forEach(({ driver, line }: LineData) => {
          mapped[driver] = line;
        });
        setLines(mapped);

        const { data: configData, error: configError } = await supabase
          .from('picks_config')
          .select('*')
          .eq('id', 'main')
          .single();

        if (configError) throw new Error(`Error cargando config: ${configError.message}`);

        setQualyEnabled(configData.is_qualy_enabled);
        setRaceEnabled(configData.is_race_enabled);

        setIsDataLoaded(true);
      } catch (err) {
        setErrors([err instanceof Error ? err.message : 'Error desconocido']);
        setIsDataLoaded(true);
      }
    };
    fetchData();
  }, [getToken, sessionType, isAuthenticated]);

  // Alternar configuración de picks_config
  const toggleConfig = async (field: 'is_qualy_enabled' | 'is_race_enabled', value: boolean) => {
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('Token no disponible');
      const supabase = createAuthClient(token);

      const { error } = await supabase
        .from('picks_config')
        .update({ [field]: value })
        .eq('id', 'main');

      if (error) throw error;
      if (field === 'is_qualy_enabled') setQualyEnabled(value);
      if (field === 'is_race_enabled') setRaceEnabled(value);
      setStatus('✅ Configuración actualizada');
    } catch (err) {
      console.error('Error actualizando picks_config:', err);
      setStatus('❌ Error al actualizar configuración');
    }
  };

  // Manejo de cambios en las líneas
  const handleChange = (driver: string, value: string) => {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      setLines((prev) => ({ ...prev, [driver]: parsed }));
    }
  };

  // Guardar líneas
  const handleSubmit = async () => {
    if (!currentGp?.gp_name) return;
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('Token no disponible');
      const supabase = createAuthClient(token);

      const inserts = drivers.map((driver) => ({
        gp_name: currentGp.gp_name,
        driver,
        line: lines[driver] ?? 10.5,
        session_type: sessionType,
      }));

      const { error } = await supabase.from('lines').upsert(inserts, {
        onConflict: 'gp_name,driver,session_type'
      });

      if (error) throw error;
      setStatus('✅ Líneas guardadas exitosamente');
    } catch (err) {
      console.error('Error guardando líneas:', err);
      setStatus('❌ Error guardando líneas');
    }
  };

  // Mostrar formulario de contraseña si no está autenticado
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-4 text-center">Ingresa la contraseña</h2>
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="px-4 py-2 rounded bg-gray-900 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Acceder
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Renderizar el panel de administración si está autenticado
  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 pt-12">
      <Header />
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Editor de Líneas — {sessionType}</h1>
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setSessionType('qualy')}
            className={`px-4 py-2 rounded ${sessionType === 'qualy' ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            Qualy
          </button>
          <button
            onClick={() => setSessionType('race')}
            className={`px-4 py-2 rounded ${sessionType === 'race' ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            Carrera
          </button>
        </div>

        <div className="flex gap-6 mb-6">
          <button
            onClick={() => toggleConfig('is_qualy_enabled', !qualyEnabled)}
            className={`px-4 py-2 rounded text-sm font-semibold ${qualyEnabled ? 'bg-green-600' : 'bg-red-600'}`}
          >
            Picks Qualy: {qualyEnabled ? '🟢 Activos' : '🔴 Inactivos'}
          </button>

          <button
            onClick={() => toggleConfig('is_race_enabled', !raceEnabled)}
            className={`px-4 py-2 rounded text-sm font-semibold ${raceEnabled ? 'bg-green-600' : 'bg-red-600'}`}
          >
            Picks Carrera: {raceEnabled ? '🟢 Activos' : '🔴 Inactivos'}
          </button>
        </div>

        {status && <p className="mb-4 text-sm text-yellow-400">{status}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {drivers.map((driver) => (
            <div key={driver} className="bg-gray-800 p-4 rounded">
              <p className="text-sm font-bold mb-1">{driver}</p>
              <input
                type="number"
                className="w-full px-2 py-1 rounded bg-gray-900 border border-gray-600 text-white"
                value={lines[driver] ?? ''}
                onChange={(e) => handleChange(driver, e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">Team: {driverToTeam[driver]}</p>
            </div>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          className="mt-6 bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white font-bold"
        >
          Guardar líneas
        </button>

        {errors.length > 0 && (
          <div className="mt-4 text-red-400">
            {errors.map((err, i) => <p key={i}>{err}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}