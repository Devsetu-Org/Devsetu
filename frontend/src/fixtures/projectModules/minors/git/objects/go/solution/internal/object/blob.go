package object

const TypeBlob = "blob"

// PutBlob stores file bytes as a blob object.
func PutBlob(s *Store, data []byte) (Hash, error) {
	return s.Put(TypeBlob, data)
}

// GetBlob loads a blob's bytes.
func GetBlob(s *Store, h Hash) ([]byte, error) {
	typ, content, err := s.Get(h)
	if err != nil {
		return nil, err
	}
	if typ != TypeBlob {
		return nil, fmtType(typ, TypeBlob)
	}
	return content, nil
}
