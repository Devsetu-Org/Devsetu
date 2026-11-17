package index

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/devlabs/findx/internal/postings"
)

// Flush writes the in-memory postings as a new segment file, opens it, appends
// it to the catalog, clears the memory buffer, and persists catalog.json.
// Flush with an empty buffer is a no-op success.
func (e *Engine) Flush() error {
	if len(e.mem.Terms()) == 0 {
		return nil
	}
	name := fmt.Sprintf("segment-%06d.fx", len(e.segNames))
	path := filepath.Join(e.Dir, name)
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	err = postings.WriteSegment(f, e.mem)
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	seg, err := postings.OpenSegment(path)
	if err != nil {
		return err
	}
	e.segNames = append(e.segNames, name)
	e.segs = append(e.segs, seg)
	e.mem.Clear()
	e.bufLens = make(map[uint32]int)
	return e.writeCatalog()
}
