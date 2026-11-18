# Disposable Compose acceptance pilot

Copy this directory's contents, including dotfiles, to a new disposable Git repository and commit the baseline. With Docker running and image registry access available, verify the copy using the installed factory.

```sh
node "<PLUGIN_ROOT>/scripts/factory.mjs" verify --repo "<PILOT_PATH>"
```

Replace both placeholders with absolute paths. From the template checkout you can also run `npm run factory -- verify --repo "<PILOT_PATH>"`.

The gate builds an API service and a Chromium test service. It checks health, saving and trimming a note, persistence across page reload, invalid input rejection, and API retrieval. The stack uses a unique Compose project for each run, with no published host ports or host bind mounts. Cleanup removes that run's containers and volumes.

To exercise a failure, remove `.trim()` from the disposable copy of `src/title.mjs`, run verification, then restore it and rerun. See the [recorded acceptance runs](../../docs/hooks-acceptance.md) for results.
