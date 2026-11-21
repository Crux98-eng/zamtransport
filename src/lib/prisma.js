// A shared Prisma client avoids creating a separate database connection pool
// for every module. Import this file wherever database access is needed.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
module.exports = prisma;
