import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

process.env.TZ = "UTC";

const app = express();
app.use(express.json());

const PORT = 3000;

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is not defined");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API Route for AI Engine Companion and Flutter Code Coach
app.post("/api/ai", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const ai = getGeminiClient();
    
    const promptMessage = messages[messages.length - 1]?.text || "Hello";
    const systemInstruction = `You are "MAHRAJ AI Engine", the premium built-in virtual contact and expert Flutter code companion inside MAHRAJ MESSENGER.
MAHRAJ MESSENGER is styled in a bespoke deep "Neon Black" layout with deep black (#0B0C10) background, dark charcoal grey card surfaces (#1F2833), and vibrant electric neon lime green (#45A29E / #66FCF1) accents.

Your responsibilities:
1. Active Chatting: Respond confidently, professionally, and stylishly to general questions, acting as a real user contact.
2. Flutter Mobile Developer Guide: If requested, give expert, copy-pasteable Flutter classes, Firebase models, custom layouts, or step-by-step guides on configuring Push Notifications or Android sound assets! Be incredibly detailed and accurate.

Keep responses cleanly formatted with Markdown. Maintain the "Neon Black" cyberpunk elite developer vibe.`;

    // Map history to simple text format for generation
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: messages.slice(-5).map((m: any) => ({
        role: m.senderId === "ai-bot" ? "model" : "user",
        parts: [{ text: m.text }]
      })),
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({
      text: response.text || "No response received from MAHRAJ AI. Please try again.",
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({
      error: error.message || "Failed to communicate with MAHRAJ AI Engine. Verify GEMINI_API_KEY is configured in Settings.",
    });
  }
});

app.get("/api/config", (req, res) => {
  const hasFirebaseConfig = fs.existsSync(path.join(process.cwd(), "firebase-applet-config.json"));
  res.json({
    hasFirebase: hasFirebaseConfig,
    hasGemini: !!process.env.GEMINI_API_KEY,
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.all("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[MAHRAJ Server] Active on port ${PORT}`);
  });
}

startServer();
