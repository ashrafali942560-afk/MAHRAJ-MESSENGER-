// ==========================================
// MAHRAJ MESSENGER - PREMIUM NEON BLACK SETTINGS SCREEN
// file: lib/screens/settings_screen.dart
// ==========================================
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_fonts/google_fonts.dart';
import 'login_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({Key? key}) : super(key: key);

  void _showLogoutDialog(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF0A0A0A),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFFFF3333), width: 1.5),
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
            "ARE YOU ABSOLUTELY SURE YOU WANT TO LOG OUT FROM MAHRAJ MESSENGER? ALL LOCAL ENCRYPTED CODES WILL BE TERMINATED.",
            style: GoogleFonts.firaCode(
              color: Colors.grey[400],
              fontSize: 12,
            ),
          ),
          actions: [
            // Cancel Action
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
            // Terminate Action
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFF3333),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              onPressed: () async {
                Navigator.pop(context); // Close Confirmation Dialog
                await FirebaseAuth.instance.signOut();
                
                if (context.mounted) {
                  // Destructive sign-out clears the entire navigation routing stack to login
                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(builder: (context) => const LoginScreen()),
                    (Route<dynamic> route) => false,
                  );
                }
              },
              child: Text(
                "TERMINATE",
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
    final User? user = FirebaseAuth.instance.currentUser;
    final String userPhone = user?.phoneNumber ?? "+91 XXXXX XXXXX";
    final String userUid = user?.uid ?? "SYSTEM_STATIC_UID_OFFLINE";

    return Scaffold(
      backgroundColor: const Color(0xFF050505),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0A0A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF00FF9C), size: 18),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          "SETTINGS / SYSTEM CONFIG",
          style: GoogleFonts.spaceGrotesk(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.5,
            fontSize: 16,
          ),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 10),
              // User Details Header with Glowing Neon Green Avatar Border
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF0A0A0A),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white10),
                ),
                child: Row(
                  children: [
                    // Avatar with glow
                    Container(
                      padding: const EdgeInsets.all(2.5),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFF00FF9C), width: 1.5),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF00FF9C).withOpacity(0.2),
                            blurRadius: 8,
                          )
                        ],
                      ),
                      child: const CircleAvatar(
                        radius: 26,
                        backgroundColor: Color(0xFF050505),
                        child: Icon(Icons.person_outline_sharp, color: Color(0xFF00FF9C), size: 28),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "MAHRAJ CLIENT NODE",
                            style: GoogleFonts.spaceGrotesk(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                              letterSpacing: 1.0,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            userPhone,
                            style: GoogleFonts.firaCode(
                              color: const Color(0xFF00D1FF),
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            "ID: ${userUid.substring(0, Math.min(10, userUid.length))}...",
                            style: GoogleFonts.firaCode(
                              color: Colors.white24,
                              fontSize: 9,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF050505),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF00FF9C).withOpacity(0.3)),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: Color(0xFF00FF9C),
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            "SECURE",
                            style: GoogleFonts.spaceGrotesk(
                              color: const Color(0xFF00FF9C),
                              fontSize: 8,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              
              // Technical Metadata Panel
              Text(
                "CONNECTED PROTOCOLS",
                style: GoogleFonts.spaceGrotesk(
                  color: Colors.grey,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 8),
              
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF0A0A0A),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white10),
                ),
                child: Column(
                  children: [
                    _buildSettingsTile(
                      icon: Icons.shield_outlined,
                      label: "ZERO TRUST SECURITY",
                      subtitle: "AES-256 chat payload encryption",
                      accentColor: const Color(0xFF00D1FF),
                    ),
                    const Divider(color: Colors.white10, height: 1),
                    _buildSettingsTile(
                      icon: Icons.cell_tower_outlined,
                      label: "SMS RETRIEVAL BAND",
                      subtitle: "Auto Verification Link Ready",
                      accentColor: const Color(0xFF00FF9C),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              
              // Destructive Action: TERMINATE SESSION Button
              InkWell(
                onTap: () => _showLogoutDialog(context),
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  height: 56,
                  decoration: BoxDecoration(
                    color: const Color(0xFF0A0A0A),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFFF3333), width: 1.5),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFFF3333).withOpacity(0.12),
                        blurRadius: 10,
                      )
                    ],
                  ),
                  child: Center(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.logout, color: Color(0xFFFF3333), size: 18),
                        const SizedBox(width: 10),
                        Text(
                          "TERMINATE SESSION / LOG_OUT",
                          style: GoogleFonts.spaceGrotesk(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.5,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSettingsTile({
    required IconData icon,
    required String label,
    required String subtitle,
    required Color accentColor,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF050505),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: accentColor.withOpacity(0.3)),
            ),
            child: Icon(icon, color: accentColor, size: 18),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.spaceGrotesk(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                    letterSpacing: 1.0,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: GoogleFonts.firaCode(
                    color: Colors.grey,
                    fontSize: 9,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// Simple Math helper for Dart min
class Math {
  static int min(int a, int b) => a < b ? a : b;
}
