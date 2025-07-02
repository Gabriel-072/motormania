// components/PredictionEmailTemplate.tsx
import React from 'react';

interface PredictionEmailTemplateProps {
  predictions: {
    pole1: string;
    pole2: string;
    pole3: string;
    gp1: string;
    gp2: string;
    gp3: string;
  };
  userName: string;
  unsubscribeLink?: string;
}

export function PredictionEmailTemplate({ predictions, userName, unsubscribeLink }: PredictionEmailTemplateProps) {
  return (
    <div style={{ backgroundColor: '#111827', padding: '20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#1F2937', borderRadius: '8px', padding: '20px' }}>
        <h1 style={{ color: '#FFFFFF', fontSize: '24px', textAlign: 'center', marginBottom: '20px' }}>
          🏁 ¡Predicciones confirmadas, {userName}!
        </h1>
        <p style={{ color: '#FFFFFF', fontSize: '16px', textAlign: 'center', marginBottom: '20px' }}>
          Tus predicciones para el Australian GP han sido recibidas:
        </p>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ color: '#F59E0B', fontSize: '18px', textAlign: 'center', marginBottom: '10px' }}>
            Qualifying (Pole)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {[predictions.pole1, predictions.pole2, predictions.pole3].map((pred, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: '#FF4500',
                  color: '#FFFFFF',
                  padding: '12px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  width: '250px',
                  textAlign: 'center',
                  margin: '5px 0',
                }}
              >
                {idx + 1}. {pred || 'No seleccionado'}
              </div>
            ))}
          </div>
          <h3 style={{ color: '#F59E0B', fontSize: '18px', textAlign: 'center', margin: '20px 0 10px' }}>
            Race (GP)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {[predictions.gp1, predictions.gp2, predictions.gp3].map((pred, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: '#FF4500',
                  color: '#FFFFFF',
                  padding: '12px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  width: '250px',
                  textAlign: 'center',
                  margin: '5px 0',
                }}
              >
                {idx + 1}. {pred || 'No seleccionado'}
              </div>
            ))}
          </div>
        </div>
        <p style={{ color: '#FFFFFF', fontSize: '16px', textAlign: 'center', marginBottom: '20px' }}>
          ¡Compite por premios! Los 3 mejores por carrera y los 3 mejores de la temporada ganan recompensas exclusivas.
        </p>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <a
            href="https://motormania.app/fantasy"
            style={{
              backgroundColor: '#F59E0B',
              color: '#1F2937',
              padding: '12px 24px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: '16px',
              display: 'inline-block',
            }}
          >
            Ver clasificación
          </a>
        </div>
        <div style={{ borderTop: '1px solid #374151', paddingTop: '20px', color: '#D1D5DB', fontSize: '12px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px' }}>
            MotorManía<br />
            Bogotá D.C., Colombia
          </p>
          {unsubscribeLink && (
            <p style={{ margin: '0' }}>
              <a href={unsubscribeLink} style={{ color: '#22D3EE', textDecoration: 'underline' }}>
                Cancelar suscripción
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function predictionTextVersion({ predictions, userName }: PredictionEmailTemplateProps) {
  return `
¡Hola ${userName}!

¡Predicciones confirmadas! Tus selecciones para el Australian GP son:

Qualifying (Pole):
1. ${predictions.pole1 || 'No seleccionado'}
2. ${predictions.pole2 || 'No seleccionado'}
3. ${predictions.pole3 || 'No seleccionado'}

Race (GP):
1. ${predictions.gp1 || 'No seleccionado'}
2. ${predictions.gp2 || 'No seleccionado'}
3. ${predictions.gp3 || 'No seleccionado'}

¡Compite por premios! Los 3 mejores por carrera y los 3 mejores de la temporada ganan recompensas exclusivas.
Ver clasificación: https://motormania.app/fantasy
  `;
}