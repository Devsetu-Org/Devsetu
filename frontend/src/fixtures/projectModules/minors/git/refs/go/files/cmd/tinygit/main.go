package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/ref"
	"github.com/devlabs/tinygit/internal/repo"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	if err := run(os.Args[1], os.Args[2:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, `tinygit <command>
  init | hash-object | cat-file | update-ref`)
}

func run(cmd string, args []string) error {
	switch cmd {
	case "init":
		root := "."
		if len(args) > 0 {
			root = args[0]
		}
		r, err := repo.Init(root)
		if err != nil {
			return err
		}
		fmt.Println("initialized", r.GitDir())
		return nil
	case "hash-object":
		if len(args) < 1 {
			return fmt.Errorf("hash-object <file>")
		}
		r, err := repo.Open(".")
		if err != nil {
			return err
		}
		data, err := os.ReadFile(args[0])
		if err != nil {
			return err
		}
		h, err := object.PutBlob(r.Objects(), data)
		if err != nil {
			return err
		}
		fmt.Println(h.Hex())
		return nil
	case "cat-file":
		if len(args) < 2 {
			return fmt.Errorf("cat-file -t|-p <hash>")
		}
		r, err := repo.Open(".")
		if err != nil {
			return err
		}
		h, err := object.ParseHex(args[1])
		if err != nil {
			return err
		}
		typ, content, err := r.Objects().Get(h)
		if err != nil {
			return err
		}
		if args[0] == "-t" {
			fmt.Println(typ)
			return nil
		}
		os.Stdout.Write(content)
		if typ != object.TypeBlob && !strings.HasSuffix(string(content), "\n") {
			fmt.Println()
		}
		return nil
	case "update-ref":
		if len(args) < 2 {
			return fmt.Errorf("update-ref <name> <hash>")
		}
		r, err := repo.Open(".")
		if err != nil {
			return err
		}
		h, err := object.ParseHex(args[1])
		if err != nil {
			return err
		}
		return ref.UpdateRef(r, args[0], h, object.Zero)
	default:
		usage()
		return fmt.Errorf("unknown command %q", cmd)
	}
}
