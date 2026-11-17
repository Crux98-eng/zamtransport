async function audit(db, { actorId, targetUserId, action, metadata, ipAddress, userAgent, resourceType, resourceId, success = true }) {
  return db.auditLog.create({
    data: { actorId, targetUserId, action, metadata, ipAddress, userAgent, resourceType, resourceId: resourceId === undefined ? undefined : String(resourceId), success },
  });
}

module.exports = { audit };
