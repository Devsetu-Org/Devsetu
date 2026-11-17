PYTHON ?= python3

.PHONY: test run

# This chapter: B+ tree + DB API (not chapter 1's pager suite).
test:
	$(PYTHON) -m unittest tests.test_btree tests.test_db -v

run:
	$(PYTHON) -m btreekv
