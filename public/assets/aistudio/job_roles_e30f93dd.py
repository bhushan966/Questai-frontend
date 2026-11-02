from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.services.question_generator import generate_questions
from app.auth import get_current_user

router = APIRouter(prefix="/job-roles", tags=["job-roles"])

@router.get("/", response_model=list[schemas.JobRoleOut])
def list_job_roles(db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    return db.query(models.JobRole).order_by(models.JobRole.created_at.desc()).all()

@router.post("/", response_model=schemas.JobRoleOut)
def create_job_role(job_role: schemas.JobRoleCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    db_job_role = models.JobRole(**job_role.model_dump(), owner_id=user_id)
    db.add(db_job_role)
    db.commit()
    db.refresh(db_job_role)
    return db_job_role

@router.get("/{job_role_id}", response_model=schemas.JobRoleOut)
def get_job_role(job_role_id: str, db: Session = Depends(get_db)):
    return db.query(models.JobRole).filter(models.JobRole.id == job_role_id).first()

@router.post("/{job_role_id}/generate-questions")
def create_questions_for_job_role(job_role_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    job_role = db.query(models.JobRole).filter(
        models.JobRole.id == job_role_id,
        models.JobRole.owner_id == user_id,
    ).first()
    if not job_role:
        raise HTTPException(status_code=404, detail="Job role not found")
    
    question_data = generate_questions(
        title=job_role.title,
        description=job_role.description,
        skills_required=job_role.skills_required or "",
    )

    created = []
    for i, item in enumerate(question_data):
        q = models.Question(
            job_role_id=job_role.id,
            question_text=item["question"],
            order_index=i,
            think_seconds=item["think_seconds"],
            answer_seconds=item["answer_seconds"],
        )
        db.add(q)
        created.append(q)

    db.commit()
    for q in created:
        db.refresh(q)

    return {
        "job_role_id": job_role_id,
        "questions_created": len(created),
        "questions": [
            {"question": q.question_text, "think_seconds": q.think_seconds, "answer_seconds": q.answer_seconds}
            for q in created
        ],
    }

@router.get("/", response_model=list[schemas.JobRoleOut])
def list_job_roles(db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    return (
        db.query(models.JobRole)
        .filter(models.JobRole.owner_id == user_id)
        .order_by(models.JobRole.created_at.desc())
        .all()
    )

@router.get("/{job_role_id}/sessions", response_model=list[schemas.SessionSummaryOut])
def get_sessions_for_job_role(job_role_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    job_role = db.query(models.JobRole).filter(
        models.JobRole.id == job_role_id,
        models.JobRole.owner_id == user_id,
    ).first()
    if not job_role:
        raise HTTPException(status_code=404, detail="Job role not found")

    return (
        db.query(models.InterviewSession)
        .filter(models.InterviewSession.job_role_id == job_role_id)
        .order_by(models.InterviewSession.created_at.desc())
        .all()
    )

@router.get("/{job_role_id}/questions", response_model=list[schemas.QuestionOut])
def list_questions(job_role_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    job_role = db.query(models.JobRole).filter(
        models.JobRole.id == job_role_id,
        models.JobRole.owner_id == user_id,
    ).first()
    if not job_role:
        raise HTTPException(status_code=404, detail="Job role not found")

    return (
        db.query(models.Question)
        .filter(models.Question.job_role_id == job_role_id)
        .order_by(models.Question.order_index)
        .all()
    )


@router.post("/{job_role_id}/questions", response_model=schemas.QuestionOut)
def add_manual_question(
    job_role_id: str,
    question: schemas.QuestionCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    job_role = db.query(models.JobRole).filter(
        models.JobRole.id == job_role_id,
        models.JobRole.owner_id == user_id,
    ).first()
    if not job_role:
        raise HTTPException(status_code=404, detail="Job role not found")

    max_order = (
        db.query(models.Question.order_index)
        .filter(models.Question.job_role_id == job_role_id)
        .order_by(models.Question.order_index.desc())
        .first()
    )
    next_index = (max_order[0] + 1) if max_order else 0

    q = models.Question(
        job_role_id=job_role_id,
        question_text=question.question_text,
        order_index=next_index,
        generated_by="manual",
        think_seconds=30,
        answer_seconds=question.answer_seconds,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


@router.delete("/{job_role_id}/questions/{question_id}")
def delete_question(
    job_role_id: str,
    question_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    job_role = db.query(models.JobRole).filter(
        models.JobRole.id == job_role_id,
        models.JobRole.owner_id == user_id,
    ).first()
    if not job_role:
        raise HTTPException(status_code=404, detail="Job role not found")

    question = db.query(models.Question).filter(
        models.Question.id == question_id,
        models.Question.job_role_id == job_role_id,
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    db.delete(question)
    db.commit()
    return {"deleted": True}


