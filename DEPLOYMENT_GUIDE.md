All fixes are complete. Here's your complete step-by-step deployment guide:

---

## ✅ Phase 1 Summary: Bugs Fixed & Files Prepared

**Root cause of your 502 / JSON parsing error:**
- `Backend/src/app.js` was listening on **port 8000** (from `.env`) but Docker/Nginx routed to **port 5000** → Nginx returned 502 HTML (hence `Unexpected token '<'`).
- Backend also double-prefixed routes (`/api/akuh/auth` instead of just `/auth`) after Nginx already stripped `/api/akuh/`.
- `chat.controller.js` was calling the RAG service on port **9090** instead of **9000**.
- Frontend had a hardcoded `BASE_URL` ignoring the Docker build args.

**All fixes applied.** Now onto deployment.

---

## 🚀 Phase 2: Deployment Guide

### Short answer: "Just push to GitHub?"
**Partially yes — with configuration.**
- **Vercel (Frontend):** Almost automatic — connect the repo and it detects Vite. **But you must set `VITE_API_BASE_URL` env vars** in the Vercel dashboard **before deploying**, because Vite bakes them into the JS bundle at build time.
- **Render (Backend + RAG):** I already created `render.yaml` (Blueprint) in the repo root. You can either:
  1. **Auto-detect:** Create two separate "Web Service" resources, each pointing to their subdirectory (`./Backend`, `./AI_Receptionist_RAG`).
  2. **OR use Blueprint:** Upload the `render.yaml` and it provisions both at once.

---

### 📦 Step 1 — Prepare & Push to GitHub

1. **Ensure `.env` files are NOT committed** (your `.gitignore` already blocks them — good ✅).
2. Create a new **private GitHub repository** (e.g. `AI_Receptionist`).
3. Push:
   ```powershell
   cd "c:\Users\Rohaan\OneDrive\Documents\DevNauts_Internship\AI_Receptionist"
   git init
   git add .
   git commit -m "Prepare for deployment: Render + Vercel configs, bug fixes"
   git remote add origin https://github.com/<YOUR_USER>/AI_Receptionist.git
   git branch -M main
   git push -u origin main
   ```

---

### 🛢️ Step 2 — Set up a Cloud MongoDB (Required before Backend)

Your current `.env` uses `mongodb://host.docker.internal:27017/AI_Receptionist` which only works locally. Render/Vercel can't reach your local MongoDB.

1. Go to **MongoDB Atlas** (free tier) → Create a cluster.
2. Add **0.0.0.0/0** to IP whitelist (Render/Vercel have dynamic IPs).
3. Copy the connection string (format: `mongodb+srv://<user>:<pass>@cluster0.mongodb.net/AI_Receptionist?retryWrites=true&w=majority`).

You'll paste this as `DB_URL` in Render.

---

### 🔵 Step 3 — Deploy Backend + RAG to Render

There are 2 approaches:

