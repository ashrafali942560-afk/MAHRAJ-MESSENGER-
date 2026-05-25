import "dotenv/config";
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
    const { messages, mediaUrl, mediaType, isVoiceCall } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const rawKey = process.env.GEMINI_API_KEY;
    const hasKey = !!rawKey && rawKey !== "MY_GEMINI_API_KEY" && rawKey !== "undefined" && rawKey.trim() !== "";
    const promptMessage = messages[messages.length - 1]?.text || "Hello";
    
    // Custom System Prompt for MAHRAJ HELP AI (Default Chat)
    const systemInstruction = `You are "MAHRAJ HELP", the premium real-time AI assistant and built-in virtual chat contact inside MAHRAJ MESSENGER.
Your role is similar to WhatsApp Meta AI—an elite, highly capable, and fully working real-time neural model helper.

Your responsibilities:
1. Real-time App Help & Guidance: Confidently explain to the user how to get around the app. Point out how to discover user profiles (via username search on the network directory), create secure chat rooms, post Status Stories that disappear in 24 hours, or start voice or video translink calls.
2. Expert Coding Support: You are an expert Flutter, Dart, React, and Fullstack companion. Provide ready-to-use, clean, fully functional code blocks (such as Flutter UI, Node/Express endpoints, Firebase Firestore models) and detailed visual specs if asked.
3. General Q&A Assistant: Answer any question, write essays, summarize documents, brainstorm ideas, tell jokes/stories, and explain complex concepts simply.

Format your responses with neat typographic elements, clear sections, and readable Markdown formatting (bullet points, bold highlights, code blocks). Maintain the polished, ultra-modern "Neon Black" developer-friendly style. Keep your answers engaging and direct!`;

    // System instruction for Real-time Voice Phone Assistant (User Request 6)
    const voiceSystemInstruction = `You are the voice engine powering MAHRAJ MESSENGER, a premium, high-speed real-time voice messaging app. Your primary job is to handle incoming voice calls from users fluidly, naturally, and with ultra-low latency. 

Because this is a rapid-fire voice messaging environment, you MUST adhere to these strict execution rules:
1. SPEECH-ONLY FORMATTING: Never use markdown, asterisks, emojis, bullet points, or lists. Your response must be written entirely as natural, fluid, spoken text. Spell out all numbers and symbols explicitly (e.g., write "one hundred percent" instead of "100%", and "dollars" instead of "$").
2. THE 15-SECOND RULE: Keep your voice notes incredibly punchy. Limit your responses to a maximum of 25 to 30 words. If the user asks a complex question, give a high-level summary and prompt them to ask for details in their next message. 
3. DYNAMIC & CASUAL TONE: Maintain a confident, smooth, and friendly tone befitting the MAHRAJ MESSENGER name. Use natural voice-chat fillers like "Alright, let's do it," "Gotcha," "On it," or "Interesting" to keep the audio stream feeling human and interactive.
4. CALL TO REPLY: End every single voice message with a direct question or prompt that naturally encourages the user to press record and reply back.

Your Persona for MAHRAJ MESSENGER:
- Tone: Confident, helpful, sharp, and highly responsive.
- Core Objective: Act as a smart personal coordinator helping the user manage their tasks, brainstorm ideas, or quickly answer daily questions completely over audio.`;

    // System instruction for media analysis request (User Request 4)
    const mediaSystemInstruction = `You are an advanced media processing assistant for a mobile app. The user will upload an image or a video clip. Your task is to analyze the input carefully and extract relevant data. Provide the output strictly in JSON format with the following keys:

'title': A short, catchy title for the media.

'description': A detailed summary of what is happening in the photo or video.

'tags': An array of 5 relevant keywords/tags.

'category': The genre or category of the content (e.g., Education, Travel, Tech, Fitness).
Do not include any conversational text or markdown formatting outside the JSON block.`;

    const isMediaAnalysis = !!mediaUrl && (mediaType === "image" || mediaType === "video");

    if (hasKey) {
      try {
        const ai = getGeminiClient();
        
        // Prepare contents structure
        let contentsPayload: any[];

        if (isMediaAnalysis && mediaUrl.startsWith("data:")) {
          const match = mediaUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            const imagePart = {
              inlineData: {
                mimeType: match[1],
                data: match[2]
              }
            };
            
            // Build chat history excluding the last prompt, and append last prompt with the imagePart
            const slicedHistory = messages.slice(0, -1).map((m: any) => ({
              role: m.senderId === "ai-bot" ? "model" : "user",
              parts: [{ text: m.text || "" }]
            }));

            contentsPayload = [
              ...slicedHistory,
              {
                role: "user",
                parts: [
                  imagePart,
                  { text: promptMessage || "Analyze this media file and provide structured metadata in JSON." }
                ]
              }
            ];
          } else {
            // Fallback if regex match fails
            contentsPayload = messages.slice(-8).map((m: any) => ({
              role: m.senderId === "ai-bot" ? "model" : "user",
              parts: [{ text: m.text || "" }]
            }));
          }
        } else {
          // Normal chat text generation
          contentsPayload = messages.slice(-8).map((m: any) => ({
            role: m.senderId === "ai-bot" ? "model" : "user",
            parts: [{ text: m.text || "" }]
          }));
        }

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: contentsPayload,
          config: {
            systemInstruction: isMediaAnalysis ? mediaSystemInstruction : (isVoiceCall ? voiceSystemInstruction : systemInstruction),
            temperature: (isMediaAnalysis || isVoiceCall) ? 0.2 : 0.7,
            ...(isMediaAnalysis ? { responseMimeType: "application/json" } : {})
          },
        });

        if (response && response.text) {
          return res.json({
            text: response.text,
          });
        }
      } catch (geminiError: any) {
        console.error("Live Gemini API call failed:", geminiError);
        return res.status(500).json({
          error: `Live Gemini API call failed: ${geminiError.message || geminiError}`,
          text: `⚠️ **MAHRAJ HELP connection failure.**\n\nError details from neural API: \`${geminiError.message || geminiError}\`\n\nVerify that your API key is correct in Settings > Secrets.`
        });
      }
    }

    // Offline fallback interactive database for testing when API keys are not supplied or fail
    if (isMediaAnalysis) {
      return res.json({
        text: JSON.stringify({
          title: "Quantum Translink Payload Detected",
          description: "An offline sample analyzed image displaying beautiful aesthetic neon cybernetic indicators overlaying a dark obsidian-sleek messaging interface.",
          tags: ["neon", "terminal", "nexus", "quantum", "offline"],
          category: "Tech"
        }, null, 2)
      });
    }

    if (isVoiceCall) {
      const lowerReq = promptMessage.toLowerCase().trim();
      let voiceText = "";
      if (lowerReq.includes("hello") || lowerReq.includes("hey") || lowerReq.includes("hi") || lowerReq.includes("salam")) {
        voiceText = "Alright, gotcha! I am Mahraj, your high speed voice engine. I can help coordinate your schedule or tasks over audio. What is on your mind today?";
      } else if (lowerReq.includes("help") || lowerReq.includes("feature") || lowerReq.includes("navigate") || lowerReq.includes("how to use")) {
        voiceText = "On it! You can register profiles, upload custom status stories, or trigger live translink voice and video calls with the top buttons. Which one should we try?";
      } else if (lowerReq.includes("code") || lowerReq.includes("flutter") || lowerReq.includes("react")) {
        voiceText = "Interesting! I can write premium clean React and Flutter layouts on the spot. Once our core engine API key is active, what amazing feature are we building?";
      } else {
        voiceText = "Alright, I hear you! Let me think. Once a valid API key is entered, I will break that down fully for you. What details should we explore first?";
      }
      return res.json({ text: voiceText });
    }
    const lowerReq = promptMessage.toLowerCase().trim();
    let responseText = "";

    if (lowerReq.includes("hello") || lowerReq.includes("hey") || lowerReq.includes("hi") || lowerReq.includes("salam") || lowerReq.includes("kaise ho")) {
      responseText = `### 🌟 Welcome to **MAHRAJ HELP** (Meta AI Powered)!

Hello! Main **MAHRAJ HELP** hoon, aapka personal real-time neural helper (bilkul WhatsApp Meta AI jaisa). 

Aap mujhse bejijhak baatein kar sakte hain! Main hamesha active hoon. Aap mujhse ye sab pooch sakte hain:
*   **General Questions & Chat**: Koi bhi sawaal pucho, main uska jawab doonga!
*   **App Navigation Support**: Messenger ko use kaise karna hai, profiles kaise discover karni hai.
*   **Expert Programming Help**: Flutter, React, Firebase, ya Node.js ke responsive layouts aur models.

*Note: Live AI neural core ko full speed par chalane ke liye, AI Studio panel mein \`GEMINI_API_KEY\` add karein!*`;
    } else if (lowerReq.includes("help") || lowerReq.includes("feature") || lowerReq.includes("app") || lowerReq.includes("kaise use") || lowerReq.includes("work")) {
      responseText = `### 📱 MAHRAJ Messenger Navigation Index

Aap is premium Messenger core ko asani se navigate kar sakte hain:
1.  **Profile Discover 🔍**: Sidebar mein active search input bar par kisi ka bhi exact username likhein (jaise: \`syed-sahab\`) to network directory search trigger ho jayegi! Wahan se asani se Request send karke chat shuru karein.
2.  **Status Stories 📸**: Top navigation bar mein Status Stories tab par click karke apni custom posts ya live media update lagayein jo 24 hours ke baad reset ho jayengi.
3.  **Real-time Encrypted Chat 💬**: Friends directory se kisi bhi contact ko choose karke chats, documents, voice clips aur attachments share karein.
4.  **Translink Voice & Video Calls 📞**: Chat window header mein call icons par tap karke instant lag-free call start karein!`;
    } else if (lowerReq.includes("code") || lowerReq.includes("flutter") || lowerReq.includes("react") || lowerReq.includes("dart") || lowerReq.includes("program") || lowerReq.includes("developer")) {
      responseText = `### 💻 Real-Time Expert Code Companion

Aapki help ke liye, yahan ek high-performance Flutter custom layout layer create kiya gaya hai:

\`\`\`dart
import 'package:flutter/material.dart';

class MahrajWorkspace extends StatelessWidget {
  const MahrajWorkspace({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0C10), // Neon Black theme
      appBar: AppBar(
        title: const Text('MAHRAJ NETWORKS'),
        backgroundColor: const Color(0xFF1F2833),
      ),
      body: const Center(
        child: Text(
          'Security Core Online',
          style: TextStyle(
            color: Color(0xFF00FF9C), // Vibrant Electric Lime
            fontSize: 20,
            fontFamily: 'monospace',
          ),
        ),
      ),
    );
  }
}
\`\`\`

*Aap Settings panel mein apni \`GEMINI_API_KEY\` set karke mujhse kisi bhi module ka custom backend ya UI components generate karwa sakte hain!*`;
    } else if (lowerReq.includes("name") || lowerReq.includes("kaun ho") || lowerReq.includes("who are you")) {
      responseText = `### 🤖 About Me (MAHRAJ HELP)

Main **MAHRAJ HELP** hoon! Main aapka customized real-time assistant aur super-intelligent companion hoon jo is chat mein live integrate kiya gaya hai.

Mera functional design bilkul **WhatsApp Meta AI** jaisa hai:
*   Aapke complex queries ko answer karna.
*   Application runtime and tools ki live detailed walkthroughs dena.
*   Hazaar tarah ke developers modules generate karna.

*Let me know if you want visual guides or specific codes!*`;
    } else if (lowerReq.includes("shukriya") || lowerReq.includes("thanks") || lowerReq.includes("thank you") || lowerReq.includes("nice")) {
      responseText = `### 💖 You're Most Welcome!

Mujhe behad khushi hui aapki help karke! Agar aapko coding, app features, ya kisi aur topic par koi bhi help chahiye ho, toh bejijhak mujhse poohein. Main yahan 24/7 online hoon aapke liye! `;
    } else {
      responseText = `### ⚡ MAHRAJ HELP AI Neural Engine Response

Aapne poocha: *"${promptMessage}"*

Main is functional environment mein fully active hoon! Mere network processors dynamically request receive kar rahe hain. 

**Chat ko fully working real-time neural layer se connect karne ke liye:**
1.  Top panel / sidebar par **Settings** (Gear Icon) select karein.
2.  Wahan \`GEMINI_API_KEY\` variable mein apni Google AI Studio api key daalein.
3.  Uskay baad, main bilkul WhatsApp Meta AI ki tarah aapse kisi bhi general topics, full history, jokes, essays, and custom live software building ke codes par behtareen chating start kar dunga!

**Tab tak ke liye, aap mujhse ye sab jaan sakte hain:**
*   Type \`app guide\` to get complete Messenger visual directions.
*   Type \`flutter code\` to get ready-to-run Dart components.
*   Ask me to introduce myself!`;
    }

    return res.json({ text: responseText });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({
      error: error.message || "Failed to communicate with MAHRAJ HELP. Verify GEMINI_API_KEY is configured in Settings.",
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
