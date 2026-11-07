-- Owner only. Deploy RESERVED_SUBDOMAINS first. Run psql with ON_ERROR_STOP,
-- --single-transaction and quiz_secret_hash containing the SHA-256 hex digest.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.member_pages WHERE slug = 'quiz') THEN
    RAISE EXCEPTION 'quiz is already assigned to a member page';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_oauth_clients WHERE client_id = 'quiz') THEN
    RAISE EXCEPTION 'quiz is already registered; inspect it rather than replacing its secret';
  END IF;
END
$$;

WITH inserted AS (
  INSERT INTO public.game_oauth_clients
    (client_id, audience, redirect_uri, client_secret_hash, enabled)
  VALUES ('quiz', 'urn:teamham:game:quiz',
    'https://quiz.teamham.world/api/auth/callback', :'quiz_secret_hash', TRUE)
  RETURNING client_id
)
SELECT 1 / count(*)::integer AS exactly_one_inserted FROM inserted;
