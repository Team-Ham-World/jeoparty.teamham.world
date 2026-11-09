# Authorization decision

The project owner approved the hybrid policy in the 2026-11-07 backend security-fix brief.

The normative sources are `teamham.world/docs/GAME_OAUTH.md`, "Identity contract" and "Authorization flow", step 6; and `organization-docs/website/reference/GAME_BACKEND_AUTHORIZATION.md`, §1.3 decision 10 ("Per-Request Introspection") and §3 steps 7-8 ("Game BFF Local Session & Introspection"). Decision 10 forbids positive introspection caching in v1 without measured production performance need. HAM checks central session continuity, membership and expiry on introspection.

HAM Quiz follows that rule for every signed-in HTTP API request, WebSocket admission and `startGame`. It deliberately deviates for commands on an already-open authenticated game socket: those may use a lease lasting at most 30 seconds from the start of the last successful introspection, capped by token expiry. This deviation is owner-approved to keep buzz handling independent of a HAM network round trip. It is a latency tradeoff, not a claim of measured production necessity or full compliance with decision 10 for in-socket commands.

Renewal starts before the lease expires. An inactive/revoked response revokes the local session and closes its sockets with `authExpired`; a replacement local login closes them with `signedInElsewhere`. An outage never extends a lease. At expiry, commands and views stop and sockets close. HTTP fails closed immediately with `503 authUnavailable` on provider failure, including logout. Display sockets use independent, room-bound grants and cannot issue commands.

This accepts a maximum 30-second revocation-detection delay for an existing socket. Removing this exception would require fresh introspection for each game command and another owner decision about buzz latency.
