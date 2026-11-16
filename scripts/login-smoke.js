require('dotenv').config();

const app = require('../src/app');
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');

async function main() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw new Error('ADMIN_EMAIL or ADMIN_PASSWORD is missing from .env');
  if (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET) throw new Error('ACCESS_TOKEN_SECRET or REFRESH_TOKEN_SECRET is missing from .env');
  const storedUser = await prisma.user.findUnique({ where: { email: process.env.ADMIN_EMAIL.toLowerCase() } });
  console.log(JSON.stringify({ databaseUserFound: Boolean(storedUser), databaseStatus: storedUser?.status, databaseRole: storedUser?.role, passwordMatches: storedUser ? await bcrypt.compare(process.env.ADMIN_PASSWORD, storedUser.passwordHash) : false }));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
    });
    const body = await response.json();
    console.log(JSON.stringify({ status: response.status, success: body.success, message: body.message, code: body.code, userStatus: body.data?.user?.status }));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  await prisma.$disconnect();
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
