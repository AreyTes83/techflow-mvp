-- Repair seed users so Email+Password login works on hosted Supabase (GoTrue).
-- Run AFTER: migrations 001–003 AND seed `001_seed.sql`.
--
-- Why: inserting only into auth.users is often NOT enough — you typically need rows in auth.identities
-- and matching auth.users.instance_id.

-- 1) Point all seed users at the project's auth instance id
-- On many hosted projects `auth.instances` is empty; a bare subquery then sets NULL and breaks login.
-- Fall back to the nil UUID that matches seed inserts when no instance row exists.
UPDATE auth.users u
SET instance_id = COALESCE(
  (SELECT id FROM auth.instances ORDER BY created_at ASC LIMIT 1),
  '00000000-0000-0000-0000-000000000000'::uuid
)
WHERE u.email IN (
  'manager@techflow.local',
  'tech@techflow.local',
  'store@techflow.local',
  'store2@techflow.local'
);

-- 2) Ensure email identities exist (provider = 'email')
INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  u.id::text AS provider_id,
  u.id AS user_id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email
  ) AS identity_data,
  'email' AS provider,
  now(),
  now(),
  now()
FROM auth.users u
WHERE u.email IN (
  'manager@techflow.local',
  'tech@techflow.local',
  'store@techflow.local',
  'store2@techflow.local'
)
AND NOT EXISTS (
  SELECT 1
  FROM auth.identities i
  WHERE i.user_id = u.id
    AND i.provider = 'email'
);

-- 3) GoTrue scans token columns as strings; NULL → 500 "Database error querying schema"
-- (see Auth logs: confirmation_token converting NULL to string is unsupported)
UPDATE auth.users u
SET
  confirmation_token = COALESCE(u.confirmation_token, ''),
  recovery_token = COALESCE(u.recovery_token, ''),
  email_change_token_new = COALESCE(u.email_change_token_new, ''),
  email_change_token_current = COALESCE(u.email_change_token_current, ''),
  email_change = COALESCE(u.email_change, '')
WHERE u.email IN (
  'manager@techflow.local',
  'tech@techflow.local',
  'store@techflow.local',
  'store2@techflow.local'
);
