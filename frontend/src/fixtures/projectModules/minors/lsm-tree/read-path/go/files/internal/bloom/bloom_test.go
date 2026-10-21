package bloom

import (
	"fmt"
	"testing"
)

func build(n, bitsPerKey int) []byte {
	b := NewBuilder(bitsPerKey)
	for i := 0; i < n; i++ {
		b.Add([]byte(fmt.Sprintf("order:%07d", i)))
	}
	return b.Finish()
}

func TestLayout(t *testing.T) {
	f := build(1000, 10)
	if len(f) != 1000*10/8+1 {
		t.Fatalf("filter for 1000 keys at 10 bits/key is %d bytes, want %d (bits + one byte for k)", len(f), 1000*10/8+1)
	}
	if k := f[len(f)-1]; k != 6 {
		t.Fatalf("last byte (k) = %d, want 6 (10 * 0.69)", k)
	}
	set := 0
	for _, c := range f[:len(f)-1] {
		for ; c != 0; c &= c - 1 {
			set++
		}
	}
	// 6000 probes into 10000 bits: about 1 - e^-0.6 ≈ 45% end up set.
	if set < 3500 || set > 5500 {
		t.Fatalf("%d of 10000 bits are set; expected about 4500. Are all k probes being set?", set)
	}
}

func TestSmallFiltersStillWork(t *testing.T) {
	f := build(0, 10)
	if len(f) != minBits/8+1 {
		t.Fatalf("empty filter is %d bytes, want %d (the 64-bit minimum + k)", len(f), minBits/8+1)
	}
	if MayContain(f, []byte("anything")) {
		t.Fatal("a filter with no keys answered maybe; every bit is zero, so it should say no")
	}
	one := NewBuilder(10)
	one.Add([]byte("only"))
	if !MayContain(one.Finish(), []byte("only")) {
		t.Fatal("a one-key filter lost its key")
	}
}

func TestNoFalseNegatives(t *testing.T) {
	f := build(20000, 10)
	for i := 0; i < 20000; i++ {
		k := []byte(fmt.Sprintf("order:%07d", i))
		if !MayContain(f, k) {
			t.Fatalf("MayContain(%s) = false for a key that was added. A Bloom filter may never say no to a member.", k)
		}
	}
}

func TestFalsePositiveRate(t *testing.T) {
	for _, tc := range []struct {
		bitsPerKey int
		maxRate    float64
	}{{10, 0.02}, {16, 0.002}, {4, 0.25}} {
		f := build(20000, tc.bitsPerKey)
		fp := 0
		const probes = 50000
		for i := 0; i < probes; i++ {
			if MayContain(f, []byte(fmt.Sprintf("absent:%07d", i))) {
				fp++
			}
		}
		rate := float64(fp) / probes
		if rate > tc.maxRate {
			t.Fatalf("%d bits/key: false-positive rate %.2f%%, want under %.2f%%", tc.bitsPerKey, rate*100, tc.maxRate*100)
		}
		t.Logf("%2d bits/key: false-positive rate %.3f%%", tc.bitsPerKey, rate*100)
	}
}

func TestDamagedFilterSaysMaybe(t *testing.T) {
	for _, f := range [][]byte{nil, {}, {6}, append(make([]byte, 8), 0), append(make([]byte, 8), 200)} {
		if !MayContain(f, []byte("k")) {
			t.Fatalf("MayContain(%v) = false; a filter that cannot be decoded must answer true", f)
		}
	}
}
