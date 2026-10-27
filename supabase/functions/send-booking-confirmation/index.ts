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

const FOREST = "#1F4D3A", CLAY = "#C1552F", INK = "#1C2B22", SOFT = "#5B6B60", GOLD = "#8A6716", GOLD_BG = "#FBF2DD";

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

function shell(title: string, badge: string, badgeBg: string, badgeFg: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#F4F6F2;font-family:Inter,Arial,sans-serif;color:${INK}">
  <div style="max-width:560px;margin:0 auto;padding:24px 14px">
    <div style="background:${FOREST};color:#fff;padding:22px 24px;border-radius:18px 18px 0 0">
      <div style="font-size:20px;font-weight:700;letter-spacing:1px">REALTRAVO</div>
      <div style="font-size:12px;opacity:.75;margin-top:2px">${esc(title)}</div>
    </div>
    <div style="background:#fff;padding:24px;border-radius:0 0 18px 18px;border:1px solid #DCE3DC;border-top:0">
      <span style="display:inline-block;background:${badgeBg};color:${badgeFg};font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px">${esc(badge)}</span>
      ${body}
      <p style="font-size:11px;color:${SOFT};margin:28px 0 0">Realtravo · support@realtravo.com</p>
    </div>
  </div></body></html>`;
}

function table(d: any, total: number) {
  const rows = lines(d);
  const sections = [...new Set(rows.map((r) => r.section))];
  const body = sections.map((s) => `
    <tr><td colspan="2" style="padding:12px 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;color:${FOREST}">${esc(s)}</td></tr>
    ${rows.filter((r) => r.section === s).map((r) => `<tr><td style="padding:5px 0;font-size:13px">${esc(r.label)}</td><td style="padding:5px 0;font-size:13px;text-align:right;font-weight:600">${money(r.amount)}</td></tr>`).join("")}`).join("");
  return `<table width="100%" cellspacing="0" cellpadding="0" style="margin-top:6px;border-collapse:collapse">${body}
    <tr><td style="padding:12px 0 0;font-size:15px;font-weight:700;border-top:1px solid #DCE3DC">Total</td>
        <td style="padding:12px 0 0;font-size:15px;font-weight:700;text-align:right;border-top:1px solid #DCE3DC;color:${CLAY}">${money(total)}</td></tr></table>`;
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
    const visit = r.visit_date || d.visit_date;
    const visitTxt = visit ? new Date(visit).toDateString() : "";

    const facts = (who: "guest" | "host") => `
      <h2 style="font-size:20px;margin:14px 0 2px">${esc(item)}</h2>
      ${visitTxt ? `<p style="margin:0;font-size:13px;color:${SOFT}">Visit date: <b style="color:${INK}">${esc(visitTxt)}</b></p>` : ""}
      ${who === "host" ? `<p style="margin:2px 0 0;font-size:13px;color:${SOFT}">Guest: <b style="color:${INK}">${esc(r.guest_name || d.guest_name || "")}</b> · ${esc(r.guest_phone || "")} · ${esc(r.guest_email || "")}</p>` : ""}
      ${table(d, total)}`;

    // ── Host accepted → guest: "Accepted – pending payment" ──────────────
    if (kind === "pending_payment") {
      if (r.status !== "accepted") return json({ skipped: "not accepted" });
      if (r.payment_status === "paid") return json({ skipped: "already paid" });
      if (r.pending_email_sent_at) return json({ skipped: "already sent" });
      if (!r.guest_email) return json({ error: "guest has no email" }, 422);
      if (total <= 0) return json({ skipped: "no amount to pay" });

      const payUrl = `${site}/booking/${r.booking_type || r.item_type || "adventure_place"}/${r.item_id || r.place_id}?inquiry=${r.id}`;
      const html = shell("Booking request accepted", "ACCEPTED · PENDING PAYMENT", GOLD_BG, GOLD, `
        ${facts("guest")}
        <div style="background:${GOLD_BG};color:${GOLD};padding:12px 14px;border-radius:12px;font-size:13px;margin-top:16px">
          The host accepted your request. <b>Your booking is not confirmed until you pay.</b>
        </div>
        <a href="${payUrl}" style="display:block;text-align:center;background:${CLAY};color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px;border-radius:12px;margin-top:16px">Pay now · ${money(total)}</a>
        <p style="font-size:12px;color:${SOFT};margin-top:10px">You can also pay from <b>Bookings → Pending payment</b> or the notification bell in the app.</p>`);
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