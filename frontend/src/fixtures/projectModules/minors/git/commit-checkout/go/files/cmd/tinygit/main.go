package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/devlabs/tinygit/internal/index"
	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/ref"
	"github.com/devlabs/tinygit/internal/repo"
	"github.com/devlabs/tinygit/internal/worktree"
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
  init | hash-object | cat-file | update-ref | add | status
  write-tree | commit | checkout`)
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
	case "add":
		if len(args) < 1 {
			return fmt.Errorf("add <path>")
		}
		r, err := repo.Open(".")
		if err != nil {
			return err
		}
		return index.Add(r, args[0])
	case "status":
		r, err := repo.Open(".")
		if err != nil {
			return err
		}
		st, err := index.Status(r)
		if err != nil {
			return err
		}
		printList("Staged", st.Staged)
		printList("Modified", st.Modified)
		printList("Untracked", st.Untracked)
		return nil
	case "write-tree":
		r, err := repo.Open(".")
		if err != nil {
			return err
		}
		h, err := worktree.WriteTree(r)
		if err != nil {
			return err
		}
		fmt.Println(h.Hex())
		return nil
	case "commit":
		msg := ""
		for i := 0; i < len(args); i++ {
			if args[i] == "-m" && i+1 < len(args) {
				msg = args[i+1]
				break
			}
		}
		r, err := repo.Open(".")
		if err != nil {
			return err
		}
		h, err := worktree.Commit(r, worktree.CommitOpts{Message: msg})
		if err != nil {
			return err
		}
		fmt.Println(h.Hex())
		return nil
	case "checkout":
		if len(args) < 1 {
			return fmt.Errorf("checkout <branch|hash>")
		}
		r, err := repo.Open(".")
		if err != nil {
			return err
		}
		if h, err := object.ParseHex(args[0]); err == nil {
			return worktree.Checkout(r, h)
		}
		return worktree.CheckoutBranch(r, args[0])
	default:
		usage()
		return fmt.Errorf("unknown command %q", cmd)
	}
}

func printList(title string, paths []string) {
	if len(paths) == 0 {
		return
	}
	fmt.Println(title + ":")
	for _, p := range paths {
		fmt.Println("  ", p)
	}
}
