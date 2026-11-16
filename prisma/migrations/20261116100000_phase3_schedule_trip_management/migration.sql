-- Phase 3 schedule and trip management additions.
ALTER TABLE "trips" DROP CONSTRAINT "trips_driverId_fkey";
ALTER TABLE "trips" DROP CONSTRAINT "trips_vehicleId_fkey";

ALTER TABLE "schedules" ADD COLUMN "description" TEXT;
ALTER TABLE "trips"
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledById" INTEGER,
  ADD COLUMN "delayReason" TEXT,
  ADD COLUMN "revisedArrival" TIMESTAMP(3),
  ADD COLUMN "revisedDeparture" TIMESTAMP(3),
  ALTER COLUMN "vehicleId" DROP NOT NULL,
  ALTER COLUMN "driverId" DROP NOT NULL;

CREATE TABLE "trip_assignments" (
  "id" SERIAL NOT NULL,
  "tripId" INTEGER NOT NULL,
  "driverId" INTEGER NOT NULL,
  "vehicleId" INTEGER NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "trip_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "trip_status_history" (
  "id" TEXT NOT NULL,
  "tripId" INTEGER NOT NULL,
  "fromStatus" "TripStatus",
  "toStatus" "TripStatus" NOT NULL,
  "changedById" INTEGER,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trip_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trip_assignments_tripId_assignedAt_idx" ON "trip_assignments"("tripId", "assignedAt");
CREATE INDEX "trip_assignments_driverId_endedAt_idx" ON "trip_assignments"("driverId", "endedAt");
CREATE INDEX "trip_assignments_vehicleId_endedAt_idx" ON "trip_assignments"("vehicleId", "endedAt");
CREATE INDEX "trip_status_history_tripId_createdAt_idx" ON "trip_status_history"("tripId", "createdAt");
CREATE INDEX "trip_status_history_changedById_createdAt_idx" ON "trip_status_history"("changedById", "createdAt");
CREATE INDEX "schedules_status_effectiveFrom_effectiveUntil_idx" ON "schedules"("status", "effectiveFrom", "effectiveUntil");
CREATE UNIQUE INDEX "trips_scheduleId_scheduledDeparture_key" ON "trips"("scheduleId", "scheduledDeparture");

ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trip_assignments" ADD CONSTRAINT "trip_assignments_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_assignments" ADD CONSTRAINT "trip_assignments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_assignments" ADD CONSTRAINT "trip_assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_status_history" ADD CONSTRAINT "trip_status_history_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_status_history" ADD CONSTRAINT "trip_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
