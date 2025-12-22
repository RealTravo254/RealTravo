import { format } from "date-fns";

// HTML escape function to prevent XSS attacks
const escapeHtml = (unsafe: string | undefined | null): string => {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export interface FacilityDetail {
  name: string;
  price: number;
  startDate?: string;
  endDate?: string;
}

export interface ActivityDetail {
  name: string;
  price: number;
  numberOfPeople?: number;
}

export interface BookingDownloadData {
  bookingId: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  itemName: string;
  bookingType: string;
  visitDate: string;
  totalAmount: number;
  adults?: number;
  children?: number;
  slotsBooked?: number;
  paymentStatus: string;
  facilities?: FacilityDetail[];
  activities?: ActivityDetail[];
}

export const generateQRCodeData = (booking: BookingDownloadData): string => {
  return JSON.stringify({
    bookingId: booking.bookingId,
    visitDate: booking.visitDate,
    email: booking.guestEmail,
  });
};

export const downloadBookingAsHTML = async (booking: BookingDownloadData, qrCodeDataUrl: string): Promise<void> => {
  const formatCurrency = (amount: number) => `KES ${amount.toLocaleString()}`;
  
  // Enhanced facilities HTML with date ranges - with XSS protection
  const facilitiesHTML = booking.facilities && booking.facilities.length > 0 
    ? `
      <div class="section">
        <h3>Facilities</h3>
        <ul>
          ${booking.facilities.map(f => {
            const dateRange = f.startDate && f.endDate 
              ? ` (${format(new Date(f.startDate), 'MMM dd')} - ${format(new Date(f.endDate), 'MMM dd, yyyy')})`
              : '';
            return `<li><strong>${escapeHtml(f.name)}</strong>${dateRange} - ${f.price === 0 ? 'Free' : formatCurrency(f.price) + '/day'}</li>`;
          }).join('')}
        </ul>
      </div>
    ` : '';

  // Enhanced activities HTML with number of people - with XSS protection
  const activitiesHTML = booking.activities && booking.activities.length > 0 
    ? `
      <div class="section">
        <h3>Activities</h3>
        <ul>
          ${booking.activities.map(a => {
            const people = a.numberOfPeople ? ` × ${a.numberOfPeople} ${a.numberOfPeople === 1 ? 'person' : 'people'}` : '';
            return `<li><strong>${escapeHtml(a.name)}</strong>${people} - ${a.price === 0 ? 'Free' : formatCurrency(a.price) + '/person'}</li>`;
          }).join('')}
        </ul>
      </div>
    ` : '';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Booking Confirmation - ${booking.bookingId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px;
      background: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #008080, #006666);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 { font-size: 24px; margin-bottom: 8px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .content { padding: 30px; }
    .booking-id {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
      margin-bottom: 25px;
    }
    .booking-id label { font-size: 12px; color: #666; display: block; margin-bottom: 4px; }
    .booking-id span { font-family: monospace; font-size: 14px; font-weight: bold; color: #008080; }
    .section { margin-bottom: 25px; }
    .section h3 { 
      font-size: 14px; 
      color: #666; 
      text-transform: uppercase; 
      letter-spacing: 1px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #f0f0f0;
    }
    .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .row label { color: #666; font-size: 14px; }
    .row span { font-weight: 500; font-size: 14px; }
    .total {
      background: #008080;
      color: white;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .total .row { margin: 0; }
    .total label { color: rgba(255,255,255,0.8); }
    .total span { font-size: 24px; font-weight: bold; }
    .qr-section {
      text-align: center;
      padding: 30px;
      background: #f8f9fa;
    }
    .qr-section img { 
      width: 180px; 
      height: 180px;
      border: 4px solid white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .qr-section p { margin-top: 12px; font-size: 12px; color: #666; }
    .qr-section .qr-label { 
      font-size: 10px; 
      font-weight: bold; 
      color: #008080; 
      text-transform: uppercase; 
      letter-spacing: 1px;
      margin-top: 8px;
    }
    .footer {
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
      color: #999;
      border-top: 1px solid #f0f0f0;
    }
    ul { list-style: none; }
    ul li { padding: 10px 0; border-bottom: 1px dashed #eee; font-size: 14px; }
    ul li:last-child { border-bottom: none; }
    ul li strong { color: #333; }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Booking Confirmation</h1>
      <p>Your booking has been confirmed</p>
    </div>
    
    <div class="content">
      <div class="booking-id">
        <label>Booking ID</label>
        <span>${booking.bookingId}</span>
      </div>

      <div class="section">
        <h3>Guest Information</h3>
        <div class="row">
          <label>Name</label>
          <span>${escapeHtml(booking.guestName)}</span>
        </div>
        <div class="row">
          <label>Email</label>
          <span>${escapeHtml(booking.guestEmail)}</span>
        </div>
        ${booking.guestPhone ? `
        <div class="row">
          <label>Phone</label>
          <span>${escapeHtml(booking.guestPhone)}</span>
        </div>
        ` : ''}
      </div>

      <div class="section">
        <h3>Booking Details</h3>
        <div class="row">
          <label>Item Booked</label>
          <span>${escapeHtml(booking.itemName)}</span>
        </div>
        <div class="row">
          <label>Type</label>
          <span>${escapeHtml(booking.bookingType.charAt(0).toUpperCase() + booking.bookingType.slice(1))}</span>
        </div>
        <div class="row">
          <label>Visit Date</label>
          <span>${format(new Date(booking.visitDate), 'PPP')}</span>
        </div>
        ${booking.slotsBooked ? `
        <div class="row">
          <label>Number of People</label>
          <span>${booking.slotsBooked}</span>
        </div>
        ` : ''}
        ${booking.adults !== undefined ? `
        <div class="row">
          <label>Adults</label>
          <span>${booking.adults}</span>
        </div>
        ` : ''}
        ${booking.children !== undefined && booking.children > 0 ? `
        <div class="row">
          <label>Children</label>
          <span>${booking.children}</span>
        </div>
        ` : ''}
        <div class="row">
          <label>Payment Status</label>
          <span style="color: ${booking.paymentStatus === 'paid' || booking.paymentStatus === 'completed' ? '#22c55e' : '#eab308'}">${booking.paymentStatus.toUpperCase()}</span>
        </div>
      </div>

      ${facilitiesHTML}
      ${activitiesHTML}

      <div class="total">
        <div class="row">
          <label>Total Amount</label>
          <span>${formatCurrency(booking.totalAmount)}</span>
        </div>
      </div>
    </div>

    <div class="qr-section">
      <img src="${qrCodeDataUrl}" alt="Booking QR Code" />
      <p class="qr-label">Check-in QR Code</p>
      <p>Show this QR code at the venue for quick check-in</p>
    </div>

    <div class="footer">
      <p>Thank you for booking with us!</p>
      <p>Generated on ${format(new Date(), 'PPP')}</p>
    </div>
  </div>
</body>
</html>
  `;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `booking-${booking.bookingId.slice(0, 8)}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export interface AllBookingsExportData {
  itemName: string;
  itemType: string;
  bookings: Array<{
    id: string;
    guest_name_masked?: string;
    guest_email_limited?: string;
    guest_phone_limited?: string;
    total_amount: number;
    status: string;
    payment_status?: string;
    created_at: string;
    slots_booked?: number;
    booking_details?: any;
  }>;
}

export const downloadAllBookingsAsPDF = async (data: AllBookingsExportData): Promise<void> => {
  const formatCurrency = (amount: number) => `KES ${amount?.toLocaleString() || 0}`;
  const totalRevenue = data.bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
  const paidBookings = data.bookings.filter(b => b.payment_status === 'paid' || b.payment_status === 'completed');

  const bookingRows = data.bookings.map((booking, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><code>${escapeHtml(booking.id?.slice(0, 8) || 'N/A')}...</code></td>
      <td>${escapeHtml(booking.guest_name_masked || 'Guest')}</td>
      <td>${escapeHtml(booking.guest_email_limited || 'N/A')}</td>
      <td>${escapeHtml(booking.guest_phone_limited || 'N/A')}</td>
      <td>${format(new Date(booking.created_at), 'PP')}</td>
      <td>${booking.slots_booked || 1}</td>
      <td>${formatCurrency(booking.total_amount)}</td>
      <td><span class="status ${escapeHtml(booking.payment_status || '')}">${escapeHtml(booking.payment_status || booking.status)}</span></td>
    </tr>
  `).join('');

  // Escape item name for title and header
  const safeItemName = escapeHtml(data.itemName);
  const safeItemType = escapeHtml(data.itemType.charAt(0).toUpperCase() + data.itemType.slice(1));

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>All Bookings - ${safeItemName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 30px;
      background: #f5f5f5;
      font-size: 12px;
    }
    .container {
      max-width: 1100px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #008080, #006666);
      color: white;
      padding: 25px 30px;
    }
    .header h1 { font-size: 22px; margin-bottom: 4px; }
    .header p { opacity: 0.9; font-size: 13px; }
    .summary {
      display: flex;
      gap: 20px;
      padding: 20px 30px;
      background: #f8f9fa;
      border-bottom: 1px solid #eee;
    }
    .summary-card {
      flex: 1;
      background: white;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .summary-card h3 { font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
    .summary-card p { font-size: 20px; font-weight: bold; color: #008080; }
    .content { padding: 20px 30px; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th {
      background: #f8f9fa;
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      color: #333;
      border-bottom: 2px solid #e0e0e0;
    }
    td {
      padding: 10px 8px;
      border-bottom: 1px solid #f0f0f0;
      vertical-align: middle;
    }
    tr:hover { background: #fafafa; }
    code {
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
    }
    .status {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status.paid, .status.completed { background: #dcfce7; color: #166534; }
    .status.pending { background: #fef3c7; color: #92400e; }
    .status.failed { background: #fecaca; color: #991b1b; }
    .footer {
      padding: 15px 30px;
      text-align: center;
      font-size: 11px;
      color: #999;
      border-top: 1px solid #f0f0f0;
    }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${safeItemName}</h1>
      <p>${safeItemType} • All Bookings Report</p>
    </div>
    
    <div class="summary">
      <div class="summary-card">
        <h3>Total Bookings</h3>
        <p>${data.bookings.length}</p>
      </div>
      <div class="summary-card">
        <h3>Paid Bookings</h3>
        <p>${paidBookings.length}</p>
      </div>
      <div class="summary-card">
        <h3>Total Revenue</h3>
        <p>${formatCurrency(totalRevenue)}</p>
      </div>
    </div>

    <div class="content">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Booking ID</th>
            <th>Guest Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Date</th>
            <th>People</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${bookingRows || '<tr><td colspan="9" style="text-align:center;padding:30px;">No bookings found</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>Generated on ${format(new Date(), 'PPP')} • Total ${data.bookings.length} bookings</p>
    </div>
  </div>
</body>
</html>
  `;

  // Create blob and trigger download
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bookings-${data.itemName.replace(/\s+/g, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
