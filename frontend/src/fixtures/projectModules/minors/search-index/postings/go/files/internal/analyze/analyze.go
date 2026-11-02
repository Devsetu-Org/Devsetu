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
	var out []string
	var b strings.Builder
	flush := func() {
		if b.Len() > 0 {
			out = append(out, b.String())
			b.Reset()
		}
	}
	for _, r := range text {
		if unicode.IsLetter(r) {
			b.WriteRune(r)
			continue
		}
		flush()
	}
	flush()
	return out
}

// Lower returns a new slice with each token lowercased (Unicode).
func Lower(tokens []string) []string {
	out := make([]string, len(tokens))
	for i, t := range tokens {
		out[i] = strings.ToLower(t)
	}
	return out
}

// FilterStop drops tokens that appear in Stopwords. Tokens must already be lowercased.
func FilterStop(tokens []string) []string {
	out := make([]string, 0, len(tokens))
	for _, t := range tokens {
		if _, stop := Stopwords[t]; stop {
			continue
		}
		out = append(out, t)
	}
	return out
}
