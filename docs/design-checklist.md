# Design and acceptance checklist

Use only categories relevant to the proposed change. Read existing contracts,
nearby examples, nested project instructions, and tests before asking questions.
Record consequential decisions and explicit exclusions in the approved spec.

## Intake and contract decisions (Shift-Left Pushback)

- Push back (`needs_clarification`) in `$factory-intake` whenever the owner's input is vague, skips failure behavior, or leaves applicable 4-Part Edge-Case Matrix questions unanswered.
- Identify users, essential journeys, failure behavior, and measurable done conditions. Decide which checks require real services, browsers or devices.
- For stateful/event systems, establish duplicate and out-of-order behavior,
  concurrency ownership, retry/idempotency rules, clocks/timezones, retention,
  deletion, and cross-service atomicity or recovery where applicable.
- Pin interfaces shared by parallel tasks: schemas, API/error contracts,
  migrations, invariants, authorization boundaries, and compatibility/versioning.
  OpenAPI, SQL migrations and healthchecks are examples, not required stacks.
- Define service lifecycle, disposable test data, secrets provisioning, and
  cleanup. Do not use shared production data for destructive validation.
- Map each acceptance criterion to an observable check and evidence. Include
  representative negative cases, loading/empty/error states, accessibility and
  security checks where they affect the feature. Record unsupported platforms.
- Give each builder ownership, dependencies, pinned contract revision, and
  stop conditions. Agree on integration order and rerun checks on the combined
  candidate. Preserve the source intake separately from decisions.

## Bug and review finding procedure

1. Reproduce the reported behavior and record expected versus actual results.
   Where practical, add a focused regression test within authorized test paths
   and confirm it fails for the relevant reason before editing implementation.
2. Identify the cause and make the smallest coherent repair. For unavailable
   live services, record the gap; a substitute test does not verify the service.
3. Run the regression and affected checks, then the integrated verification.
   Do not weaken acceptance controls or fixtures to pass. Protected control
   edits require separate review even when the owner authorized a bug fix.
4. Return reproduction evidence, candidate identity, changed paths, results,
   and remaining uncertainty. Review substantive fixes independently.

These are workflow instructions. They do not create a signed specification,
sealed acceptance environment, test-first enforcement, or a distributed queue.
