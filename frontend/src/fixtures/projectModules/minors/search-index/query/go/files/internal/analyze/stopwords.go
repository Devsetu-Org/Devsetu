package analyze

// Stopwords are dropped after lowercasing. The list is fixed for the minor so
// every implementation produces the same tokens.
var Stopwords = map[string]struct{}{
	"a": {}, "an": {}, "the": {}, "and": {}, "or": {}, "of": {}, "to": {},
	"in": {}, "is": {}, "it": {}, "for": {}, "on": {}, "with": {}, "as": {},
	"by": {}, "at": {}, "from": {}, "be": {}, "this": {}, "that": {},
	"are": {}, "was": {}, "were": {}, "been": {}, "but": {}, "not": {},
	"you": {}, "your": {}, "we": {}, "they": {}, "he": {}, "she": {},
}
