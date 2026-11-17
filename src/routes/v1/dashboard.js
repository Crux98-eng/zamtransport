const express = require('express');
const prisma = require('../../lib/prisma');
const AppError = require('../../errors/app-error');
const { authenticate, authorize } = require('../../middlewares/auth');
const asyncHandler = require('../../utils/async-handler');
const analytics = require('../../services/analytics');
const reports = require('../../services/reports');

const adminRouter = express.Router();
adminRouter.use(authenticate, authorize('ADMIN'));
const id = (value, name) => { const result = Number.parseInt(value, 10); if (!Number.isInteger(result) || result < 1) throw new AppError(400, `Invalid ${name}.`, 'VALIDATION_ERROR'); return result; };
const page = (query) => ({ page: Math.max(1, Number.parseInt(query.page, 10) || 1), limit: Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20)) });
function filters(query) { return { ...(query.routeId ? { routeId: id(query.routeId, 'routeId') } : {}), ...(query.driverId ? { driverId: id(query.driverId, 'driverId') } : {}), ...(query.vehicleId ? { vehicleId: id(query.vehicleId, 'vehicleId') } : {}) }; }
function sorted(rows, query, fields) { const sortBy = query.sortBy || 'totalTrips'; if (!fields.includes(sortBy)) throw new AppError(400, `sortBy must be one of: ${fields.join(', ')}.`, 'VALIDATION_ERROR'); const direction = String(query.sortOrder || 'desc').toLowerCase(); if (!['asc', 'desc'].includes(direction)) throw new AppError(400, 'sortOrder must be asc or desc.', 'VALIDATION_ERROR'); return [...rows].sort((a, b) => { const av = a[sortBy] ?? 0; const bv = b[sortBy] ?? 0; return (av > bv ? 1 : av < bv ? -1 : 0) * (direction === 'asc' ? 1 : -1); }); }
function paginate(rows, query) { const value = page(query); return { items: rows.slice((value.page - 1) * value.limit, value.page * value.limit), pagination: { ...value, total: rows.length, totalPages: Math.ceil(rows.length / value.limit) } }; }

adminRouter.get('/dashboard/overview', asyncHandler(async (_request, response) => response.json({ success: true, data: await analytics.overview() })));
adminRouter.get('/dashboard/trips', asyncHandler(async (request, response) => response.json({ success: true, data: await analytics.tripsAnalytics(analytics.dateRange(request.query), filters(request.query)) })));
adminRouter.get('/dashboard/fleet', asyncHandler(async (request, response) => response.json({ success: true, data: await analytics.fleetAnalytics(analytics.dateRange(request.query)) })));
adminRouter.get('/dashboard/drivers', asyncHandler(async (request, response) => { const range = analytics.dateRange(request.query); const data = await analytics.driverAnalytics(range); response.json({ success: true, data: { period: range, ...paginate(sorted(data.drivers, request.query, ['totalTrips', 'completedTrips', 'cancelledTrips', 'delayedTrips', 'completionPercentage', 'totalDistanceKm']), request.query) } }); }));
adminRouter.get('/dashboard/routes', asyncHandler(async (request, response) => response.json({ success: true, data: await analytics.routeAnalytics(analytics.dateRange(request.query)) })));
adminRouter.get('/dashboard/operations', asyncHandler(async (_request, response) => response.json({ success: true, data: await analytics.operations() })));

adminRouter.get('/analytics/drivers', asyncHandler(async (request, response) => { const range = analytics.dateRange(request.query); const data = await analytics.driverAnalytics(range); response.json({ success: true, data: { period: range, ...paginate(sorted(data.drivers, request.query, ['totalTrips', 'completedTrips', 'cancelledTrips', 'delayedTrips', 'completionPercentage', 'totalDistanceKm']), request.query) } }); }));
adminRouter.get('/analytics/drivers/:driverId', asyncHandler(async (request, response) => response.json({ success: true, data: await analytics.driverAnalytics(analytics.dateRange(request.query), id(request.params.driverId, 'driver ID')) })));
adminRouter.get('/analytics/vehicles', asyncHandler(async (request, response) => { const range = analytics.dateRange(request.query); const data = await analytics.vehicleAnalytics(range); response.json({ success: true, data: { period: range, ...paginate(sorted(data.vehicles, request.query, ['totalTrips', 'completedTrips', 'cancelledTrips', 'utilizationPercent', 'totalDistanceKm']), request.query) } }); }));
adminRouter.get('/analytics/vehicles/:vehicleId', asyncHandler(async (request, response) => response.json({ success: true, data: await analytics.vehicleAnalytics(analytics.dateRange(request.query), id(request.params.vehicleId, 'vehicle ID')) })));
adminRouter.get('/analytics/routes', asyncHandler(async (request, response) => { const range = analytics.dateRange(request.query); const data = await analytics.routeAnalytics(range); response.json({ success: true, data: { period: range, ...paginate(sorted(data.routes, request.query, ['totalTrips', 'completedTrips', 'cancelledTrips', 'delayedTrips', 'completionPercentage', 'averageJourneyDurationMinutes']), request.query) } }); }));
adminRouter.get('/analytics/routes/:routeId', asyncHandler(async (request, response) => response.json({ success: true, data: await analytics.routeAnalytics(analytics.dateRange(request.query), id(request.params.routeId, 'route ID')) })));

adminRouter.post('/reports/generate', asyncHandler(async (request, response) => { const report = await reports.generate(request.body || {}, request.user.id); response.status(201).json({ success: true, data: { report } }); }));
adminRouter.get('/reports', asyncHandler(async (request, response) => { const value = page(request.query); const type = request.query.reportType && String(request.query.reportType).toUpperCase(); if (type && !reports.TYPES.includes(type)) throw new AppError(400, 'Invalid reportType.', 'VALIDATION_ERROR'); const where = type ? { type } : {}; const [items, total] = await Promise.all([prisma.report.findMany({ where, include: { generatedBy: { select: { id: true, fullName: true, email: true } } }, orderBy: { createdAt: 'desc' }, skip: (value.page - 1) * value.limit, take: value.limit }), prisma.report.count({ where })]); response.json({ success: true, data: { reports: items, pagination: { ...value, total, totalPages: Math.ceil(total / value.limit) } } }); }));
adminRouter.get('/reports/:reportId', asyncHandler(async (request, response) => { const report = await prisma.report.findUnique({ where: { id: request.params.reportId }, include: { generatedBy: { select: { id: true, fullName: true, email: true } } } }); if (!report) throw new AppError(404, 'Report not found.', 'NOT_FOUND'); response.json({ success: true, data: { report } }); }));
adminRouter.get('/reports/:reportId/download', asyncHandler(async (request, response) => { const report = await prisma.report.findUnique({ where: { id: request.params.reportId } }); if (!report) throw new AppError(404, 'Report not found.', 'NOT_FOUND'); const file = reports.downloadPath(report); try { await require('node:fs').promises.access(file); } catch (_) { throw new AppError(404, 'Report file is unavailable.', 'REPORT_UNAVAILABLE'); } response.download(file, report.fileName); }));

module.exports = adminRouter;
