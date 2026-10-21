package pager

import (
	"bytes"
	"encoding/binary"
	"errors"
	"hash/crc32"
	"os"
	"path/filepath"
	"testing"
)

func openPager(t *testing.T, path string) *Pager {
	t.Helper()
	p, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	return p
}

// page returns a PageSize buffer whose usable bytes are filled with b.
func page(b byte) []byte {
	buf := make([]byte, PageSize)
	for i := 0; i < Usable; i++ {
		buf[i] = b
	}
	return buf
}

func TestWriteThenRead(t *testing.T) {
	p := openPager(t, filepath.Join(t.TempDir(), "data.db"))
	defer p.Close()
	for i := PageNo(1); i <= 3; i++ {
		if err := p.WritePage(i, page(byte(i))); err != nil {
			t.Fatalf("WritePage(%d): %v", i, err)
		}
	}
	for i := PageNo(1); i <= 3; i++ {
		got := make([]byte, PageSize)
		if err := p.ReadPage(i, got); err != nil {
			t.Fatalf("ReadPage(%d): %v", i, err)
		}
		if !bytes.Equal(got[:Usable], page(byte(i))[:Usable]) {
			t.Fatalf("page %d came back with different bytes", i)
		}
	}
}

func TestPageTrailerIsCRC32C(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data.db")
	p := openPager(t, path)
	defer p.Close()
	if err := p.WritePage(2, page(0xAB)); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(raw) < 3*PageSize {
		t.Fatalf("file is %d bytes; page 2 should end at byte %d", len(raw), 3*PageSize)
	}
	pg := raw[2*PageSize : 3*PageSize]
	want := crc32.Checksum(pg[:Usable], crc32.MakeTable(crc32.Castagnoli))
	if got := binary.LittleEndian.Uint32(pg[Usable:]); got != want {
		t.Fatalf("trailer = %#x, want CRC-32C of the first %d bytes = %#x", got, Usable, want)
	}
}

func TestWriteLeavesCallerBufferAlone(t *testing.T) {
	p := openPager(t, filepath.Join(t.TempDir(), "data.db"))
	defer p.Close()
	buf := page(7)
	for i := Usable; i < PageSize; i++ {
		buf[i] = 0xEE
	}
	if err := p.WritePage(1, buf); err != nil {
		t.Fatal(err)
	}
	for i := Usable; i < PageSize; i++ {
		if buf[i] != 0xEE {
			t.Fatalf("WritePage modified the caller's buffer at byte %d", i)
		}
	}
}

func TestCorruptionIsDetected(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data.db")
	p := openPager(t, path)
	defer p.Close()
	if err := p.WritePage(1, page(1)); err != nil {
		t.Fatal(err)
	}
	f, err := os.OpenFile(path, os.O_RDWR, 0)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.WriteAt([]byte{0xFF}, PageSize+100); err != nil {
		t.Fatal(err)
	}
	f.Close()
	err = p.ReadPage(1, make([]byte, PageSize))
	if !errors.Is(err, ErrChecksum) {
		t.Fatalf("ReadPage of a corrupted page = %v, want ErrChecksum", err)
	}
}

func TestBadBufferAndPastEnd(t *testing.T) {
	p := openPager(t, filepath.Join(t.TempDir(), "data.db"))
	defer p.Close()
	if err := p.WritePage(1, make([]byte, 100)); !errors.Is(err, ErrBadPage) {
		t.Fatalf("WritePage with a short buffer = %v, want ErrBadPage", err)
	}
	if err := p.ReadPage(1, make([]byte, 100)); !errors.Is(err, ErrBadPage) {
		t.Fatalf("ReadPage with a short buffer = %v, want ErrBadPage", err)
	}
	if err := p.ReadPage(500, make([]byte, PageSize)); !errors.Is(err, ErrBadPage) {
		t.Fatalf("ReadPage past the end of the file = %v, want ErrBadPage", err)
	}
}

