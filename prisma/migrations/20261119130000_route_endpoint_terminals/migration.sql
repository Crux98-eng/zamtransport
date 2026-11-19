ALTER TABLE "routes"
  ADD COLUMN "originStopId" INTEGER,
  ADD COLUMN "destinationStopId" INTEGER;

CREATE INDEX "routes_originStopId_idx" ON "routes"("originStopId");
CREATE INDEX "routes_destinationStopId_idx" ON "routes"("destinationStopId");

ALTER TABLE "routes"
  ADD CONSTRAINT "routes_originStopId_fkey"
  FOREIGN KEY ("originStopId") REFERENCES "stops"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "routes"
  ADD CONSTRAINT "routes_destinationStopId_fkey"
  FOREIGN KEY ("destinationStopId") REFERENCES "stops"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
