PYTHON ?= python3
export PYTHONPATH := .

.PHONY: test run

test:
	$(PYTHON) -m unittest discover -s tests -v

run:
	$(PYTHON) -m raftkv
