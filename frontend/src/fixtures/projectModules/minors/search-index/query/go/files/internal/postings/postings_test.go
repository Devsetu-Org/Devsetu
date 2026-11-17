package postings

import (
	"bytes"
	"reflect"
	"testing"
)

func TestMapAddSorted(t *testing.T) {
	m := NewMap()
	m.Add("cat", 3, 1)
	m.Add("cat", 1, 2)
	m.Add("cat", 2, 1)
	m.Add("cat", 1, 5) // replace tf
	got := m.Postings("cat")
	want := []Posting{{DocID: 1, TF: 5}, {DocID: 2, TF: 1}, {DocID: 3, TF: 1}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %#v want %#v", got, want)
	}
}

func TestSegmentRoundTrip(t *testing.T) {
	m := NewMap()
	m.Add("cat", 1, 2)
	m.Add("cat", 3, 1)
	m.Add("dog", 2, 4)
	m.Add("apple", 1, 1)

	var buf bytes.Buffer
	if err := WriteSegment(&buf, m); err != nil {
		t.Fatal(err)
	}
	seg, err := DecodeSegment(buf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	got, ok := seg.Postings("cat")
	if !ok {
		t.Fatal("missing cat")
	}
	want := []Posting{{DocID: 1, TF: 2}, {DocID: 3, TF: 1}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("cat %#v want %#v", got, want)
	}
	got, ok = seg.Postings("dog")
	if !ok || !reflect.DeepEqual(got, []Posting{{DocID: 2, TF: 4}}) {
		t.Fatalf("dog %#v", got)
	}
	if _, ok := seg.Postings("missing"); ok {
		t.Fatal("expected missing")
	}
	terms := seg.Terms()
	if !reflect.DeepEqual(terms, []string{"apple", "cat", "dog"}) {
		t.Fatalf("terms %#v", terms)
	}
}
