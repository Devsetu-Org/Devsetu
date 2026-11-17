package query

import "github.com/devlabs/findx/internal/postings"

// Intersect returns doc ids that appear in every list. Lists must be sorted by
// DocID. The result is sorted and deduplicated.
func Intersect(lists [][]postings.Posting) []uint32 {
	if len(lists) == 0 {
		return nil
	}
	for _, list := range lists {
		if len(list) == 0 {
			return nil
		}
	}
	cur := docIDs(lists[0])
	for i := 1; i < len(lists); i++ {
		cur = intersectTwo(cur, docIDs(lists[i]))
		if len(cur) == 0 {
			return nil
		}
	}
	return cur
}

// Union returns doc ids that appear in any list. Lists must be sorted by DocID.
// The result is sorted and deduplicated.
func Union(lists [][]postings.Posting) []uint32 {
	if len(lists) == 0 {
		return nil
	}
	cur := docIDs(lists[0])
	for i := 1; i < len(lists); i++ {
		cur = unionTwo(cur, docIDs(lists[i]))
	}
	return cur
}

func docIDs(list []postings.Posting) []uint32 {
	out := make([]uint32, len(list))
	for i, p := range list {
		out[i] = p.DocID
	}
	return out
}

func intersectTwo(a, b []uint32) []uint32 {
	var out []uint32
	i, j := 0, 0
	for i < len(a) && j < len(b) {
		switch {
		case a[i] == b[j]:
			out = append(out, a[i])
			i++
			j++
		case a[i] < b[j]:
			i++
		default:
			j++
		}
	}
	return out
}

func unionTwo(a, b []uint32) []uint32 {
	var out []uint32
	i, j := 0, 0
	for i < len(a) && j < len(b) {
		switch {
		case a[i] == b[j]:
			out = append(out, a[i])
			i++
			j++
		case a[i] < b[j]:
			out = append(out, a[i])
			i++
		default:
			out = append(out, b[j])
			j++
		}
	}
	out = append(out, a[i:]...)
	out = append(out, b[j:]...)
	return out
}

// Retrieve resolves a Query against a posting source. AND within a group,
// OR across groups.
type PostingSource interface {
	Postings(term string) []postings.Posting
}

// Docs returns matching internal document ids for q.
func Docs(src PostingSource, q Query) []uint32 {
	if len(q.Groups) == 0 {
		return nil
	}
	// Represent each group's hit set as a synthetic posting list (TF unused).
	var groupLists [][]postings.Posting
	for _, terms := range q.Groups {
		lists := make([][]postings.Posting, len(terms))
		for i, term := range terms {
			lists[i] = src.Postings(term)
		}
		ids := Intersect(lists)
		synth := make([]postings.Posting, len(ids))
		for i, id := range ids {
			synth[i] = postings.Posting{DocID: id, TF: 1}
		}
		groupLists = append(groupLists, synth)
	}
	if len(groupLists) == 1 {
		return docIDs(groupLists[0])
	}
	return Union(groupLists)
}
