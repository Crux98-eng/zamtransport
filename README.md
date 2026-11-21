# Zambia Transport System (Full‑Stack Demo)

## 📚 Overview
Zambia Transport is a **school project** that demonstrates a complete transport‑management solution:
- **Frontend:** React + Vite + TypeScript, styled with Tailwind CSS.
- **Backend:** Express + Prisma ORM (PostgreSQL) providing a REST API.
- **Real‑time:** Socket.IO for live vehicle tracking.
- **Maps:** React‑Leaflet + OpenStreetMap for route visualisation.

A live version is deployed on Vercel: **https://zamtransport-seven.vercel.app/**

---

## ✅ Prerequisites (what you need before starting)
| Tool | Why we need it | Recommended version |
|------|----------------|---------------------|
| **Node.js** | Runs both the frontend (Vite) and backend (Express). | 20.x or later |
| **npm** (comes with Node) | Package manager for installing dependencies. | 10.x or later |
| **PostgreSQL** (or Docker) | Database for Prisma models. The project is configured for PostgreSQL. | 15.x or later |
| **Git** (optional) | To clone the repository. | any recent version |
| **A modern web browser** | To view the frontend (Chrome, Edge, Firefox, Safari). | – |

> **Tip:** If you don't have PostgreSQL installed locally, you can run it quickly with Docker:
> ```bash
> docker run --name zam-transport-pg -e POSTGRES_PASSWORD=secret -p 5432:5432 -d postgres:15
> ```

---

## 📦 Installation – step by step
1. **Clone the repo** (or open the folder you already have):
   ```bash
   git clone https://github.com/your‑username/zambia_transport.git
   cd zambia_transport
   ```
2. **Create a copy of the environment file** and fill in the values:
   ```bash
   cp .env.example .env   # on Windows use `copy .env.example .env`
   ```
   The most important variables are:
   - `DATABASE_URL` – connection string for PostgreSQL (e.g. `postgresql://postgres:secret@localhost:5432/zam_transport`)
   - `CLIENT_URL` – URL of the frontend; for local development use `http://localhost:5173`
   - `PORT` – port the backend will listen on (default `5000`).
3. **Install backend dependencies**:
   ```bash
   cd src
   npm install
   ```
4. **Deploy the Prisma schema to the database** (creates tables):
   ```bash
   npx prisma migrate dev --name init   # runs the migration and generates Prisma client
   ```
5. **Start the backend** (in a new terminal tab/window):
   ```bash
   npm start   # runs `node src/server.js`
   ```
   You should see a log line like `API server started` and the health endpoint will be reachable at `http://localhost:5000/health`.
6. **Install frontend dependencies**:
   ```bash
   cd ../frontend/zamtransportfrontend
   npm install
   ```
7. **Run the frontend in development mode**:
   ```bash
   npm run dev
   ```
   Vite will start a dev server (usually on `http://localhost:5173`). Opening that URL in a browser shows the UI.
8. **Optional – switch between local and hosted backend**
   The file `frontend/zamtransportfrontend/src/lib/env.ts` contains the base API URL. During testing you can comment out the line that points to the hosted backend (`https://zamtransport-seven.vercel.app/api/v1`) and uncomment the one that points to your local server (`http://localhost:5000/api/v1`). This makes it easy to test both environments without changing code elsewhere.

---

## 🛠️ Libraries & Why They Were Chosen
| Category | Library | Reason / What it does |
|----------|---------|-----------------------|
| **Frontend UI** | `react`, `react‑dom` | Core React library for building UI components. |
| | `vite` | Fast dev server and bundler; great for React + TS projects. |
| | `tailwindcss` & `tailwind‑merge` | Utility‑first CSS framework + class merging utility for clean styling. |
| | `lucide-react` | Open‑source icon set used throughout the app. |
| | `react‑hook‑form` & `zod` | Simple form handling with schema validation (type‑safe). |
| | `react‑router‑dom` | Client‑side routing (pages, protected routes). |
| | `react‑leaflet` & `leaflet` | Interactive maps with OpenStreetMap tiles. |
| | `socket.io-client` | Real‑time communication for live vehicle tracking. |
| **Backend** | `express` | Minimalist web framework for the API. |
| | `prisma` | Type‑safe ORM that generates a client from the schema. |
| | `cors` | Enables Cross‑Origin Resource Sharing; we now allow all origins for the school demo. |
| | `helmet` | Basic security headers.
| | `express‑rate‑limit` | Prevents brute‑force attacks on auth & tracking endpoints. |
| | `dotenv` | Loads environment variables from `.env`. |
| | `socket.io` | Server side of real‑time updates. |
| **Testing / Docs** | `postman` collections (provided in `docs/postman/`) | Easy way to explore the API. |
| | `jest` / `@testing‑library` (if present) | Unit & integration tests. |

---

## 🚀 Running the Live Demo
The publicly deployed version can be accessed at:

**🔗 https://zamtransport-seven.vercel.app/**

It talks to the hosted backend (also on Vercel) and includes the full feature set – driver registration, trip assignment, live tracking, and dashboards.

---

## 🧭 Quick Troubleshooting
- **CORS errors** – Make sure the backend `src/app.js` has `origin: true` (we already set it) and that the frontend `env.ts` points to the correct base URL.
- **Database connection fails** – Verify that `DATABASE_URL` in `.env` matches your local PostgreSQL credentials and that the DB service is running.
- **Missing migrations** – Run `npx prisma migrate dev` again; it will create any missing tables.
- **Socket.IO not receiving updates** – Ensure the backend server is started **before** the frontend and that both are using the same `API_BASE_URL`.

---

## 📜 License & Contributions
This project is for educational purposes. Feel free to fork, experiment, and submit pull requests. No commercial use is intended.

---

*Happy coding!*