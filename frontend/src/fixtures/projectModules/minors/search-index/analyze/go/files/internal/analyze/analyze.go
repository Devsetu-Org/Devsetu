package analyze

import (
	"strings"
	"unicode"
)

// Analyze turns document or query text into index tokens: split on non-letters,
// lowercase, drop stopwords. Empty input yields a nil or empty slice.
func Analyze(text string) []string {
	return FilterStop(Lower(Tokenize(text)))
}

// Tokenize splits text into runs of Unicode letters. Digits, punctuation, and
// whitespace separate tokens and are discarded. Case is preserved.
func Tokenize(text string) []string {
	// TODO(1.1): Walk runes. Append a token whenever a run of unicode.IsLetter
	// ends. Use a strings.Builder. Do not keep digits or punctuation.
	_ = unicode.IsLetter
	_ = strings.Builder{}
	panic("TODO(1.1): Tokenize")
}

// Lower returns a new slice with each token lowercased (Unicode).
func Lower(tokens []string) []string {
	// TODO(1.2): Allocate an output slice the same length. strings.ToLower each token.
	_ = strings.ToLower
	panic("TODO(1.2): Lower")
}

// FilterStop drops tokens that appear in Stopwords. Tokens must already be lowercased.
func FilterStop(tokens []string) []string {
	// TODO(1.3): Keep tokens that are not keys in Stopwords. Preserve order.
	panic("TODO(1.3): FilterStop")
}
