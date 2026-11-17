-- Phase 4: controlled in-process GPS simulation lifecycle and efficient trip history reads.
CREATE TYPE "SimulationStatus" AS ENUM ('RUNNING', 'STOPPED', 'ERROR');

CREATE TABLE "tracking_simulations" (
  "id" TEXT NOT NULL,
  "tripId" INTEGER NOT NULL,
  "vehicleId" INTEGER NOT NULL,
  "status" "SimulationStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stoppedAt" TIMESTAMP(3),
  "stopReason" VARCHAR(100),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tracking_simulations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tracking_simulations_tripId_key" ON "tracking_simulations"("tripId");
CREATE INDEX "tracking_simulations_status_startedAt_idx" ON "tracking_simulations"("status", "startedAt");
CREATE INDEX "tracking_simulations_vehicleId_status_idx" ON "tracking_simulations"("vehicleId", "status");
CREATE INDEX "vehicle_locations_tripId_recordedAt_idx" ON "vehicle_locations"("tripId", "recordedAt");

ALTER TABLE "tracking_simulations" ADD CONSTRAINT "tracking_simulations_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tracking_simulations" ADD CONSTRAINT "tracking_simulations_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
