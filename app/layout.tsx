import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Exo_2 } from "next/font/google";
import { esES } from '@clerk/localizations';
import { dark } from '@clerk/themes';
import Header from '@/components/Header';
import MovingBar from '@/components/MovingBar';
import PixelTracker from '@/components/PixelTracker';
import RegistrationTracker from '@/components/RegistrationTracker';
import { Suspense } from "react"; // ✅ necesario para evitar errores con useSearchParams

const exo2 = Exo_2({ subsets: ["latin"] });

export const metadata = {
  title: "MotorManía Colombia",
  description: "La comunidad de apasionados por los autos en Colombia",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      localization={esES}
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#F59E0B",
          colorText: "white",
          colorBackground: "#1F2937",
          colorInputBackground: "#1F2937",
          colorInputText: "#FFFFFF",
          colorNeutral: '#6b7280',
          borderRadius: '0.5rem',
        },
        elements: {
          card: 'bg-gray-900/80 backdrop-blur-sm border border-amber-500/40 shadow-lg shadow-amber-500/10',
          formButtonPrimary: 'bg-gradient-to-r from-amber-500 to-cyan-500 hover:from-amber-600 hover:to-cyan-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300',
          formFieldInput: 'bg-[#1F2937] border border-gray-700/50 text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/70 transition-all duration-200',
          headerTitle: 'text-2xl text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-cyan-400',
          headerSubtitle: 'text-gray-400',
          socialButtonsBlockButton: 'bg-gray-200 hover:bg-gray-300 text-gray-900 border border-gray-300 hover:border-amber-500 hover:bg-amber-500/20',
          socialButtonsProviderIcon: 'filter-none',
          footer: 'text-gray-500',
        },
      }}
    >
      <html lang="es-CO">
        <body className={exo2.className} suppressHydrationWarning>
          <PixelTracker />
          <Suspense fallback={null}>
            <RegistrationTracker />
          </Suspense>
          <MovingBar />
          <Header />
          <main className="pt-20">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}