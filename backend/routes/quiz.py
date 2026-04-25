import json
import uuid
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db, QuizAttempt
from schemas import (
    QuizResponse, QuizQuestionSchema, QuizSubmitRequest,
    QuizSubmitResponse, QuizResultItem,
)
from data.quiz_questions import QUIZ_DATA

router = APIRouter()


@router.get("/quiz/{lesson_id}", response_model=QuizResponse)
async def get_quiz(lesson_id: int):
    questions = QUIZ_DATA.get(lesson_id)
    if not questions:
        raise HTTPException(status_code=404, detail=f"Квиз для урока {lesson_id} не найден")
    # Return questions without correct answer
    qs = [
        QuizQuestionSchema(
            id=q["id"],
            type=q["type"],
            question=q["question"],
            options=q.get("options"),
        )
        for q in questions
    ]
    return QuizResponse(lesson_id=lesson_id, questions=qs)


@router.post("/quiz/{lesson_id}/submit", response_model=QuizSubmitResponse)
async def submit_quiz(lesson_id: int, req: QuizSubmitRequest, db: Session = Depends(get_db)):
    questions = QUIZ_DATA.get(lesson_id)
    if not questions:
        raise HTTPException(status_code=404, detail=f"Квиз для урока {lesson_id} не найден")

    q_map = {q["id"]: q for q in questions}
    results = []
    score = 0

    for ans in req.answers:
        q = q_map.get(ans.question_id)
        if not q:
            continue
        correct = False
        correct_answer = q.get("correct")
        correct_display = correct_answer

        if q["type"] == "mcq":
            correct = int(ans.answer) == int(correct_answer)
            correct_display = correct_answer
        elif q["type"] == "estimate":
            try:
                val = float(ans.answer)
                tol = correct_answer.get("tolerance", 0.5)
                correct = abs(val - correct_answer["value"]) <= tol
                correct_display = correct_answer["value"]
            except Exception:
                correct_display = correct_answer.get("value", 0)

        if correct:
            score += 1

        results.append(QuizResultItem(
            question_id=ans.question_id,
            correct=correct,
            correct_answer=correct_display,
            explanation=q.get("explanation", ""),
            formula_steps=q.get("formula_steps"),
        ))

    total = len(questions)
    pct = round(score / total * 100, 1) if total > 0 else 0.0

    # Save attempt
    attempt = QuizAttempt(
        id=str(uuid.uuid4()),
        user_session_id=req.user_session_id,
        lesson_id=lesson_id,
        score=score,
        total_q=total,
        answers_json=json.dumps([a.dict() for a in req.answers]),
    )
    db.add(attempt)
    db.commit()

    return QuizSubmitResponse(
        score=score,
        total=total,
        percentage=pct,
        results=results,
        passed=pct >= 60,
    )


@router.get("/quiz/progress/{user_session_id}")
async def quiz_progress(user_session_id: str, db: Session = Depends(get_db)):
    attempts = db.query(QuizAttempt).filter_by(user_session_id=user_session_id).all()
    progress = {}
    for attempt in attempts:
        lid = attempt.lesson_id
        pct = round(attempt.score / attempt.total_q * 100, 1) if attempt.total_q > 0 else 0.0
        if lid not in progress or pct > progress[lid]["best_score"]:
            progress[lid] = {
                "lesson_id": lid,
                "best_score": pct,
                "passed": pct >= 60,
                "attempts": 0,
            }
        progress[lid]["attempts"] += 1
    return list(progress.values())
