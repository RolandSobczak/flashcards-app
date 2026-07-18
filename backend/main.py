import json
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sympy import symbols, Not
from sympy.logic.boolalg import Xor, Equivalent, simplify_logic

from . import storage
from .auth import get_current_user, router as auth_router
from .models import UserModel
from .sets import router as sets_router

EXERCISES_FILE = Path(__file__).parent / "exercises.json"


@asynccontextmanager
async def lifespan(app: FastAPI):
    storage.ensure_bucket()
    yield


app = FastAPI(title="Flashcards – Tasks API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sets_router)
app.include_router(auth_router)


@app.get("/health")
def health():
    return {"status": "ok"}


def load_exercises() -> list[dict]:
    if not EXERCISES_FILE.exists():
        return []
    return json.loads(EXERCISES_FILE.read_text(encoding="utf-8"))


# ── Answer parser ──────────────────────────────────────────────────────────────

def parse_bool_latex(expr: str, variable_names: list[str]):
    """
    Parse a limited subset of LaTeX Boolean notation into a sympy expression.
    Supported patterns:
      A \\oplus B              → Xor
      A \\odot B               → Not(Xor)
      \\overline{A \\oplus B}  → Not(Xor)
      Single variable A        → symbol
    """
    syms = {v: symbols(v) for v in variable_names}

    s = expr.strip()
    s = re.sub(r"\$+", "", s).strip()
    s = re.sub(r"\s+", " ", s).strip()

    # \\overline{A \\oplus B}  or  \\overline{B \\oplus A}
    m = re.fullmatch(
        r"\\overline\{\s*([A-Z])\s*\\oplus\s*([A-Z])\s*\}", s
    )
    if m and m.group(1) in syms and m.group(2) in syms:
        return Not(Xor(syms[m.group(1)], syms[m.group(2)]))

    # A \\oplus B
    m = re.fullmatch(r"([A-Z])\s*\\oplus\s*([A-Z])", s)
    if m and m.group(1) in syms and m.group(2) in syms:
        return Xor(syms[m.group(1)], syms[m.group(2)])

    # A \\odot B
    m = re.fullmatch(r"([A-Z])\s*\\odot\s*([A-Z])", s)
    if m and m.group(1) in syms and m.group(2) in syms:
        return Not(Xor(syms[m.group(1)], syms[m.group(2)]))

    return None


def answers_equivalent(user: str, expected: str, variable_names: list[str]) -> bool:
    a = parse_bool_latex(user, variable_names)
    b = parse_bool_latex(expected, variable_names)

    if a is None or b is None:
        # Fall back to string normalization
        def norm(s):
            return re.sub(r"\s+", "", s.strip())
        return norm(user) == norm(expected)

    result = simplify_logic(Equivalent(a, b))
    return bool(result)


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/api/exercises")
def get_exercises(user: UserModel = Depends(get_current_user)):
    exercises = load_exercises()
    return [
        {"id": e["id"], "title": e["title"], "question": e["question"]}
        for e in exercises
    ]


@app.get("/api/exercises/{ex_id}/solution")
def get_solution(ex_id: int, user: UserModel = Depends(get_current_user)):
    exercises = load_exercises()
    ex = next((e for e in exercises if e["id"] == ex_id), None)
    if ex is None:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return {"answer": ex["answer"], "steps": ex["steps"]}


class AnswerPayload(BaseModel):
    answer: str


@app.post("/api/exercises/{ex_id}/check")
def check_answer(ex_id: int, payload: AnswerPayload, user: UserModel = Depends(get_current_user)):
    exercises = load_exercises()
    ex = next((e for e in exercises if e["id"] == ex_id), None)
    if ex is None:
        raise HTTPException(status_code=404, detail="Exercise not found")

    correct = answers_equivalent(
        payload.answer, ex["answer"], ex.get("variables", ["A", "B"])
    )
    return {"correct": correct}
