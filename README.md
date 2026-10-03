# CyberShield

CyberShield is a React frontend and FastAPI backend for explainable statistical
network anomaly analysis.

## Deploy to Render

1. Push this project directory to a GitHub repository.
2. In Render, choose **New + → Blueprint**, connect the repository, and select
   this `render.yaml`.
3. Render builds the frontend and backend into one web service. When deployment
   finishes, open the service URL shown in the Render dashboard.

The service uses an in-memory session store. Uploaded data and analysis sessions
are temporary and will be lost when the service restarts or spins down. The free
Render service can take a short time to wake after inactivity.

## Run locally

Start the API from `backend` with `uvicorn main:app --reload --port 8000` and
start the frontend from `frontend` with `npm run dev`. During development Vite
forwards `/api` requests to the local API.
