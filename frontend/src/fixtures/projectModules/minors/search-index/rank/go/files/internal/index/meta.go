package index

import "github.com/devlabs/findx/internal/postings"

// Meta is per-document catalog data needed for BM25.
type Meta struct {
	ExtID string // caller-facing document id
	Len   int    // token count after Analyze
}

// catalogFile is the on-disk JSON shape of the index directory.
type catalogFile struct {
	NextDoc  uint32   `json:"next_doc"`
	Docs     []docRec `json:"docs"`
	Segments []string `json:"segments"`
}

type docRec struct {
	ID    uint32 `json:"id"`
	ExtID string `json:"ext_id"`
	Len   int    `json:"len"`
}

// Engine is a directory-backed inverted index with an in-memory buffer.
type Engine struct {
	Dir string

	nextDoc  uint32
	docs     map[uint32]Meta
	extToID  map[string]uint32
	mem      *postings.Map
	bufLens  map[uint32]int // lengths for docs still in mem
	segNames []string
	segs     []*postings.Segment
}
