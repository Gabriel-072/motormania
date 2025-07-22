// 📁 /app/api/send-pick-confirmation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { checkInternalKey } from '@/lib/checkInternalKey';
import { PickSelection } from '@/app/types/picks';

// ─── ENV ────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const APP_URL        = process.env.NEXT_PUBLIC_SITE_URL!;
const INTERNAL_KEY   = process.env.INTERNAL_API_KEY!;
const APP_NAME       = 'MotorManía';
const FROM_EMAIL     = `MotorMania <noreply@motormania.app>`;
const SUPPORT_EMAIL  = 'soporte@motormania.app';

// ─── Start-up sanity checks (solo log) ──────────────────
if (!RESEND_API_KEY) console.error('FATAL: RESEND_API_KEY missing');
if (!APP_URL)        console.error('FATAL: NEXT_PUBLIC_SITE_URL missing');
if (!INTERNAL_KEY)   console.error('FATAL: INTERNAL_API_KEY missing');

const resend = new Resend(RESEND_API_KEY);

// ─── Handler ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  console.log('[PickEmail] route hit');

  /* 1. Seguridad: clave interna */
  if (!checkInternalKey(req)) {
    console.warn('[PickEmail] Unauthorized – bad x-internal-key');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  /* 2. Parse + validación */
  let body: {
    to: string;
    name?: string;
    amount?: number;
    mode?: 'full' | 'safety';
    picks: PickSelection[];
    orderId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { to, name = 'Jugador', amount = 0, mode = 'full', picks, orderId } = body;

  if (!to || !/\S+@\S+\.\S+/.test(to)) {
    return NextResponse.json({ error: 'Invalid "to" address' }, { status: 400 });
  }
  if (!Array.isArray(picks) || picks.length === 0) {
    return NextResponse.json({ error: 'Picks array empty' }, { status: 400 });
  }

  /* 3. Construir email */
  const wagerCOP = new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
  }).format(amount);

  const picksRows = picks.map(p => `
    <li style="margin-bottom:8px;padding:6px 10px;border-bottom:1px solid #eee;display:flex;justify-content:space-between">
      <div>
        <strong>${p.driver}</strong><br/>
        <span style="font-size:12px;color:#6b7280">
          (${p.session_type === 'qualy' ? 'Q' : 'R'} ${p.line.toFixed(1)})
        </span>
      </div>
      <span style="color:${p.betterOrWorse==='mejor' ? '#16a34a' : '#dc2626'};font-weight:bold">
        ${p.betterOrWorse?.toUpperCase()}
      </span>
    </li>`).join('');

  const subject = `✅ Picks MMC GO confirmados (${orderId?.slice(-6) ?? 'Sin ref'})`;

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:20px auto;padding:20px;border:1px solid #ddd;border-radius:8px">
    <h1 style="color:#8b5cf6;text-align:center">¡Jugada confirmada, ${name}!</h1>
    <p style="text-align:center">Tus picks se registraron correctamente.</p>
    <p style="text-align:center;font-size:14px;color:#555">Referencia: ${orderId ?? 'N/A'}</p>

    <div style="background:#f3f4f6;padding:15px;border-radius:6px">
      <p style="margin:4px 0"><span style="color:#6b7280">Monto apostado:</span> <strong style="float:right">${wagerCOP}</strong></p>
      <p style="margin:4px 0"><span style="color:#6b7280">Modo:</span> <strong style="float:right">${mode==='full'?'Full Throttle':'Safety Car'}</strong></p>
      <h3 style="margin:12px 0 6px;color:#4b5563;font-size:15px">Picks (${picks.length}):</h3>
      <ul style="list-style:none;padding:0;margin:0">${picksRows}</ul>
    </div>

    <p style="text-align:center;margin-top:25px">
      <a href="${APP_URL}/mmc-go" style="background:#8b5cf6;color:#fff;padding:12px 24px;border-radius:5px;text-decoration:none;font-weight:bold">
        Ver MMC GO
      </a>
    </p>

    <footer style="margin-top:30px;font-size:12px;color:#999;text-align:center;border-top:1px solid #eee;padding-top:12px">
      ${APP_NAME} | Bogotá D.C., Colombia | <a href="mailto:${SUPPORT_EMAIL}" style="color:#999">${SUPPORT_EMAIL}</a>
    </footer>
  </div>`;

  /* 4. Enviar email */
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html
    });

    if (error) {
      console.error('[PickEmail] Resend error:', error);
      return NextResponse.json({ error: 'Resend error', details: error.message }, { status: 500 });
    }

    console.log(`[PickEmail] Sent to ${to} (id ${data?.id})`);
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err) {
    console.error('[PickEmail] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}