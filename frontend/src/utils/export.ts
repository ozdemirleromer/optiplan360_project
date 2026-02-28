/**
 * Export Utilities
 * CSV, Excel, PDF dışa aktarma fonksiyonları
 */

/**
 * CSV Export
 */
export const exportToCSV = (
  data: Record<string, unknown>[],
  filename: string = 'export.csv',
) => {
  if (!data.length) {
    console.warn('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csv = [
    // Header row
    headers.map((h) => `"${h}"`).join(','),
    // Data rows
    ...data.map((row) =>
      headers
        .map((key) => {
          const value = row[key];
          // Escape quotes in values
          return `"${String(value || '').replace(/"/g, '""')}"`;
        })
        .join(','),
    ),
  ].join('\n');

  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
};

/**
 * Excel Export (using xlsx library)
 * npm install xlsx
 */
export const exportToExcel = async (
  data: Record<string, unknown>[],
  filename: string = 'export.xlsx',
) => {
  try {
    const XLSX = await import('xlsx');

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    // Adjust column widths
    const colWidths = Object.keys(data[0] || {}).map(() => 15);
    worksheet['!cols'] = colWidths.map((w) => ({ wch: w }));

    XLSX.writeFile(workbook, filename);
  } catch (error) {
    console.error('Excel export failed:', error);
    // Fallback to CSV
    exportToCSV(data, filename.replace('.xlsx', '.csv'));
  }
};

/**
 * PDF Export (using jspdf + html2canvas)
 * npm install jspdf html2canvas
 */
export const exportToPDF = async (
  element: HTMLElement,
  filename: string = 'export.pdf',
) => {
  try {
    const { jsPDF } = await import('jspdf');
    const html2canvas = await import('html2canvas');

    const canvas = await html2canvas.default(element);
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(filename);
  } catch (error) {
    console.error('PDF export failed:', error);
  }
};

/**
 * Generic file download helper
 */
const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Send via Email (API call)
 */
export const sendViaEmail = async (_options: {
  to: string[];
  subject: string;
  body: string;
  attachmentData?: Record<string, unknown>[];
  attachmentName?: string;
}) => {
  // This would call your backend API
  // const response = await fetch('/api/email/send', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(options),
  // });
  // return response.json();
};

/**
 * Export helpers
 */
export const exportHelpers = {
  /**
   * Tabile'dan veri çek ve CSV'ye çıkar
   */
  tableToCSV: (tableSelector: string, filename?: string) => {
    const table = document.querySelector(tableSelector) as HTMLTableElement;
    if (!table) return;

    const data: Record<string, unknown>[] = [];
    const headers = Array.from(table.querySelectorAll('thead th')).map(
      (th) => th.textContent || '',
    );

    table.querySelectorAll('tbody tr').forEach((tr) => {
      const row: Record<string, unknown> = {};
      const cells = tr.querySelectorAll('td');
      headers.forEach((header, index) => {
        row[header] = cells[index]?.textContent || '';
      });
      data.push(row);
    });

    exportToCSV(data, filename || 'table-export.csv');
  },

  /**
   * Array'i farklı formatlarda indir
   */
  download: (
    data: Record<string, unknown>[],
    format: 'csv' | 'excel' | 'json',
    filename: string = 'export',
  ) => {
    switch (format) {
      case 'csv':
        exportToCSV(data, `${filename}.csv`);
        break;
      case 'excel':
        exportToExcel(data, `${filename}.xlsx`);
        break;
      case 'json':
        downloadFile(JSON.stringify(data, null, 2), `${filename}.json`, 'application/json');
        break;
    }
  },
};

/**
 * useExport Hook
 */
export const useExport = () => {
  const exportAsCSV = (
    data: Record<string, unknown>[],
    filename?: string,
  ) => {
    exportToCSV(data, filename);
  };

  const exportAsExcel = async (
    data: Record<string, unknown>[],
    filename?: string,
  ) => {
    await exportToExcel(data, filename);
  };

  const exportAsPDF = async (
    element: HTMLElement,
    filename?: string,
  ) => {
    await exportToPDF(element, filename);
  };

  return { exportAsCSV, exportAsExcel, exportAsPDF };
};
