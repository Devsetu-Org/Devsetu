package db

import (
	"github.com/devlabs/btreekv/internal/pager"
	"github.com/devlabs/btreekv/internal/wal"
)

// apply makes logged records real: it writes every page image into the store
// and installs the header state. Replay at startup and commit at runtime both
// use it, so a page is always written the same way. Applying a batch twice is
// harmless: the images are whole pages, not deltas.
func (d *DB) apply(recs []wal.Record) error {
	for _, r := range recs {
		switch r.Kind {
		case wal.KindPage:
			buf := make([]byte, pager.PageSize)
			copy(buf, r.Data)
			if err := d.store.WritePage(pager.PageNo(r.Page), buf); err != nil {
				return err
			}
		case wal.KindMeta:
			root, count, free, err := r.Meta()
			if err != nil {
				return err
			}
			d.store.SetMeta(pager.Meta{Root: pager.PageNo(root), PageCount: pager.PageNo(count), FreeHead: pager.PageNo(free)})
		}
	}
	return nil
}
