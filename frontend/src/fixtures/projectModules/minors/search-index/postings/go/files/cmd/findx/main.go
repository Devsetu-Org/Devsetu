package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/devlabs/findx/internal/analyze"
	"github.com/devlabs/findx/internal/postings"
)

func main() {
	m := postings.NewMap()
	var docID uint32
	in := bufio.NewScanner(os.Stdin)
	fmt.Fprintln(os.Stderr, "findx postings. One document per line. Ctrl-D to encode.")
	for in.Scan() {
		tf := map[string]uint32{}
		for _, t := range analyze.Analyze(in.Text()) {
			tf[t]++
		}
		for term, n := range tf {
			m.Add(term, docID, n)
		}
		docID++
	}
	if err := postings.WriteSegment(os.Stdout, m); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	_ = strings.TrimSpace
}
