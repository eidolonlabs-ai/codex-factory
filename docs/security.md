# Trust and enforcement boundaries

Review a project's instructions, commands, and Compose configuration before invoking the factory. The controller executes verification with the user's OS permissions, including Docker access. Codex sandbox policy governs the agent's tools. Git worktrees separate working copies and share Git metadata.

Trusted native hooks can block covered commands and direct patches in adopted projects. Verification also checks the final candidate against task scope and protected paths. See [hook coverage](hooks.md) and [protection policy](solo-policy.md).

The Compose gate gives each run its own project identity and cleans up its own containers and volumes. Give each application service a healthcheck and use the Compose network for E2E traffic. The gate rejects fixed host ports, host bind mounts, privileged services, external or shared networks/volumes, custom driver options, and explicit image tags on services it builds. A separate execution environment and verifier identity are needed to keep acceptance inputs inaccessible to a builder.

Candidate hashes cover the Git candidate, including unstaged and untracked non-ignored files. Ignored files, external services, mutable image tags, and symlink targets can change independently. Keep trusted inputs under review and rerun acceptance for the candidate you plan to ship.

The Git common directory retains task prompts, check logs, and review evidence. Review artifacts before sharing. For a blind benchmark, isolate evaluator files from the agent's accessible filesystem.
