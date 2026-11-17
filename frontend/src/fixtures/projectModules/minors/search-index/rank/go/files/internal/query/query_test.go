package query

import (
	"reflect"
	"testing"

	"github.com/devlabs/findx/internal/postings"
)

func TestParseAND(t *testing.T) {
	q := Parse("The Cat Dog")
	want := Query{Groups: [][]string{{"cat", "dog"}}}
	if !reflect.DeepEqual(q, want) {
		t.Fatalf("got %#v want %#v", q, want)
	}
}

func TestParseOR(t *testing.T) {
	q := Parse("cat OR dog bird")
	want := Query{Groups: [][]string{{"cat"}, {"dog", "bird"}}}
	if !reflect.DeepEqual(q, want) {
		t.Fatalf("got %#v want %#v", q, want)
	}
}

func p(id, tf uint32) postings.Posting { return postings.Posting{DocID: id, TF: tf} }

func TestIntersectUnion(t *testing.T) {
	a := []postings.Posting{p(1, 1), p(3, 1), p(5, 1)}
	b := []postings.Posting{p(3, 2), p(5, 1), p(7, 1)}
	c := []postings.Posting{p(2, 1), p(5, 1)}
	if got := Intersect([][]postings.Posting{a, b}); !reflect.DeepEqual(got, []uint32{3, 5}) {
		t.Fatalf("intersect %#v", got)
	}
	if got := Intersect([][]postings.Posting{a, b, c}); !reflect.DeepEqual(got, []uint32{5}) {
		t.Fatalf("intersect3 %#v", got)
	}
	if got := Union([][]postings.Posting{a, c}); !reflect.DeepEqual(got, []uint32{1, 2, 3, 5}) {
		t.Fatalf("union %#v", got)
	}
}

type memSrc map[string][]postings.Posting

func (m memSrc) Postings(term string) []postings.Posting { return m[term] }

func TestDocs(t *testing.T) {
	src := memSrc{
		"cat":  {p(1, 1), p(2, 1), p(3, 1)},
		"dog":  {p(2, 1), p(3, 1)},
		"bird": {p(1, 1), p(4, 1)},
	}
	got := Docs(src, Parse("cat dog"))
	if !reflect.DeepEqual(got, []uint32{2, 3}) {
		t.Fatalf("and %#v", got)
	}
	got = Docs(src, Parse("cat OR bird"))
	if !reflect.DeepEqual(got, []uint32{1, 2, 3, 4}) {
		t.Fatalf("or %#v", got)
	}
}
