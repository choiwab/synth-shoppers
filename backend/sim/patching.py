from __future__ import annotations

from copy import deepcopy
from typing import Any

from contracts import ListingConfig


class PatchError(ValueError):
    pass


def apply_config_patch(config: ListingConfig, patch: list[dict[str, Any]]) -> ListingConfig:
    data = config.model_dump()
    for op in patch:
        operation = op.get("op")
        path = op.get("path")
        if operation not in {"replace", "add"}:
            raise PatchError(f"unsupported patch op: {operation}")
        if not isinstance(path, str) or not path.startswith("/"):
            raise PatchError(f"invalid patch path: {path}")
        _apply_one(data, operation, path, op.get("value"))
    return ListingConfig.model_validate(data)


def _apply_one(data: Any, operation: str, path: str, value: Any) -> None:
    parts = [part for part in path.strip("/").split("/") if part]
    if not parts:
        raise PatchError("patch path cannot target document root")
    target = data
    for part in parts[:-1]:
        target = _descend(target, part)
    key = parts[-1]

    if isinstance(target, list):
        if key == "-":
            if operation != "add":
                raise PatchError("list '-' only supports add")
            target.append(deepcopy(value))
            return
        index = int(key)
        if operation == "add":
            target.insert(index, deepcopy(value))
        else:
            target[index] = deepcopy(value)
        return

    if not isinstance(target, dict):
        raise PatchError(f"cannot patch non-container at {path}")
    if operation == "replace" and key not in target:
        raise PatchError(f"cannot replace missing key: {path}")
    target[key] = deepcopy(value)


def _descend(target: Any, part: str) -> Any:
    if isinstance(target, list):
        return target[int(part)]
    if isinstance(target, dict) and part in target:
        return target[part]
    raise PatchError(f"invalid patch path segment: {part}")

