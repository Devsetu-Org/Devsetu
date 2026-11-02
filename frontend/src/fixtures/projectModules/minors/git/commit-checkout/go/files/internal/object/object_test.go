package object_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/devlabs/tinygit/internal/object"
)

func TestHashOfKnown(t *testing.T) {
	// sha1("hello") — not a git object; just HashOf on raw bytes
	h := object.HashOf([]byte("hello"))
	if h.Hex() != "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d" {
		t.Fatalf("got %s", h.Hex())
	}
}

func TestStoreBlobRoundTrip(t *testing.T) {
	dir := t.TempDir()
	s := &object.Store{Dir: filepath.Join(dir, "objects")}
	h, err := object.PutBlob(s, []byte("hello\n"))
	if err != nil {
		t.Fatal(err)
	}
	// Known Git blob hash for "hello\n"
	if h.Hex() != "ce013625030ba8dba906f756967f9e9ca394464a" {
		t.Fatalf("blob hash %s", h.Hex())
	}
	data, err := object.GetBlob(s, h)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "hello\n" {
		t.Fatalf("%q", data)
	}
	typ, _, err := s.Get(h)
	if err != nil || typ != "blob" {
		t.Fatalf("typ %s err %v", typ, err)
	}
}

func TestTreeCommitRoundTrip(t *testing.T) {
	dir := t.TempDir()
	s := &object.Store{Dir: filepath.Join(dir, "objects")}
	bh, err := object.PutBlob(s, []byte("x"))
	if err != nil {
		t.Fatal(err)
	}
	th, err := object.PutTree(s, []object.TreeEntry{
		{Mode: object.ModeFile, Name: "a.txt", Hash: bh},
		{Mode: object.ModeFile, Name: "b.txt", Hash: bh},
	})
	if err != nil {
		t.Fatal(err)
	}
	entries, err := object.GetTree(s, th)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 || entries[0].Name != "a.txt" || entries[1].Name != "b.txt" {
		t.Fatalf("%+v", entries)
	}
	ch, err := object.PutCommit(s, object.Commit{
		Tree:    th,
		Author:  "A <a@b> 1 +0000",
		Message: "first\n",
	})
	if err != nil {
		t.Fatal(err)
	}
	c, err := object.GetCommit(s, ch)
	if err != nil {
		t.Fatal(err)
	}
	if c.Tree != th || c.Message != "first\n" || c.Author != "A <a@b> 1 +0000" {
		t.Fatalf("%+v", c)
	}
	if _, err := os.Stat(filepath.Join(s.Dir, ch.Hex()[:2], ch.Hex()[2:])); err != nil {
		t.Fatal(err)
	}
}
