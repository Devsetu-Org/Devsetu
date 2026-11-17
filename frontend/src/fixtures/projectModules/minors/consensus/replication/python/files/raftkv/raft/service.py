"""labrpc Handler for a Raft node."""

from __future__ import annotations

from raftkv.labrpc import ErrDown, decode, encode

from .rpc import (
    METHOD_APPEND_ENTRIES,
    METHOD_REQUEST_VOTE,
    AppendEntriesArgs,
    RequestVoteArgs,
)


class ServiceMixin:
    def handle(self, method: str, data: bytes) -> bytes:
        if self.killed():
            raise ErrDown("raft: node is down")
        if method == METHOD_REQUEST_VOTE:
            args = decode(data)
            if not isinstance(args, RequestVoteArgs):
                # Allow plain decode of RequestVoteArgs
                pass
            reply = self.request_vote(args)
            return encode(reply)
        if method == METHOD_APPEND_ENTRIES:
            args = decode(data)
            reply = self.append_entries(args)
            return encode(reply)
        raise ValueError(f"raft: unknown method {method!r}")
