// lib/useFomoFake.ts
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Asegúrate de que tus variables de entorno estén configuradas correctamente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase URL or Anon Key is missing. Check your environment variables.'
  );
  // Podrías lanzar un error o manejarlo de otra forma si prefieres
  // throw new Error('Supabase URL or Anon Key is missing.');
}

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

// Interfaz para el tipo de dato que esperamos de Supabase
interface FomoNotification {
  nombre: string;
  ciudad: string;
  picks_count: number;
  // Puedes añadir más campos si los seleccionas y usas
}

export function useFomoFake(intervalMs = 2500): string | null {
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const allNotificationsRef = useRef<FomoNotification[]>([]);
  const currentIndexRef = useRef<number>(-1); // Empezar en -1 para que el primer mensaje sea el 0 o uno aleatorio
  const intervalIdRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchAllNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notificaciones_fomo')
          .select('nombre, ciudad, picks_count'); // Traer todos los campos necesarios

        if (error) {
          console.error('Error fetching FOMO notifications:', error);
          if (isMounted) setCurrentMessage(null); // O un mensaje de error
          return;
        }

        if (data && data.length > 0 && isMounted) {
          allNotificationsRef.current = data as FomoNotification[];
          // Opcional: mostrar el primer mensaje de forma aleatoria del set cargado
          // currentIndexRef.current = Math.floor(Math.random() * allNotificationsRef.current.length);
          // O empezar secuencialmente
          currentIndexRef.current = 0;
          updateMessage(); // Mostrar el primer mensaje inmediatamente
        }
      } catch (e) {
        console.error('Exception fetching FOMO notifications:', e);
        if (isMounted) setCurrentMessage(null);
      }
    };

    fetchAllNotifications();

    // Función para actualizar el mensaje actual
    const updateMessage = () => {
      if (allNotificationsRef.current.length === 0) return;

      const notification = allNotificationsRef.current[currentIndexRef.current];
      if (notification) {
        const { nombre, ciudad, picks_count } = notification;
        const message = `${nombre} en ${ciudad} ha enviado ${picks_count} pick${picks_count > 1 ? 's' : ''}`;
        if (isMounted) {
          setCurrentMessage(message);
        }
      }
    };

    // Configurar el intervalo para cambiar el mensaje
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
    }

    intervalIdRef.current = window.setInterval(() => {
      if (allNotificationsRef.current.length > 0) {
        currentIndexRef.current =
          (currentIndexRef.current + 1) % allNotificationsRef.current.length;
        updateMessage();
      }
    }, intervalMs);

    return () => {
      isMounted = false;
      if (intervalIdRef.current) {
        window.clearInterval(intervalIdRef.current);
      }
    };
  }, [intervalMs]); // Solo se vuelve a ejecutar si intervalMs cambia

  return currentMessage;
}