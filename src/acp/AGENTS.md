# ACP

- This package is a thin JSON-RPC multiplexer over `grok agent stdio`.
- Catalog methods in `methods.ts`. Prefer those constants over new string
  literals.
- Do not parse Grok session JSONL here; that belongs in `src/main/transcript.ts`.
