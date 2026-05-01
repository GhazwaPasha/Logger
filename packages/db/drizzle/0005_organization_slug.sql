ALTER TABLE "organizations" ADD COLUMN "slug" text;

UPDATE "organizations"
SET "slug" = trim(both '-' from lower(regexp_replace(trim("name"), '[^a-zA-Z0-9]+', '-', 'g')))
WHERE "slug" IS NULL;

UPDATE "organizations"
SET "slug" = 'workspace'
WHERE "slug" IS NULL OR "slug" = '';

UPDATE "organizations"
SET "slug" = "slug" || '-' || substring(replace("id"::text, '-', ''), 1, 8);

ALTER TABLE "organizations" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" ("slug");
