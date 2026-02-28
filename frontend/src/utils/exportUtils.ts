/**
 * Export Utilities - PDF, Excel, CSV
 */
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { type Invoice } from '../services/paymentService';

/**
 * Export invoices to PDF
 */
export const exportInvoicesToPDF = (invoices: Invoice[]) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text('Fatura Raporu', 14, 22);
  
  // Tarih
  doc.setFontSize(10);
  doc.text(`Oluşturma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 32);
  
  // Table data
  const rows = invoices.map(inv => [
    inv.invoiceNumber,
    inv.accountId,
    `₺${(inv.totalAmount ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`,
    `₺${(inv.paidAmount ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`,
    inv.status,
    inv.reminderType || '-',
  ]);
  
  // jspdf-autotable extends jsPDF with autoTable method
  (doc as unknown as { autoTable: (opts: Record<string, unknown>) => void }).autoTable({
    head: [['Fatura No', 'Hesap', 'Tutar', 'Ödenen', 'Durum', 'Hatırlatıcı']],
    body: rows,
    startY: 40,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
  });
  
  doc.save(`faturalar-${new Date().getTime()}.pdf`);
};

/**
 * Export invoices to Excel
 */
export const exportInvoicesToExcel = (invoices: Invoice[]) => {
  const data = invoices.map(inv => ({
    'Fatura No': inv.invoiceNumber,
    'Hesap': inv.accountId,
    'Tür': inv.invoiceType,
    'Ara Toplam': inv.subtotal,
    'KDV': inv.taxAmount,
    'İndirim': inv.discountAmount,
    'Toplam': inv.totalAmount,
    'Ödenen': inv.paidAmount,
    'Kalan': inv.remainingAmount,
    'Durum': inv.status,
    'Vade Tarihi': inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('tr-TR') : '-',
    'Hatırlatıcı Türü': inv.reminderType || '-',
    'Hatırlatıcı Durumu': inv.reminderStatus || '-',
  }));
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Faturalar');
  
  // Column widths
  ws['!cols'] = [
    { wch: 15 }, // Fatura No
    { wch: 15 }, // Hesap
    { wch: 10 }, // Tür
    { wch: 12 }, // Ara Toplam
    { wch: 10 }, // KDV
    { wch: 10 }, // İndirim
    { wch: 12 }, // Toplam
    { wch: 12 }, // Ödenen
    { wch: 10 }, // Kalan
    { wch: 12 }, // Durum
    { wch: 15 }, // Vade
    { wch: 15 }, // Hatırlatıcı Türü
    { wch: 15 }, // Hatırlatıcı Durumu
  ];
  
  XLSX.writeFile(wb, `faturalar-${new Date().getTime()}.xlsx`);
};

/**
 * Export invoices to CSV
 */
export const exportInvoicesToCSV = (invoices: Invoice[]) => {
  const headers = ['Fatura No', 'Hesap', 'Tür', 'Tutar', 'Ödenen', 'Durum', 'Hatırlatıcı'];
  
  const rows = invoices.map(inv => [
    inv.invoiceNumber,
    inv.accountId,
    inv.invoiceType,
    inv.totalAmount,
    inv.paidAmount,
    inv.status,
    inv.reminderType || '-',
  ]);
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `faturalar-${new Date().getTime()}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};
