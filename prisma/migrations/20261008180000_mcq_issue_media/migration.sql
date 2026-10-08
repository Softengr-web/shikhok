ALTER TABLE "McqImportIssue"
ADD COLUMN "mediaIds" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "McqMedia"
ALTER COLUMN "data" DROP NOT NULL,
ADD COLUMN "objectKey" TEXT;

CREATE INDEX "McqMedia_objectKey_idx" ON "McqMedia"("objectKey");
