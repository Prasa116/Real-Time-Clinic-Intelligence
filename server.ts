import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

interface Patient {
  token: number;
  name: string;
  status: "waiting" | "serving" | "completed";
}

const DB_FILE = path.join(process.cwd(), "clinic_database.json");

// Initial state
let queue: Patient[] = [];
let currentActiveToken: number = 0;
let avgConsultationTime: number = 5;

// Helper to load database state
function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      queue = parsed.queue || [];
      currentActiveToken = typeof parsed.currentActiveToken === "number" ? parsed.currentActiveToken : 0;
      avgConsultationTime = parsed.avgConsultationTime || 5;
      console.log(`Database loaded successfully from ${DB_FILE}. Found ${queue.length} patients.`);
    } else {
      queue = [];
      currentActiveToken = 0;
      avgConsultationTime = 5;
      saveDb();
    }
  } catch (err) {
    console.error("Error loading database file, initializing as empty:", err);
    queue = [];
    currentActiveToken = 0;
    avgConsultationTime = 5;
  }
}

// Helper to save database state
function saveDb() {
  try {
    const data = JSON.stringify({
      queue,
      currentActiveToken,
      avgConsultationTime
    }, null, 2);
    fs.writeFileSync(DB_FILE, data, "utf-8");
  } catch (err) {
    console.error("Error saving to database file:", err);
  }
}

// Load initial state on server startup
loadDb();

let clients: express.Response[] = [];

function broadcastState() {
  const data = JSON.stringify({
    queue,
    currentActiveToken,
    avgConsultationTime
  });
  clients.forEach(client => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (e) {
      // client connection already interrupted
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Endpoints
  app.get("/api/queue", (req, res) => {
    res.json({
      queue,
      currentActiveToken,
      avgConsultationTime
    });
  });

  app.post("/api/patient", (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== "string" || name.trim() === "") {
      res.status(400).json({ error: "Patient name is required" });
      return;
    }

    const nextTokenNumber = queue.length > 0 
      ? Math.max(...queue.map(p => p.token)) + 1 
      : 1;

    const newPatient: Patient = {
      token: nextTokenNumber,
      name: name.trim(),
      status: "waiting"
    };

    queue.push(newPatient);
    saveDb();
    broadcastState();

    res.status(201).json({
      success: true,
      patient: newPatient
    });
  });

  app.post("/api/call-next", (req, res) => {
    // 1. Mark currently serving patient as completed
    queue.forEach(p => {
      if (p.token === currentActiveToken) {
        p.status = "completed";
      }
    });

    // 2. Find next patient with status "waiting"
    const nextWaiting = queue.find(p => p.status === "waiting");

    if (nextWaiting) {
      nextWaiting.status = "serving";
      currentActiveToken = nextWaiting.token;
    } else {
      // No more patients waiting. Clamp current active token to max or reset to 0 if empty
      const maxToken = queue.length > 0 ? Math.max(...queue.map(p => p.token)) : 0;
      currentActiveToken = maxToken;
    }

    saveDb();
    broadcastState();

    res.json({
      success: true,
      currentActiveToken,
      queue
    });
  });

  app.post("/api/settings", (req, res) => {
    const { avgConsultationTime: newTime } = req.body;
    const parsedTime = Number(newTime);
    if (isNaN(parsedTime) || parsedTime <= 0) {
      res.status(400).json({ error: "Invalid consultation time. Must be greater than 0." });
      return;
    }

    avgConsultationTime = parsedTime;
    saveDb();
    broadcastState();

    res.json({
      success: true,
      avgConsultationTime
    });
  });

  app.post("/api/reset", (req, res) => {
    queue = [];
    currentActiveToken = 0;
    avgConsultationTime = 5;
    saveDb();
    broadcastState();
    res.json({ success: true });
  });

  // Real-time Event Stream (SSE)
  app.get("/api/queue/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Flush initial state to the client immediately
    const data = JSON.stringify({
      queue,
      currentActiveToken,
      avgConsultationTime
    });
    res.write(`data: ${data}\n\n`);

    clients.push(res);

    req.on("close", () => {
      clients = clients.filter(c => c !== res);
    });
  });

  // Vite Integration for Serving Frontend
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
