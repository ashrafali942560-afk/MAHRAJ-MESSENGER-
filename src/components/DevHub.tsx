import React, { useState } from "react";
import { Terminal, Copy, Check, ShieldAlert, Layers, PhoneCall, MessageCircle, FileCode } from "lucide-react";

export function DevHub({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"deps" | "rules" | "auth" | "chat" | "schema">("deps");
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const pubspecCode = `name: mahraj_messenger
description: A premium custom WhatsApp clone using Custom Neon Black aesthetics.
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.5

  # Firebase Core and Services
  firebase_core: ^2.24.0
  firebase_auth: ^4.15.0
  cloud_firestore: ^4.13.0

  # Media Sharing
  firebase_storage: ^11.5.0
  image_picker: ^1.0.4

  # UI and Neon Design Package Pairings
  google_fonts: ^6.1.0
  pulse_animation: ^1.0.2 # Glow animations
  shimmer: ^3.0.0

  # Calling Integration
  agora_rtc_engine: ^6.3.0
  permission_handler: ^11.1.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0`;

  const securityRulesCode = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Catch-all default secure reject door
    match /{document=**} {
      allow read, write: if false;
    }

    function isSignedIn() { return request.auth != null; }
    function isValidId(id) { 
      return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\\\-]+$'); 
    }

    match /users/{userId} {
      allow get: if isSignedIn() && isValidId(userId);
      allow list: if isSignedIn();
      allow create, update: if isSignedIn() && request.auth.uid == userId;
    }

    match /chats/{chatId} {
      allow get: if isSignedIn() && request.auth.uid in resource.data.participants;
      allow list: if isSignedIn();
      allow create, update: if isSignedIn() && request.auth.uid in request.resource.data.participants;
    }

    match /chats/{chatId}/messages/{messageId} {
      allow get, list: if isSignedIn() && request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
      allow create: if isSignedIn() && request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants && request.resource.data.senderId == request.auth.uid;
    }
  }
}`;

  const flutterAuthCode = `// ==========================================
// 1. DEPENDENCIES / PUBSPEC CONFIG
// Add to your pubspec.yaml:
//   firebase_core: ^2.24.0
//   firebase_auth: ^4.15.0
//   cloud_firestore: ^4.13.0
//   pin_code_fields: ^8.0.1  # For premium OTP custom layout
//   google_fonts: ^6.1.0
// ==========================================

// ==========================================
// 2. AUTHENTICATION & PROFILE VERIFICATION CONTROLLER
// file: lib/services/auth_service.dart
// ==========================================
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

class PhoneAuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  // Stream listening to dynamic auth changes (stay logged in checking)
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  // Retrieve current active firebase uid
  String? get currentUid => _auth.currentUser?.uid;

  // Check if authenticated user has fully populated their profile metadata
  Future<bool> isUserProfileComplete(String uid) async {
    try {
      DocumentSnapshot doc = await _db.collection('users').doc(uid).get();
      if (doc.exists && doc.data() != null) {
        var data = doc.data() as Map<String, dynamic>;
        // If they have set a displayName and photoURL, profile is complete
        return data.containsKey('displayName') && 
               data['displayName'] != null && 
               data['displayName'].toString().trim().isNotEmpty;
      }
      return false;
    } catch (e) {
      debugPrint("Error checking profile parameters: $e");
      return false;
    }
  }

  // Phase 1: Request SMS verification pins from Firebase Authentication
  Future<void> sendOtpCode({
    required String phoneNumber,
    required Function(String codeVerId, int? resendToken) onCodeSent,
    required Function(FirebaseAuthException exception) onVerificationFailed,
  }) async {
    await _auth.verifyPhoneNumber(
      phoneNumber: phoneNumber,
      timeout: const Duration(seconds: 60),
      verificationCompleted: (PhoneAuthCredential credential) async {
        // Handle android automatic code extraction (zero-user-touch log in)
        await _auth.signInWithCredential(credential);
      },
      verificationFailed: onVerificationFailed,
      codeSent: onCodeSent,
      codeAutoRetrievalTimeout: (String verificationId) {},
    );
  }

  // Phase 2: Complete phone validation using received pins
  Future<UserCredential> signInWithOtp(String verificationId, String smsCode) async {
    PhoneAuthCredential credential = PhoneAuthProvider.credential(
      verificationId: verificationId,
      smsCode: smsCode,
    );
    return await _auth.signInWithCredential(credential);
  }

  // Sign out cleanly and reset local states (WhatsApp zero-state flow)
  Future<void> logOutSecurely() async {
    await _auth.signOut();
  }
}

