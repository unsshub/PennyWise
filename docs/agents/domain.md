# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** (and **`CONTEXT.md`**) at the repo root.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.

## File structure

Single-context repo:

```
/
├── GLOSSARY.md
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-expo-local-first-architecture.md
│   ├── 0002-multi-currency-snapshot-and-live-rates.md
│   └── 0003-exact-monetary-precision-across-fiat-and-crypto.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding.
