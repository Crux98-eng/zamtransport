require('dotenv').config();

const bcrypt = require('bcryptjs');
const { PrismaClient, UserRole, UserStatus } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  await prisma.systemSetting.upsert({
    where: { key: 'application.timezone' },
    update: { value: 'Africa/Lusaka' },
    create: {
      key: 'application.timezone',
      value: 'Africa/Lusaka',
      description: 'Display timezone for the Zambia Transport application.',
    },
  });

  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    console.log('Timezone setting seeded. Set SEED_ADMIN_PASSWORD to seed the initial administrator.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email: 'admin@zambiatransport.local' },
    update: {},
    create: {
      fullName: 'System Administrator',
      email: 'admin@zambiatransport.local',
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
}

main()
  .then(() => console.log('Database seed completed.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
