package rank

import (
	"math"
	"testing"
)

func TestIDF(t *testing.T) {
	got := IDF(100, 10)
	want := math.Log(1 + (100-10+0.5)/(10+0.5))
	if math.Abs(got-want) > 1e-12 {
		t.Fatalf("idf %v want %v", got, want)
	}
}

func TestScoreMonotonicTF(t *testing.T) {
	st := Stats{N: 100, AvgDL: 50}
	s1 := Score(1, 50, 10, st)
	s2 := Score(5, 50, 10, st)
	if s2 <= s1 {
		t.Fatalf("higher tf should score higher: %v vs %v", s1, s2)
	}
}

func TestTopKTieBreak(t *testing.T) {
	hits := []Hit{{3, 1.0}, {1, 2.0}, {2, 2.0}, {4, 0.5}}
	got := TopK(hits, 3)
	want := []Hit{{1, 2.0}, {2, 2.0}, {3, 1.0}}
	if len(got) != 3 || got[0] != want[0] || got[1] != want[1] || got[2] != want[2] {
		t.Fatalf("got %#v want %#v", got, want)
	}
}

type stubDF struct {
	n   int
	avg float64
	df  map[string]int
}

func (s stubDF) NumDocs() int       { return s.n }
func (s stubDF) AvgDL() float64     { return s.avg }
func (s stubDF) DF(term string) int { return s.df[term] }

func TestCollectStats(t *testing.T) {
	src := stubDF{n: 10, avg: 4, df: map[string]int{"cat": 3, "dog": 1}}
	st, df := CollectStats(src, []string{"cat", "dog", "cat"})
	if st.N != 10 || st.AvgDL != 4 {
		t.Fatalf("stats %#v", st)
	}
	if df["cat"] != 3 || df["dog"] != 1 {
		t.Fatalf("df %#v", df)
	}
}
