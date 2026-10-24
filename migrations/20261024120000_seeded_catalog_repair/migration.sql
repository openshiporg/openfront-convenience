BEGIN;

-- One-time repair of rows onboarding seeded before the round-1 fix (QA-002,
-- QA-006). Guarded so it only touches rows still in the old shape; every
-- other row, and every install already in the new shape, is left alone.

-- Product descriptions seeded as ProseMirror JSON ({"type":"doc"}) become one
-- Keystone document paragraph with the same text.
UPDATE "Product"
SET "description" = jsonb_build_array(
  jsonb_build_object(
    'type', 'paragraph',
    'children', jsonb_build_array(
      jsonb_build_object(
        'text',
        COALESCE((SELECT string_agg(node #>> '{}', ' ') FROM jsonb_path_query("description", 'strict $.**.text') AS node), '')
      )
    )
  )
)
WHERE jsonb_typeof("description") = 'object' AND "description" ->> 'type' = 'doc';

-- Seeded sample variants track stock (negative allowed until stock is
-- received), as onboarding now seeds them.
UPDATE "ProductVariant"
SET "trackInventory" = true, "allowNegativeInventory" = true
WHERE "metadata" ->> 'demo' = 'true' AND "trackInventory" = false;

COMMIT;
