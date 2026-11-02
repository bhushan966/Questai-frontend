import os
import shutil
import subprocess
from datetime import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

from app.services.transcription import transcribe_audio
from app.auth import get_current_user
from supabase import create_client
import shutil as shutil_module

from app.services.conversation_engine import get_next_ai_turn, generate_verdict


router = APIRouter(prefix="/sessions", tags=["sessions"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

FFMPEG_PATH = shutil_module.which("ffmpeg") or r"C:\Users\Admin\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0-full_build\bin\ffmpeg.exe"

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
BUCKET_NAME = "interview-videos"

MAX_AUDIO_BYTES = 5 * 1024 * 1024
MAX_VIDEO_BYTES = 40 * 1024 * 1024
ALLOWED_AUDIO_EXT = {".webm", ".wav", ".mp3", ".m4a", ".ogg", ".mp4"}


@router.post("/", response_model=schemas.SessionOut)
def create_session(session: schemas.SessionCreate, db: Session = Depends(get_db)):
    db_session = models.InterviewSession(
        job_role_id=session.job_role_id,
        candidate_id=session.candidate_id,
        mode=session.mode,
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)

    if session.mode == "conversational":
        return db_session

    questions = (
        db.query(models.Question)
        .filter(
            models.Question.job_role_id == session.job_role_id,
            models.Question.generated_by == session.question_source,
        )
        .order_by(models.Question.order_index)
        .all()
    )
    if not questions:
        raise HTTPException(
            status_code=400,
            detail=f"No '{session.question_source}' questions found for this job role",
        )

    for q in questions:
        db.add(models.SessionAnswer(session_id=db_session.id, question_id=q.id))
    db.commit()

    return db_session


@router.get("/{session_id}", response_model=schemas.SessionOut)
def get_session(session_id: str, db: Session = Depends(get_db)):
    db_session = db.query(models.InterviewSession).filter(models.InterviewSession.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    return db_session


@router.post("/{session_id}/start")
def start_conversation(session_id: str, db: Session = Depends(get_db)):
    db_session = db.query(models.InterviewSession).filter(models.InterviewSession.id == session_id).first()
    if not db_session or db_session.mode != "conversational":
        raise HTTPException(status_code=404, detail="Conversational session not found")

    existing = (
        db.query(models.ConversationTurn)
        .filter(models.ConversationTurn.session_id == session_id)
        .order_by(models.ConversationTurn.order_index)
        .all()
    )
    if existing:
        last_ai = next((t for t in reversed(existing) if t.role == "ai"), None)
        return {"message": last_ai.content if last_ai else "", "action": "resume"}

    job_role = db.query(models.JobRole).filter(models.JobRole.id == db_session.job_role_id).first()
    topics = [q.question_text for q in job_role.questions] or [f"{job_role.title} relevant experience"]

    try:
        result = get_next_ai_turn(job_role.title, job_role.description, job_role.skills_required or "", topics, [])
    except Exception as e:
        print(f"Conversation engine failed on start: {e}")
        result = {
            "message": "Hi, thanks for joining. To start, could you tell me a bit about yourself and your background?",
            "action": "next_topic",
        }

    db.add(models.ConversationTurn(session_id=session_id, role="ai", content=result["message"], order_index=0))
    db.commit()
    return {"message": result["message"], "action": result["action"]}


@router.get("/{session_id}/turns")
def list_turns(session_id: str, db: Session = Depends(get_db)):
    turns = (
        db.query(models.ConversationTurn)
        .filter(models.ConversationTurn.session_id == session_id)
        .order_by(models.ConversationTurn.order_index)
        .all()
    )
    return {"turns": [{"role": t.role, "content": t.content} for t in turns]}


@router.get("/{session_id}/turns/recruiter-view")
def list_turns_for_recruiter(
    session_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    db_session = (
        db.query(models.InterviewSession)
        .join(models.JobRole, models.InterviewSession.job_role_id == models.JobRole.id)
        .filter(models.InterviewSession.id == session_id, models.JobRole.owner_id == user_id)
        .first()
    )
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    turns = (
        db.query(models.ConversationTurn)
        .filter(models.ConversationTurn.session_id == session_id)
        .order_by(models.ConversationTurn.order_index)
        .all()
    )
    return {
        "turns": [{"role": t.role, "content": t.content, "video_url": t.video_url} for t in turns],
        "verdict": db_session.verdict,
    }


# Candidate-facing — NO auth, used by /interview/[sessionId]
@router.get("/{session_id}/answers", response_model=list[schemas.SessionAnswerOut])
def get_session_answers(session_id: str, db: Session = Depends(get_db)):
    db_session = db.query(models.InterviewSession).filter(models.InterviewSession.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    answers = (
        db.query(models.SessionAnswer)
        .join(models.Question, models.SessionAnswer.question_id == models.Question.id)
        .filter(models.SessionAnswer.session_id == session_id)
        .order_by(models.Question.order_index)
        .all()
    )

    return [
        schemas.SessionAnswerOut(
            id=a.id, question_id=a.question_id, question_text=a.question.question_text,
            think_seconds=a.question.think_seconds, answer_seconds=a.question.answer_seconds,
            status=a.status, video_url=a.video_url, transcript=a.transcript, submitted_at=a.submitted_at,
        )
        for a in answers
    ]


# Recruiter-facing — auth required, ownership-checked, used by the dashboard
@router.get("/{session_id}/answers/recruiter-view", response_model=list[schemas.SessionAnswerOut])
def get_session_answers_for_recruiter(session_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    db_session = (
        db.query(models.InterviewSession)
        .join(models.JobRole, models.InterviewSession.job_role_id == models.JobRole.id)
        .filter(models.InterviewSession.id == session_id, models.JobRole.owner_id == user_id)
        .first()
    )
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    answers = (
        db.query(models.SessionAnswer)
        .join(models.Question, models.SessionAnswer.question_id == models.Question.id)
        .filter(models.SessionAnswer.session_id == session_id)
        .order_by(models.Question.order_index)
        .all()
    )

    return [
        schemas.SessionAnswerOut(
            id=a.id, question_id=a.question_id, question_text=a.question.question_text,
            think_seconds=a.question.think_seconds, answer_seconds=a.question.answer_seconds,
            status=a.status, video_url=a.video_url, transcript=a.transcript, submitted_at=a.submitted_at,
        )
        for a in answers
    ]


@router.post("/{session_id}/answers/{answer_id}/upload")
def upload_answer_video(session_id: str, answer_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    db_answer = db.query(models.SessionAnswer).filter(
        models.SessionAnswer.id == answer_id,
        models.SessionAnswer.session_id == session_id,
    ).first()
    if not db_answer:
        raise HTTPException(status_code=404, detail="Answer not found")

    filename = f"{session_id}_{answer_id}.webm"
    raw_filepath = os.path.join(UPLOAD_DIR, f"raw_{filename}")
    final_filepath = os.path.join(UPLOAD_DIR, filename)

    with open(raw_filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = subprocess.run(
        [FFMPEG_PATH, "-y", "-i", raw_filepath, "-c", "copy", final_filepath],
        capture_output=True,
    )

    os.remove(raw_filepath)

    if result.returncode != 0 or not os.path.exists(final_filepath):
        raise HTTPException(status_code=500, detail=f"Video processing failed: {result.stderr.decode()}")

    # Upload the ffmpeg-fixed file to Supabase Storage
    with open(final_filepath, "rb") as f:
        supabase_client.storage.from_(BUCKET_NAME).upload(
            filename,
            f,
            file_options={"content-type": "video/webm", "upsert": "true"},
        )

        public_url = supabase_client.storage.from_(BUCKET_NAME).get_public_url(filename)

    db_answer.video_url = public_url
    db_answer.status = "uploaded"
    db_answer.submitted_at = datetime.utcnow()

    try:
        db_answer.transcript = transcribe_audio(final_filepath)
    except Exception as e:
        print(f"Transcription failed for answer {answer_id}: {e}")
        db_answer.transcript = None

    # Clean up local file now that upload + transcription are both done
    os.remove(final_filepath)

    db.commit()

    return {
        "answer_id": answer_id,
        "video_url": db_answer.video_url,
        "status": "uploaded",
        "transcript": db_answer.transcript,
    }


@router.post("/{session_id}/submit")
def submit_session(session_id: str, db: Session = Depends(get_db)):
    db_session = db.query(models.InterviewSession).filter(models.InterviewSession.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    db_session.status = "submitted"
    db.commit()
    return {"session_id": session_id, "status": "submitted"}


@router.post("/{session_id}/turns")
def submit_candidate_turn(session_id: str, payload: schemas.TurnSubmit, db: Session = Depends(get_db)):
    db_session = db.query(models.InterviewSession).filter(models.InterviewSession.id == session_id).first()
    if not db_session or db_session.mode != "conversational":
        raise HTTPException(status_code=404, detail="Conversational session not found")
    if db_session.status == "submitted":
        raise HTTPException(status_code=400, detail="Interview already completed")

    job_role = db.query(models.JobRole).filter(models.JobRole.id == db_session.job_role_id).first()

    existing_turns = (
        db.query(models.ConversationTurn)
        .filter(models.ConversationTurn.session_id == session_id)
        .order_by(models.ConversationTurn.order_index)
        .all()
    )

    next_index = len(existing_turns)
    candidate_turn = models.ConversationTurn(
        session_id=session_id, role="candidate", content=payload.transcript, order_index=next_index
    )
    db.add(candidate_turn)
    db.commit()
    candidate_turn_id = str(candidate_turn.id)

    history = [{"role": t.role, "content": t.content} for t in existing_turns] + [
        {"role": "candidate", "content": payload.transcript}
    ]
    topics = [q.question_text for q in job_role.questions] or [f"{job_role.title} relevant experience"]

    try:
        result = get_next_ai_turn(job_role.title, job_role.description, job_role.skills_required or "", topics, history)
    except Exception as e:
        print(f"Conversation engine failed: {e}")
        result = {"message": "Sorry, I didn't catch that. Could you say that again?", "action": "follow_up"}

    db.add(models.ConversationTurn(
        session_id=session_id, role="ai", content=result["message"], order_index=next_index + 1
    ))

    if result["action"] == "conclude":
        full_history = history + [{"role": "ai", "content": result["message"]}]
        try:
            db_session.verdict = generate_verdict(job_role.title, job_role.skills_required or "", full_history)
        except Exception as e:
            print(f"Verdict generation failed: {e}")
            db_session.verdict = "Verdict could not be generated automatically."
        db_session.status = "submitted"

    db.commit()
    return {"message": result["message"], "action": result["action"], "turn_id": candidate_turn_id}


@router.post("/{session_id}/turns/{turn_id}/video")
def upload_turn_video(session_id: str, turn_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Deliberately allowed after the interview concludes: the last clip is usually still uploading then.
    turn = (
        db.query(models.ConversationTurn)
        .filter(
            models.ConversationTurn.id == turn_id,
            models.ConversationTurn.session_id == session_id,
            models.ConversationTurn.role == "candidate",
        )
        .first()
    )
    if not turn:
        raise HTTPException(status_code=404, detail="Turn not found")
    if turn.video_url:
        return {"video_url": turn.video_url}  # already uploaded, ignore retries

    data = file.file.read(MAX_VIDEO_BYTES + 1)
    if len(data) > MAX_VIDEO_BYTES:
        raise HTTPException(status_code=413, detail="Video too large")
    if len(data) < 1000:
        raise HTTPException(status_code=400, detail="Video too small")

    filename = f"live_{session_id}_{turn_id}.webm"
    raw_path = os.path.join(UPLOAD_DIR, f"raw_{filename}")
    final_path = os.path.join(UPLOAD_DIR, filename)

    try:
        with open(raw_path, "wb") as f:
            f.write(data)

        result = subprocess.run(
            [FFMPEG_PATH, "-y", "-i", raw_path, "-c", "copy", final_path],
            capture_output=True,
        )
        if result.returncode != 0 or not os.path.exists(final_path):
            raise HTTPException(status_code=500, detail="Video processing failed")

        with open(final_path, "rb") as f:
            supabase_client.storage.from_(BUCKET_NAME).upload(
                filename, f, file_options={"content-type": "video/webm", "upsert": "true"}
            )
        public_url = supabase_client.storage.from_(BUCKET_NAME).get_public_url(filename)
    finally:
        for p in (raw_path, final_path):
            if os.path.exists(p):
                os.remove(p)

    turn.video_url = public_url
    db.commit()
    return {"video_url": public_url}


@router.post("/{session_id}/transcribe")
def transcribe_turn_audio(session_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    db_session = db.query(models.InterviewSession).filter(models.InterviewSession.id == session_id).first()
    if not db_session or db_session.mode != "conversational":
        raise HTTPException(status_code=404, detail="Conversational session not found")
    if db_session.status == "submitted":
        raise HTTPException(status_code=400, detail="Interview already completed")

    data = file.file.read(MAX_AUDIO_BYTES + 1)
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio too large")
    if len(data) < 1000:
        return {"transcript": ""}

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_AUDIO_EXT:
        ext = ".webm"
    temp_path = os.path.join(UPLOAD_DIR, f"turn_{uuid.uuid4().hex}{ext}")

    with open(temp_path, "wb") as f:
        f.write(data)
    try:
        text = transcribe_audio(temp_path)
    except Exception as e:
        print(f"Turn transcription failed: {e}")
        raise HTTPException(status_code=502, detail="Transcription failed")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return {"transcript": (text or "").strip()}