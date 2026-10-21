// Command raftkv runs a three-node Raft cluster in this process and lets you
// poke it: watch elections, cut links, crash nodes, and offer commands.
package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/devlabs/raftkv/internal/labharness"
)

// reporter prints safety violations instead of failing a test.
type reporter struct{}

func (reporter) Helper() {}
func (reporter) Errorf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "!! "+format+"\n", args...)
}
func (reporter) Fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "!! "+format+"\n", args...)
	os.Exit(1)
}
func (reporter) Cleanup(func()) {}

const help = `commands:
  status            one line per node: role, term, vote, log, commit
  start <text>      offer a command to whichever node leads
  log <n>           print node n's log
  cut <n>           disconnect node n          heal   reconnect everyone
  crash <n>         kill node n                restart <n>   boot it again
  quit`

func main() {
	c := labharness.NewCluster(reporter{}, 3)
	defer c.Shutdown()
	fmt.Println("raftkv: 3 nodes running. Type help.")

	in := bufio.NewScanner(os.Stdin)
	for fmt.Print("> "); in.Scan(); fmt.Print("> ") {
		f := strings.Fields(in.Text())
		if len(f) == 0 {
			continue
		}
		node := -1
		if len(f) > 1 {
			if n, err := strconv.Atoi(f[1]); err == nil && n >= 0 && n < c.N() {
				node = n
			}
		}
		switch f[0] {
		case "help":
			fmt.Println(help)
		case "status":
			for i := 0; i < c.N(); i++ {
				if !c.Up(i) {
					fmt.Printf("node %d  down\n", i)
					continue
				}
				st := c.State(i)
				fmt.Printf("node %d  %-9s term %-3d votedFor %-2d log %-3d commit %-3d applied %d\n",
					i, st.Role, st.Term, st.VotedFor, len(st.Log), st.CommitIndex, st.LastApplied)
			}
		case "start":
			cmd := strings.TrimSpace(strings.TrimPrefix(in.Text(), "start"))
			accepted := false
			for i := 0; i < c.N() && !accepted; i++ {
				if !c.Up(i) {
					continue
				}
				if idx, _, ok := c.Raft(i).Start([]byte(cmd)); ok {
					fmt.Printf("node %d accepted %q at index %d\n", i, cmd, idx)
					accepted = true
				}
			}
			if !accepted {
				fmt.Println("no node accepted it (no leader yet?)")
			}
		case "log":
			if node < 0 {
				fmt.Println("usage: log <node>")
				continue
			}
			for k, e := range c.State(node).Log {
				fmt.Printf("  %d  term %d  %s\n", k+1, e.Term, e.Command)
			}
		case "cut":
			if node >= 0 {
				c.Disconnect(node)
			}
		case "heal":
			c.Heal()
		case "crash":
			if node >= 0 {
				c.Crash(node)
			}
		case "restart":
			if node >= 0 && !c.Up(node) {
				c.Restart(node)
			}
		case "quit", "exit":
			return
		default:
			fmt.Println("unknown command; try help")
		}
	}
}
