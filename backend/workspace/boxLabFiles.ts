'use strict';

/**
 * Browser editor files for Linux / Git box labs. Paths are relative to
 * /home/learner inside the pod. Bare remotes under /var/git stay unreachable.
 */

const k8s = require('./k8sCluster');
const linuxBox = require('./linuxBox');

const MAX_FILE_BYTES = 256 * 1024;
const MAX_ENTRIES_PER_DIR = 200;
const MAX_FOLDERS_LISTED = 300;
const MAX_DEPTH = 6;
const SEGMENT_RE = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/;
const EXEC_MS = 20_000;

class LabFileError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function splitRel(raw: unknown, allowEmpty: boolean): string[] {
  if (raw == null || raw === '') {
    if (allowEmpty) return [];
    throw new LabFileError(400, 'path is required');
  }
  if (typeof raw !== 'string') throw new LabFileError(400, 'path must be a string');
  const trimmed = raw.trim().replace(/^~(\/|$)/, '').replace(/^\/+|\/+$/g, '');
  if (!trimmed) {
    if (allowEmpty) return [];
    throw new LabFileError(400, 'path is required');
  }
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length > MAX_DEPTH) {
    throw new LabFileError(400, `Paths can be at most ${MAX_DEPTH} levels deep`);
  }
  for (const seg of parts) {
    if (!SEGMENT_RE.test(seg)) {
      throw new LabFileError(
        400,
        `"${seg}" is not allowed — use letters, digits, ".", "_" and "-" (no leading dot).`,
      );
    }
  }
  return parts;
}

function relOf(parts: string[]): string {
  return parts.join('/');
}

/** kubectl exec as learner; positional args after the script become $1, $2, … */
function learnerArgs(ns: string, script: string, positional: string[]): string[] {
  return [
    'exec', '-i', '-n', ns, linuxBox.BOX_POD, '-c', 'box', '--',
    'runuser', '-u', linuxBox.LEARNER_USER, '--',
    'bash', '-c', script, 'bash',
    ...positional,
  ];
}

async function learnerExec(
  ns: string,
  script: string,
  positional: string[],
  opts: { input?: string } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return k8s.runKubectl(learnerArgs(ns, script, positional), {
    input: opts.input,
    timeoutMs: EXEC_MS,
  });
}

function mapExecError(
  rel: string,
  result: { code: number; stderr: string; stdout: string },
  verb: string,
): never {
  const errText = String(result.stderr || result.stdout || '');
  if (/No such file|not a directory|Not a directory/i.test(errText)) {
    const label = rel ? `~/${rel}` : '~';
    throw new LabFileError(404, `${label} not found`);
  }
  if (/File exists|already exists/i.test(errText)) {
    throw new LabFileError(409, `~/${rel} already exists`);
  }
  if (/Is a directory/i.test(errText)) {
    throw new LabFileError(409, `~/${rel} is not a regular file`);
  }
  throw new LabFileError(502, `Could not ${verb} ~/${rel || '.'} on the machine.`);
}

interface LabFileEntry {
  name: string;
  path: string;
  size: number;
  updatedAt: number;
}

const LIST_SCRIPT = `
set -euo pipefail
target="$HOME"
if [ -n "\${1:-}" ]; then target="$HOME/$1"; fi
if [ ! -d "$target" ] || [ -L "$target" ]; then echo "No such file" >&2; exit 1; fi
count=0
# NULL-delimited so odd names cannot break the loop; editor still filters names.
while IFS= read -r -d '' name; do
  case "$name" in
    .*|'') continue ;;
  esac
  echo "$name" | grep -Eq '^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$' || continue
  p="$target/$name"
  if [ -L "$p" ]; then continue; fi
  if [ -d "$p" ]; then
    printf 'D\\t%s\\n' "$name"
  elif [ -f "$p" ]; then
    size=$(wc -c < "$p" | tr -d ' ')
    mtime=$(stat -c '%Y' "$p" 2>/dev/null || echo 0)
    printf 'F\\t%s\\t%s000\\t%s\\n' "$size" "$mtime" "$name"
  else
    continue
  fi
  count=$((count + 1))
  [ "$count" -ge ${MAX_ENTRIES_PER_DIR} ] && break
# read returns 1 at EOF under set -e; that is expected.
done < <(find "$target" -mindepth 1 -maxdepth 1 -printf '%f\\0' 2>/dev/null) || true
`;

