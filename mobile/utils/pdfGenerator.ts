import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { EstimateData } from '../types';

export const generateAndSharePDF = async (data: EstimateData) => {
  const totalNet = data.items.reduce((sum, item) => sum + item.totalNet, 0);
  const totalVat = totalNet * 0.23;
  const totalGross = totalNet + totalVat;
  const advanceAmount = (totalGross * (data.advancePercent / 100)).toFixed(2);

  const itemsHtml = data.items
    .map(
      (item, index) => `
    <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${index + 1}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>${item.name}</strong></td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.unit}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.unitPriceNet.toFixed(2)} zł</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;"><strong>${item.totalNet.toFixed(2)} zł</strong></td>
    </tr>
  `
    )
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #1e293b; font-size: 13px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; }
        .badge { background: #eff6ff; color: #2563eb; padding: 6px 12px; border-radius: 4px; font-weight: bold; font-size: 15px; text-align: right; }
        .grid { display: flex; justify-content: space-between; margin-bottom: 25px; }
        .box { width: 47%; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
        .box h4 { font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
        th { background: #0f172a; color: white; padding: 8px 10px; font-size: 11px; text-align: left; }
        .totals { margin-left: auto; width: 45%; margin-bottom: 25px; }
        .totals-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e2e8f0; }
        .grand-total { font-size: 16px; font-weight: bold; color: #0f172a; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; padding: 8px 0; }
        .advance { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px; border-radius: 6px; color: #166534; font-weight: 500; margin-bottom: 30px; }
        .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
  <div>
    <div style="font-size: 20px; font-weight: bold; text-transform: uppercase;">${data.contractor.companyName}</div>
    ${data.contractor.nip ? `<div style="color: #64748b; font-size: 11px;">NIP: ${data.contractor.nip}</div>` : ''}
    <div style="color: #64748b; font-size: 11px;">Tel: ${data.contractor.phone} | Email: ${data.contractor.email}</div>
    <div style="color: #64748b; font-size: 11px;">Konto: ${data.contractor.bankAccount}</div>
  </div>
  <div>
    <div class="badge">WYCENA: ${data.estimateNumber}</div>
    <div style="text-align: right; font-size: 11px; color: #64748b; margin-top: 5px;">Data: ${data.issueDate}</div>
  </div>
</div>

      <div class="grid">
        <div class="box">
          <h4>Wykonawca</h4>
          <p><strong>${data.contractor.companyName}</strong></p>
          <p>Tel: ${data.contractor.phone}</p>
        </div>
        <div class="box">
          <h4>Zleceniodawca</h4>
          <p><strong>${data.client.name}</strong></p>
          <p>${data.client.address}</p>
          <p>Tel: ${data.client.phone}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 5%;">Lp.</th>
            <th style="width: 45%;">Nazwa usługi / materiału</th>
            <th style="text-align: center; width: 10%;">J.m.</th>
            <th style="text-align: right; width: 10%;">Ilość</th>
            <th style="text-align: right; width: 15%;">Cena netto</th>
            <th style="text-align: right; width: 15%;">Wartość netto</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row"><span>Suma netto:</span><span>${totalNet.toFixed(2)} PLN</span></div>
        <div class="totals-row"><span>VAT (23%):</span><span>${totalVat.toFixed(2)} PLN</span></div>
        <div class="totals-row grand-total"><span>RAZEM Brutto:</span><span>${totalGross.toFixed(2)} PLN</span></div>
      </div>

      <div class="advance">
        💡 <strong>Warunki:</strong> Wymagana zaliczka ${data.advancePercent}% tj. <strong>${advanceAmount} PLN</strong> na konto bankowe przed rozpoczęciem prac.
      </div>

      <div class="footer">
        Wygenerowano w aplikacji FachOferta. Dokument stanowi ofertę wstępną.
      </div>
    </body>
    </html>
  `;

  try {
    // 1. Generujemy PDF w postaci ciągu Base64
    const { base64 } = await Print.printToFileAsync({
      html: htmlContent,
      base64: true,
    });

    if (!base64) {
      throw new Error('Nie udało się uzyskać danych pliku PDF');
    }

    // 2. Tworzymy nową ścieżkę w folderze dokumentów aplikacji
    const safeDocName = data.estimateNumber.replace(/[\/\\?%*:|"<>]/g, '_');
    const pdfPath = `${FileSystem.documentDirectory}${safeDocName}.pdf`;

    // 3. Zapisujemy dane bezpośrednio do pliku
    await FileSystem.writeAsStringAsync(pdfPath, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 4. Otwieramy natywne menu udostępniania
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(pdfPath, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Wyślij wycenę ${data.estimateNumber}`,
      });
    } else {
      alert('Udostępnianie niedostępne na tym urządzeniu');
    }
  } catch (error) {
    console.error('Błąd podczas generowania PDF:', error);
    alert('Wystąpił błąd przy generowaniu pliku PDF');
  }
};