import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white font-exo2 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-8 text-amber-400">
          Política de Tratamiento de Datos Personales – MotorMania Colombia SAS
        </h1>

        <section className="space-y-6 text-sm sm:text-base leading-relaxed">
          <p>
            Esta versión de la política de privacidad se ajusta a las
            <strong> regulaciones colombianas</strong> y contempla el funcionamiento de MotorMania como una
            <strong> plataforma de entretenimiento basada en monedas virtuales (MMC Coins y Fuel Coins)</strong>.
          </p>

          <p>
            MotorMania actúa como <strong>responsable del tratamiento</strong> y recolecta información como:
            nombre, correo electrónico, identificación, ubicación, y comportamiento en la plataforma. Esta
            información se utiliza para propósitos como:
          </p>

          <ul className="list-disc list-inside space-y-2">
            <li>Administrar la participación en sorteos y dinámicas de predicciones deportivas.</li>
            <li>Emitir y redimir monedas virtuales no convertibles (MMC Coins) y canjeables (Fuel Coins).</li>
            <li>Analizar comportamiento y ofrecer beneficios personalizados.</li>
            <li>Proteger a los usuarios mediante controles antifraude y verificación de identidad.</li>
            <li>Comunicar promociones, resultados y novedades de la plataforma.</li>
          </ul>

          <h2 className="text-2xl font-bold text-amber-400 mt-8">Cumplimiento Legal</h2>
          <p>
            Esta política está alineada con la <strong>Ley 1581 de 2012</strong> y sus decretos reglamentarios,
            así como las guías de la Superintendencia de Industria y Comercio. Se garantiza:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>Acceso, actualización, corrección y supresión de datos por parte del titular.</li>
            <li>Transparencia en el uso de cookies y otras herramientas de tracking.</li>
            <li>Autorización previa, expresa e informada del usuario para el tratamiento de datos.</li>
            <li>Almacenamiento seguro y transferencia internacional cuando sea aplicable.</li>
          </ul>

          <h2 className="text-2xl font-bold text-amber-400 mt-8">Ejercicio de Derechos</h2>
          <p>
            Para ejercer cualquiera de sus derechos, el titular puede contactar a MotorMania a través de:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>Correo electrónico:</strong>{' '}
              <a href="mailto:soporte@motormaniacolombia.com" className="text-amber-500 hover:underline font-bold">
                soporte@motormaniacolombia.com
              </a>
            </li>
            <li>
              <strong>Canal de soporte:</strong>{' '}
              <Link href="/soporte" className="text-amber-500 hover:underline font-bold">
                https://motormaniacolombia.com/soporte
              </Link>
            </li>
          </ul>

          <p className="text-sm text-gray-400 mt-6">
            Esta versión fue actualizada el 18 de abril de 2025. Cualquier cambio será publicado en este mismo
            enlace y comunicado a través de nuestros canales oficiales.
          </p>
        </section>
      </div>
    </div>
  );
}
