# Solution — Lab 6

1. Hold at 1024m only fits B (2048m); A is 768m. Storage shows tiny use.
2. Victim also needs 1024m → cannot use A; sharing B fails.
3. Kill old hold → stop Worker B → resubmit hold at ≤768m (e.g. 512m) → lands on A → start B → run victim at 1024m on B.
4. Grade: hold active on A; victim STATUS=ok. Exact 512m not required.
