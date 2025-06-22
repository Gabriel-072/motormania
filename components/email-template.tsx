import React from "react";

interface EmailTemplateProps {
  numbers: string[];
  userName: string;
  unsubscribeLink?: string;
}

export function EmailTemplate({ numbers, userName, unsubscribeLink }: EmailTemplateProps) {
  return (
    <div style={{ backgroundColor: "#111827", padding: "20px" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: "#1F2937", borderRadius: "8px", padding: "20px" }}>
        {/* Header */}
        <h1 style={{ color: "#FFFFFF", fontSize: "24px", textAlign: "center", marginBottom: "20px" }}>
          🏆 ¡Participación confirmada, {userName}!
        </h1>

        <p style={{ color: "#FFFFFF", fontSize: "16px", textAlign: "center", marginBottom: "20px" }}>
          Tus números para el LEGO McLaren P1:
        </p>

        {/* Números */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" }}>
          {numbers.map((num) => (
            <div
              key={num}
              style={{
                backgroundColor: "#FF4500",
                color: "#FFFFFF",
                padding: "15px",
                borderRadius: "8px",
                fontWeight: "bold",
                fontSize: "18px",
                width: "200px",
                textAlign: "center",
                margin: "5px 0",
              }}
            >
              {num}
            </div>
          ))}
        </div>

        {/* CTA Dashboard */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <a
            href="https://motormaniacolombia.com/dashboard"
            style={{
              backgroundColor: "#F59E0B",
              color: "#1F2937",
              padding: "12px 24px",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "16px",
              display: "inline-block",
            }}
          >
            Ver mis números en el dashboard
          </a>
        </div>

        {/* Upsell 1: Más oportunidades */}
        <div style={{ backgroundColor: "#374151", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
          <h2 style={{ color: "#FBBF24", fontSize: "18px", marginBottom: "10px", textAlign: "center" }}>🎯 ¿Quieres más oportunidades?</h2>
          <p style={{ color: "#D1D5DB", fontSize: "14px", textAlign: "center", marginBottom: "16px" }}>
            Por solo <strong>$5.000</strong> COP puedes obtener <strong>5 números adicionales</strong> y aumentar tus chances de ganar.
          </p>
          <div style={{ textAlign: "center" }}>
            <a
              href="https://motormania.app/dashboard?extra=true"
              style={{
                backgroundColor: "#10B981",
                color: "#FFFFFF",
                padding: "10px 20px",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: "bold",
              }}
            >
              Quiero más números
            </a>
          </div>
        </div>

        {/* Upsell 2: MMC-GO */}
        <div style={{ backgroundColor: "#0F172A", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
          <h2 style={{ color: "#38BDF8", fontSize: "18px", marginBottom: "10px", textAlign: "center" }}>🏎️ ¿Amas la F1?</h2>
          <p style={{ color: "#E5E7EB", fontSize: "14px", textAlign: "center", marginBottom: "16px" }}>
            En <strong>MMC-GO</strong> puedes hacer predicciones sobre los resultados de cada carrera y ganar premios si aciertas.
          </p>
          <div style={{ textAlign: "center" }}>
            <a
              href="https://motormaniacolombia.com/mmc-go"
              style={{
                backgroundColor: "#3B82F6",
                color: "#FFFFFF",
                padding: "10px 20px",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: "bold",
              }}
            >
              Probar MMC-GO
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid #374151", paddingTop: "20px", color: "#D1D5DB", fontSize: "12px", textAlign: "center" }}>
          <p style={{ margin: "0 0 8px" }}>
            MotorMania SAS <br />
            Bogotá D.C., Colombia
          </p>
          <p style={{ margin: "0 0 8px" }}>
    <br />
          </p>
          {unsubscribeLink && (
            <p style={{ margin: "0" }}>
              <a href={unsubscribeLink} style={{ color: "#22D3EE", textDecoration: "underline" }}>
                Cancelar suscripción
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function textVersion({ numbers, userName }: EmailTemplateProps) {
  return `
🏆 ¡Hola ${userName}!

Tus números para el sorteo del LEGO McLaren P1 son:
${numbers.join(", ")}

🎯 ¿Quieres más oportunidades?
Agrega 5 números adicionales por solo $5.000 COP:
https://motormania.app/dashboard?extra=true

🏎️ ¿Amas la F1?
Haz predicciones con MMC-GO y gana premios:
https://motormania.app/mmc-go

Ver tus números en el dashboard:
https://motormania.app/dashboard

—
MotorMania SAs
Bogotá D.C., Colombia
Certificado de existencia y representación legal 12345
Autorizado mediante resolución 1234 de 2023
  `;
}