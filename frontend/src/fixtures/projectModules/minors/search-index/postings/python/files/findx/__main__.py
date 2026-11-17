"""Encode one document per stdin line into a segment on stdout."""

from __future__ import annotations

import sys

from findx.analyze import analyze
from findx.postings import Map, write_segment


def main() -> None:
    m = Map()
    doc_id = 0
    print("findx postings. One document per line. Ctrl-D to encode.", file=sys.stderr)
    for line in sys.stdin:
        tf: dict[str, int] = {}
        for t in analyze(line.rstrip("\n")):
            tf[t] = tf.get(t, 0) + 1
        for term, n in tf.items():
            m.add(term, doc_id, n)
        doc_id += 1
    write_segment(sys.stdout.buffer, m)


if __name__ == "__main__":
    main()
