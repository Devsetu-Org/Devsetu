// Command lsmkv is a REPL over the store as it grows. It keeps its data in a
// directory: a write-ahead log plus the SSTables flushed from the memtable.
package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/devlabs/lsmkv/internal/db"
)

const help = `commands:
  put <key> <value>   store a value
  get <key>           look a key up
  del <key>           delete a key
  scan [from] [to]    list live keys in order, from included, to excluded
  flush               write the memtable to a new SSTable now
  compact             merge every table into one
  stats               sizes, table count, and write amplification
  quit`

func main() {
	dir := flag.String("dir", "data", "data directory")
	flag.Parse()

	d, err := db.Open(*dir, db.Options{})
	if err != nil {
		fmt.Fprintln(os.Stderr, "open:", err)
		os.Exit(1)
	}
	defer d.Close()

	s := d.Stats()
	fmt.Printf("lsmkv: memtable, log, and SSTables (chapter 5). dir=%s, %d tables, recovered %d log entries. Type 'help'.\n",
		*dir, s.Tables, s.MemtableEntries)

	in := bufio.NewScanner(os.Stdin)
	for {
		fmt.Print("> ")
		if !in.Scan() {
			fmt.Println()
			return
		}
		fields := strings.Fields(in.Text())
		if len(fields) == 0 {
			continue
		}
		switch cmd, args := strings.ToLower(fields[0]), fields[1:]; {
		case cmd == "put" && len(args) >= 2:
			report(d.Put([]byte(args[0]), []byte(strings.Join(args[1:], " "))))
		case cmd == "get" && len(args) == 1:
			value, ok, err := d.Get([]byte(args[0]))
			switch {
			case err != nil:
				fmt.Println("error:", err)
			case ok:
				fmt.Printf("%q\n", value)
			default:
				fmt.Println("(not found)")
			}
		case cmd == "del" && len(args) == 1:
			report(d.Delete([]byte(args[0])))
		case cmd == "scan" && len(args) <= 2:
			var from, to []byte
			if len(args) >= 1 {
				from = []byte(args[0])
			}
			if len(args) == 2 {
				to = []byte(args[1])
			}
			err := d.Scan(from, to, func(k, v []byte) bool {
				fmt.Printf("%s  %q\n", k, v)
				return true
			})
			if err != nil {
				fmt.Println("error:", err)
			}
		case cmd == "flush":
			report(d.Flush())
		case cmd == "compact":
			report(d.Compact())
		case cmd == "stats":
			s := d.Stats()
			fmt.Printf("memtable entries=%d bytes=%d  wal bytes=%d\n", s.MemtableEntries, s.MemtableBytes, s.WALBytes)
			fmt.Printf("tables=%d bytes=%d  compactions=%d\n", s.Tables, s.TableBytes, s.Compactions)
			if s.FlushedBytes > 0 {
				fmt.Printf("since open: flushed=%d compacted=%d  write amplification=%.2f\n",
					s.FlushedBytes, s.CompactedBytes, float64(s.FlushedBytes+s.CompactedBytes)/float64(s.FlushedBytes))
			}
		case cmd == "quit" || cmd == "exit":
			return
		default:
			fmt.Println(help)
		}
	}
}

func report(err error) {
	if err != nil {
		fmt.Println("error:", err)
	} else {
		fmt.Println("OK")
	}
}
