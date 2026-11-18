# Disposable Compose acceptance pilot

Copy this directory into a disposable Git repo and commit the baseline. Run
the installed harness `verify --repo /absolute/pilot`. Docker, Compose and image
registry access are required. The harness creates unique projects and removes
only its own stack. It builds an API app and Chromium E2E test service.

The gate checks service health, browser save/trim/reload persistence, invalid
input rejection, and API retrieval. No host ports or host bind mounts are used.
The fixture is small evidence of the mechanism, not universal production coverage.
To reproduce a failure, remove `.trim()` in src/title.mjs in the disposable copy.
E2E then fails; restore it and reverify. For concurrent workers, assign disjoint
source paths and preserve the Compose/acceptance controls.
