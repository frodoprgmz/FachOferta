const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  // 1. Obsługa CORS (zapobiega blokowaniu strzałów z frontendu)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Bezpieczne parsowanie body
  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (parseError) {
    console.error('[send-acceptance] Błąd parsowania JSON:', parseError);
    return res.status(400).json({
      error: 'Nieprawidłowy format JSON w żądaniu',
      details: parseError.message,
    });
  }

  try {
    const { contractorEmail, estimateNumber, clientName, totalGross } = body;

    const normalizeEnv = (value) => (typeof value === 'string' ? value.trim() : '');

    // 3. Pobranie i czyszczenie zmiennych z Vercela (usuwa przypadkowe spacje na końcach)
    const smtpHost = normalizeEnv(process.env.SMTP_HOST);
    const smtpPortRaw = normalizeEnv(process.env.SMTP_PORT);
    const smtpPort = Number(smtpPortRaw || '587');
    const smtpUser = normalizeEnv(process.env.SMTP_USER);
    const smtpPass = normalizeEnv(process.env.SMTP_PASS);
    const smtpFrom = normalizeEnv(process.env.SMTP_FROM) || smtpUser;
    const smtpSecureOverride = normalizeEnv(process.env.SMTP_SECURE).toLowerCase();
    const smtpSecure = smtpSecureOverride ? smtpSecureOverride === 'true' : smtpPort === 465;

    console.log('[send-acceptance] Start wysyłki:', {
      contractorEmail,
      estimateNumber,
      clientName,
      totalGross,
      smtpHost,
      smtpPort,
      secure: smtpSecure,
      hasUser: Boolean(smtpUser),
      hasPass: Boolean(smtpPass),
      hasFrom: Boolean(smtpFrom),
    });

    if (!contractorEmail) {
      return res.status(400).json({ error: 'Brak adresu e-mail wykonawcy w żądaniu' });
    }

    if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
      return res.status(500).json({
        error: 'Brak konfiguracji SMTP w Vercel Environment Variables',
        status: {
          SMTP_HOST: Boolean(smtpHost),
          SMTP_USER: Boolean(smtpUser),
          SMTP_PASS: Boolean(smtpPass),
          SMTP_FROM: Boolean(smtpFrom),
        },
      });
    }

    // 4. Konfiguracja Transportera z sztywnym limitowaniem czasu (Timeout) + poprawną detekcją SSL / STARTTLS
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
      },
      debug: process.env.NODE_ENV !== 'production',
      logger: process.env.NODE_ENV !== 'production',
    });

    await transporter.verify();

    // 5. Wysyłka e-maila
    const mailResult = await transporter.sendMail({
      from: `FachOferta <${smtpFrom}>`,
      to: contractorEmail,
      subject: `🎉 Akceptacja wyceny ${estimateNumber || ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #16a34a; margin-bottom: 10px;">Dobre wieści! Klient zaakceptował wycenę.</h2>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
          <p style="font-size: 14px; margin: 5px 0;"><strong>Numer wyceny:</strong> ${estimateNumber || '-'}</p>
          <p style="font-size: 14px; margin: 5px 0;"><strong>Klient:</strong> ${clientName || '-'}</p>
          <p style="font-size: 14px; margin: 5px 0;"><strong>Kwota brutto:</strong> ${totalGross || 0} PLN</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
          <p style="font-size: 12px; color: #64748b;">Powiadomienie wygenerowane automatycznie przez FachOferta.</p>
        </div>
      `,
    });

    console.log('[send-acceptance] Sukces wysyłki:', mailResult.messageId);
    return res.status(200).json({ success: true, messageId: mailResult.messageId });

  } catch (error) {
    console.error('[SMTP ERROR]:', error);

    // Zwracamy dokładny kod i odpowiedź serwera SMTP (np. EAUTH dla błędnego hasła, ETIMEDOUT dla zablokowanego portu)
    return res.status(500).json({
      error: 'Błąd podczas wysyłania e-maila SMTP',
      message: error.message || 'Unknown Server Error',
      code: error.code || null,
      command: error.command || null,
      response: error.response || null,
    });
  }
};