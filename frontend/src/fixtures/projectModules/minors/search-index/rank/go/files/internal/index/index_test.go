package index

import (
	"path/filepath"
	"reflect"
	"testing"

	"github.com/devlabs/findx/internal/postings"
)

func TestAddFlushOpen(t *testing.T) {
	dir := t.TempDir()
	e, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := e.Add("a", "The cat sat"); err != nil {
		t.Fatal(err)
	}
	if err := e.Add("b", "A cat and a dog"); err != nil {
		t.Fatal(err)
	}
	if err := e.Flush(); err != nil {
		t.Fatal(err)
	}
	if err := e.Add("c", "birds fly"); err != nil {
		t.Fatal(err)
	}
	if err := e.Flush(); err != nil {
		t.Fatal(err)
	}

	e2, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if e2.NumDocs() != 3 {
		t.Fatalf("docs %d", e2.NumDocs())
	}
	got := e2.Postings("cat")
	want := []postings.Posting{{DocID: 0, TF: 1}, {DocID: 1, TF: 1}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("cat %#v want %#v", got, want)
	}
	if e2.ExtID(2) != "c" {
		t.Fatalf("ext %q", e2.ExtID(2))
	}
	if len(e2.Postings("fly")) != 1 {
		t.Fatalf("fly %#v", e2.Postings("fly"))
	}
	// catalog file exists
	if _, err := filepath.Glob(filepath.Join(dir, "segment-*.fx")); err != nil {
		t.Fatal(err)
	}
}

func TestDuplicateID(t *testing.T) {
	e, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := e.Add("x", "hi"); err != nil {
		t.Fatal(err)
	}
	if err := e.Add("x", "yo"); err == nil {
		t.Fatal("expected duplicate error")
	}
}
