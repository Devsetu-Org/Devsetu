package postings

// Posting is one document's occurrence of a term: the internal doc id and the
// term frequency in that document.
type Posting struct {
	DocID uint32
	TF    uint32
}
