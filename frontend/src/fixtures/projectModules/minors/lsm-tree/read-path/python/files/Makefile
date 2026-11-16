PYTHON ?= python3

.PHONY: test run

# This chapter: Bloom, merging iterator, scan.
test:
	$(PYTHON) -m unittest tests.test_bloom tests.test_merging tests.test_scan -v

run:
	$(PYTHON) -m lsmkv
