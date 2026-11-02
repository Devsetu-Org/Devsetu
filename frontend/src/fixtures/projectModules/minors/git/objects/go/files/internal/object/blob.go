package object

const TypeBlob = "blob"

// PutBlob stores file bytes as a blob object.
func PutBlob(s *Store, data []byte) (Hash, error) {
	// TODO(1.3): return s.Put(TypeBlob, data)
	panic("TODO(1.3): PutBlob")
}

// GetBlob loads a blob's bytes.
func GetBlob(s *Store, h Hash) ([]byte, error) {
	// TODO(1.3): typ, content, err := s.Get(h); require typ == TypeBlob; return content.
	panic("TODO(1.3): GetBlob")
}
