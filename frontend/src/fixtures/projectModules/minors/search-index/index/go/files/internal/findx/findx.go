package findx

import "github.com/devlabs/findx/internal/index"

// Index is a directory-backed search index.
type Index struct {
	eng *index.Engine
}

// Open opens or creates an index in dir.
func Open(dir string) (*Index, error) {
	eng, err := index.Open(dir)
	if err != nil {
		return nil, err
	}
	return &Index{eng: eng}, nil
}

// Add indexes one document. id must be unique within the index.
func (idx *Index) Add(id, text string) error {
	return idx.eng.Add(id, text)
}

// Flush writes buffered postings to a new segment on disk.
func (idx *Index) Flush() error {
	return idx.eng.Flush()
}
