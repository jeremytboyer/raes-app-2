# Rae's App

Rae's App is a Vite + React frontend with a Node/Express + Socket.IO backend and MongoDB persistence.

## Local development

Frontend:
```bash
npm run dev
```

Backend:
```bash
node server/index.js
```

Required local environment values:
```env
MONGO_URI=...
```

## Render deployment

This repo includes a `render.yaml` blueprint for deploying:

1. `raes-app-api` as a Node web service from `/server`
2. `raes-app-web` as a static site from the repo root

Set these values in Render:

- `MONGO_URI` on the API service
- `ALLOWED_ORIGINS` on the API service
  Use your frontend Render URL, for example `https://raes-app-web.onrender.com`
- `VITE_API_BASE_URL` on the static site
  Use your API Render URL, for example `https://raes-app-api.onrender.com`

You will also need to add your deployed frontend domain to Firebase Authentication's authorized domains and to any website restrictions on your Firebase API key.
