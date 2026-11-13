require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const timezone = await prisma.systemSetting.findUnique({
    where: { key: 'application.timezone' },
  });

  if (!timezone) {
    throw new Error('Expected application.timezone setting was not found.');
  }

  console.log(`Database verification passed: application.timezone=${timezone.value}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
