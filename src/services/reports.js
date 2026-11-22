const fs = require('node:fs');
const path = require('node:path');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const prisma = require('../lib/prisma');
const AppError = require('../errors/app-error');
const analytics = require('./analytics');

const ROOT = path.resolve(__dirname, '..', '..');
const REPORT_DIR = path.join(ROOT, 'storage', 'reports');
const TYPES = ['VEHICLE_UTILIZATION', 'DRIVER_PERFORMANCE', 'TRIP_COMPLETION', 'ROUTE_PERFORMANCE', 'TRIP_DELAYS', 'VEHICLE_MAINTENANCE', 'FLEET_OPERATIONAL', 'USER_REGISTRATION'];
const FORMATS = ['PDF', 'XLSX', 'CSV'];
function safeInteger(value, name) { if (value === undefined) return undefined; const id = Number.parseInt(value, 10); if (!Number.isInteger(id) || id < 1) throw new AppError(400, `${name} must be a positive integer.`, 'VALIDATION_ERROR'); return id; }
function title(type) { return type.split('_').map((word) => word[0] + word.slice(1).toLowerCase()).join(' '); }
function primitive(value) { if (value === null || value === undefined) return ''; if (value instanceof Date) return value.toISOString(); if (typeof value === 'object') return JSON.stringify(value); return value; }
function rowsFrom(value) { const source = Array.isArray(value) ? value : [value]; return source.filter(Boolean).map((item) => Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, primitive(entry)]))); }
function csvEscape(value) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
async function reportData(type, range, filters) {
  if (type === 'TRIP_COMPLETION' || type === 'TRIP_DELAYS') { const data = await analytics.tripsAnalytics(range, filters); return { summary: type === 'TRIP_DELAYS' ? { delayedTrips: data.tripsByStatus.DELAYED, period: range.startDate + ' to ' + range.endDate } : { completionRate: data.tripCompletionRate, completedTrips: data.tripsByStatus.COMPLETED, totalTrips: Object.values(data.tripsByStatus).reduce((a, b) => a + b, 0) }, records: type === 'TRIP_DELAYS' ? data.delayedOverTime : data.completedOverTime }; }
  if (type === 'VEHICLE_UTILIZATION') { const data = await analytics.fleetAnalytics(range); return { summary: data.vehicleAvailability, records: data.vehicleUtilization }; }
  if (type === 'DRIVER_PERFORMANCE') { const data = await analytics.driverAnalytics(range, filters.driverId); return { summary: { drivers: data.drivers?.length || (data.driver ? 1 : 0) }, records: data.drivers || [data.driver] }; }
  if (type === 'ROUTE_PERFORMANCE') { const data = await analytics.routeAnalytics(range, filters.routeId); return { summary: { routes: data.routes?.length || (data.route ? 1 : 0) }, records: data.routes || [data.route] }; }
  if (type === 'VEHICLE_MAINTENANCE') { const records = await prisma.maintenanceRecord.findMany({ where: { maintenanceDate: { gte: range.start, lt: range.end }, ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}) }, include: { vehicle: { select: { registrationNumber: true, vehicleType: true } } }, orderBy: { maintenanceDate: 'desc' } }); return { summary: { maintenanceRecords: records.length }, records: records.map((r) => ({ id: r.id, vehicle: r.vehicle.registrationNumber, vehicleType: r.vehicle.vehicleType, maintenanceDate: r.maintenanceDate, status: r.status, cost: r.cost && Number(r.cost), description: r.description })) }; }
  if (type === 'FLEET_OPERATIONAL') { const data = await analytics.operations(); return { summary: data, records: [] }; }
  if (type === 'USER_REGISTRATION') { const records = await prisma.user.findMany({ where: { createdAt: { gte: range.start, lt: range.end } }, select: { id: true, fullName: true, email: true, role: true, status: true, createdAt: true, approvedAt: true }, orderBy: { createdAt: 'desc' } }); return { summary: { registeredUsers: records.length, activeUsers: records.filter((u) => u.status === 'ACTIVE').length, pendingUsers: records.filter((u) => u.status === 'PENDING').length }, records }; }
  throw new AppError(400, 'Unsupported report type.', 'VALIDATION_ERROR');
}
async function writeCsv(file, data) { const rows = [{ section: 'Summary', ...data.summary }, ...rowsFrom(data.records)]; const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]; await fs.promises.writeFile(file, `${columns.join(',')}\n${rows.map((row) => columns.map((column) => csvEscape(row[column])).join(',')).join('\n')}\n`, 'utf8'); }
async function writeXlsx(file, reportTitle, range, data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ZamTransport';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Report', { views: [{ showGridLines: false }] });
  sheet.mergeCells('A1:H1');
  sheet.getCell('A1').value = 'ZAMTRANSPORT';
  sheet.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17181B' } };
  sheet.getRow(1).height = 38;

  sheet.mergeCells('A2:H2');
  sheet.getCell('A2').value = reportTitle;
  sheet.getCell('A2').font = { bold: true, size: 16, color: { argb: 'FF17181B' } };
  sheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(2).height = 28;

  sheet.mergeCells('A3:H3');
  sheet.getCell('A3').value = `Reporting period: ${range.startDate} to ${range.endDate} (${range.timeZone})`;
  sheet.getCell('A3').font = { size: 10, color: { argb: 'FF696873' } };
  sheet.getRow(3).height = 22;

  sheet.mergeCells('A5:H5');
  sheet.getCell('A5').value = 'SUMMARY';
  sheet.getCell('A5').font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF5A2B' } };
  sheet.getCell('A5').alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(5).height = 24;

  let rowIndex = 6;
  for (const [key, value] of Object.entries(data.summary)) {
    sheet.getCell(rowIndex, 1).value = key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
    sheet.getCell(rowIndex, 2).value = primitive(value);
    sheet.getCell(rowIndex, 1).font = { bold: true, color: { argb: 'FF696873' } };
    sheet.getCell(rowIndex, 2).font = { bold: true, color: { argb: 'FF17181B' } };
    sheet.getRow(rowIndex).height = 20;
    rowIndex += 1;
  }

  rowIndex += 1;
  const rows = rowsFrom(data.records);
  if (rows.length) {
    sheet.mergeCells(rowIndex, 1, rowIndex, 8);
    sheet.getCell(rowIndex, 1).value = 'DETAILED RECORDS';
    sheet.getCell(rowIndex, 1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    sheet.getCell(rowIndex, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF5A2B' } };
    sheet.getRow(rowIndex).height = 24;
    rowIndex += 1;

    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    columns.forEach((column, index) => {
      const cell = sheet.getCell(rowIndex, index + 1);
      cell.value = column.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF343438' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
    sheet.getRow(rowIndex).height = 24;
    rowIndex += 1;

    rows.forEach((row) => {
      columns.forEach((column, index) => {
        const cell = sheet.getCell(rowIndex, index + 1);
        cell.value = row[column];
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFE8E8EC' } } };
      });
      sheet.getRow(rowIndex).height = 24;
      rowIndex += 1;
    });
  } else {
    sheet.mergeCells(rowIndex, 1, rowIndex, 8);
    sheet.getCell(rowIndex, 1).value = 'No detailed records for this period.';
    sheet.getCell(rowIndex, 1).font = { italic: true, color: { argb: 'FF696873' } };
  }

  sheet.columns.forEach((column) => {
    column.width = Math.min(32, Math.max(12, ...(column.values || []).map((value) => String(value ?? '').length + 2)));
  });
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  await workbook.xlsx.writeFile(file);
}

async function writePdf(file, reportTitle, range, data) {
  await new Promise((resolve, reject) => {
    const document = new PDFDocument({ margin: 48, size: 'A4', bufferPages: true, info: { Title: reportTitle, Author: 'ZamTransport', Subject: 'Administrative report' } });
    const stream = fs.createWriteStream(file);
    const logoPath = path.join(ROOT, 'frontend', 'zamtransportfrontend', 'src', 'assets', 'logo.png');
    const contentWidth = document.page.width - 96;
    document.pipe(stream);

    document.rect(0, 0, document.page.width, 92).fill('#17181b');
    document.rect(0, 92, document.page.width, 5).fill('#ff5a2b');
    try { document.image(logoPath, 48, 22, { width: 48, height: 48 }); } catch (_) {}
    document.fillColor('#ffffff').fontSize(19).text('ZAMTRANSPORT', 108, 26, { lineBreak: false });
    document.fillColor('#c8c8cf').fontSize(9).text('ADMINISTRATIVE REPORT', 108, 51, { characterSpacing: 1.2, lineBreak: false });

    document.fillColor('#17181b').fontSize(22).text(reportTitle, 48, 118, { width: contentWidth });
    document.moveDown(0.35);
    document.fontSize(10).fillColor('#696873').text(`Reporting period  ${range.startDate} to ${range.endDate}  |  ${range.timeZone}`, { width: contentWidth });
    document.fontSize(9).text(`Generated ${new Date().toLocaleString('en-ZM', { timeZone: range.timeZone })}`, { width: contentWidth });

    document.moveDown(1);
    document.fillColor('#17181b').fontSize(12).text('SUMMARY');
    document.moveDown(0.45);

    const summaryEntries = Object.entries(data.summary);
    const cardWidth = (contentWidth - 12) / 2;
    const summaryTop = document.y;
    summaryEntries.forEach(([key, value], index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 48 + column * (cardWidth + 12);
      const y = summaryTop + row * 68;
      document.roundedRect(x, y, cardWidth, 58, 8).fillAndStroke('#f6f6f8', '#e8e8ec');
      document.fillColor('#696873').fontSize(8).text(key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase()).toUpperCase(), x + 12, y + 12, { width: cardWidth - 24, lineBreak: false });
      document.fillColor('#17181b').fontSize(16).text(String(primitive(value)), x + 12, y + 30, { width: cardWidth - 24, lineBreak: false });
    });
    if (summaryEntries.length) document.y = summaryTop + Math.ceil(summaryEntries.length / 2) * 68 + 18;

    const rows = rowsFrom(data.records);
    document.addPage();
    document.rect(0, 0, document.page.width, 68).fill('#17181b');
    document.rect(0, 68, document.page.width, 4).fill('#ff5a2b');
    document.fillColor('#ffffff').fontSize(16).text('ZAMTRANSPORT', 48, 22);
    document.fillColor('#c8c8cf').fontSize(9).text('DETAILED RECORDS', 48, 45);
    document.moveDown(2.6);

    if (!rows.length) {
      document.fillColor('#696873').fontSize(11).text('No detailed records for this period.', 48, 105);
    } else {
      const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
      columns.forEach((column) => {
        document.moveDown(0.25).fillColor('#17181b').rect(48, document.y - 2, contentWidth, 24).fill('#343438');
        document.fillColor('#ffffff').fontSize(8).text(column.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase()).toUpperCase(), 58, document.y - 20, { width: contentWidth - 20, lineBreak: false });
        document.moveDown(1.2);
      });
      rows.forEach((row, index) => {
        if (document.y > 700) document.addPage();
        const recordY = document.y;
        document.roundedRect(48, recordY, contentWidth, 52, 6).fillAndStroke(index % 2 ? '#fafafa' : '#ffffff', '#e8e8ec');
        document.fillColor('#17181b').fontSize(9).text(`${index + 1}.`, 58, recordY + 10, { width: 24 });
        document.fillColor('#696873').fontSize(8).text(Object.entries(row).map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1')}: ${value}`).join('  |  '), 82, recordY + 10, { width: contentWidth - 46, height: 32, ellipsis: true });
        document.moveDown(3);
      });
    }

    const pages = document.bufferedPageRange();
    for (let index = 0; index < pages.count; index += 1) {
      document.switchToPage(index);
      document.fillColor('#9a9aa3').fontSize(8).text(`ZamTransport  •  Confidential`, 48, document.page.height - 32, { width: 260 });
      document.text(`Page ${index + 1} of ${pages.count}`, document.page.width - 108, document.page.height - 32, { width: 60, align: 'right' });
    }
    document.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}
async function cleanup() { await fs.promises.mkdir(REPORT_DIR, { recursive: true }); const cutoff = new Date(Date.now() - 30 * 86400000); const old = await prisma.report.findMany({ where: { createdAt: { lt: cutoff } }, select: { id: true, storagePath: true } }); await Promise.all(old.map(async (report) => { if (report.storagePath) await fs.promises.unlink(report.storagePath).catch(() => {}); })); if (old.length) await prisma.report.deleteMany({ where: { id: { in: old.map((r) => r.id) } } }); }
async function generate(input, generatedById) { const type = String(input.reportType || '').toUpperCase(); const format = String(input.format || '').toUpperCase(); if (!TYPES.includes(type)) throw new AppError(400, `reportType must be one of: ${TYPES.join(', ')}.`, 'VALIDATION_ERROR'); if (!FORMATS.includes(format)) throw new AppError(400, 'format must be PDF, XLSX, or CSV.', 'VALIDATION_ERROR'); const range = analytics.dateRange(input); const filters = { routeId: safeInteger(input.routeId, 'routeId'), driverId: safeInteger(input.driverId, 'driverId'), vehicleId: safeInteger(input.vehicleId, 'vehicleId') }; await cleanup(); const report = await prisma.report.create({ data: { type, format, generatedById, startDate: range.start, endDate: new Date(range.end.getTime() - 86400000), filters } }); const extension = format.toLowerCase(); const fileName = `${type.toLowerCase()}-${report.id}.${extension}`; const storagePath = path.join(REPORT_DIR, fileName); try { const data = await reportData(type, range, filters); if (format === 'CSV') await writeCsv(storagePath, data); else if (format === 'XLSX') await writeXlsx(storagePath, title(type), range, data); else await writePdf(storagePath, title(type), range, data); return prisma.report.update({ where: { id: report.id }, data: { storagePath, fileName, status: 'COMPLETED' } }); } catch (error) { await prisma.report.update({ where: { id: report.id }, data: { status: 'FAILED', errorMessage: error.message } }); throw error; } }
function downloadPath(report) { if (report.status !== 'COMPLETED' || !report.storagePath || !path.resolve(report.storagePath).startsWith(`${REPORT_DIR}${path.sep}`)) throw new AppError(404, 'Report file is unavailable.', 'REPORT_UNAVAILABLE'); return report.storagePath; }
module.exports = { TYPES, FORMATS, generate, downloadPath };
