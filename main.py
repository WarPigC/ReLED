from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import aiosqlite
import asyncio

DB_PATH = "led.db"


# --- Schemas ---

class LEDState(BaseModel):
    mode: str = "solid"       # solid | rainbow | pulse | chase | sparkle
    color: str = "#ff0000"
    brightness: int = 255     # 0-255
    speed: int = 50           # 1-100

class Pattern(LEDState):
    id: Optional[int] = None
    name: str


# --- Database helpers ---

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS active_state (
                id      INTEGER PRIMARY KEY CHECK (id = 1),
                mode    TEXT    NOT NULL DEFAULT 'solid',
                color   TEXT    NOT NULL DEFAULT '#ff0000',
                brightness INTEGER NOT NULL DEFAULT 255,
                speed   INTEGER NOT NULL DEFAULT 50
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS patterns (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT    NOT NULL UNIQUE,
                mode       TEXT    NOT NULL,
                color      TEXT    NOT NULL,
                brightness INTEGER NOT NULL,
                speed      INTEGER NOT NULL
            )
        """)
        # Ensure there is always exactly one active-state row
        await db.execute("""
            INSERT OR IGNORE INTO active_state (id, mode, color, brightness, speed)
            VALUES (1, 'solid', '#ff0000', 255, 50)
        """)
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Lumina LED API", lifespan=lifespan)


# --- Active State endpoints (used by both the UI and the ESP32) ---

@app.get("/api/state", response_model=LEDState)
async def get_state():
    """
    ESP32 polls this endpoint to know what to render.
    """
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM active_state WHERE id = 1") as cur:
            row = await cur.fetchone()
    return LEDState(**dict(row))


@app.post("/api/state", response_model=LEDState)
async def update_state(state: LEDState):
    """
    UI pushes the desired LED state here.
    """
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            UPDATE active_state
            SET mode=?, color=?, brightness=?, speed=?
            WHERE id = 1
            """,
            (state.mode, state.color, state.brightness, state.speed)
        )
        await db.commit()
    return state


# --- Pattern CRUD endpoints ---

@app.get("/api/patterns", response_model=list[Pattern])
async def list_patterns():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM patterns ORDER BY id") as cur:
            rows = await cur.fetchall()
    return [Pattern(**dict(r)) for r in rows]


@app.post("/api/patterns", response_model=Pattern, status_code=201)
async def create_pattern(pattern: Pattern):
    async with aiosqlite.connect(DB_PATH) as db:
        try:
            cur = await db.execute(
                """
                INSERT INTO patterns (name, mode, color, brightness, speed)
                VALUES (?, ?, ?, ?, ?)
                """,
                (pattern.name, pattern.mode, pattern.color,
                 pattern.brightness, pattern.speed)
            )
            await db.commit()
            pattern.id = cur.lastrowid
        except aiosqlite.IntegrityError:
            raise HTTPException(status_code=409, detail="Pattern name already exists")
    return pattern


@app.put("/api/patterns/{pattern_id}", response_model=Pattern)
async def update_pattern(pattern_id: int, pattern: Pattern):
    async with aiosqlite.connect(DB_PATH) as db:
        result = await db.execute(
            """
            UPDATE patterns
            SET name=?, mode=?, color=?, brightness=?, speed=?
            WHERE id=?
            """,
            (pattern.name, pattern.mode, pattern.color,
             pattern.brightness, pattern.speed, pattern_id)
        )
        await db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Pattern not found")
    pattern.id = pattern_id
    return pattern


@app.delete("/api/patterns/{pattern_id}", status_code=204)
async def delete_pattern(pattern_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        result = await db.execute(
            "DELETE FROM patterns WHERE id=?", (pattern_id,)
        )
        await db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Pattern not found")


@app.post("/api/patterns/{pattern_id}/activate", response_model=LEDState)
async def activate_pattern(pattern_id: int):
    """Load a saved pattern into the active state."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM patterns WHERE id=?", (pattern_id,)
        ) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Pattern not found")
        p = dict(row)
        await db.execute(
            """
            UPDATE active_state
            SET mode=?, color=?, brightness=?, speed=?
            WHERE id = 1
            """,
            (p["mode"], p["color"], p["brightness"], p["speed"])
        )
        await db.commit()
    state = LEDState(
        mode=p["mode"], color=p["color"],
        brightness=p["brightness"], speed=p["speed"]
    )
    return state


# Serve frontend last so API routes take priority
app.mount("/", StaticFiles(directory="static", html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
