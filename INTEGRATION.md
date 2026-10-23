# Integration steps (Adventure Place + Trip)

1. Run `01_inquiries_setup.sql` once in the Supabase SQL editor (it replaces the earlier 01 and 02 files).
2. Copy `InquiryDialog.tsx` and `InquiryNotificationActions.tsx` into `src/components/`.
3. Apply the edits below.

The dialog now takes `item` + `itemType` ("adventure_place" | "trip").

---------------------------------------------------------------------
## A. AdventurePlaceDetail.tsx
---------------------------------------------------------------------

**Imports**
```tsx
import { InquiryDialog } from "@/components/InquiryDialog";
// add MessageCircleQuestion to the existing lucide-react import
```

**BookingCardProps** – add `onInquire: () => void;` and destructure `onInquire` in `BookingCard`.

**In BookingCard**, directly under the "Check availability" `<Button>`:
```tsx
<Button
  type="button" variant="ghost" onClick={onInquire}
  className="w-full py-5 rounded-2xl text-sm font-semibold border"
  style={{ borderColor: FOREST, color: FOREST, background: "transparent", fontFamily: FONT_BODY }}
>
  <MessageCircleQuestion className="h-4 w-4 mr-2" /> Ask the host
</Button>
```

**In AdventurePlaceDetail**
```tsx
const [inquiryOpen, setInquiryOpen] = useState(false);   // next to the other useState calls (before any early return)
...
const bookingCardProps = { ..., onInquire: () => setInquiryOpen(true) };
...
<InquiryDialog item={place} itemType="adventure_place" open={inquiryOpen} onClose={() => setInquiryOpen(false)} />
```
(put the dialog next to `<MapModal>` at the bottom).

**Mobile sticky bar** – wrap the button area:
```tsx
<div className="flex gap-2">
  <Button onClick={() => setInquiryOpen(true)} variant="ghost" className="px-3 py-5 rounded-xl text-sm font-semibold border" style={{ borderColor: FOREST, color: FOREST }}>Ask</Button>
  <Button onClick={handleCheckAvailability} ...existing...>Check availability</Button>
</div>
```

---------------------------------------------------------------------
## B. TripDetail.tsx
---------------------------------------------------------------------

**Imports**
```tsx
import { InquiryDialog } from "@/components/InquiryDialog";
import { MessageCircleQuestion } from "lucide-react"; // add to existing lucide import
```

**BookingCard props type + destructuring** – add `onInquire: () => void;`

**In BookingCard**, directly under the "Reserve spot" `<Button>` (before the Map/Copy/Share grid):
```tsx
<Button
  type="button" variant="ghost" onClick={onInquire}
  className="w-full mt-2.5 py-5 rounded-2xl text-sm font-semibold border"
  style={{ borderColor: FOREST, color: FOREST, background: "transparent", fontFamily: FONT_BODY }}
>
  <MessageCircleQuestion className="h-4 w-4 mr-2" /> Ask the host
</Button>
```

**In TripDetail** – the state MUST sit with the other `useState`s, above `if (loading) return ...`:
```tsx
const [inquiryOpen, setInquiryOpen] = useState(false);
```
then
```tsx
const bookingCardProps = { ..., onInquire: () => setInquiryOpen(true) };
```
and next to `<MapModal>` at the bottom:
```tsx
<InquiryDialog item={event} itemType="trip" open={inquiryOpen} onClose={() => setInquiryOpen(false)} />
```

**Mobile sticky bar** – replace the single Reserve button with:
```tsx
<div className="flex gap-2">
  <Button onClick={() => setInquiryOpen(true)} variant="ghost" className="px-3 py-5 rounded-xl text-sm font-semibold border" style={{ borderColor: FOREST, color: FOREST }}>Ask</Button>
  <Button onClick={() => navigateToBooking(`/booking/trip/${event.id}`)} disabled={!canBook} ...existing...>
    {isSoldOut ? "Fully booked" : isExpired ? "Expired" : "Reserve"}
  </Button>
</div>
```

---------------------------------------------------------------------
## C. NotificationBell.tsx (unchanged, works for both)
---------------------------------------------------------------------

**Import**
```tsx
import { InquiryNotificationActions } from "@/components/InquiryNotificationActions";
```

**TYPE_META** – add:
```tsx
inquiry_request:  { icon: CalendarCheck, bg: CLAY_SOFT,    iconColor: CLAY,     accent: CLAY },
inquiry_accepted: { icon: CheckCircle2,  bg: SUCCESS_SOFT, iconColor: SUCCESS,  accent: SUCCESS },
inquiry_declined: { icon: X,             bg: DANGER_SOFT,  iconColor: DANGER,   accent: DANGER },
inquiry_expired:  { icon: Clock,         bg: CANVAS,       iconColor: INK_SOFT, accent: INK_SOFT },
```

**getDeepLink** – add:
```tsx
case "inquiry_request":
case "inquiry_accepted":
case "inquiry_declined":
case "inquiry_expired":      return null;
```

**Expire stale requests when the drawer opens**, after `handleClick`:
```tsx
useEffect(() => {
  if (isOpen) (supabase as any).rpc("expire_stale_inquiries").then(() => fetchNotifications());
}, [isOpen]);
```

**Card markup** – a `<button>` can't contain links/buttons, so change the card wrapper from `<button ...>` to:
```tsx
<div
  key={n.id} role="button" tabIndex={0}
  onClick={() => handleClick(n)}
  onKeyDown={(e) => e.key === "Enter" && handleClick(n)}
  className="w-full text-left rounded-2xl transition-all duration-150 group bg-white cursor-pointer"
  style={{ ...same style as before... }}
>
  ...existing inner content...

  {n.type.startsWith("inquiry_") && n.data?.inquiry_id && user && (
    <InquiryNotificationActions notification={n} userId={user.id} />
  )}

  {isUnread && (<div className="h-0.5 ..." />)}
</div>
```
Place the `InquiryNotificationActions` block right after the inner `flex items-start gap-3 p-3.5` div and before the unread gradient bar.