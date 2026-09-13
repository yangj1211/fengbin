import ExcelJS from 'exceljs';

/** Values stay typed: text such as product codes and formulas remains literal text. */
export async function createDetailWorkbook(
  columns: string[],
  rows: (string | number)[][],
) {
  if (!columns.length || !rows.length) throw new Error('暂无可导出的明细。');
  if (columns.length > 16384 || rows.length > 1048575)
    throw new Error('明细超过 Excel 单表容量，请缩小筛选范围后重试。');

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('明细', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.addRow(columns);
  for (const values of rows)
    sheet.addRow(columns.map((_, index) => values[index] ?? ''));
  sheet.columns.forEach((column, index) => {
    const values = [
      columns[index],
      ...rows.slice(0, 200).map((row) => row[index] ?? ''),
    ];
    const width = Math.max(
      ...values.map((value) =>
        Array.from(String(value)).reduce(
          (sum, char) => sum + (char.charCodeAt(0) > 255 ? 2 : 1),
          0,
        ),
      ),
    );
    column.width = Math.max(12, Math.min(48, width + 3));
  });
  sheet.getRow(1).font = { bold: true, color: { argb: 'FF203044' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEAF0F8' },
  };
  sheet.getRow(1).height = 25;
  sheet.eachRow((row) => {
    row.alignment = { vertical: 'top', wrapText: true };
  });
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length + 1, column: columns.length },
  };
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
