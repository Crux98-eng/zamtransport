require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.systemSetting.upsert({ where: { key: 'application.timezone' }, update: { value: 'Africa/Lusaka' }, create: { key: 'application.timezone', value: 'Africa/Lusaka', description: 'Display timezone for the Zambia Transport application.' } });
  const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (existingAdmin) {
    if (process.env.RESET_ADMIN_PASSWORD !== 'true') return console.log('Administrator bootstrap already completed; no account was changed.');
    if (!process.env.ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD is required when RESET_ADMIN_PASSWORD=true.');
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await prisma.$transaction(async (db) => { await db.user.update({ where: { id: existingAdmin.id }, data: { passwordHash } }); await db.refreshToken.updateMany({ where: { userId: existingAdmin.id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'ADMIN_PASSWORD_RESET' } }); await db.auditLog.create({ data: { actorId: existingAdmin.id, targetUserId: existingAdmin.id, action: 'ADMIN_PASSWORD_RESET' } }); }, { maxWait: 10000, timeout: 30000 });
    return console.log('Administrator password reset explicitly.');
  }
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Admin bootstrap requires ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD environment variables. No administrator was created.');
  const email = ADMIN_EMAIL.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new Error('ADMIN_EMAIL already belongs to a non-administrator account. Bootstrap was not performed.');
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await prisma.$transaction(async (db) => { const admin = await db.user.create({ data: { fullName: ADMIN_NAME.trim(), email, passwordHash, role: 'ADMIN', status: 'ACTIVE', approvedAt: new Date() } }); await db.auditLog.create({ data: { actorId: admin.id, targetUserId: admin.id, action: 'ADMIN_BOOTSTRAPPED' } }); }, { maxWait: 10000, timeout: 30000 });
  console.log('Initial administrator created.');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
