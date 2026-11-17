"""Buffer pool: fixed frames caching pages from the layer below."""

from .pool import Pool, Frame, ErrPoolFull

__all__ = ["Pool", "Frame", "ErrPoolFull"]
