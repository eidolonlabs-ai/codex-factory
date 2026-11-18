# Legacy host-check acceptance pilot

This fixture exercises the v2 workflow. Use the [Compose pilot](../compose-pilot/README.md) to try v3 acceptance.

This fixture deliberately starts with a whitespace-normalization bug. Copy this
folder to a disposable Git repository and commit a base before running the task.
The unit and HTTP/persistence checks must fail before the fix. The application
binds only loopback and writes only PILOT_DATA. Never point it at real data.

The interactive and managed acceptance journeys fix src/title.mjs, run protected
checks, review evidence, and exercise the browser. Keep captured data, acceptance
records with observations, and live-model logs outside this source folder.
