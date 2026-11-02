package index

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
)

func (e *Engine) writeCatalog() error {
	cat := catalogFile{
		NextDoc:  e.nextDoc,
		Segments: append([]string(nil), e.segNames...),
	}
	ids := make([]uint32, 0, len(e.docs))
	for id := range e.docs {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	for _, id := range ids {
		m := e.docs[id]
		cat.Docs = append(cat.Docs, docRec{ID: id, ExtID: m.ExtID, Len: m.Len})
	}
	raw, err := json.MarshalIndent(cat, "", "  ")
	if err != nil {
		return err
	}
	raw = append(raw, '\n')
	return os.WriteFile(filepath.Join(e.Dir, catalogName), raw, 0o644)
}
