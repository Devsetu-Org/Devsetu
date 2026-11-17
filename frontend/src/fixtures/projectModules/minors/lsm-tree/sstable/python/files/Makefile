PYTHON ?= python3

.PHONY: test run

# This chapter: SSTable + flush only.
test:
	$(PYTHON) -m unittest tests.test_sstable tests.test_flush -v

run:
	$(PYTHON) -m lsmkv
