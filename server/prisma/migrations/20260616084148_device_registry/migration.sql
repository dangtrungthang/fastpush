-- AlterTable
ALTER TABLE "Release" ADD COLUMN     "targetDeviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "targetMode" TEXT NOT NULL DEFAULT 'all';

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "nativeAppVersion" TEXT,
    "otaVersion" INTEGER,
    "otaHash" TEXT,
    "deviceGroupId" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceGroup" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_appId_serialNumber_key" ON "Device"("appId", "serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceGroup_appId_name_key" ON "DeviceGroup"("appId", "name");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_deviceGroupId_fkey" FOREIGN KEY ("deviceGroupId") REFERENCES "DeviceGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceGroup" ADD CONSTRAINT "DeviceGroup_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
