from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


class ProviderError(RuntimeError):
    """A provider request or response failed with a user-visible cause."""


@dataclass(frozen=True)
class RawDataArtifact:
    raw_path: Path
    sidecar_path: Path
    sha256: str
    payload: dict[str, Any]
    metadata: dict[str, Any]
