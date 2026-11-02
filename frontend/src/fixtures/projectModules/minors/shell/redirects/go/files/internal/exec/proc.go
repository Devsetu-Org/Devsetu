package exec

import (
	"os"
	osexec "os/exec"
)

// proc is one started external command plus redirect files to close after Wait.
type proc struct {
	cmd   *osexec.Cmd
	files []*os.File
}