async function listDir(
  ns: string,
  rawDir: unknown,
): Promise<{ dir: string; folders: string[]; files: LabFileEntry[] }> {
  const parts = splitRel(rawDir, true);
  const dir = relOf(parts);
  const result = await learnerExec(ns, LIST_SCRIPT, dir ? [dir] : []);
  if (result.code !== 0) mapExecError(dir, result, 'list');

  const folders: string[] = [];
  const files: LabFileEntry[] = [];
  for (const line of String(result.stdout || '').split('\n')) {
    if (!line) continue;
    const cols = line.split('\t');
    if (cols[0] === 'D' && cols[1]) folders.push(cols[1]);
    else if (cols[0] === 'F' && cols[3]) {
      files.push({
        name: cols[3],
        path: dir ? `${dir}/${cols[3]}` : cols[3],
        size: Number(cols[1]) || 0,
        updatedAt: Number(cols[2]) || 0,
      });
    }
  }
  folders.sort((a, b) => a.localeCompare(b));
  files.sort((a, b) => a.name.localeCompare(b.name));
  return { dir, folders, files };
}

async function listAllFolders(ns: string): Promise<string[]> {
  const out: string[] = [];
  const queue: Array<{ rel: string; depth: number }> = [{ rel: '', depth: 0 }];
  while (queue.length > 0 && out.length < MAX_FOLDERS_LISTED) {
    const { rel, depth } = queue.shift()!;
    const listing = await listDir(ns, rel);
    for (const name of listing.folders) {
      const childRel = rel ? `${rel}/${name}` : name;
      out.push(childRel);
      if (out.length >= MAX_FOLDERS_LISTED) break;
      if (depth + 1 < MAX_DEPTH) queue.push({ rel: childRel, depth: depth + 1 });
    }
  }
  return out;
}

async function createFolder(ns: string, rawDir: unknown): Promise<string> {
  const parts = splitRel(rawDir, false);
  const dir = relOf(parts);
  const result = await learnerExec(
    ns,
    'set -euo pipefail; install -d -m 755 "$HOME/$1"',
    [dir],
  );
  if (result.code !== 0) mapExecError(dir, result, 'create');
  return dir;
}

const READ_SCRIPT = `
set -euo pipefail
p="$HOME/$1"
if [ -L "$p" ] || [ ! -f "$p" ]; then echo "No such file" >&2; exit 1; fi
size=$(wc -c < "$p" | tr -d ' ')
if [ "$size" -gt ${MAX_FILE_BYTES} ]; then echo "too large" >&2; exit 41; fi
cat "$p"
`;

async function readFile(ns: string, rawPath: unknown): Promise<{ path: string; content: string }> {
  const parts = splitRel(rawPath, false);
  const rel = relOf(parts);
  const result = await learnerExec(ns, READ_SCRIPT, [rel]);
  if (result.code === 41 || /too large/i.test(result.stderr || '')) {
    throw new LabFileError(413, `~/${rel} is too large to open in the editor`);
  }
  if (result.code !== 0) mapExecError(rel, result, 'read');
  return { path: rel, content: String(result.stdout || '') };
}

