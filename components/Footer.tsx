// 📁 components/Footer.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Footer() {

  const pathname = usePathname();
  if (pathname === '/mmc-go') return null;
  if (pathname === '/giveaway/spain') return null;
  if (pathname === '/fantasy-vip') return null;
  if (pathname === '/fantasy-vip-info') return null;
  if (pathname === '/plataforma-viral') return null;

  return (
    <footer className="bg-gray-950 text-gray-400 py-10 px-4 sm:px-8 border-t border-gray-800 text-sm font-exo2">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">

        <p className="text-center sm:text-left">
          © {new Date().getFullYear()} MotorManía. Todos los derechos reservados.
        </p>

        <div className="flex flex-wrap justify-center sm:justify-end gap-4 text-amber-500">
          <Link href="/pages/legal/terminos"        className="hover:underline">Términos y Condiciones</Link>
          <Link href="/pages/legal/privacy-policy"  className="hover:underline">Política de Privacidad</Link>
          <Link href="/pages/legal/responsable"     className="hover:underline">Juego Responsable</Link>
          <Link href="/pages/legal/unofficial"      className="hover:underline">Aplicación No Oficial</Link>
          <Link href="/pages/legal/reglas"          className="hover:underline">Reglas de la Casa</Link>{/* 🔗 nuevo */}
          <Link href="/pages/legal/soporte"               className="hover:underline">Centro de Soporte</Link>
        </div>
      </div>
    </footer>
  );
}