# WHOOP production envelope regression

`whoop-empty-production.json` preserves the activity, sleep and daily payload structures received by AT CAPACITY on 3 September 2026 and inspected read-only on 8 September. User/reference identifiers and user timestamps are replaced; no measurements or credentials are included. `data: []`, `status: success`, provider casing, schema version and scopes match production.

All 24 retained data events for the affected WHOOP connection (3–8 September) had this empty-array shape. Terra's dashboard HTTP GET for each dataset over its Last Week range independently returned the same empty success response on 8 September. No populated WHOOP production sample was available. Populated fixtures in the tests are explicitly shared-contract expectations, not fabricated production evidence.
