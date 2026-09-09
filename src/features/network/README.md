# John's integration module

Start with [John's guide](../../../docs/pointers/john/README.md). J0 supplies the app and checks; J1 still needs an authoritative-runtime proof with Happy.

Keep browser connection code separate from server-only identity, storage, and command processing when those are introduced. Only intentionally public view data may cross that boundary. Do not add credentials or pretend that an in-browser mock is authoritative networking.

The `/workbench/network` page is onboarding only. No Supabase account, database, or transport has been configured.
