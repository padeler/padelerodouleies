# Unstructured list of TODOs/bugs from using the application

- [x] Many icons in the setup screen are missing — FIXED: replaced 6 non-existent icons with existing SVGs
- [x] a user should not be able to delete himself — FIXED: backend guard + frontend hides delete button
- [x] on create user all icons are fetched and this is slow — FIXED: added loading="lazy" to icon images
- [x] on "new chore" if start time is not set the server responds 422 — FIXED: empty string → null conversion
- [x] When a user has image for icon (not one of the svgs) it does not show on the login page — FIXED: removed double-prefix
- [x] Themes should be added controlled by the each user in their settings — FIXED: system/light/dark toggle
- [x] when a user logsout it takes him back to the entry page without reloading it — FIXED: React Query cache clear on logout
- [x] The pin pad for entering the password should work with keyboard input as well — FIXED: keydown listener added
- [x] as a user logged in browsing the dashboard throws the following exceptions on the backend: 
```bash
    INFO:     connection open
    INFO:     connection closed
    INFO:     127.0.0.1:36486 - "WebSocket /ws" [accepted]
    ERROR:    Exception in ASGI application
    Traceback (most recent call last):
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/uvicorn/protocols/websockets/websockets_impl.py", line 239, in run_asgi
        result = await self.app(self.scope, self.asgi_receive, self.asgi_send)  # type: ignore[func-returns-value]
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/uvicorn/middleware/proxy_headers.py", line 63, in __call__
        return await self.app(scope, receive, send)
            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/fastapi/applications.py", line 1159, in __call__
        await super().__call__(scope, receive, send)
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/starlette/applications.py", line 90, in __call__
        await self.middleware_stack(scope, receive, send)
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/starlette/middleware/errors.py", line 151, in __call__
        await self.app(scope, receive, send)
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/starlette/middleware/exceptions.py", line 63, in __call__
        await wrap_app_handling_exceptions(self.app, conn)(scope, receive, send)
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 53, in wrapped_app
        raise exc
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 42, in wrapped_app
        await app(scope, receive, sender)
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/fastapi/middleware/asyncexitstack.py", line 18, in __call__
        await self.app(scope, receive, send)
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/starlette/routing.py", line 660, in __call__
        await self.middleware_stack(scope, receive, send)
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/starlette/routing.py", line 680, in app
        await route.handle(scope, receive, send)
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/starlette/routing.py", line 350, in handle
        await self.app(scope, receive, send)
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/fastapi/routing.py", line 160, in app
        await wrap_app_handling_exceptions(app, session)(scope, receive, send)
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 53, in wrapped_app
        raise exc
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 42, in wrapped_app
        await app(scope, receive, sender)
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/fastapi/routing.py", line 157, in app
        await func(session)
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/fastapi/routing.py", line 764, in app
        await dependant.call(**solved_result.values)
    File "/home/padeler/work/padelerodouleies/backend/app/main.py", line 90, in websocket_endpoint
        await broadcaster.connect(ws, user.id, user.role)
    File "/home/padeler/work/padelerodouleies/backend/app/realtime/broadcaster.py", line 12, in connect
        await websocket.accept()
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/starlette/websockets.py", line 110, in accept
        await self.send({"type": "websocket.accept", "subprotocol": subprotocol, "headers": headers})
    File "/home/padeler/work/padelerodouleies/backend/.venv/lib/python3.12/site-packages/starlette/websockets.py", line 80, in send
        raise RuntimeError(
    RuntimeError: Expected ASGI message "websocket.send" or "websocket.close", but got 'websocket.accept'"
```