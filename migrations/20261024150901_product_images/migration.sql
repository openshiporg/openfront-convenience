BEGIN;

-- Product photos, using E-commerce's ProductImage list shape (Keystone image
-- storage "my_images" on the existing S3 bucket). Generated with migrate:gen
-- against the scratch database and reduced to the new tables; the draft also
-- proposed join-table key changes that are pre-existing drift, not part of this.

CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "altText" TEXT NOT NULL DEFAULT '',
    "order" INTEGER DEFAULT 0,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_Product_images" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE INDEX "ProductImage_business_idx" ON "ProductImage"("business");

CREATE UNIQUE INDEX "_Product_images_AB_unique" ON "_Product_images"("A", "B");

CREATE INDEX "_Product_images_B_index" ON "_Product_images"("B");

ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "_Product_images" ADD CONSTRAINT "_Product_images_A_fkey" FOREIGN KEY ("A") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_Product_images" ADD CONSTRAINT "_Product_images_B_fkey" FOREIGN KEY ("B") REFERENCES "ProductImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
