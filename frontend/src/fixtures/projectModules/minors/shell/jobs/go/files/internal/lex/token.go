// Package lex turns a shell line into tokens. The parser never sees raw characters.
package lex

// Kind is one token class.
type Kind int

const (
	Illegal Kind = iota
	EOF
	Word     // a word; Lit is the decoded text (quotes stripped, escapes applied)
	Pipe     // |
	RedirOut // >
	RedirApp // >>
	RedirIn  // <
	RedirErr // 2>
	Amp      // &
)

func (k Kind) String() string {
	if int(k) >= 0 && int(k) < len(kindNames) {
		return kindNames[k]
	}
	return "illegal"
}

var kindNames = []string{
	"illegal", "eof", "word", "pipe", "redir_out", "redir_app", "redir_in", "redir_err", "amp",
}

// Token is one lexeme.
type Token struct {
	Kind Kind
	Lit  string
	Pos  int
}

// Error is a scan failure at a byte offset.
type Error struct {
	Pos int
	Msg string
}

func (e *Error) Error() string { return e.Msg }
