import { handleHook, type HookEvent } from "./hooks.js";
let input = "";
let event: HookEvent | undefined;
try {
  for await (const part of process.stdin) {
    input += part;
    if (Buffer.byteLength(input) > 1024 * 1024)
      throw new Error("Hook input too large");
  }
  event = JSON.parse(input) as HookEvent;
  if (
    !event ||
    typeof event.cwd !== "string" ||
    typeof event.hook_event_name !== "string"
  )
    throw new Error("Malformed hook event");
  console.log(JSON.stringify(await handleHook(event)));
} catch (e) {
  // Exit 2 is a native explicit block, unlike generic error exit 1 (fail open).
  const reason = `Factory hook failed: ${e instanceof Error ? e.message : e}`;
  if (event?.hook_event_name === "Stop")
    console.log(
      JSON.stringify({
        continue: false,
        stopReason: reason,
        systemMessage:
          "Factory BLOCKED: hook failure is not verified completion.",
      }),
    );
  else {
    console.error(reason);
    process.exitCode = 2;
  }
}
