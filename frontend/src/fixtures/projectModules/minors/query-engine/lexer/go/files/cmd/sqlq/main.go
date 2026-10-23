package main

import (
	"fmt"
	"io"
	"os"

	"github.com/devlabs/sqlq/internal/lex"
)

func main() {
	src, err := io.ReadAll(os.Stdin)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	toks, err := lex.Scan(string(src))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	for _, t := range toks {
		if t.Kind == lex.EOF {
			break
		}
		if t.Lit != "" && t.Kind != lex.Ident && t.Kind != lex.Int && t.Kind != lex.String {
			fmt.Printf("%s\n", t.Kind)
			continue
		}
		if t.Lit != "" {
			fmt.Printf("%s %s\n", t.Kind, t.Lit)
			continue
		}
		fmt.Printf("%s\n", t.Kind)
	}
}
