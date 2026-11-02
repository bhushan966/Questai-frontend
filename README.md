# QuestAI — AI Video Interview & Assessment Platform

QuestAI is a production-grade asynchronous video interviewing and automated candidate assessment platform. It empowers recruiting teams to create customized job roles, generate smart AI interview questions, invite candidates via shareable links, and evaluate recorded candidate answers with AI transcription, speed playback, and scoring scorecards.

---

## 🌟 Key Features

### For Recruiters
- **Job Role Management**: Create, edit, clone/duplicate, and delete job openings with specific skills and responsibilities.
- **Question Generation**: Auto-generate AI questions or manually author custom questions with adjustable think time and answer duration.
- **Flexible Interview Modes**:
  - **Recorded AI Questions**: Structured one-way video interviews with AI voice reading questions aloud.
  - **Custom Questions**: Recruiter-defined questions with bespoke prep and answer timers.
  - **Conversational AI**: Dynamic, interactive multi-turn AI interviews.
- **Review & Evaluation Studio**:
  - Direct video playback from **Supabase Storage** with 1x, 1.25x, 1.5x, 2x speed controls.
  - Speech-to-text transcripts with instant one-click copy.
  - Recruiter evaluation scorecard (Technical, Communication, Problem Solving ratings + candidate hiring decisions: Shortlisted / Hold / Declined).

### For Candidates
- **Hardware Pre-Check**: Camera preview with live audio level meter and speaker chime verification.
- **Warm-Up Practice Interview**:
  - Completely isolated, unscored practice session with sample prompt.
  - 15s preparation timer and 30s answer recording.
  - **Post-Practice Video Review**: Instant playback of their practice recording to inspect lighting, audio volume, and framing before starting the real interview.
  - Direct **"Proceed to Real Interview"** one-click transition.
- **Candidate Studio Experience**:
  - Teleprompter-style question display with AI voice reading.
  - Countdown timers for Think Time and Answer Recording with quick-skip buttons.
  - Visual recording ring (`idle`, `speaking`, `thinking`, `recording`).

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│     Next.js Frontend (App Router)│ ────> │       FastAPI Backend API       │
│  - /dashboard (Job Roles & Stats│       │  - /job-roles (CRUD & Gen)      │
│  - /interview/[sessionId]       │       │  - /sessions (Submissions)      │
│  - /dashboard/sessions/[id]     │       │  - Audio Transcription (Whisper)│
└─────────────────────────────────┘       └─────────────────────────────────┘
                 │                                         │
                 │                                         ▼
                 │                        ┌─────────────────────────────────┐
                 └──────────────────────> │    Supabase Storage & Database  │
                                          │  - Bucket: interview-videos     │
                                          │  - PostgreSQL: Candidate DB     │
                                          └─────────────────────────────────┘
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ (Node 20+ recommended)
- Python 3.10+ (for FastAPI backend)
- FFmpeg (installed and available in system PATH)
- A Supabase project with an **`interview-videos`** storage bucket

### 2. Frontend Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env.local`:
   ```env
   # Leave empty or set to /api for preview/development mode
   # For production, point to your deployed FastAPI backend:
   NEXT_PUBLIC_API_URL=https://your-backend-api.onrender.com

   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application.

4. Build for production:
   ```bash
   npm run build
   npm start
   ```

---

## ⚙️ Backend Setup (FastAPI)

1. Ensure the following environment variables are set in your backend `.env`:
   ```env
   DATABASE_URL=postgresql://user:password@host:5432/questai
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   OPENAI_API_KEY=your-openai-or-gemini-key
   ```

2. Run backend database migrations / models.

3. Start the FastAPI server:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

---

## 📦 Deployment Checklist

- [x] **Supabase Storage**: Bucket `interview-videos` is created with public read access.
- [x] **FFmpeg**: Installed on the backend host (`apt-get install -y ffmpeg` on Debian/Ubuntu/Render).
- [x] **Frontend Environment**: `NEXT_PUBLIC_API_URL` points to the live backend domain.
- [x] **CORS**: Backend allows requests from your frontend domain (e.g. `https://your-app.vercel.app`).
