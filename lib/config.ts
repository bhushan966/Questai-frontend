// Uses external backend URL if configured (e.g. Render/FastAPI), otherwise internal Next.js API routes (/api)
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';