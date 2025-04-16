export function AuthFooter() {
    return (
      <div className="mt-8 text-center text-sm text-gray-400">
        <p>
          Al registrarte, aceptas nuestros{' '}
          <a href="/terms" className="text-amber-500 hover:underline">
            Términos de Servicio
          </a>{' '}
          y{' '}
          <a href="/privacy" className="text-amber-500 hover:underline">
            Política de Privacidad
          </a>
        </p>
        <div className="mt-4 flex items-center justify-center space-x-4">
          <img 
            src="/wompi-logo.png" 
            alt="Wompi Secure Payments" 
            className="h-8 opacity-75"
          />
          <img
            src="/supabase-logo.png"
            alt="Powered by Supabase"
            className="h-6 opacity-75"
          />
        </div>
      </div>
    )
  }