# HAM Quiz registration, owner managed

These are instructions for the TeamHam.world owner. The backend implementation does not change the central repository, register a client, touch production or deploy anything.

1. In the central TeamHam.world project, add `quiz` to `RESERVED_SUBDOMAINS` and deploy that reservation before creating DNS or registering the client. Check that no existing member page owns the slug. Stop and resolve any collision.
2. Generate a client secret in a private administrative terminal, using the same pattern as Pusoy:

   ```sh
   node -e "const c=require('node:crypto');const s='ths_'+c.randomBytes(32).toString('base64url');console.log('Secret:',s);console.log('SHA-256:',c.createHash('sha256').update(s).digest('hex'))"
   ```

   The plaintext goes only into the game server's private `HAM_CLIENT_SECRET` environment setting or secret manager. Do not paste either value into chat, source, PRs or logs. The central database receives only the SHA-256 hex digest. Clear the terminal and temporary files under the owner's secret-handling policy.
3. Inspect [deploy/register-quiz.sql](../deploy/register-quiz.sql). It refuses an existing member slug or client instead of silently changing a registered secret. As the owner database role, run it with `psql -v ON_ERROR_STOP=1 --single-transaction`, setting `quiz_secret_hash` through a private mechanism to the digest. The insert must report exactly one row. Do not use the restricted runtime role for registration.
4. Verify the registration contains these public values:

   | Field | Value |
   | --- | --- |
   | `client_id` | `quiz` |
   | `audience` | `urn:teamham:game:quiz` |
   | `redirect_uri` | `https://quiz.teamham.world/api/auth/callback` |
   | `enabled` | `true` |

   Set server `HAM_ISSUER=https://teamham.world`, `HAM_CLIENT_ID=quiz`, `HAM_MODE=live`, `APP_ENV=production`, and `PUBLIC_ORIGIN=https://quiz.teamham.world`. The audience and callback are derived by the backend. No browser code receives the client secret or access token.
5. Generate an independent `TOKEN_ENCRYPTION_KEY` with `openssl rand -hex 32` and store it privately alongside the client secret. It encrypts the game's stored HAM tokens and PKCE verifiers. Preserve it with encrypted backups.
6. Follow [deployment](DEPLOYMENT.md). Verify a real OAuth round trip, issuer/audience validation, fresh introspection, central sign-out revocation, and a superseding login. No fixture result substitutes for this gate.

For rotation, follow the central `GAME_BACKEND_AUTHORIZATION.md` runbook: generate a new secret, transactionally update exactly one client's hash and `updated_at`, then update the server secret and restart. For retirement, disable the client and revoke its tokens/codes first, stop the game next, and remove DNS last. Never automatically overwrite registration during application startup.
