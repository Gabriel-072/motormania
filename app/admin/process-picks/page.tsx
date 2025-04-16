'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';

export default function ProcessPicksPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProcessPicks = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
  
    try {
      const response = await fetch('/api/admin/process-picks', {
        method: 'POST'
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        setError(data.error || '❌ Error desconocido');
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message || '❌ Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 font-exo2">
      <h1 className="text-3xl font-bold mb-4">Admin: Procesar Picks</h1>

      <button
        onClick={handleProcessPicks}
        disabled={loading}
        className="bg-amber-500 text-black font-bold px-6 py-2 rounded hover:bg-amber-400 disabled:opacity-50"
      >
        {loading ? 'Procesando...' : 'Procesar Picks'}
      </button>

      {error && (
        <div className="mt-4 text-red-400 text-sm">{error}</div>
      )}

      {result && (
        <div className="mt-6 bg-gray-900 p-4 rounded text-sm whitespace-pre-wrap">
          <strong className="text-green-400">✅ Resultado:</strong>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
