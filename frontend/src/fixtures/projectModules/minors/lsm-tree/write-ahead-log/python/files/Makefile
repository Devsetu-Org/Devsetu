PYTHON ?= python3

.PHONY: test run

# This chapter: WAL + recovery only.
test:
	$(PYTHON) -m unittest tests.test_wal tests.test_db -v

run:
	$(PYTHON) -m lsmkv
