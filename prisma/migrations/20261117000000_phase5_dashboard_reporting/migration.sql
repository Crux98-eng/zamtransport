CREATE TYPE "ReportType" AS ENUM ('VEHICLE_UTILIZATION', 'DRIVER_PERFORMANCE', 'TRIP_COMPLETION', 'ROUTE_PERFORMANCE', 'TRIP_DELAYS', 'VEHICLE_MAINTENANCE', 'FLEET_OPERATIONAL', 'USER_REGISTRATION');
CREATE TYPE "ReportFormat" AS ENUM ('PDF', 'XLSX', 'CSV');
CREATE TYPE "ReportStatus" AS ENUM ('COMPLETED', 'FAILED');

CREATE TABLE "reports" (
  "id" TEXT NOT NULL,
  "type" "ReportType" NOT NULL,
  "format" "ReportFormat" NOT NULL,
  "status" "ReportStatus" NOT NULL DEFAULT 'COMPLETED',
  "generatedById" INTEGER NOT NULL,
  "startDate" DATE,
  "endDate" DATE,
  "filters" JSONB,
  "storagePath" VARCHAR(500),
  "fileName" VARCHAR(255),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reports_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "reports_generatedById_createdAt_idx" ON "reports"("generatedById", "createdAt");
CREATE INDEX "reports_type_createdAt_idx" ON "reports"("type", "createdAt");
