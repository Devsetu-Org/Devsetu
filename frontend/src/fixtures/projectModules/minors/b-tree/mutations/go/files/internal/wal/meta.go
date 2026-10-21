package wal

import (
	"encoding/binary"
	"fmt"
)

// MetaRecord returns the KindMeta record for the header state a write leaves
// behind: the tree's root, the file's page count, and the freelist head.
func MetaRecord(root, pageCount, freeHead uint32) Record {
	data := make([]byte, 12)
	binary.LittleEndian.PutUint32(data[0:], root)
	binary.LittleEndian.PutUint32(data[4:], pageCount)
	binary.LittleEndian.PutUint32(data[8:], freeHead)
	return Record{Kind: KindMeta, Data: data}
}

// Meta unpacks a KindMeta record.
func (r Record) Meta() (root, pageCount, freeHead uint32, err error) {
	if r.Kind != KindMeta || len(r.Data) != 12 {
		return 0, 0, 0, fmt.Errorf("wal: not a meta record")
	}
	return binary.LittleEndian.Uint32(r.Data[0:]), binary.LittleEndian.Uint32(r.Data[4:]), binary.LittleEndian.Uint32(r.Data[8:]), nil
}

// CommitRecord is the record that ends a batch.
func CommitRecord() Record { return Record{Kind: KindCommit} }
