# GameBuddy offline evaluation

Run from `backend`:

```powershell
python scripts/run_eval.py --output ../artifacts/offline-eval.json
```

The same harness is available in `/ops/`. A run is pinned to an immutable policy version, stores individual outcomes and forces the external model off even when a key is configured. Evaluation requests do not populate user history or request traces.

The 12 checks cover three known structured situations, Chinese retrieval, an uncovered query, cited Q&A, Q&A abstention, a zero-resource RPG build, review event provenance, the local policy action budget, personalization, and invalid numeric input. Provider timeout, response validation, two-round function calling and MongoDB replication/failure are covered separately by mocked integration tests.

Passing these checks means the listed contracts held on these fixed examples. It does not estimate gameplay decision accuracy, user satisfaction, human preference, robustness on arbitrary games or training gains. Relevance scores are ranking scores, not confidence probabilities.

## Historical artifacts

`evaluation-results.json` and `backend/scripts/evaluate_response_quality.py` are retained as historical heuristic diagnostics. Their keyword coverage and synthetic baseline comparisons are not independently validated accuracy or interaction-experience metrics. Do not use the percentages as resume performance claims. The current harness does not regenerate that report.
