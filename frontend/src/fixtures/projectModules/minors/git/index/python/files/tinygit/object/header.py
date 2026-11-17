"""Git object header encode/split."""
from __future__ import annotations


def encode_header(typ: str, content: bytes) -> bytes:
    """Build the Git object header ``type size\\0`` plus content."""
    hdr = f"{typ} {len(content)}\x00".encode()
    return hdr + content


def split_header(data: bytes) -> tuple[str, bytes]:
    """Split a decoded object into type and content."""
    nul = data.find(b"\x00")
    if nul < 0:
        raise ValueError("object: missing header NUL")
    space = data.find(b" ", 0, nul)
    if space < 0:
        raise ValueError("object: missing type/size space")
    typ = data[:space].decode()
    size_str = data[space + 1 : nul].decode()
    try:
        size = int(size_str)
    except ValueError as e:
        raise ValueError(f"object: bad size: {e}") from e
    content = data[nul + 1 :]
    if len(content) != size:
        raise ValueError(f"object: size mismatch: header {size} body {len(content)}")
    return typ, content
