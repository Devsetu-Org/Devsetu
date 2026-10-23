package main

import (
	"fmt"
	"io"
	"os"

	"github.com/devlabs/sqlq/internal/parse"
)

func main() {
	src, err := io.ReadAll(os.Stdin)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	stmt, err := parse.Parse(string(src))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	switch s := stmt.(type) {
	case *parse.Select:
		fmt.Printf("SELECT %d cols FROM %s\n", len(s.Items), s.From)
	default:
		fmt.Printf("%T\n", stmt)
	}
}
