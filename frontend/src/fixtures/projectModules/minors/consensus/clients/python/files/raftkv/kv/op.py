"""Op encoding for the Raft log."""

from __future__ import annotations

import pickle
from dataclasses import dataclass, field

OP_GET = 1
OP_PUT = 2
OP_DELETE = 3

OpGet = OP_GET
OpPut = OP_PUT
OpDelete = OP_DELETE

ERR_NOT_LEADER = "not leader"
ERR_TIMEOUT = "timeout"


@dataclass
class Op:
    kind: int = 0
    key: bytes = b""
    value: bytes = b""
    client_id: int = 0
    seq: int = 0


def encode_op(op: Op) -> bytes:
    return pickle.dumps(op, protocol=pickle.HIGHEST_PROTOCOL)


def decode_op(data: bytes) -> Op:
    return pickle.loads(data)


@dataclass
class ExecuteArgs:
    op: Op = field(default_factory=Op)


@dataclass
class ExecuteReply:
    err: str = ""
    value: bytes = b""
    found: bool = False
    leader: int = -1
