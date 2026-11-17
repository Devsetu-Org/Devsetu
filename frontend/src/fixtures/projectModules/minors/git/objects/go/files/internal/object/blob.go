package object

const TypeBlob = "blob"

// PutBlob stores file bytes as a blob object.
func PutBlob(s *Store, data []byte) (Hash, error) {
	// TODO(1.3)
	panic("TODO(1.3)")
}

// GetBlob loads a blob's bytes.
func GetBlob(s *Store, h Hash) ([]byte, error) {
	// TODO(1.3)
	panic("TODO(1.3)")
}
