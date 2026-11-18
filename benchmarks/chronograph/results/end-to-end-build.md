# ChronoGraph end-to-end build run

On November 17, 2026 (America/Los_Angeles), the owner approved building the canonical ChronoGraph handoff as a disposable local application. The terminal intake result `a02fd2d15cdd47698df5509ea7dc2918` supplied the blocking decisions. The project records the approved answers separately from the verbatim source.

The application lives in the separate Git repository at `dist/chronograph-e2e` in this checkout. The benchmark baseline is `ed9a7ffbba6976a653d3ee3b8c1c9acacb239d9f`. The factory prepared the acceptance mapping, reported preflight ready, and activated task `chronograph`. App implementation was limited to `api` and `web`.

## Observed acceptance

- Integrated run `0ce9ee53beb74bb8bea7794dcb51f8af` passed Docker Compose and Chromium. It exercised the four demo episodes, historical graph and browser lineage, browser ingestion, effective and recording time, invalid input and timestamp conflicts, retry identity, retraction, and automatic Neo4j recovery after isolating Bolt traffic. The factory cleaned up the acceptance stack.
- Deliberate regression run `58eca2d7f8034769b19a4e8920cf79a2` changed one seed IP in a disposable copy. The protected suite rejected the change with the expected `10.0.0.12` versus actual `10.0.0.13` assertion and cleaned up. The seed source was subsequently restored.
- Python timeline tests reproduced a retraction that a late corroborating observation could undo, then passed after the fix. A second test confirms retraction does not close a different replacement fact.
- A separate Compose project serves the seeded preview on `127.0.0.1:3317`. Host requests confirmed the UI, both datastores, seed and historical API through that port. The in-app browser displayed the graph and the selected IP replacement lineage. The override configuration was checked with `UI_PORT=3318`.

## Independent review and repair

The first candidate's gate and reviewer ran under `2498422f2f2e4caeafcd153178720766`. The reviewer identified a recording-time race, a graph-rendering crash for inherited JavaScript property names, projection queue poisoning by oversized names, invalid episode input handling, and incomplete browser provenance.

A separate coordinator commit strengthened the protected checks and enabled PostgreSQL commit timestamps. The repair task used that commit as its frozen base. The new suite failed on the pre-fix app in `09981ae9fee844148b1101e229e0e109`, which accepted an oversized name as `201` instead of rejecting it as `422`. The corrected app commit `90f3caad56d38d1cff8a8cad93b8a8e04bf6d8a8` passed the strengthened gate in `1b15880fc56746cdbd20d24ac9470d8d`. The suite forced a write to overlap a recording-time cutoff and checked that the historical result excluded the later commit.

The second CLI review surfaced an exact-timestamp retraction issue, hidden provenance for reasserted edges, and ordering risk if PostgreSQL's clock moves backward. A new temporal unit test reproduced the retraction issue. Commit `88036d42a89ea25b72843499625956cbca9bddfd` retains recording order for equal effective times, uses an edge's own chain or provenance, and selects live revisions by ID. Explicit recording-time cutoffs select the latest complete prefix of serialized commits. A focused independent native re-review found no remaining material findings in those three fixes. It did not simulate a live clock rollback.

The final candidate passed all four temporal unit tests and the full protected Compose and Chromium gate in `8d19ee515aed426faa3b07682958e8b6`. The CLI handoff is saved at `dist/chronograph-e2e/.git/chronograph-handoff.md`. The final verification record and the focused native review are separate. The preview was refreshed to the same app commit and its historical IP remained `10.0.0.12`. This run used explicit task activation and verification. Automatic Desktop Stop-hook dispatch was outside this run.

## Reproduce locally

From the factory root, rerun the protected check against the retained app checkout:

```sh
npm run factory -- verify --repo dist/chronograph-e2e \
  --task dist/chronograph-e2e/tasks/chronograph-review.json \
  --acceptance dist/chronograph-e2e/.git/review-acceptance.json
```

To restart the interactive preview on another port, change into `dist/chronograph-e2e`:

```sh
UI_PORT=3318 docker compose --project-name chronograph-benchmark-ui \
  -f compose.yaml -f compose.ui.yaml up -d --wait --build db graph api web
```
