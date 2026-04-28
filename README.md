# 🎵 AI Music Coach — Computer Vision Powered Embodied Teaching Agent

A real-time, multimodal AI music coach that **sees you through your camera**, **listens to you speak**, and **teaches you any instrument** through an interactive photorealistic avatar with lip-synced voice responses.

## Why This Is a Computer Vision Project

Traditional music learning apps are text/video-based — they can't see what you're doing. This project uses **real-time computer vision** as the core teaching mechanism:

| CV Capability | What It Does | Technology |
|---|---|---|
| **Body Pose Estimation** | Detects 33 body landmarks — posture, arm angles, shoulder alignment | MediaPipe Pose Landmarker (on-device, GPU) |
| **Hand & Finger Tracking** | Tracks 21 landmarks per hand — finger curl, spread, chord shapes | MediaPipe Hand Landmarker (on-device, GPU) |
| **Skeleton Overlay** | Real-time visual feedback drawn on camera feed | Canvas 2D rendering at 30fps |
| **Pose-to-Intent Pipeline** | CV data → musical context (e.g. finger positions → chord detection) | Custom metrics computation |
| **Photorealistic Avatar** | AI-driven avatar with lip-sync from audio | SpatialReal AvatarKit (on-device WASM) |

The coach doesn't just hear you — it **watches your hands, your posture, your finger positions** and gives feedback based on what it sees. This is fundamentally impossible with a text chatbot.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    BROWSER (Frontend)                    │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Camera      │  │  MediaPipe   │  │  SpatialReal │  │
│  │   WebRTC      │──│  Pose + Hand │  │  Avatar      │  │
│  │   Feed        │  │  Detection   │  │  (lip-sync)  │  │
│  └──────────────┘  └──────┬───────┘  └──────▲───────┘  │
│                           │                  │          │
│                    pose/hand data        PCM audio      │
│                           │                  │          │
│  ┌──────────────┐         │                  │          │
│  │  Microphone   │─── audio chunks ──┐       │          │
│  └──────────────┘                    │       │          │
│                                      │       │          │
└──────────────────────────────────────┼───────┼──────────┘
                                       │       │
                              Socket.io (WebSocket)
                                       │       │
┌──────────────────────────────────────┼───────┼──────────┐
│                    SERVER (Backend)   │       │          │
│                                      ▼       │          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────┴───────┐  │
│  │  Deepgram    │  │  Claude      │  │  ElevenLabs  │  │
│  │  STT         │──│  Sonnet 4    │──│  TTS         │  │
│  │  (Nova-2)    │  │  (coaching)  │  │  (Turbo v2)  │  │
│  └──────────────┘  └──────┬───────┘  └──────────────┘  │
│                           │                             │
│                    ┌──────▼───────┐                     │
│                    │  Progress    │                     │
│                    │  Tracker     │                     │
│                    │  (JSON/RAG)  │                     │
│                    └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

## Computer Vision Pipeline Detail

```
Camera Frame (30fps)
    │
    ├── MediaPipe Pose Landmarker (GPU)
    │   └── 33 body landmarks → posture score, wrist angle, shoulder tilt
    │
    ├── MediaPipe Hand Landmarker (GPU)
    │   └── 21 landmarks × 2 hands → finger curl (per finger), spread, chord shape
    │
    ├── Skeleton + Hand Overlay (Canvas 2D)
    │   └── Visual feedback: green skeleton, colored hand wireframes, finger curl bars
    │
    └── Metrics → Backend (10Hz via WebSocket)
        └── Claude receives: pose metrics + hand metrics + speech transcript
            └── Generates contextual coaching based on what it SEES
```

## Key CV Features

- **Real-time pose detection** at 30fps with <50ms latency (on-device GPU)
- **Dual hand tracking** with per-finger curl measurement (thumb, index, middle, ring, pinky)
- **Finger spread analysis** for chord shape detection
- **Skeleton overlay** rendered on live camera feed
- **Hand wireframe visualization** with color-coded left/right hands
- **Pose-to-coaching pipeline** — CV data directly influences AI coaching responses

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Computer Vision** | MediaPipe Pose + Hand Landmarker | Real-time body & finger tracking |
| **Frontend** | React 18 + Vite + TypeScript | UI framework |
| **3D/Avatar** | SpatialReal AvatarKit | Photorealistic avatar with lip-sync |
| **Fallback Avatar** | Three.js + React Three Fiber | Stylized 3D avatar |
| **Speech-to-Text** | Deepgram Nova-2 | Real-time transcription (<200ms) |
| **AI Coaching** | Claude Sonnet 4 (Anthropic) | Context-aware music instruction |
| **Text-to-Speech** | ElevenLabs Turbo v2 | Natural voice synthesis |
| **Real-time Comms** | Socket.io (WebSocket) | Bidirectional streaming |
| **State** | Zustand | Client-side state management |
| **Progress** | JSON store (local) | Session history & skill tracking |
| **Styling** | Tailwind CSS | UI styling |

## Setup

### Prerequisites
- Node.js 20+
- API keys: Anthropic, Deepgram, ElevenLabs
- Optional: SpatialReal account (for photorealistic avatar)

### Install & Run

```bash
# Frontend
cd music-coach
cp .env.example .env  # fill in your keys
npm install
npm run dev

# Backend (separate terminal)
cd music-coach-server
cp .env.example .env  # fill in your keys
npm install
npx tsx src/index.ts
```

### Environment Variables

**Backend** (`music-coach-server/.env`):
```
ANTHROPIC_API_KEY=sk-ant-...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=sk_...
```

**Frontend** (`music-coach/.env`):
```
VITE_SERVER_URL=http://localhost:3001
VITE_SPATIALREAL_APP_ID=...        # optional
VITE_SPATIALREAL_AVATAR_ID=...     # optional
VITE_SPATIALREAL_SESSION_TOKEN=... # optional
```

## How It Works

1. **You open the app** — camera activates, MediaPipe starts detecting your body + hands
2. **You click Start Coaching** — microphone activates, audio streams to Deepgram
3. **You speak** — "I want to learn guitar" → Deepgram transcribes → Claude detects instrument
4. **Coach responds** — Claude generates coaching text → ElevenLabs converts to speech → SpatialReal avatar speaks with lip-sync
5. **You play** — CV tracks your hand positions, finger shapes, posture in real-time
6. **Coach observes** — Claude receives your pose + hand data alongside your speech, gives contextual feedback
7. **Progress saved** — skills learned, weak areas tracked, next session picks up where you left off

## What Makes This Different

- **The coach can SEE you** — not just hear you. It knows if your fingers are in the right position.
- **Any instrument** — not hardcoded. Say "teach me violin" and it adapts.
- **Interactive** — waits for you, asks questions, progresses through lessons.
- **Embodied** — photorealistic avatar with lip-sync creates presence and engagement.
- **Persistent memory** — remembers what you've learned across sessions.

## License

MIT
