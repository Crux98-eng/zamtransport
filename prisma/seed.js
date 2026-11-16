require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.systemSetting.upsert({ where: { key: 'application.timezone' }, update: { value: 'Africa/Lusaka' }, create: { key: 'application.timezone', value: 'Africa/Lusaka', description: 'Display timezone for the Zambia Transport application.' } });
  const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (existingAdmin) return console.log('Administrator bootstrap already completed; no account was changed.');
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) return console.log('Timezone setting seeded. Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD to bootstrap the first administrator.');
  const email = ADMIN_EMAIL.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new Error('ADMIN_EMAIL already belongs to a non-administrator account. Bootstrap was not performed.');
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await prisma.$transaction(async (db) => { const admin = await db.user.create({ data: { fullName: ADMIN_NAME.trim(), email, passwordHash, role: 'ADMIN', status: 'ACTIVE', approvedAt: new Date() } }); await db.auditLog.create({ data: { actorId: admin.id, targetUserId: admin.id, action: 'ADMIN_BOOTSTRAPPED' } }); });
  console.log('Initial administrator created.');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
