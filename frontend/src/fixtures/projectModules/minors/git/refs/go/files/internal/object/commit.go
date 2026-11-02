package object

import (
	"bytes"
	"fmt"
	"strings"
)

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
	if c.Tree.IsZero() {
		return nil, fmt.Errorf("object: commit missing tree")
	}
	if c.Author == "" {
		return nil, fmt.Errorf("object: commit missing author")
	}
	committer := c.Committer
	if committer == "" {
		committer = c.Author
	}
	var b strings.Builder
	fmt.Fprintf(&b, "tree %s\n", c.Tree.Hex())
	for _, p := range c.Parents {
		fmt.Fprintf(&b, "parent %s\n", p.Hex())
	}
	fmt.Fprintf(&b, "author %s\n", c.Author)
	fmt.Fprintf(&b, "committer %s\n", committer)
	b.WriteByte('\n')
	b.WriteString(c.Message)
	if !strings.HasSuffix(c.Message, "\n") {
		b.WriteByte('\n')
	}
	return []byte(b.String()), nil
}

// DecodeCommit parses a commit object body.
func DecodeCommit(content []byte) (Commit, error) {
	var c Commit
	rest := content
	for {
		nl := bytes.IndexByte(rest, '\n')
		if nl < 0 {
			return c, fmt.Errorf("object: truncated commit")
		}
		line := string(rest[:nl])
		rest = rest[nl+1:]
		if line == "" {
			c.Message = string(rest)
			break
		}
		key, val, ok := strings.Cut(line, " ")
		if !ok {
			return c, fmt.Errorf("object: bad commit header %q", line)
		}
		switch key {
		case "tree":
			h, err := ParseHex(val)
			if err != nil {
				return c, err
			}
			c.Tree = h
		case "parent":
			h, err := ParseHex(val)
			if err != nil {
				return c, err
			}
			c.Parents = append(c.Parents, h)
		case "author":
			c.Author = val
		case "committer":
			c.Committer = val
		default:
			// ignore unknown headers
		}
	}
	if c.Tree.IsZero() {
		return c, fmt.Errorf("object: commit missing tree")
	}
	return c, nil
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
