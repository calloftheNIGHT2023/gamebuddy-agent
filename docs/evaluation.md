# GameBuddy Offline Evaluation

This report compares a legacy generic-answer baseline with the current GameBuddy orchestrated path.
The evaluation is deterministic and does not require an external LLM key.

## Aggregate Results

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| accuracy | 0.24 | 0.90 | 280.0% |
| interaction_experience | 0.48 | 0.94 | 97.1% |
| overall | 0.33 | 0.92 | 175.2% |
| personalization | 0.08 | 0.89 | 967.1% |
| actionability | 0.50 | 1.00 | 100.0% |

## Method

- Accuracy: keyword coverage against expected game-specific concepts for each complex scenario.
- Interaction experience: average of schema completeness, actionability, uncertainty disclosure, and personalization fit.
- Personalization: whether the answer reflects user profile fields such as skill level, response style, favorite role or goal.

## Resume-Ready Result

- On 3 complex game-analysis cases, accuracy improved from 0.24 to 0.90 (+280.0%), and interaction experience improved from 0.48 to 0.94 (+97.1%).

Raw case-level data is stored in `docs/evaluation-results.json`.