// ==========================================
// 3. SECURE AUTH ENTRIES WRAPPER (SESSION PERSISTENCE CHECK)
// file: lib/screens/auth_wrapper.dart
// ==========================================
import 'auth_service.dart';
import 'login_screen.dart';
import 'profile_setup_screen.dart';
import 'home_screen.dart';

class AuthWrapper extends StatelessWidget {
  final PhoneAuthService _authService = PhoneAuthService();

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: _authService.authStateChanges,
      builder: (context, snapshot) {
        // Wait till telemetry streams boot up complete
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            backgroundColor: Color(0xFF050505),
            body: Center(
              child: CircularProgressIndicator(color: Color(0xFF00FF9C)),
            ),
          );
        }

        final User? firebaseUser = snapshot.data;

        if (firebaseUser == null) {
          return LoginScreen(); // Zero authenticated credential, route to signup
        }

        // Authenticated. Now check if profile exists on database
        return FutureBuilder<bool>(
          future: _authService.isUserProfileComplete(firebaseUser.uid),
          builder: (context, profileSnapshot) {
            if (profileSnapshot.connectionState == ConnectionState.waiting) {
              return const Scaffold(
                backgroundColor: Color(0xFF050505),
                body: Center(
                  child: CircularProgressIndicator(color: Color(0xFF00FF9C)),
                ),
              );
            }

            final bool complete = profileSnapshot.data ?? false;
            if (complete) {
              return HomeScreen(); // Completed, direct to active Chats portal
            } else {
              return ProfileSetupScreen(); // Needs metadata, route to onboarding config
            }
          },
        );
      },
    );
  }
}

// ==========================================
// 4. SETTINGS DRAWER & WHATSAPP LOGOUT OVERLAY (NEON BLACK STYLE)
// file: lib/screens/settings_screen.dart
// ==========================================
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/auth_service.dart';

class SettingsScreen extends StatelessWidget {
  final PhoneAuthService _authService = PhoneAuthService();

  SettingsScreen({Key? key}) : super(key: key);

  void _showLogoutDialog(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: false, // User background me click karke close nahi kar sakta
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF0A0A0A),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFF00FF9C), width: 1.5),
          ),
          title: Text(
            "TERMINATE SESSION?",
            style: GoogleFonts.spaceGrotesk(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              letterSpacing: 2,
            ),
          ),
          content: Text(
            "Are you sure you want to log out from MAHRAJ MESSENGER? You will need to verify your phone number again.",
            style: GoogleFonts.firaCode(
              color: Colors.grey[400],
              fontSize: 12,
            ),
          ),
          actions: [
            // Cancel Button
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                "CANCEL",
                style: GoogleFonts.spaceGrotesk(
                  color: Colors.grey[500],
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            // Confirm Logout Button
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFF3333), // Neon Red Accent for danger actions
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              onPressed: () async {
                Navigator.pop(context); // Close dialog
                await _authService.logOutSecurely();
                
                // Pure navigation stack ko clear karke LoginScreen par bhejna (WhatsApp Style)
                Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
              },
              child: Text(
                "LOG OUT",
                style: GoogleFonts.spaceGrotesk(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050505),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0A0A),
        title: Text(
          "SETTINGS",
          style: GoogleFonts.spaceGrotesk(color: Colors.white, letterSpacing: 2),
        ),
        iconTheme: const IconThemeData(color: Color(0xFF00FF9C)),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            // User Meta Dummy Card
            ListTile(
              leading: CircleAvatar(
                backgroundColor: const Color(0xFF0A0A0A),
                child: const Icon(Icons.person, color: Color(0xFF00FF9C)),
              ),
              title: Text("Mahraj User", style: GoogleFonts.spaceGrotesk(color: Colors.white)),
              subtitle: Text("Encrypted Telemetry Active", style: GoogleFonts.firaCode(color: Colors.grey, fontSize: 10)),
            ),
            const Divider(color: Color(0xFF222222)),
            const Spacer(),
            
            // Glowing Neon Logout Button
            InkWell(
              onTap: () => _showLogoutDialog(context),
              borderRadius: BorderRadius.circular(16),
              child: Container(
                height: 56,
                decoration: BoxDecoration(
                  color: const Color(0xFF050505),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFFF3333), width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFFF3333).withOpacity(0.15),
                      blurRadius: 10,
                    )
                  ],
                ),
                child: Center(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.logout, color: Color(0xFFFF3333)),
                      const SizedBox(width: 10),
                      Text(
                        "LOG OUT SESSION",
                        style: GoogleFonts.spaceGrotesk(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ==========================================
// 5. SECURE ONBOARDING SCREEN (PROFILE SETUP FRAME)
// file: lib/screens/profile_setup_screen.dart
// ==========================================
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/auth_service.dart';

class ProfileSetupScreen extends StatefulWidget {
  @override
  _ProfileSetupScreenState createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends State<ProfileSetupScreen> {
  final TextEditingController _nameController = TextEditingController();
  final PhoneAuthService _authService = PhoneAuthService();
  bool _isLoading = false;

  void _saveProfile() async {
    String name = _nameController.text.trim();
    if (name.isEmpty) return;

    setState(() => _isLoading = true);
    try {
      String? uid = _authService.currentUid;
      if (uid != null) {
        // Firestore me user profile complete data sync karna
        await FirebaseFirestore.instance.collection('users').doc(uid).set({
          'uid': uid,
          'displayName': name,
          'profilePic': '', // Abhi ke liye empty string, baad me update hoga
          'createdAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));

        // Profile save hone ke baad seedhe main chat frame par redirect karna
        Navigator.pushReplacementNamed(context, '/home');
      }
    } catch (e) {
      setState(() => _isLoading = false);
      // Handling Exception logs
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050505),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                "INITIALIZE PROFILE",
                style: GoogleFonts.spaceGrotesk(
                  color: Colors.white, 
                  fontSize: 24, 
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _nameController,
                style: const TextStyle(color: Color(0xFF00FF9C)),
                decoration: InputDecoration(
                  labelText: "DISPLAY NAME",
                  labelStyle: GoogleFonts.spaceGrotesk(color: Colors.grey),
                  enabledBorder: const OutlineInputBorder(
                    borderSide: BorderSide(color: Color(0xFF222222)),
                  ),
                  focusedBorder: const OutlineInputBorder(
                    borderSide: BorderSide(color: Color(0xFF00FF9C)),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00FF9C),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                onPressed: _isLoading ? null : _saveProfile,
                child: _isLoading 
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2),
                    )
                  : Text(
                      "SAVE PROFILE", 
                      style: GoogleFonts.spaceGrotesk(
                        color: Colors.black, 
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.5,
                      ),
                    ),
              )
            ],
          ),
        ),
      ),
    );
  }
}

