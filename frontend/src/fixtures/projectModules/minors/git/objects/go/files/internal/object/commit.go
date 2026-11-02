package object

const TypeCommit = "commit"

// Commit is a parsed commit object.
type Commit struct {
	Tree      Hash
	Parents   []Hash
	Author    string
	Committer string
	Message   string
}

// EncodeCommit serializes a commit object body.
func EncodeCommit(c Commit) ([]byte, error) {
	// TODO(1.5): Require Tree and Author. Committer defaults to Author.
	// Write: tree, parent lines, author, committer, blank line, message (ensure trailing newline).
	// Imports: fmt, strings.
	panic("TODO(1.5): EncodeCommit")
}

// DecodeCommit parses a commit object body.
func DecodeCommit(content []byte) (Commit, error) {
	// TODO(1.5): Read header lines until a blank line; then the rest is Message.
	// Parse tree/parent/author/committer. Imports: bytes, fmt, strings.
	panic("TODO(1.5): DecodeCommit")
}

// PutCommit encodes and stores a commit.
func PutCommit(s *Store, c Commit) (Hash, error) {
	body, err := EncodeCommit(c)
	if err != nil {
		return Zero, err
	}
	return s.Put(TypeCommit, body)
}

// GetCommit loads and decodes a commit.
func GetCommit(s *Store, h Hash) (Commit, error) {
	typ, content, err := s.Get(h)
	if err != nil {
		return Commit{}, err
	}
	if typ != TypeCommit {
		return Commit{}, fmtType(typ, TypeCommit)
	}
	return DecodeCommit(content)
}
