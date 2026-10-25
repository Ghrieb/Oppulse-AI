"""The agent's rules.

The rule engine, the next-action derivation and the completeness measure,
ported from the frontend's ``lib/matching.ts``, ``lib/next-action.ts`` and
``lib/completeness.ts``.

The two implementations must agree exactly, so both are pinned by one
expectation file (``contracts/rule-cases.json``): the TypeScript test
asserts the frontend's answers and the Python test asserts the backend's,
against the same cases. A divergence fails both suites, in CI, on the case
that disagrees.
"""
