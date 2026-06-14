-- AlterTable
ALTER TABLE "Release" ADD COLUMN     "failCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "installCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rolledBackAt" TIMESTAMP(3),
ADD COLUMN     "rolledBackFrom" TEXT,
ADD COLUMN     "rolloutPercent" INTEGER NOT NULL DEFAULT 100,
ALTER COLUMN "version" DROP DEFAULT;
DROP SEQUENCE "Release_version_seq";

-- CreateTable
CREATE TABLE "DeviceInstall" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceInstall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceInstall_releaseId_deviceId_key" ON "DeviceInstall"("releaseId", "deviceId");

-- AddForeignKey
ALTER TABLE "DeviceInstall" ADD CONSTRAINT "DeviceInstall_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
