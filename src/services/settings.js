const prisma = require('../lib/prisma');
let cache = { until: 0, values: new Map() };
async function all() { if (Date.now() < cache.until) return cache.values; const values = new Map((await prisma.systemSetting.findMany()).map((item) => [item.key, item.value])); cache = { values, until: Date.now() + 10000 }; return values; }
async function get(key, fallback = null) { return (await all()).get(key) ?? fallback; }
function invalidate() { cache.until = 0; }
module.exports = { all, get, invalidate };
