import nodemailer from 'nodemailer';

interface BookingEmailData {
  customerName: string;
  customerEmail: string;
  service: {
    titleFi: string;
    price: number;
    duration: number;
  };
  date: string;
  time: string;
  vehicleType: string;
  specialRequests?: string;
  bookingId: string;
}

// Create transporter using environment variables
function createTransporter() {
  const port = parseInt(process.env.SMTP_PORT || '587');
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false // Accept self-signed certificates
    }
  });
}

// Generate HTML email template
function generateBookingEmailHTML(data: BookingEmailData): string {
  return `
<!DOCTYPE html>
<html lang="fi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Autopesu Varaus Vahvistettu</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .content {
      background: #f9fafb;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .booking-details {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #10b981;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      margin: 10px 0;
      padding: 5px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .detail-label {
      font-weight: bold;
      color: #374151;
    }
    .detail-value {
      color: #6b7280;
    }
    .price {
      font-size: 24px;
      font-weight: bold;
      color: #10b981;
    }
    .important-info {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      color: #6b7280;
      font-size: 14px;
    }
    .button {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚗 Autopesu Varaus Vahvistettu</h1>
    <p>Kiitos varauksestasi, ${data.customerName}!</p>
  </div>

  <div class="content">
    <p>Hei ${data.customerName},</p>
    <p>Autopesuvuorosi on vahvistettu. Alla ovat varauksen tiedot:</p>

    <div class="booking-details">
      <h3>📋 Varauksen Tiedot</h3>

      <div class="detail-row">
        <span class="detail-label">Palvelu:</span>
        <span class="detail-value">${data.service.titleFi}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Päivämäärä:</span>
        <span class="detail-value">${new Date(data.date).toLocaleDateString('fi-FI', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Kellonaika:</span>
        <span class="detail-value">${data.time}</span>
      </div>


      <div class="detail-row">
        <span class="detail-label">Ajoneuvo:</span>
        <span class="detail-value">${data.vehicleType}</span>
      </div>

      ${data.specialRequests ? `
      <div class="detail-row">
        <span class="detail-label">Lisätiedot:</span>
        <span class="detail-value">${data.specialRequests}</span>
      </div>
      ` : ''}

      <div class="detail-row" style="border-bottom: none; margin-top: 20px;">
        <span class="detail-label">Hinta:</span>
        <span class="price">€${data.service.price}</span>
      </div>

      <div style="margin-top: 10px; font-size: 12px; color: #6b7280;">
        Varausnumero: ${data.bookingId}
      </div>
    </div>

    <div class="important-info">
      <h4>⚠️ Tärkeää muistaa:</h4>
      <ul>
        <li>Saavu 5 minuuttia ennen varattua aikaa</li>
        <li>Tuo mukanasi auton avaimet</li>
        <li>Maksu tapahtuu paikan päällä (käteinen tai kortti)</li>
        <li>Jos tarvitset peruuttaa varauksen, ota yhteyttä mahdollisimman pian</li>
      </ul>
    </div>

    <p>Odotamme sinua ${new Date(data.date).toLocaleDateString('fi-FI')} klo ${data.time}!</p>

    <p>Jos sinulla on kysyttävää, älä epäröi ottaa yhteyttä.</p>

    <div class="footer">
      <p><strong>Autopesu Kiilto & Loisto</strong></p>
      <p>Puhelin: +358 44 960 8148</p>
      <p>Sähköposti: info@kiiltoloisto.fi</p>
      <p>Tämä on automaattisesti lähetetty vahvistusviesti.</p>
    </div>
  </div>
</body>
</html>`;
}

// Generate plain text version
function generateBookingEmailText(data: BookingEmailData): string {
  return `
AUTOPESU VARAUS VAHVISTETTU

Hei ${data.customerName},

Autopesuvuorosi on vahvistettu. Alla ovat varauksen tiedot:

VARAUKSEN TIEDOT:
- Palvelu: ${data.service.titleFi}
- Päivämäärä: ${new Date(data.date).toLocaleDateString('fi-FI')}
- Kellonaika: ${data.time}
- Ajoneuvo: ${data.vehicleType}
${data.specialRequests ? `- Lisätiedot: ${data.specialRequests}` : ''}
- Hinta: €${data.service.price}
- Varausnumero: ${data.bookingId}

TÄRKEÄÄ MUISTAA:
- Saavu 5 minuuttia ennen varattua aikaa
- Tuo mukanasi auton avaimet
- Maksu tapahtuu paikan päällä (käteinen tai kortti)
- Jos tarvitset peruuttaa varauksen, ota yhteyttä mahdollisimman pian

Odotamme sinua ${new Date(data.date).toLocaleDateString('fi-FI')} klo ${data.time}!

Jos sinulla on kysyttävää, älä epäröi ottaa yhteyttä.

--
Autopesu Kiilto & Loisto
Puhelin: +358 44 960 8148
Sähköposti: info@kiiltoloisto.fi

Tämä on automaattisesti lähetetty vahvistusviesti.
`;
}

// Send booking confirmation email
export async function sendBookingConfirmationEmail(data: BookingEmailData): Promise<boolean> {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Autopesu Kiilto & Loisto" <${process.env.SMTP_FROM}>`,
      to: data.customerEmail,
      subject: `Autopesu varaus vahvistettu - ${new Date(data.date).toLocaleDateString('fi-FI')} klo ${data.time}`,
      text: generateBookingEmailText(data),
      html: generateBookingEmailHTML(data),
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
}

// Send business notification email (backup to WhatsApp)
export async function sendBusinessNotificationEmail(data: BookingEmailData): Promise<boolean> {
  try {
    const transporter = createTransporter();

    const businessEmailText = `
UUSI AUTOPESU VARAUS

Päivämäärä: ${new Date(data.date).toLocaleDateString('fi-FI')} klo ${data.time}
Palvelu: ${data.service.titleFi} (€${data.service.price})
Asiakas: ${data.customerName}
Puhelin: ${data.customerEmail}
Ajoneuvo: ${data.vehicleType}
Varausnumero: ${data.bookingId}

${data.specialRequests ? `Lisätiedot: ${data.specialRequests}` : 'Ei erityistoiveita'}

--
Automaattinen ilmoitus varausjärjestelmästä
`;

    const mailOptions = {
      from: `"Varausjärjestelmä" <${process.env.SMTP_FROM}>`,
      to: process.env.SMTP_FROM, // Send to business email
      subject: `🚗 Uusi varaus: ${data.customerName} - ${new Date(data.date).toLocaleDateString('fi-FI')}`,
      text: businessEmailText,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Business email notification failed:', error);
    return false;
  }
}