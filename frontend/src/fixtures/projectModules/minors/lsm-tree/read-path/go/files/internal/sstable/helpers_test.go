package sstable

import (
	"fmt"
	"testing"
)

func key(i int) []byte { return []byte(fmt.Sprintf("order:%06d", i)) }

func openTable(t *testing.T, path string) *Table {
	t.Helper()
	tbl, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { tbl.Close() })
	return tbl
}
