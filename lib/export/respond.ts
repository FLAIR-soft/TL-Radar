import ExcelJS from 'exceljs';

function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
}

// Odna i ta zhe matritsa stroк (zagolovok + dannyye, uzhe otformatirovannyye v
// stroki) prevrashchaetsya libo v CSV-tekst, libo v .xlsx-bufer cherez exceljs —
// eto edinaya tochka, gde format eksporta reshaetsya, chtoby oba route handler'a
// (arkhiv, analitika) ne dublirovali logiku otdachi fayla.
export async function exportResponse(
  rows: string[][],
  format: 'csv' | 'xlsx',
  filename: string,
  sheetName: string
): Promise<Response> {
  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((col) => {
      col.width = 20;
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
      },
    });
  }

  // BOM, chtoby Excel korrektno raspoznal UTF-8 (kirillicheskiye imena/nazvaniya).
  const csv = '﻿' + rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
    },
  });
}

export function parseFormat(searchParams: URLSearchParams): 'csv' | 'xlsx' {
  return searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';
}
