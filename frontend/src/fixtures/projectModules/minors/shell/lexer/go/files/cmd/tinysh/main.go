package main

import (
	"fmt"
	"io"
	"os"

	"github.com/devlabs/tinysh/internal/lex"
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
		if t.Kind == lex.Word {
			fmt.Printf("%s %q\n", t.Kind, t.Lit)
			continue
		}
		fmt.Printf("%s\n", t.Kind)
	}
}
