import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class JobRole(Base):
    __tablename__ = "job_roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(String, nullable=False)  # Supabase user ID
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    skills_required = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    questions = relationship("Question", back_populates="job_role")
    
class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_role_id = Column(UUID(as_uuid=True), ForeignKey("job_roles.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    order_index = Column(Integer, nullable=False)
    generated_by = Column(String, default="ai")
    think_seconds = Column(Integer, default=60)
    answer_seconds = Column(Integer, default=120)

    job_role = relationship("JobRole", back_populates="questions")

class InterviewSession(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_role_id = Column(UUID(as_uuid=True), ForeignKey("job_roles.id"), nullable=False)
    candidate_id = Column(UUID(as_uuid=True), nullable=False)
    status = Column(String, default="not_started")  # not_started / in_progress / submitted
    created_at = Column(DateTime, default=datetime.utcnow)

    answers = relationship("SessionAnswer", back_populates="session")
    
    mode = Column(String, default="recorded") 
    verdict = Column(Text, nullable=True) 

class SessionAnswer(Base):
    __tablename__ = "session_answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=False)
    status = Column(String, default="pending")
    video_url = Column(String, nullable=True)
    transcript = Column(Text, nullable=True)
    submitted_at = Column(DateTime, nullable=True)

    session = relationship("InterviewSession", back_populates="answers")
    question = relationship("Question")  # <-- add this line

class ConversationTurn(Base):
    __tablename__ = "conversation_turns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    role = Column(String, nullable=False)  # "ai" or "candidate"
    content = Column(Text, nullable=False)
    order_index = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    video_url = Column(String, nullable=True)