// ==========================================
// 6. MAIN CHAT DIRECTORY PORTAL (SECURED HOME SCREEN)
// file: lib/screens/home_screen.dart
// ==========================================
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'settings_screen.dart';

class HomeScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050505),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0A0A),
        title: Text("MAHRAJ MESSENGER", style: GoogleFonts.spaceGrotesk(color: Colors.white)),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings, color: Color(0xFF00FF9C)),
            onPressed: () {
              Navigator.push(context, MaterialPageRoute(builder: (context) => SettingsScreen()));
            },
          )
        ],
      ),
      body: Center(
        child: Text(
          "CHATS SECURED UNDER ZERO-TRUST",
          style: GoogleFonts.firaCode(color: const Color(0xFF00D1FF), fontSize: 12),
        ),
      ),
    );
  }
}

// ==========================================
// 7. CORE RUNTIME APP ENTRY (MAIN BLUEPRINTS GATEWAY)
// file: lib/main.dart
// ==========================================
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'screens/auth_wrapper.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(const MahrajMessenger());
}

class MahrajMessenger extends StatelessWidget {
  const MahrajMessenger({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MAHRAJ MESSENGER',
      debugShowCheckedModeBanner: false,
      home: AuthWrapper(), // App pehle state verify karega yahan se
      routes: {
        '/login': (context) => const LoginScreen(),
        '/home': (context) => HomeScreen(),
      },
    );
  }
}`;

  const flutterChatCode = `// lib/screens/chat_screen.dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

// Styled Message Bubble for Neon Black Aesthetic
class MessageBubble extends StatelessWidget {
  final String text;
  final bool isMe;

