package ref_test

import (
	"path/filepath"
	"testing"

	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/ref"
	"github.com/devlabs/tinygit/internal/repo"
)

func TestRefsAndHEAD(t *testing.T) {
	root := t.TempDir()
	r, err := repo.Init(root)
	if err != nil {
		t.Fatal(err)
	}
	h := object.HashOf([]byte("commit-ish"))
	// store a fake hash by writing ref
	if err := ref.Write(r, "refs/heads/main", h); err != nil {
		t.Fatal(err)
	}
	got, err := ref.Read(r, "refs/heads/main")
	if err != nil || got != h {
		t.Fatalf("%v %v", got, err)
	}
	hd, err := ref.ReadHEAD(r)
	if err != nil || hd.Symbolic != "refs/heads/main" {
		t.Fatalf("%+v %v", hd, err)
	}
	res, err := ref.ResolveHEAD(r)
	if err != nil || res != h {
		t.Fatalf("%v %v", res, err)
	}
	h2 := object.HashOf([]byte("other"))
	if err := ref.UpdateRef(r, "HEAD", h2, h); err != nil {
		t.Fatal(err)
	}
	got, err = ref.Read(r, "refs/heads/main")
	if err != nil || got != h2 {
		t.Fatalf("%v %v", got, err)
	}
	if err := ref.WriteDetachedHEAD(r, h); err != nil {
		t.Fatal(err)
	}
	hd, err = ref.ReadHEAD(r)
	if err != nil || hd.Symbolic != "" || hd.Hash != h {
		t.Fatalf("%+v", hd)
	}
	_ = filepath.Join // keep import if needed
}
