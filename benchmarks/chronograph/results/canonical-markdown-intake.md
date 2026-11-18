# Canonical Markdown intake

On November 17, 2026 (America/Los_Angeles), a fresh native architect received the [canonical Markdown](../input/original.md) and generic intake instructions. The handoff matched the supplied file byte-for-byte. The architect was given no evaluator material or earlier results.

The architect returned **`needs_clarification`**, with 12 questions, 11 blocking. The questions covered temporal and recording-time semantics, late and same-time conflicts, retry identity, concurrent ingestion, projection recovery, historical visibility, retractions, extraction and API contracts, reset recovery, and required Compose/E2E checks. The sole nonblocking question concerned playback behavior. The benchmark stopped at intake. This was a live native architect smoke test.

## Headless CLI

The automated CLI regression verified that `benchmark` selects the canonical Markdown and passes its exact bytes to the architect as `intake.txt`. An initial live attempt inside the tool sandbox stopped before model execution because the nested Codex app server could not initialize.

The owner's terminal run `a02fd2d15cdd47698df5509ea7dc2918` completed in 81.45 seconds with exit code 0 and a **`needs_clarification`** report containing 13 questions, all blocking. It used the configured default model. The saved intake matched the canonical fixture byte-for-byte, and the intake workspace contained only `intake.txt` and Git metadata. The generic prompt SHA-256 was `6dd02e13538d4062814e6346cbfb8bad64809081c75bbf9d74ed0452e12283fc`. No formal rubric score was recorded.