func TestAllocateGrowsTheFile(t *testing.T) {
	p := openPager(t, filepath.Join(t.TempDir(), "data.db"))
	defer p.Close()
	for want := PageNo(1); want <= 4; want++ {
		got, err := p.Allocate()
		if err != nil {
			t.Fatalf("Allocate: %v", err)
		}
		if got != want {
			t.Fatalf("Allocate = %d, want %d (page 0 is the header)", got, want)
		}
	}
	if m := p.Meta(); m.PageCount != 5 {
		t.Fatalf("PageCount = %d, want 5", m.PageCount)
	}
	// An allocated page exists on disk even before anyone writes it.
	if err := p.ReadPage(4, make([]byte, PageSize)); err != nil {
		t.Fatalf("ReadPage of a fresh page: %v", err)
	}
}

func TestFreeThenAllocateReuses(t *testing.T) {
	p := openPager(t, filepath.Join(t.TempDir(), "data.db"))
	defer p.Close()
	var nos [3]PageNo
	for i := range nos {
		nos[i], _ = p.Allocate()
	}
	if err := p.Free(nos[1]); err != nil {
		t.Fatalf("Free: %v", err)
	}
	if err := p.Free(nos[2]); err != nil {
		t.Fatalf("Free: %v", err)
	}
	// Last freed, first reused.
	for _, want := range []PageNo{nos[2], nos[1], 4} {
		got, err := p.Allocate()
		if err != nil {
			t.Fatal(err)
		}
		if got != want {
			t.Fatalf("Allocate = %d, want %d", got, want)
		}
	}
	if m := p.Meta(); m.PageCount != 5 || m.FreeHead != 0 {
		t.Fatalf("meta = %+v, want PageCount 5 and an empty freelist", m)
	}
}

func TestFreeRejectsBadPages(t *testing.T) {
	p := openPager(t, filepath.Join(t.TempDir(), "data.db"))
	defer p.Close()
	p.Allocate()
	for _, no := range []PageNo{0, 9} {
		if err := p.Free(no); !errors.Is(err, ErrBadPage) {
			t.Fatalf("Free(%d) = %v, want ErrBadPage", no, err)
		}
	}
}

func TestStateSurvivesReopen(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data.db")
	p := openPager(t, path)
	a, _ := p.Allocate()
	b, _ := p.Allocate()
	c, _ := p.Allocate()
	if err := p.WritePage(c, page(9)); err != nil {
		t.Fatal(err)
	}
	if err := p.Free(b); err != nil {
		t.Fatal(err)
	}
	p.SetRoot(a)
	if err := p.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}

	p = openPager(t, path)
	defer p.Close()
	if got := p.Root(); got != a {
		t.Fatalf("Root after reopen = %d, want %d", got, a)
	}
	got := make([]byte, PageSize)
	if err := p.ReadPage(c, got); err != nil || got[0] != 9 {
		t.Fatalf("page %d after reopen: err=%v first byte=%d", c, err, got[0])
	}
	if no, err := p.Allocate(); err != nil || no != b {
		t.Fatalf("Allocate after reopen = %d, %v; want the freed page %d", no, err, b)
	}
	if no, _ := p.Allocate(); no != 4 {
		t.Fatalf("next Allocate = %d, want 4 (file must not have forgotten its size)", no)
	}
}

func TestOpenRejectsAForeignFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data.db")
	if err := os.WriteFile(path, bytes.Repeat([]byte("not a page file "), PageSize/16), 0o644); err != nil {
		t.Fatal(err)
	}
	if p, err := Open(path); err == nil {
		p.Close()
		t.Fatal("Open accepted a file that is not a page file")
	}
}

func TestOpenRejectsACorruptHeader(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data.db")
	p := openPager(t, path)
	p.Close()
	f, _ := os.OpenFile(path, os.O_RDWR, 0)
	f.WriteAt([]byte{0x55}, 3)
	f.Close()
	if p, err := Open(path); !errors.Is(err, ErrChecksum) {
		if err == nil {
			p.Close()
		}
		t.Fatalf("Open with a damaged header = %v, want ErrChecksum", err)
	}
}
