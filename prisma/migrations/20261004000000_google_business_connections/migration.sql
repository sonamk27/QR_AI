CREATE TABLE "GoogleBusinessConnection" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "locationName" TEXT,
    "locationTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleBusinessConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleBusinessConnection_restaurantId_key"
    ON "GoogleBusinessConnection"("restaurantId");

ALTER TABLE "GoogleBusinessConnection"
    ADD CONSTRAINT "GoogleBusinessConnection_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
