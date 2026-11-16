async function audit(db, { actorId, targetUserId, action, metadata, ipAddress }) {
  return db.auditLog.create({
    data: { actorId, targetUserId, action, metadata, ipAddress },
  });
}

module.exports = { audit };
