// Deploy:  supabase functions deploy send-booking-email
// Secrets: supabase secrets set RESEND_API_KEY=... FROM_EMAIL="Realtravo <bookings@yourdomain.com>" SITE_URL=https://realtravo.com
// (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are provided automatically.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const money = (n: number) => "KES " + Math.round(Number(n) || 0).toLocaleString("en-KE");

const FOREST = "#1F4D3A", CLAY = "#C1552F", INK = "#1C2B22", SOFT = "#5B6B60", GOLD = "#8A6716",
  GOLD_BG = "#FBF2DD", LINE = "#E2E8E2", PANEL = "#F3F7F3";

const TYPE_LABELS: Record<string, string> = {
  trip: "Trip", event: "Event", hotel: "Hotel stay", adventure_place: "Adventure place", adventure: "Adventure place",
};

// Same line items the app shows (entry tickets, tickets, activities, facilities)
function lines(d: any) {
  d = d || {};
  const out: { section: string; label: string; amount: number }[] = [];
  const entry = (d.entryTicketSelections?.length ? d.entryTicketSelections : d.entry_ticket_selections) || [];
  entry.forEach((t: any) => out.push({ section: "Entry tickets", label: `${t.label || "Entry ticket"} × ${t.quantity || 1}`, amount: (Number(t.price) || 0) * (Number(t.quantity) || 1) }));
  (d.ticketSelections || d.ticket_selections || []).forEach((t: any) => out.push({ section: "Tickets", label: `${t.name} × ${t.quantity || 1}`, amount: (Number(t.price) || 0) * (Number(t.quantity) || 1) }));
  (d.selectedActivities || d.selected_activities || d.activities || []).forEach((a: any) => {
    const p = Number(a.numberOfPeople || a.number_of_people) || 1;
    out.push({ section: "Activities", label: `${a.name} × ${p}`, amount: (Number(a.price) || 0) * p });
  });
  (d.selectedFacilities || d.selected_facilities || d.facilities || []).forEach((f: any) => {
    let days = 1;
    if (f.startDate && f.endDate) days = Math.max(1, Math.ceil((+new Date(f.endDate) - +new Date(f.startDate)) / 86400000));
    out.push({ section: "Facilities", label: `${f.name}${f.startDate ? ` (${days} day${days > 1 ? "s" : ""})` : ""}`, amount: (Number(f.price) || 0) * days });
  });
  return out;
}

