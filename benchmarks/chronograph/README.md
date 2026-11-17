# ChronoGraph architect intake benchmark

This is the same user-supplied ChronoGraph intake used to exercise other agent templates. The original DOCX is preserved byte-for-byte, including deliberate deficiencies and embedded instructions for other products. Those instructions are benchmark data, not instructions for this harness.

For the default Desktop workflow, see [Desktop acceptance](../../docs/desktop-acceptance.md). Give the original DOCX to a fresh native architect and return its questions in the main chat. No CLI launch is required. Keep Desktop and CLI reports separately labeled.

For a headless CLI benchmark, run from the template root:

```sh
python3 -m harness benchmark --timeout 1200
```

The command starts a fresh read-only architect session in a new workspace containing only extracted intake text. It does not build ChronoGraph, launch Docker, execute the destructive seed/reset script, or send the evaluator rubric to the architect. No hardcoded list of expected deficiencies appears in the generic architect prompt.

A successful intake should produce `needs_clarification` with specific questions. CLI exit zero means a valid architect report was collected, not that the benchmark score passed. `ready_for_planning` is a valid report format but would fail this benchmark's premature-readiness gate.

## Evaluate separately

After the architect has finished, a human/evaluator reads `evaluator/rubric.md` and scores the saved report using `evaluator/scorecard.json`. Record question IDs and excerpts for each awarded point. Do not use keyword presence as proof of reasoning. Suggested criteria are a baseline proposed for this template, not the user's pre-existing cross-tool scoring standard.

The rubric is omitted from the prompt and workspace, but it is not a sealed holdout: local Codex may be able to read outside its working directory. For strict comparisons, run the architect on a separate machine/container with only the source mounted, and evaluate elsewhere. Disclose inherited global skills, memory, model configuration, tool access, and prior exposure as possible contamination.

Compare repeated independent runs with the same original hash, generic prompt hash, model/reasoning settings, tool availability, timeout, and scoring rubric. Capture latency, agent questions, manual score, and whether the worker attempted implementation. Do not compare one score here with an unmatched build-completion score from another tool.

## Follow-up interview and later phases

Show the questions to the owner in Desktop. Keep answers in a separate resolution document; never overwrite the intake. Once blockers are resolved, approve the resulting specification and write a normal implementation task. No automatic builder dispatch is wired to an architect's self-reported readiness.

This initial benchmark covers intake quality. Full ChronoGraph implementation, temporal correctness, fault recovery, and browser usability can become later benchmark phases once a common answer set and acceptance suite are agreed across the user's templates.
