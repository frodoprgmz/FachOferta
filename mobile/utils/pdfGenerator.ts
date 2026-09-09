import * as Print from 'expo-print';
import { Alert } from 'react-native';
import { EstimateData } from '../types';

// Stały alias produkcyjny, niezależny od konkretnego deploymentu Vercel
const WEB_BASE_URL = 'https://fach-oferta-app.vercel.app';

export const getEstimateHTML = (data: EstimateData): string => {
  const acceptUrl = data.id ? `${WEB_BASE_URL}/?id=${data.id}` : WEB_BASE_URL;

  const totalNet = data.items.reduce((sum, item) => sum + item.totalNet, 0);
  const totalVat = totalNet * 0.23;
  const totalGross = totalNet + totalVat;
  const advanceAmount = totalGross * (data.advancePercent / 100);

  const itemsRowsHtml = data.items
    .map(
      (item, index) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; text-align: center; color: #64748b;">${index + 1}</td>
        <td style="padding: 10px; font-weight: 500;">${item.name}</td>
        <td style="padding: 10px; text-align: center;">${item.quantity} ${item.unit}</td>
        <td style="padding: 10px; text-align: right;">${item.unitPriceNet.toFixed(2)} zł</td>
        <td style="padding: 10px; text-align: right; font-weight: bold;">${item.totalNet.toFixed(2)} zł</td>
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 20px; line-height: 1.5; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; border-bottom: 2px solid #0f172a; padding-bottom: 15px; }
        .logo { max-height: 50px; margin-bottom: 8px; }
        .title { font-size: 20px; font-weight: bold; color: #0f172a; margin: 0; }
        .doc-info { text-align: right; font-size: 12px; color: #64748b; }
        .grid { display: flex; justify-content: space-between; margin-bottom: 25px; gap: 15px; }
        .card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12px; }
        .card-title { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 12px; }
        th { background: #0f172a; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; }
        .totals { margin-left: auto; width: 260px; margin-bottom: 25px; font-size: 12px; }
        .totals-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e2e8f0; }
        .totals-row.grand-total { border-top: 2px solid #0f172a; border-bottom: none; font-size: 15px; font-weight: bold; color: #0f172a; padding-top: 8px; }
        .advance-box { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 10px 14px; border-radius: 8px; font-size: 12px; margin-bottom: 20px; }
        .accept-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 14px; border-radius: 8px; text-align: center; margin-bottom: 25px; }
        .accept-title { font-weight: bold; color: #1e40af; font-size: 13px; margin: 0 0 4px 0; }
        .accept-desc { font-size: 11px; color: #3b82f6; margin: 0 0 8px 0; }
        .accept-link { color: #2563eb; font-weight: bold; text-decoration: underline; font-size: 12px; word-break: break-all; }
        .footer { text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
      </style>
    </head>
    <body>

      <div class="header">
        <div>
          ${data.contractor.logoBase64 ? `<img src="${data.contractor.logoBase64}" class="logo" />` : ''}
          <div class="title">${data.contractor.companyName || 'Wykonawca'}</div>
          <div style="font-size: 11px; color: #64748b;">NIP: ${data.contractor.nip || 'Brak'}</div>
        </div>
        <div class="doc-info">
          <div style="font-weight: bold; font-size: 15px; color: #2563eb;">${data.estimateNumber}</div>
          <div>Data wystawienia: ${data.issueDate}</div>
          <div>Ważne do: ${data.validUntil}</div>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="card-title">Wykonawca</div>
          <strong>${data.contractor.companyName || '-'}</strong><br/>
          Tel: ${data.contractor.phone || '-'}<br/>
          Email: ${data.contractor.email || '-'}<br/>
          Konto: ${data.contractor.bankAccount || '-'}
        </div>
        <div class="card">
          <div class="card-title">Zleceniodawca</div>
          <strong>${data.client.name || '-'}</strong><br/>
          Adres: ${data.client.address || '-'}<br/>
          Tel: ${data.client.phone || '-'}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">Lp.</th>
            <th>Usługa / Materiał</th>
            <th style="text-align: center;">Ilość</th>
            <th style="text-align: right;">Cena Netto</th>
            <th style="text-align: right;">Razem Netto</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row">
          <span>Suma Netto:</span>
          <span>${totalNet.toFixed(2)} PLN</span>
        </div>
        <div class="totals-row">
          <span>VAT (23%):</span>
          <span>${totalVat.toFixed(2)} PLN</span>
        </div>
        <div class="totals-row grand-total">
          <span>RAZEM Brutto:</span>
          <span>${totalGross.toFixed(2)} PLN</span>
        </div>
      </div>

      <div class="advance-box">
        💡 <strong>Warunki płatności:</strong> Wymagana zaliczka ${data.advancePercent}% tj. <strong>${advanceAmount.toFixed(2)} PLN</strong> na konto bankowe.
      </div>

      <div class="accept-box">
        <p class="accept-title">🟢 Akceptacja wyceny online</p>
        <p class="accept-desc">Kliknij poniższy link, aby szybko zaakceptować kosztorys online:</p>
        <a href="${acceptUrl}" class="accept-link">${acceptUrl}</a>
      </div>

      <div class="footer">
        Dziękujemy za zaufanie! Dokument wygenerowany w aplikacji FachOferta.
      </div>

    </body>
    </html>
  `;
};

export const generateAndSharePDF = async (data: EstimateData) => {
  try {
    const htmlContent = getEstimateHTML(data);

    // Natywny widok drukowania/zapisu systemu Android/iOS
    await Print.printAsync({
      html: htmlContent,
    });
  } catch (error) {
    console.error('Błąd drukowania/zapisu PDF:', error);
    Alert.alert('Błąd', 'Nie udało się otworzyć okna drukowania PDF.');
  }
};