package object

import (
	"bytes"
	"fmt"
	"strconv"
)

// EncodeHeader builds the Git object header "type size\0" plus content.
func EncodeHeader(typ string, content []byte) []byte {
	hdr := typ + " " + strconv.Itoa(len(content)) + "\x00"
	out := make([]byte, 0, len(hdr)+len(content))
	out = append(out, hdr...)
	out = append(out, content...)
	return out
}

// SplitHeader splits a decoded object into type and content.
func SplitHeader(data []byte) (typ string, content []byte, err error) {
	nul := bytes.IndexByte(data, 0)
	if nul < 0 {
		return "", nil, fmt.Errorf("object: missing header NUL")
	}
	space := bytes.IndexByte(data[:nul], ' ')
	if space < 0 {
		return "", nil, fmt.Errorf("object: missing type/size space")
	}
	typ = string(data[:space])
	sizeStr := string(data[space+1 : nul])
	size, err := strconv.Atoi(sizeStr)
	if err != nil {
		return "", nil, fmt.Errorf("object: bad size: %w", err)
	}
	content = data[nul+1:]
	if len(content) != size {
		return "", nil, fmt.Errorf("object: size mismatch: header %d body %d", size, len(content))
	}
	return typ, content, nil
}
