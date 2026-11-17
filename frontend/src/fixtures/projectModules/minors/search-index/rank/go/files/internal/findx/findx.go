package findx

import (
	"github.com/devlabs/findx/internal/index"
	"github.com/devlabs/findx/internal/query"
	"github.com/devlabs/findx/internal/rank"
)

// Hit is one search result: the caller's document id and its BM25 score.
type Hit struct {
	ID    string
	Score float64
}

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

// Search runs a boolean query (AND by default, OR between groups) and returns
// the top k hits ranked by BM25. k <= 0 means all hits.
func (idx *Index) Search(q string, k int) ([]Hit, error) {
	parsed := query.Parse(q)
	ids := query.Docs(idx.eng, parsed)
	if len(ids) == 0 {
		return nil, nil
	}

	var terms []string
	seen := map[string]struct{}{}
	for _, g := range parsed.Groups {
		for _, t := range g {
			if _, ok := seen[t]; ok {
				continue
			}
			seen[t] = struct{}{}
			terms = append(terms, t)
		}
	}
	st, df := rank.CollectStats(idx.eng, terms)

	tfFor := func(term string, docID uint32) int {
		for _, p := range idx.eng.Postings(term) {
			if p.DocID == docID {
				return int(p.TF)
			}
			if p.DocID > docID {
				break
			}
		}
		return 0
	}

	raw := make([]rank.Hit, 0, len(ids))
	for _, id := range ids {
		meta, ok := idx.eng.Doc(id)
		if !ok {
			continue
		}
		var score float64
		for _, term := range terms {
			tf := tfFor(term, id)
			if tf == 0 {
				continue
			}
			score += rank.Score(tf, meta.Len, df[term], st)
		}
		raw = append(raw, rank.Hit{DocID: id, Score: score})
	}
	top := rank.TopK(raw, k)
	out := make([]Hit, len(top))
	for i, h := range top {
		out[i] = Hit{ID: idx.eng.ExtID(h.DocID), Score: h.Score}
	}
	return out, nil
}
