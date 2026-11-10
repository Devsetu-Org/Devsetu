import io
import os
import tempfile
import unittest

from tinysh.exec import Shell


def run_lines(directory, *lines):
    out = io.StringIO()
    err = io.StringIO()
    sh = Shell(
        stdin=io.StringIO(""),
        stdout=out,
        stderr=err,
        dir=directory,
        env=[f"{k}={v}" for k, v in os.environ.items()],
    )
    status = 0
    for line in lines:
        status = sh.run_line(line)
        if sh.exited():
            status = sh.last_status()
            break
    return out.getvalue(), err.getvalue(), status


class TestGold(unittest.TestCase):
    def test_echo(self):
        with tempfile.TemporaryDirectory() as d:
            stdout, stderr, st = run_lines(d, "echo hello")
            self.assertEqual(st, 0)
            self.assertEqual(stderr, "")
            self.assertEqual(stdout, "hello\n")

    def test_exit_status(self):
        with tempfile.TemporaryDirectory() as d:
            _, _, st = run_lines(d, "false")
            self.assertNotEqual(st, 0)
            _, _, st = run_lines(d, "true")
            self.assertEqual(st, 0)

    def test_cd(self):
        with tempfile.TemporaryDirectory() as d:
            sub = os.path.join(d, "sub")
            os.mkdir(sub)
            stdout, _, st = run_lines(d, "cd sub", "pwd")
            self.assertEqual(st, 0)
            self.assertEqual(os.path.realpath(stdout.strip()), os.path.realpath(sub))

    def test_exit_builtin(self):
        with tempfile.TemporaryDirectory() as d:
            _, _, st = run_lines(d, "exit 7")
            self.assertEqual(st, 7)

    def test_redirect_out(self):
        with tempfile.TemporaryDirectory() as d:
            _, _, st = run_lines(d, "echo hello > out.txt")
            self.assertEqual(st, 0)
            with open(os.path.join(d, "out.txt")) as f:
                self.assertEqual(f.read(), "hello\n")

    def test_redirect_append(self):
        with tempfile.TemporaryDirectory() as d:
            _, _, st = run_lines(d, "echo a > out.txt", "echo b >> out.txt")
            self.assertEqual(st, 0)
            with open(os.path.join(d, "out.txt")) as f:
                self.assertEqual(f.read(), "a\nb\n")

    def test_redirect_in(self):
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, "in.txt"), "w") as f:
                f.write("xyz\n")
            stdout, _, st = run_lines(d, "cat < in.txt")
            self.assertEqual(st, 0)
            self.assertEqual(stdout, "xyz\n")

    def test_redirect_err(self):
        with tempfile.TemporaryDirectory() as d:
            _, _, st = run_lines(d, "sh -c 'echo oops 1>&2' 2> err.txt")
            self.assertEqual(st, 0)
            with open(os.path.join(d, "err.txt")) as f:
                self.assertEqual(f.read(), "oops\n")

    def test_pipe(self):
        with tempfile.TemporaryDirectory() as d:
            stdout, _, st = run_lines(d, "printf 'abc\\n' | tr a-z A-Z")
            self.assertEqual(st, 0)
            self.assertEqual(stdout, "ABC\n")

    def test_pipe_status(self):
        with tempfile.TemporaryDirectory() as d:
            _, _, st = run_lines(d, "true | false")
            self.assertNotEqual(st, 0)
            _, _, st = run_lines(d, "false | true")
            self.assertEqual(st, 0)

    def test_quotes_in_argv(self):
        with tempfile.TemporaryDirectory() as d:
            stdout, _, st = run_lines(d, "echo 'a b'")
            self.assertEqual(st, 0)
            self.assertEqual(stdout, "a b\n")

    def test_command_not_found(self):
        with tempfile.TemporaryDirectory() as d:
            _, stderr, st = run_lines(d, "definitely-not-a-real-command-xyz")
            self.assertNotEqual(st, 0)
            self.assertTrue("not found" in stderr or "definitely-not" in stderr)


if __name__ == "__main__":
    unittest.main()
