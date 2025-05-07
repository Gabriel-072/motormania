// 📁 app/legal/reglas/page.tsx
'use client';

import Link from 'next/link';

export default function ReglasDeLaCasa() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-gray-200 p-6 font-exo2">
      <div className="max-w-3xl mx-auto space-y-8">

        <header className="space-y-3">
          <h1 className="text-3xl font-bold text-amber-500">📜 Reglas de la Casa</h1>
          <p className="text-gray-400">
            Última actualización: {new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })}
          </p>
        </header>

        <section className="space-y-6 leading-relaxed">
          <h2 className="text-xl font-semibold text-cyan-400">1. Elegibilidad</h2>
          <p>
            MotorManía Solo está disponible para personas mayores de 18 años. Al jugar,
            confirmas que cumples con la edad mínima requerida en tu jurisdicción.
          </p>

          <h2 className="text-xl font-semibold text-cyan-400">2. Promociones &amp; Bonos</h2>
          <p>
            Los bonos (por ejemplo, duplicar o triplicar el primer depósito) están sujetos
            a requisitos de apuesta (<em>play-through</em>) y caducan 30&nbsp;días después
            de otorgarse, salvo que se indique lo contrario en la promoción específica.
          </p>

          <h2 className="text-xl font-semibold text-cyan-400">3. Conducta del Jugador</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>No se permiten cuentas múltiples ni suplantación de identidad.</li>
            <li>Queda prohibido cualquier intento de explotar errores de la plataforma.</li>
            <li>Nos reservamos el derecho de suspender cuentas por actividad fraudulenta.</li>
          </ul>

          <h2 className="text-xl font-semibold text-cyan-400">4. Conversión de Monedas</h2>
          <p>
            La relación actual es <strong>1 COP =&nbsp;1 Fuel Coin</strong> y
            <strong> 1 000 COP =&nbsp;1 MMC Coin</strong>. Estas conversiones pueden
            ajustarse previo aviso en esta sección.
          </p>

          <h2 className="text-xl font-semibold text-cyan-400">5. Juego Responsable</h2>
          <p>
            Si sientes que tu hábito de juego se está convirtiendo en un problema,
            visita nuestra página de&nbsp;
            <Link href="/legal/responsable" className="text-amber-400 hover:underline">
              Juego Responsable
            </Link> para recursos de ayuda y herramientas de auto-exclusión.
          </p>
        </section>

        <footer className="pt-8 border-t border-gray-700/50 text-sm text-gray-400">
          Para cualquier duda adicional, contacta a nuestro&nbsp;
          <Link href="/soporte" className="text-amber-400 hover:underline">
            Centro de Soporte
          </Link>.
        </footer>
      </div>
    </main>
  );
}