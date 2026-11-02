import type { ChapterReading } from './types';

/** Shell minor, chapter 00: lines become processes. */
export const SHELL_OVERVIEW: ChapterReading = {
  eyebrow: 'Shell · Chapter 00',
  title: 'Shells: from a line of text to running processes',
  lede:
    'Start here before writing any code. We look at **what a Unix shell actually does**, how a line becomes argv and file descriptors, where that shows up every day, and exactly what you will build across the five chapters of this minor.',
  showBlogStamp: true,
  sections: [
    {
      id: 'what-it-is',
      title: 'What a shell is',
      body: [
        'A shell is a small language whose verbs are programs. You type a line; it tokenizes, decides what is a word and what is an operator, starts one or more processes, and waits (or does not) for them to finish.',
        'The kernel runs the programs. The shell’s job is **argv** and **file descriptors**: who gets which arguments, and where stdin, stdout, and stderr point before `exec`.',
      ],
      subsections: [
        {
          id: 'not-the-kernel',
          title: 'Not a kernel project',
          body: [
            'You will call the process APIs Go exposes (`os/exec`, pipes, files). You will not write a scheduler. The learning is the shell’s side: parsing, wiring fds, pipelines, and a light jobs model.',
          ],
        },
        {
          id: 'everyday',
          title: 'Where you already use this',
          body: [
            '`ls | grep go > out.txt` is tokenize, two processes, a pipe, and a redirect. Bash, zsh, and fish all do that dance. The syntax differs; the fd story does not.',
          ],
        },
      ],
      callout: {
        kind: 'idea',
        title: 'Operators are not arguments',
        body: [
          '`>` and `|` are tokens of their own. They never appear in argv of the child. The shell consumes them, opens files or pipes, then starts the program with only the words.',
        ],
      },
    },
    {
      id: 'pipeline',
      title: 'One line, three stages',
      body: ['Take a pipeline and follow it.'],
      code: {
        language: 'plaintext',
        filename: 'pipeline',
        code: 'echo hello | tr a-z A-Z > out.txt',
      },
      flows: [
        {
          title: 'Parse',
          steps: ['Characters', 'Tokens', 'Commands + operators'],
        },
        {
          title: 'Run',
          steps: ['Open out.txt', 'Pipe', 'Start echo', 'Start tr', 'Wait'],
        },
      ],
      after: [
        '**Lexer.** Words, quotes, `|`, `>`, `>>`, `<`, `2>`, and `&`.',
        '**Exec.** PATH lookup, argv, exit status. Builtins `cd` and `exit` do not spawn.',
        '**Redirects.** Open files and dup onto 0, 1, or 2 in the child.',
        '**Pipes.** Connect stdout of one to stdin of the next. Close unused ends.',
        '**Jobs.** `&` skips the wait; `wait` reaps. Foreground pipelines get a simple interrupt story.',
      ],
    },
    {
      id: 'what-you-build',
      title: 'What you will build in this minor',
      body: [
        'Over five chapters you build **tinysh**, a small shell in Go. Tests run gold scripts and compare stdout, stderr, and exit status.',
      ],
      table: {
        headers: ['Chapter', 'You build', 'Done when'],
        rows: [
          [
            '**01 · Lexer**',
            'Quotes, escapes, words, and operator tokens',
            'Fixed lines tokenize the same way every time',
          ],
          [
            '**02 · Exec**',
            'PATH lookup, run, wait, cd, exit',
            'Simple commands match exit status and output',
          ],
          [
            '**03 · Redirects**',
            '`>`, `>>`, `<`, `2>`',
            'Files receive the right bytes; argv has no operators',
          ],
          [
            '**04 · Pipes**',
            'Pipelines of two or more commands',
            'Data flows left to right; status is the last command’s',
          ],
          [
            '**05 · Jobs**',
            'Background `&` and `wait`',
            'Background work finishes; wait reaps the right status',
          ],
          [
            '**06 · Benchmark** (coming soon)',
            'Your shell against the reference on the same scripts',
            'Outputs match, then you see how the time compares',
          ],
        ],
      },
    },
    {
      id: 'how-chapters-work',
      title: 'How each chapter works',
      body: [],
      bullets: [
        '**Theory on the left, code on the right.** Each chapter opens with a short read, then sends you into the repository with clearly marked `TODO` blocks.',
        '**Small tasks.** A chapter has a few tasks, and each turns green as you finish it.',
        '**Tests decide.** When `make test` passes, the chapter is complete. Gold scripts are the judge.',
        '**Your code carries forward.** Each chapter starts from your own earlier work, with an opt-in reference solution if you get stuck.',
      ],
      after: [
        '**What you need:** comfortable Go and a basic idea of processes. No prior shell internals.',
      ],
      callout: {
        kind: 'scope',
        title: 'Deliberately left out',
        body: [
          'Full job control with process groups and a controlling TTY, `$(…)` and backticks, functions, aliases, arrays, globs, and a scripting language beyond one line at a time. Those are later minors. This one gets pipes right.',
        ],
      },
    },
  ],
  takeaways: [
    'A shell’s job is argv and file descriptors. The kernel runs the programs.',
    'Operators are tokens for the shell, never arguments to the child.',
    'Redirects open files before exec. Pipes connect processes before exec.',
    'Pipeline status is the last command. Background skips wait until you ask.',
    'Bash, zsh, and fish differ in syntax; the fd model is shared.',
  ],
};
