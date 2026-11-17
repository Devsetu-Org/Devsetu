PYTHON ?= python3

.PHONY: test run

# This chapter: compaction merge + manifest.
test:
	$(PYTHON) -m unittest tests.test_compaction tests.test_manifest -v

run:
	$(PYTHON) -m lsmkv
