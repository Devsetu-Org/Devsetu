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
	// TODO(3.2): If e.mem has no terms, return nil. Otherwise create
	// segment-%06d.fx under e.Dir (len(e.segNames) as the number), WriteSegment,
	// OpenSegment, append to e.segNames / e.segs, Clear the map, reset e.bufLens,
	// and return e.writeCatalog().
	_ = fmt.Sprintf
	_ = os.Create
	_ = filepath.Join
	_ = postings.WriteSegment
	panic("TODO(3.2): Engine.Flush")
}
