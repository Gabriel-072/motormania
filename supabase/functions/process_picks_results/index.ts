// index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: picks, error } = await supabase
    .from("picks")
    .select("*");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results = [];

  for (const pick of picks) {
    const { data: existing } = await supabase
      .from("pick_results")
      .select("id")
      .eq("pick_id", pick.id)
      .maybeSingle();

    if (existing) {
      continue;
    }

    const pickSelections = pick.picks;
    let correct = 0;

    const { data: driverResults } = await supabase
      .from("driver_results_for_picks")
      .select("*")
      .eq("gp_name", pick.gp_name);

    for (const sel of pickSelections) {
      const r = driverResults.find(
        (r: any) => r.driver === sel.driver
      );
      if (!r) continue;

      const position = sel.session_type === "race" ? r.race_position : r.qualy_position;
      if (!position) continue;

      const isBetter = position < sel.line;
      const isWorse = position > sel.line;

      if ((sel.betterOrWorse === "mejor" && isBetter) || (sel.betterOrWorse === "peor" && isWorse)) {
        correct++;
      }
    }

    const total = pickSelections.length;
    let resultType: 'won' | 'partial' | 'lost' = 'lost';
    let payout = 0;

    if (pick.mode === "Full Throttle") {
      if (correct === total) {
        resultType = 'won';
        payout = Number(pick.wager_amount) * pick.multiplier;
      }
    } else if (pick.mode === "Safety Car") {
      const table = getSafetyCarPayoutTable(total);
      const multiplier = table[correct] || 0;
      payout = Number(pick.wager_amount) * multiplier;
      if (multiplier > 0) {
        resultType = correct === total ? 'won' : 'partial';
      }
    }

    await supabase.from("pick_results").insert({
      user_id: pick.user_id,
      pick_id: pick.id,
      gp_name: pick.gp_name,
      session_type: pick.session_type,
      picks: pick.picks,
      correct_count: correct,
      total_picks: total,
      mode: pick.mode,
      result: resultType,
      payout,
      processed_at: new Date().toISOString(),
    });

    const { data: userData } = await supabase
      .from('clerk_users')
      .select('email, full_name')
      .eq('clerk_id', pick.user_id)
      .maybeSingle();

    if (userData?.email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "MotorManía <noreply@motormaniacolombia.com>",
          to: userData.email,
          subject: `🏁 Tus PICKS han sido procesados`,
          html: `
            <p>Hola ${userData.full_name || 'fanático de la F1'},</p>
            <p>Tus PICKS del GP <strong>${pick.gp_name}</strong> han sido procesados.</p>
            <p><strong>Modo:</strong> ${pick.mode}<br/>
            <strong>Correctos:</strong> ${correct} / ${total}<br/>
            <strong>Resultado:</strong> ${resultType.toUpperCase()}</p>
            <hr/>
            <p>Consulta más detalles en tu panel:</p>
            <p>🚀 <a href="https://motormaniacolombia.com/dashboard">Ir al Dashboard</a></p>
          `,
        }),
      });
    }

    results.push({ id: pick.id, result: resultType, payout });
  }

  return new Response(JSON.stringify({ message: "Picks procesados ✅", results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

function getSafetyCarPayoutTable(pickCount: number): Record<number, number> {
  switch (pickCount) {
    case 3: return { 3: 5, 2: 1 };
    case 4: return { 4: 8, 3: 2 };
    case 5: return { 5: 15, 4: 5, 3: 1 };
    case 6: return { 6: 30, 5: 10, 4: 2 };
    case 7: return { 7: 60, 6: 20, 5: 5 };
    case 8: return { 8: 100, 7: 40, 6: 10 };
    default: return {};
  }
}
