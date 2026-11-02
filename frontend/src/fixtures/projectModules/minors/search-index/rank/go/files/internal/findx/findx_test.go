package findx

import (
	"math"
	"testing"
)

func TestSearchANDORRank(t *testing.T) {
	dir := t.TempDir()
	idx, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	docs := []struct{ id, text string }{
		{"d0", "cat cat cat"},
		{"d1", "cat dog"},
		{"d2", "dog dog dog"},
		{"d3", "bird flies"},
	}
	for _, d := range docs {
		if err := idx.Add(d.id, d.text); err != nil {
			t.Fatal(err)
		}
	}
	if err := idx.Flush(); err != nil {
		t.Fatal(err)
	}

	hits, err := idx.Search("cat", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(hits) != 2 || hits[0].ID != "d0" || hits[1].ID != "d1" {
		t.Fatalf("cat hits %#v", hits)
	}
	if hits[0].Score <= hits[1].Score {
		t.Fatalf("d0 should rank above d1: %#v", hits)
	}

	hits, err = idx.Search("cat dog", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(hits) != 1 || hits[0].ID != "d1" {
		t.Fatalf("and %#v", hits)
	}

	hits, err = idx.Search("cat OR bird", 10)
	if err != nil {
		t.Fatal(err)
	}
	ids := map[string]bool{}
	for _, h := range hits {
		ids[h.ID] = true
		if math.IsNaN(h.Score) {
			t.Fatal("nan score")
		}
	}
	if !ids["d0"] || !ids["d1"] || !ids["d3"] || ids["d2"] {
		t.Fatalf("or ids %#v", hits)
	}

	hits, err = idx.Search("cat", 1)
	if err != nil || len(hits) != 1 || hits[0].ID != "d0" {
		t.Fatalf("top1 %#v err %v", hits, err)
	}
}

func TestSearchReopen(t *testing.T) {
	dir := t.TempDir()
	idx, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	_ = idx.Add("a", "red fox")
	_ = idx.Flush()
	idx2, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	hits, err := idx2.Search("fox", 5)
	if err != nil || len(hits) != 1 || hits[0].ID != "a" {
		t.Fatalf("%#v %v", hits, err)
	}
}