const WRITE_SCRIPT = `
set -euo pipefail
p="$HOME/$1"
parent=$(dirname "$p")
install -d -m 755 "$parent"
if [ -e "$p" ] && { [ -L "$p" ] || [ ! -f "$p" ]; }; then echo "Is a directory" >&2; exit 1; fi
count=$(ls -A "$parent" 2>/dev/null | wc -l | tr -d ' ')
if [ ! -e "$p" ] && [ "$count" -ge ${MAX_ENTRIES_PER_DIR} ]; then echo "too many" >&2; exit 42; fi
cat > "$p"
`;

async function writeFile(ns: string, rawPath: unknown, content: unknown): Promise<LabFileEntry> {
  if (typeof content !== 'string') throw new LabFileError(400, 'content must be a string');
  if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) {
    throw new LabFileError(413, 'File is too large (256 KB max)');
  }
  const parts = splitRel(rawPath, false);
  const name = parts[parts.length - 1];
  const rel = relOf(parts);
  const result = await learnerExec(ns, WRITE_SCRIPT, [rel], { input: content });
  if (result.code === 42 || /too many/i.test(result.stderr || '')) {
    throw new LabFileError(409, `Too many entries in this folder (${MAX_ENTRIES_PER_DIR} max)`);
  }
  if (result.code !== 0) mapExecError(rel, result, 'write');
  return {
    name,
    path: rel,
    size: Buffer.byteLength(content, 'utf8'),
    updatedAt: Date.now(),
  };
}

const RENAME_SCRIPT = `
set -euo pipefail
src="$HOME/$1"
dst="$HOME/$2"
if [ -L "$src" ] || [ ! -e "$src" ]; then echo "No such file" >&2; exit 1; fi
if [ -e "$dst" ]; then echo "File exists" >&2; exit 1; fi
install -d -m 755 "$(dirname "$dst")"
mv "$src" "$dst"
if [ -d "$dst" ]; then echo folder; else echo file; fi
`;

async function renameEntry(
  ns: string,
  rawFrom: unknown,
  rawTo: unknown,
): Promise<{ path: string; kind: 'file' | 'folder' }> {
  const fromParts = splitRel(rawFrom, false);
  const toParts = splitRel(rawTo, false);
  const fromRel = relOf(fromParts);
  const toRel = relOf(toParts);
  if (toRel === fromRel) {
    const listing = await listDir(ns, fromParts.slice(0, -1).join('/'));
    const isFile = listing.files.some((f) => f.name === fromParts[fromParts.length - 1]);
    return { path: fromRel, kind: isFile ? 'file' : 'folder' };
  }
  if (toRel.startsWith(`${fromRel}/`)) {
    throw new LabFileError(400, 'A folder cannot be moved inside itself');
  }
  const result = await learnerExec(ns, RENAME_SCRIPT, [fromRel, toRel]);
  if (result.code !== 0) mapExecError(fromRel, result, 'rename');
  const kind = String(result.stdout || '').trim() === 'folder' ? 'folder' : 'file';
  return { path: toRel, kind };
}

async function deleteFile(ns: string, rawPath: unknown): Promise<void> {
  const rel = relOf(splitRel(rawPath, false));
  const result = await learnerExec(
    ns,
    'set -euo pipefail; p="$HOME/$1"; if [ -L "$p" ] || [ ! -f "$p" ]; then echo "No such file" >&2; exit 1; fi; rm -f "$p"',
    [rel],
  );
  if (result.code !== 0) mapExecError(rel, result, 'delete');
}

async function deleteFolder(ns: string, rawDir: unknown): Promise<void> {
  const rel = relOf(splitRel(rawDir, false));
  const result = await learnerExec(
    ns,
    'set -euo pipefail; p="$HOME/$1"; if [ -L "$p" ] || [ ! -d "$p" ]; then echo "No such file" >&2; exit 1; fi; rm -rf "$p"',
    [rel],
  );
  if (result.code !== 0) mapExecError(rel, result, 'delete');
}

module.exports = {
  LabFileError,
  listDir,
  listAllFolders,
  createFolder,
  readFile,
  writeFile,
  renameEntry,
  deleteFile,
  deleteFolder,
};
