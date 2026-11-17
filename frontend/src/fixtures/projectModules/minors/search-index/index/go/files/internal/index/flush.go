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
	// TODO(3.2)
	_ = fmt.Sprintf
	_ = os.Create
	_ = filepath.Join
	_ = postings.WriteSegment
	panic("TODO(3.2)")
}
