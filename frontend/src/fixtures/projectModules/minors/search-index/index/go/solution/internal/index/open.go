package index

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/devlabs/findx/internal/postings"
)

const catalogName = "catalog.json"

// Open loads an index from dir, creating the directory and an empty catalog when
// missing. Existing segment files listed in catalog.json are opened.
func Open(dir string) (*Engine, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	e := &Engine{
		Dir:     dir,
		docs:    make(map[uint32]Meta),
		extToID: make(map[string]uint32),
		mem:     postings.NewMap(),
		bufLens: make(map[uint32]int),
	}
	path := filepath.Join(dir, catalogName)
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return e, e.writeCatalog()
		}
		return nil, err
	}
	var cat catalogFile
	if err := json.Unmarshal(raw, &cat); err != nil {
		return nil, fmt.Errorf("catalog: %w", err)
	}
	e.nextDoc = cat.NextDoc
	for _, d := range cat.Docs {
		e.docs[d.ID] = Meta{ExtID: d.ExtID, Len: d.Len}
		e.extToID[d.ExtID] = d.ID
	}
	for _, name := range cat.Segments {
		seg, err := postings.OpenSegment(filepath.Join(dir, name))
		if err != nil {
			return nil, err
		}
		e.segNames = append(e.segNames, name)
		e.segs = append(e.segs, seg)
	}
	return e, nil
}
