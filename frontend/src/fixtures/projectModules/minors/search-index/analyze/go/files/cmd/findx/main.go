package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/devlabs/findx/internal/analyze"
)

func main() {
	in := bufio.NewScanner(os.Stdin)
	for in.Scan() {
		toks := analyze.Analyze(in.Text())
		fmt.Println(strings.Join(toks, " "))
	}
}
