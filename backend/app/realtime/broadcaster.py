"""In-process WebSocket pub/sub broadcaster."""

from typing import Any

from fastapi import WebSocket

# Connected sockets keyed by user_id.
_sockets: dict[int, list[tuple[WebSocket, str]]] = {}


async def connect(websocket: WebSocket, user_id: int, role: str) -> None:
    await websocket.accept()
    _sockets.setdefault(user_id, []).append((websocket, role))


def disconnect(websocket: WebSocket) -> None:
    for uid, list_ in list(_sockets.items()):
        before = len(list_)
        _sockets[uid] = [(ws, r) for ws, r in list_ if ws != websocket]
        if len(_sockets[uid]) == 0:
            del _sockets[uid]
        elif len(_sockets[uid]) < before:
            break


async def emit(
    event: str,
    payload: dict[str, Any],
    audience: str = "all",
    user_id: int | None = None,
) -> None:
    """Push an event to the matching audience.

    audience:
        'all'    -> every connected socket
        'admins' -> sockets belonging to admin users
        'user'   -> sockets belonging to user_id
    """
    message = {"event": event, **payload}
    targets: list[WebSocket] = []

    for uid, list_ in _sockets.items():
        for ws, role in list_:
            if audience == "all":
                targets.append(ws)
            elif audience == "admins" and role == "admin":
                targets.append(ws)
            elif audience == "user" and uid == user_id:
                targets.append(ws)

    for ws in targets:
        try:
            await ws.send_json(message)
        except Exception:
            pass
