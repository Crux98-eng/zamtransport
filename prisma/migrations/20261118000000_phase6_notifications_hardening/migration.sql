ALTER TABLE "refresh_tokens" ADD COLUMN "lastUsedAt" TIMESTAMP(3), ADD COLUMN "ipAddress" VARCHAR(64), ADD COLUMN "userAgent" VARCHAR(500);
ALTER TABLE "audit_logs" ADD COLUMN "resourceType" VARCHAR(100), ADD COLUMN "resourceId" VARCHAR(100), ADD COLUMN "userAgent" VARCHAR(500), ADD COLUMN "success" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notifications" ADD COLUMN "readAt" TIMESTAMP(3), ADD COLUMN "dedupeKey" VARCHAR(191);
CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "notifications"("dedupeKey");
CREATE INDEX "notifications_type_createdAt_idx" ON "notifications"("type", "createdAt");
CREATE INDEX "audit_logs_resourceType_resourceId_createdAt_idx" ON "audit_logs"("resourceType", "resourceId", "createdAt");

CREATE TABLE "notification_preferences" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "mutedTypes" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_preferences_userId_key" UNIQUE ("userId"),
  CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