#### Option A: Use `render.yaml` Blueprint (Recommended for first time)
1. Go to **render.com → Blueprints** → **"New Blueprint Instance"**.
2. Connect your GitHub repo, set the branch to `main`.
3. On the "Review Blueprint" page, you'll see both services detected from `render.yaml:1-56`.
4. For each **Environment Variable** marked `sync: false`, paste your real values:
   | Service | Variable | Value |
   |---|---|---|
   | `akuh-api-backend` | `DB_URL` | Your MongoDB Atlas string from Step 2 |
   | `akuh-api-backend` | `FRONTEND_URL` | `https://<YOUR_VERCEL_APP>.vercel.app` *(you'll update this after Vercel deploy, but you can put a placeholder `https://example.com` now and edit later)* |
   | `akuh-rag-backend` | `CHROMA_HOST` | `api.trychroma.com` |
   | `akuh-rag-backend` | `CHROMA_API_KEY` | `ck-HGW...` (your existing key) |
   | `akuh-rag-backend` | `CHROMA_TENANT` | `5b272605-...` (your existing UUID) |
   | `akuh-rag-backend` | `CHROMA_DATABASE` | `AKUH_Agent` |
   | `akuh-rag-backend` | `CHROMA_COLLECTION_NAME` | `akuh-rag` |
   | `akuh-rag-backend` | `GOOGLE_API_KEY` | Your Google GenAI key |
   | `akuh-rag-backend` | `GROQ_API_KEY` | Your Groq key |
5. Click **Apply**. Render builds Docker images using `Backend/Dockerfile` and `AI_Receptionist_RAG/Dockerfile`. Health check paths are set to `/health`.
6. ✅ Once both are live, copy the two public URLs:
   - e.g. `https://akuh-api-backend.onrender.com`
   - e.g. `https://akuh-rag-backend.onrender.com`

#### Option B: Create Web Services Manually
If the Blueprint has trouble, create them one-by-one:
- **New → Web Service →** pick repo.
- For Backend:
  - **Root Directory:** `./Backend`
  - **Runtime:** Docker
  - **Plan:** Starter (or Pro for faster cold starts)
  - **Health Check Path:** `/health`
  - **Environment Variables:** `PORT=10000`, `NODE_ENV=production`, `DB_URL`, `JWT_SECRET`, `JWT_EXPIRY=5d`, `FRONTEND_URL`, `RAG_API_URL=https://<rag-service-url>.onrender.com`
- For RAG:
  - **Root Directory:** `./AI_Receptionist_RAG`
  - **Runtime:** Docker
  - **Plan:** Starter
  - **Health Check Path:** `/health`
  - **Environment Variables:** `PORT=10000`, `NODE_ENV=production`, `BACKEND_URL=https://<backend-url>.onrender.com`, all the Chroma/Google/Groq keys.

> **Important** for both: Once you have the real Backend and RAG URLs, go back into Render → Environment and update `FRONTEND_URL`, `BACKEND_URL`, `RAG_API_URL` to the **actual public Render URLs** (not `localhost`). Re-deploy.

---

### 🟢 Step 4 — Deploy Frontend to Vercel

1. Go to **vercel.com → New Project** → Import your GitHub repo.
2. In **Configure Project**:
   - **Framework Preset:** Vite (auto-detected ✅)
   - **Root Directory:** Click **Edit** → set to `Frontend`
3. ⚠️ **Open "Environment Variables" section BEFORE clicking Deploy.** Set:
   | Variable | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://akuh-api-backend.onrender.com` *(your Render API URL from Step 3)* |
   | `VITE_RAG_API_BASE_URL` | `https://akuh-rag-backend.onrender.com` *(your Render RAG URL)* |
4. Click **Deploy**. Vercel runs `npm install && npm run build` (reads `Frontend/package.json:7-8`).
5. ✅ Copy the live Vercel URL (e.g. `https://ai-receptionist-kuh.vercel.app`).

6. **Go back to Render** → `akuh-api-backend` → Environment → update `FRONTEND_URL` to this Vercel URL. Save & re-deploy. This allows CORS to work.

---

### 🔄 Step 5 — Verify the Full Flow

1. Open Vercel URL → Sign Up (creates user in MongoDB Atlas).
2. Try Login → It should POST to `https://akuh-api-backend.onrender.com/auth/login` via the `VITE_API_BASE_URL`.
3. Open DevTools → Network tab: confirm responses are JSON (not HTML) with status **200/201**.
4. Send a chat message (e.g. "What are radiology hours?") → This should go:
   **Frontend → Render Backend (`/ai/chat`) → Render RAG (`/chat`) → Chroma + Groq → reply back.**

---

### 🐳 Local Docker Testing First (Recommended before deploying)

Since you already have Docker Desktop running with containers listed in your screenshot, run this to rebuild with all fixes applied:
```powershell
cd "c:\Users\Rohaan\OneDrive\Documents\DevNauts_Internship\AI_Receptionist"
docker compose down
docker compose up --build -d
```
Wait ~2 minutes, then open `http://localhost:8000` and test login. This catches issues before cloud deployment.

---

### 🗺️ Final Architecture Diagram (Post-Deployment)
```
┌─────────────────────────────────┐
│  User Browser (Vercel URL)      │
│  ├── Calls VITE_API_BASE_URL ───┼────► Render: akuh-api-backend (Docker)
│  │                              │         │  ├── MongoDB Atlas
│  │                              │         │  └── Calls RAG_API_URL ──┐
│  └── Calls VITE_RAG_API_BASE_URL┼─────────┤                            │
└─────────────────────────────────┘         └► Render: akuh-rag-backend (Docker)
                                                      ├── ChromaDB Cloud
                                                      └── Groq LLM
```

---

### 📌 Quick Checklist
- [ ] MongoDB Atlas cluster + connection string
- [ ] Push code to GitHub (`.env` excluded by `.gitignore` ✅)
- [ ] Render: Deploy Backend + RAG (Blueprint or manual)
- [ ] Render: Paste all Chroma/Groq/Google env vars
- [ ] Render: Set `RAG_API_URL` and `BACKEND_URL` cross-references to real Render URLs
- [ ] Vercel: Deploy Frontend **with both VITE_ env vars set first**
- [ ] Render Backend: Update `FRONTEND_URL` to the final Vercel domain

---

All the files I modified/created to make this work:

| File | Purpose |
|---|---|
| `Backend/.env` | Fixed `PORT=5000`, added `FRONTEND_URL`, `RAG_API_URL` |
| `Backend/src/app.js` | Route prefix fix, permissive multi-origin CORS, `/health` endpoint |
| `Backend/src/Controllers/chat.controller.js` | RAG URL port fix + env var + 60s timeout |
| `Backend/src/Models/chat.model.js` | Added `userId` + `userMessage` fields |
| `Backend/package.json` | Added `"start"` script (Render auto-runs `npm start`) |
| `Backend/Dockerfile` | Render-compatible PORT=10000 exposure, fallbacks for `npm ci` |
| `Backend/.env.example` | Template for team/devs |
| `AI_Receptionist_RAG/.env` | Multi-origin BACKEND_URL for Docker network + local |
| `AI_Receptionist_RAG/src/app.js` | Multi-origin CORS, `/health` endpoint |
| `AI_Receptionist_RAG/package.json` | Added `"start"` script |
| `AI_Receptionist_RAG/Dockerfile` | Added build tools for native deps, Render PORT compatibility |
| `AI_Receptionist_RAG/.env.example` | Template |
| `Frontend/src/utils/api.js` | Uses `import.meta.env.VITE_API_BASE_URL` instead of hardcoded localhost; Content-Type check to catch HTML errors |
| `Frontend/Dockerfile` | `npm ci` for reproducible builds |
| `Frontend/nginx.conf` | Proxy timeouts (120s for chat), JSON-friendly 502 error page instead of default HTML Nginx error (fixes your `Unexpected token '<'`) |
| `Frontend/.env.example` | Template |
| `Frontend/vercel.json` | SPA rewrites + asset cache headers |
| `docker-compose.yaml` | Inter-service env vars (`RAG_API_URL=http://rag_backend:9000`), restart policies, explicit depends_on |
| `render.yaml` | Blueprint for Render: provisions both backend services with correct directories, ports, env vars, and health checks |
| `vercel.json` | Root-level Vercel config (uses Frontend subdir) |

Push to GitHub, follow the 5 steps above, and you'll be live.