  const MessageBubble({required this.text, required this.isMe});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 5, horizontal: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          // Deep Grey surfaces decorated with Neon Lime Green or Electric Cyan Borders
          color: isMe ? const Color(0xFF080808) : const Color(0xFF0A0A0A),
          border: Border.all(
            color: isMe ? const Color(0xFF00FF9C) : const Color(0xFF00D1FF),
            width: 1.5,
          ),
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: isMe ? const Radius.circular(16) : const Radius.circular(0),
            bottomRight: isMe ? const Radius.circular(0) : const Radius.circular(16),
          ),
          boxShadow: [
            BoxShadow(
              color: (isMe ? const Color(0xFF00FF9C) : const Color(0xFF00D1FF)).withOpacity(0.15),
              blurRadius: 8,
              spreadRadius: 1,
            )
          ]
        ),
        child: Text(
          text,
          style: TextStyle(
            color: isMe ? const Color(0xFF00FF9C) : Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}`;

  return (
    <div id="dev-hub-root" className="fixed inset-0 z-50 bg-[#050505]/95 flex flex-col justify-end md:justify-center items-center p-4">
      <div className="w-full max-w-4xl bg-[#080808] border-2 border-[#00FF9C]/40 rounded-2xl shadow-[0_0_30px_rgba(0,255,156,0.25)] overflow-hidden flex flex-col h-[85vh] max-h-[750px] font-sans">
        {/* Header */}
        <div className="p-4 border-b border-[#00FF9C]/20 bg-[#0A0A0A] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="text-[#00FF9C] animate-pulse w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold tracking-wider text-white">MAHRAJ MESSENGER • FLUTTER DEV HUB</h2>
              <p className="text-xs text-[#00FF9C] font-mono">Expert blueprints and cross-platform native specifications</p>
            </div>
          </div>
          <button 
            id="close-devhub-btn"
            onClick={onClose}
            className="text-gray-400 hover:text-white border border-white/5 hover:border-[#00FF9C] rounded px-3 py-1 font-mono text-xs transition duration-200"
          >
            ESC // CLOSE
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap border-b border-white/5 bg-[#0A0A0A] p-1 gap-1">
          <button
            onClick={() => setActiveTab("deps")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-mono rounded transition duration-200 ${
              activeTab === "deps" ? "bg-[#080808] text-[#00FF9C] border-b-2 border-[#00FF9C]" : "text-gray-400 hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> pubspec.yaml
          </button>
          <button
            onClick={() => setActiveTab("rules")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-mono rounded transition duration-200 ${
              activeTab === "rules" ? "bg-[#080808] text-[#00FF9C] border-b-2 border-[#00FF9C]" : "text-gray-400 hover:text-white"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" /> Firestore Rules
          </button>
          <button
            onClick={() => setActiveTab("auth")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-mono rounded transition duration-200 ${
              activeTab === "auth" ? "bg-[#080808] text-[#00FF9C] border-b-2 border-[#00FF9C]" : "text-gray-400 hover:text-white"
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" /> Phone Auth (OTP)
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-mono rounded transition duration-200 ${
              activeTab === "chat" ? "bg-[#080808] text-[#00FF9C] border-b-2 border-[#00FF9C]" : "text-gray-400 hover:text-white"
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" /> Chat UI (Dart)
          </button>
          <button
            onClick={() => setActiveTab("schema")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-mono rounded transition duration-200 ${
              activeTab === "schema" ? "bg-[#080808] text-[#00FF9C] border-b-2 border-[#00FF9C]" : "text-gray-400 hover:text-white"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" /> Schemas (NoSQL)
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#050505] font-mono text-xs text-gray-300">
          {activeTab === "deps" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-[#0A0A0A] p-2 rounded border border-white/5">
                <span>Setup standard Dart dynamic libraries in your Flutter project root:</span>
                <button
                  onClick={() => copyToClipboard(pubspecCode, "deps")}
                  className="flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-[#00FF9C]/20 rounded text-[#00FF9C] transition"
                >
                  {copied === "deps" ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Code
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 bg-[#0A0A0A] text-[#00FF9C]/90 rounded-lg overflow-x-auto whitespace-pre-wrap border border-white/5 leading-relaxed">
                {pubspecCode}
              </pre>
            </div>
          )}

          {activeTab === "rules" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-[#0A0A0A] p-2 rounded border border-white/5">
                <span>Secure live database using Attributes-Based Zero Trust Rules:</span>
                <button
                  onClick={() => copyToClipboard(securityRulesCode, "rules")}
                  className="flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-[#00FF9C]/20 rounded text-[#00FF9C] transition"
                >
                  {copied === "rules" ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Code
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 bg-[#0A0A0A] text-lime-400 rounded-lg overflow-x-auto whitespace-pre-wrap border border-white/5 leading-relaxed">
                {securityRulesCode}
              </pre>
            </div>
          )}

          {activeTab === "auth" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-[#0A0A0A] p-2 rounded border border-white/5">
                <span>Implement Phone OTP Signing & Validation in Dart:</span>
                <button
                  onClick={() => copyToClipboard(flutterAuthCode, "auth")}
                  className="flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-[#00FF9C]/20 rounded text-[#00FF9C] transition"
                >
                  {copied === "auth" ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Code
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 bg-[#0A0A0A] text-cyan-400 rounded-lg overflow-x-auto whitespace-pre-wrap border border-white/5 leading-relaxed">
                {flutterAuthCode}
              </pre>
            </div>
          )}

          {activeTab === "chat" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-[#0A0A0A] p-2 rounded border border-white/5">
                <span>Aesthetic "Neon Black" Chat Bubbles widget in Flutter:</span>
                <button
                  onClick={() => copyToClipboard(flutterChatCode, "chat")}
                  className="flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-[#00FF9C]/20 rounded text-[#00FF9C] transition"
                >
                  {copied === "chat" ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Code
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 bg-[#0A0A0A] text-pink-400 rounded-lg overflow-x-auto whitespace-pre-wrap border border-white/5 leading-relaxed">
                {flutterChatCode}
              </pre>
            </div>
          )}

          {activeTab === "schema" && (
            <div className="space-y-4">
              <h3 className="text-white text-sm font-bold border-b border-white/5 pb-10">Firestore Collections Schema (JSON reference)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0A0A0A] p-3 rounded border border-white/5">
                  <h4 className="text-[#00FF9C] font-bold">/users/&#123;uid&#125; (User Documents)</h4>
                  <ul className="list-disc pl-4 mt-2 space-y-1 text-gray-400 text-xxs">
                    <li><strong className="text-white">uid:</strong> String (firebase user ID)</li>
                    <li><strong className="text-white">displayName:</strong> String (Username)</li>
                    <li><strong className="text-white">phone:</strong> String (Full Mobile Number)</li>
                    <li><strong className="text-white">photoURL:</strong> String (HTTPS URL)</li>
                    <li><strong className="text-white">bio:</strong> String (Status text)</li>
                    <li><strong className="text-white">isOnline:</strong> Boolean</li>
                    <li><strong className="text-white">lastSeen:</strong> Timestamp</li>
                  </ul>
                </div>

                <div className="bg-[#0A0A0A] p-3 rounded border border-white/5">
                  <h4 className="text-[#00FF9C] font-bold">/chats/&#123;chatId&#125; (Chat Rooms)</h4>
                  <ul className="list-disc pl-4 mt-2 space-y-1 text-gray-400 text-xxs">
                    <li><strong className="text-white">id:</strong> String ([uid1]_[uid2])</li>
                    <li><strong className="text-white">participants:</strong> Array [uid1, uid2]</li>
                    <li><strong className="text-white">lastMessage:</strong> String</li>
                    <li><strong className="text-white">lastMessageSender:</strong> String</li>
                    <li><strong className="text-white">lastMessageTime:</strong> Timestamp</li>
                  </ul>
                </div>

                <div className="bg-[#0A0A0A] p-3 rounded border border-white/5">
                  <h4 className="text-[#00FF9C] font-bold">/chats/&#123;chatId&#125;/messages/&#123;msgId&#125;</h4>
                  <ul className="list-disc pl-4 mt-2 space-y-1 text-gray-400 text-xxs">
                    <li><strong className="text-white">id:</strong> String unique identifier</li>
                    <li><strong className="text-white">senderId:</strong> String UID of sender</li>
                    <li><strong className="text-white">text:</strong> String content</li>
                    <li><strong className="text-white">mediaUrl:</strong> String (optional URL)</li>
                    <li><strong className="text-white">mediaType:</strong> Enum "image" | "video"</li>
                    <li><strong className="text-white">timestamp:</strong> Timestamp of dispatch</li>
                    <li><strong className="text-white">status:</strong> Enum "sent" | "delivered" | "read"</li>
                  </ul>
                </div>

                <div className="bg-[#0A0A0A] p-3 rounded border border-white/5">
                  <h4 className="text-[#00FF9C] font-bold">/statuses/&#123;storyId&#125; (Stories Feed)</h4>
                  <ul className="list-disc pl-4 mt-2 space-y-1 text-gray-400 text-xxs">
                    <li><strong className="text-white">id:</strong> String unique identifier</li>
                    <li><strong className="text-white">userId:</strong> String poster UID</li>
                    <li><strong className="text-white">userName:</strong> String username</li>
                    <li><strong className="text-white">userAvatar:</strong> String avatar URL</li>
                    <li><strong className="text-white">mediaUrl:</strong> String status asset URL</li>
                    <li><strong className="text-white">text:</strong> String text comment</li>
                    <li><strong className="text-white">timestamp:</strong> Timestamp</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0A0A0A] border-t border-white/5 text-center text-xxs text-gray-500">
          蓝 M-Blue Cross-platform specifications for MAHRAJ MESSENGER Mobile compilation. Made for Syed Ashraf.
        </div>
      </div>
    </div>
  );
}
