# Network

Shared, browser-safe types and the client side of the realtime connection.

- `protocol.ts`: the WebSocket messages and HTTP API shapes, room code format, close codes and the CSRF header name. Types and constants only.
- `connection.ts`: the `RoomConnection` interface screens consume (status, latest view, `stale`, `send`). Screens take it as a prop so previews and tests can pass a mock.
- `client/use-room-connection.ts`: the real hook. It reconnects with backoff, keeps only the newest revision, resends unacknowledged commands with the same id, estimates server clock offset, and stops reconnecting after an intentional `closing` message.
- `client/api.ts`: typed fetch helpers for every HTTP endpoint, sending the CSRF header from the session.

The server side lives in `src/server`. Only intentionally public view data crosses this boundary; never import server code from here.
