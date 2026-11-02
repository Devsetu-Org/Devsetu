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
	// TODO(3.3): MkdirAll dir. Build an empty Engine (docs, extToID, mem, bufLens).
	// If catalog.json is missing, writeCatalog and return. Otherwise unmarshal
	// catalogFile, restore nextDoc / docs / extToID, OpenSegment each name under
	// dir, and append to e.segNames / e.segs.
	_ = json.Unmarshal
	_ = fmt.Errorf
	_ = os.MkdirAll
	_ = filepath.Join
	_ = postings.OpenSegment
	panic("TODO(3.3): Open")
}
