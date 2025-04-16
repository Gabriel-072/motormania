// app/onboarding/page.tsx
"use client";

import { useUser, useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { createAuthClient } from "@/lib/supabase"; // Fixed import
import { useRouter } from "next/navigation";

export default function Onboarding() {
  const { isLoaded, user } = useUser();
  const { getToken } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user?.id) throw new Error("Usuario no autenticado");

      const token = await getToken({ template: "supabase" });
      if (!token) throw new Error("Authentication token missing");

      const supabase = createAuthClient(token); // Updated function name

      const clerkResponse = await fetch("/api/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!clerkResponse.ok) {
        const errorText = await clerkResponse.text();
        throw new Error(`Error al actualizar metadatos de Clerk: ${errorText}`);
      }

      const { error } = await supabase
        .from("clerk_users")
        .update({
          full_name: fullName,
          phone_number: phone,
          onboarding_complete: true,
          updated_at: new Date().toISOString(),
        })
        .eq("clerk_id", user.id);

      if (error) throw new Error(`Error updating Supabase: ${error.message}`);

      router.push("/dashboard");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al guardar tus datos"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-amber-500 text-xl">
          Cargando configuración inicial...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-amber-500 mb-8">
        ¡Completa tu perfil para participar! 🏁
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-gray-400 mb-2">Nombre completo</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-gray-800 rounded-lg p-4 text-white focus:ring-2 focus:ring-amber-500"
            required
          />
        </div>

        <div>
          <label className="block text-gray-400 mb-2">Teléfono (WhatsApp)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-gray-800 rounded-lg p-4 text-white focus:ring-2 focus:ring-amber-500"
            placeholder="+57 300 123 4567"
            required
          />
        </div>

        {error && (
          <div className="p-4 bg-red-900/30 text-red-400 rounded-lg">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-500 text-black font-bold py-4 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Continuar al sorteo"}
        </button>
      </form>

      <div className="mt-8 text-gray-400 text-sm space-y-2">
        <p>• Tus datos están protegidos bajo la Ley 1581 de 2012 de Colombia</p>
        <p>• Solo requerimos información esencial para el sorteo</p>
        <p>• Soporte: soporte@motormania.co</p>
      </div>
    </div>
  );
}