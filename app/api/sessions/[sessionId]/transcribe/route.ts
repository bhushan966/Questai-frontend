import { NextResponse } from 'next/server';

export async function POST() {
  // In mock environment or until live Whisper endpoint is connected,
  // return a realistic simulated transcription of candidate response
  const responses = [
    "I led the architectural migration from a monolithic backend to modular microservices with asynchronous worker queues, improving our latency by 45%.",
    "I prioritize clean error handling and unit tests with over 85% branch coverage, ensuring our CI/CD pipelines catch regressions before production.",
    "When faced with tight sprint deadlines, I broke down the user stories into iterative MVPs and maintained constant communication with stakeholders.",
    "I have extensive experience tuning database queries, indexing foreign keys, and implementing Redis caching layers for high-throughput reads.",
  ];
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];

  return NextResponse.json({ transcript: randomResponse });
}
