package analyze

import (
	"reflect"
	"testing"
)

func TestTokenize(t *testing.T) {
	got := Tokenize("Hello, world! Don't 123 go.")
	want := []string{"Hello", "world", "Don", "t", "go"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Tokenize = %#v, want %#v", got, want)
	}
	if Tokenize("") != nil && len(Tokenize("")) != 0 {
		t.Fatalf("empty: %#v", Tokenize(""))
	}
}

func TestLower(t *testing.T) {
	got := Lower([]string{"Hello", "WORLD"})
	want := []string{"hello", "world"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Lower = %#v, want %#v", got, want)
	}
}

func TestFilterStop(t *testing.T) {
	got := FilterStop([]string{"the", "cat", "and", "dog", "a"})
	want := []string{"cat", "dog"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("FilterStop = %#v, want %#v", got, want)
	}
}

func TestAnalyze(t *testing.T) {
	got := Analyze("The Cat in the Hat sat on a mat.")
	want := []string{"cat", "hat", "sat", "mat"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Analyze = %#v, want %#v", got, want)
	}
}