// ── Layout pieces ───────────────────────────────────────────────────────────
function shell(subtitle: string, badge: string, badgeBg: string, badgeFg: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#EEF2EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK}">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden">
    <tr><td style="background:${FOREST};padding:22px 32px;border-bottom:4px solid ${CLAY}">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
        <td style="color:#fff"><div style="font-size:20px;font-weight:700;letter-spacing:1px">REALTRAVO</div>
          <div style="font-size:12px;opacity:.85;margin-top:2px">${esc(subtitle)}</div></td>
        <td align="right"><span style="display:inline-block;background:${badgeBg};color:${badgeFg};font-size:11px;font-weight:700;padding:6px 14px;border-radius:999px">${esc(badge)}</span></td>
      </tr></table>
    </td></tr>
    ${body}
    <tr><td style="padding:18px 32px;border-top:1px solid ${LINE};text-align:center;font-size:12px;color:#8C968F">
      Realtravo · support@realtravo.com
    </td></tr>
  </table></td></tr></table></body></html>`;
}

const fact = (label: string, value: string) =>
  `<td width="33%" style="padding:14px 10px;text-align:center;vertical-align:top">
     <div style="font-size:10px;letter-spacing:1px;color:${SOFT}">${label}</div>
     <div style="font-size:14px;font-weight:700;color:${INK};margin-top:3px">${esc(value)}</div>
   </td>`;

function table(d: any, total: number) {
  const rows = lines(d);
  const sections = [...new Set(rows.map((r) => r.section))];
  const body = sections.map((s) => `
    <tr><td colspan="2" style="padding:14px 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${SOFT}">${esc(s)}</td></tr>
    ${rows.filter((r) => r.section === s).map((r) => `
      <tr><td style="padding:8px 0;border-bottom:1px solid ${LINE};font-size:14px;font-weight:600">${esc(r.label)}</td>
          <td align="right" style="padding:8px 0;border-bottom:1px solid ${LINE};font-size:14px;font-weight:700;white-space:nowrap">${money(r.amount)}</td></tr>`).join("")}`).join("");
  return `<div style="border-left:4px solid ${CLAY};padding-left:10px;font-size:13px;font-weight:700;letter-spacing:1px;color:${FOREST};text-transform:uppercase">Price breakdown</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${body}</table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${FOREST};border-radius:12px;margin-top:16px"><tr>
      <td style="padding:16px 20px;color:#fff;font-size:14px">Total amount</td>
      <td align="right" style="padding:16px 20px;color:#fff;font-size:22px;font-weight:800">${money(total)}</td></tr></table>`;
}

async function send(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("FROM_EMAIL") || "Realtravo <onboarding@resend.dev>", to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const { inquiry_id, kind } = await req.json();
    if (!inquiry_id || kind !== "pending_payment") return json({ error: "bad request" }, 400);

    // Who is calling?
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: r } = await db.from("availability_inquiries").select("*").eq("id", inquiry_id).maybeSingle();
    if (!r) return json({ error: "not found" }, 404);
    if (user.id !== r.guest_id && user.id !== r.host_id) return json({ error: "forbidden" }, 403);

    const site = (Deno.env.get("SITE_URL") || "https://realtravo.com").replace(/\/$/, "");
    const total = Number(r.agreed_amount ?? r.offered_price ?? r.total_amount ?? r.current_price ?? 0);
    const d0 = r.booking_details || {};
    const guests = Number(r.guests ?? r.slots_booked ?? 0) || 1;
    // Your inquiries store date + guests + price (no ticket form) → show one "agreed price" line
    const d = lines(d0).length > 0 ? d0 : {
      ...d0,
      ticketSelections: [{ name: `${r.item_name || "Custom booking"} — agreed price (${guests} guest${guests > 1 ? "s" : ""})`, price: total, quantity: 1 }],
    };
    const item = r.item_name || d.item_name || d.name || "your booking";
    const location = r.location || d.location || d.locationName || "";
    const typeLabel = TYPE_LABELS[String(r.booking_type || r.item_type || "")] || "Booking";
    const visit = r.visit_date || d.visit_date;
    const visitTxt = visit && !isNaN(+new Date(visit))
      ? new Date(visit).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
      : "—";

    // ── Host accepted → guest: "Accepted – pending payment" ──────────────
    if (kind === "pending_payment") {
      if (r.status !== "accepted") return json({ skipped: "not accepted" });
      if (r.payment_status === "paid") return json({ skipped: "already paid" });
      if (r.pending_email_sent_at) return json({ skipped: "already sent" });
      if (!r.guest_email) return json({ error: "guest has no email" }, 422);
      if (total <= 0) return json({ skipped: "no amount to pay" });

      const payUrl = `${site}/booking/${r.booking_type || r.item_type || "adventure_place"}/${r.item_id || r.place_id}?inquiry=${r.id}`;
      const hostPhone = r.host_phone || d.host_phone || "";
      const hostEmail = r.host_email || d.host_email || "";

      const body = `
        <tr><td style="padding:30px 32px 8px">
          <div style="font-size:12px;font-weight:700;letter-spacing:1.5px;color:${CLAY};text-transform:uppercase">${esc(typeLabel)}</div>
          <div style="font-size:30px;line-height:1.2;font-weight:800;margin-top:6px">${esc(item)}</div>
          ${location ? `<div style="font-size:15px;color:${SOFT};margin-top:6px">📍 ${esc(location)}</div>` : ""}
          <div style="font-size:14px;line-height:1.5;margin-top:18px">
            Hi ${esc(r.guest_name || d.guest_name || "there")}, the host accepted your request.
            <b>Your booking is not confirmed until you pay.</b>
          </div>
        </td></tr>

        <tr><td style="padding:18px 32px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PANEL};border-radius:12px"><tr>
            ${fact("VISIT DATE", visitTxt)}
            ${fact("GUESTS", `${guests} ${guests === 1 ? "person" : "people"}`)}
            ${fact("AMOUNT DUE", money(total))}
          </tr></table>
        </td></tr>

        <tr><td style="padding:0 32px 8px">${table(d, total)}</td></tr>

        <tr><td align="center" style="padding:24px 32px 8px">
          <a href="${esc(payUrl)}" style="display:inline-block;background:${CLAY};color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:15px 40px;border-radius:12px">Pay now · ${money(total)}</a>
          <div style="font-size:12px;color:${SOFT};margin-top:12px;line-height:1.5">
            You can also pay from <b>Bookings → Pending payment</b> or the notification bell in the app.
            Your QR code is issued right after payment.
          </div>
        </td></tr>

        ${hostPhone || hostEmail ? `
        <tr><td style="padding:18px 32px 28px">
          <div style="background:${GOLD_BG};border-left:4px solid ${GOLD};border-radius:10px;padding:14px 16px;color:${GOLD}">
            <div style="font-size:14px;font-weight:700">Host contact</div>
            <div style="font-size:12px;margin:2px 0 8px">Questions before you pay? Reach out directly.</div>
            <div style="font-size:14px;font-weight:700">${[hostPhone, hostEmail].filter(Boolean).map(esc).join(" &nbsp;|&nbsp; ")}</div>
          </div></td></tr>` : `<tr><td style="padding-bottom:20px"></td></tr>`}`;

      const html = shell("Booking request accepted", "AWAITING PAYMENT", "#FEF3C7", "#92400E", body);
      await send(r.guest_email, `Accepted – pay now to confirm ${item}`, html);
      await db.from("availability_inquiries").update({ pending_email_sent_at: new Date().toISOString() }).eq("id", r.id);
      return json({ sent: "pending_payment" });
    }

    return json({ skipped: "unknown kind" });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});