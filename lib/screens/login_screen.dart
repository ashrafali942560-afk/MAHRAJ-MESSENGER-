// ==========================================
// MAHRAJ MESSENGER - PREMIUM NEON BLACK AUTHENTICATION SCREEN
// file: lib/screens/login_screen.dart
// ==========================================
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_fonts/google_fonts.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final TextEditingController _phoneController = TextEditingController(text: "+91");
  final TextEditingController _otpController = TextEditingController();

  bool _isLoading = false;
  bool _isOtpSent = false;
  String? _verificationId;

  void _showNeonSnackBar(String message, {bool isError = false}) {
    if (!mounted) return;
    
    final Color activeColor = isError ? const Color(0xFFFF3333) : const Color(0xFF00FF9C);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              isError ? Icons.security_focus_credential_outlined : Icons.wifi_protected_setup_sharp,
              color: activeColor,
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message.toUpperCase(),
                style: GoogleFonts.firaCode(
                  color: activeColor,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        backgroundColor: const Color(0xFF0A0A0A),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          side: BorderSide(color: activeColor, width: 1.5),
          borderRadius: BorderRadius.circular(8),
        ),
        duration: const Duration(seconds: 4),
      ),
    );
  }

  // Phase 1: Request OTP Pin from Firebase Authentication
  void _requestOtp() async {
    final String phone = _phoneController.text.trim();
    if (phone.isEmpty || phone.length < 10) {
      _showNeonSnackBar("INVALID TARGET PORT: SPECIFY VALID MOBILE NUMBER", isError: true);
      return;
    }

    setState(() => _isLoading = true);

    try {
      await _auth.verifyPhoneNumber(
        phoneNumber: phone,
        timeout: const Duration(seconds: 60),
        verificationCompleted: (PhoneAuthCredential credential) async {
          // Android Auto SMS extraction support triggers instant authentication
          await _auth.signInWithCredential(credential);
          _showNeonSnackBar("AUTO-HANDSHAKE COMPLETE: SIGNED IN SUCCESSFULLY");
          _navigateToHome();
        },
        verificationFailed: (FirebaseAuthException e) {
          setState(() => _isLoading = false);
          _showNeonSnackBar("HANDSHAKE FAILURE: ${e.message}", isError: true);
        },
        codeSent: (String verificationId, int? resendToken) {
          setState(() {
            _verificationId = verificationId;
            _isOtpSent = true;
            _isLoading = false;
          });
          _showNeonSnackBar("OTP DECRYPTED TRANSMISSION EN-ROUTE. VERIFY RECEIVED PIN.");
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          _verificationId = verificationId;
        },
      );
    } catch (e) {
      setState(() => _isLoading = false);
      _showNeonSnackBar("NETWORK EXCEPTION: ${e.toString()}", isError: true);
    }
  }

  // Phase 2: Sign-in utilizing provided SMS code
  void _verifyOtp() async {
    final String otp = _otpController.text.trim();
    if (otp.length != 6) {
      _showNeonSnackBar("CRITICAL ERR: TRANSCEIVED PIN LENGTH MUST BE 6 DIGITS", isError: true);
      return;
    }

    if (_verificationId == null) {
      _showNeonSnackBar("VERIFICATION ID CORRUPTED. PLEASE RE-REQUEST PIN", isError: true);
      return;
    }

    setState(() => _isLoading = true);

    try {
      PhoneAuthCredential credential = PhoneAuthProvider.credential(
        verificationId: _verificationId!,
        smsCode: otp,
      );

      await _auth.signInWithCredential(credential);
      _showNeonSnackBar("CRYPTO HANDSHAKE SUCCESS • INSTANCE GRANTED");
      _navigateToHome();
    } on FirebaseAuthException catch (e) {
      setState(() => _isLoading = false);
      _showNeonSnackBar("SIGN-IN CORRUPTION: ${e.message}", isError: true);
    } catch (e) {
      setState(() => _isLoading = false);
      _showNeonSnackBar("EXCEPTION RESOLVING CODE: ${e.toString()}", isError: true);
    }
  }

  void _navigateToHome() {
    if (mounted) {
      Navigator.of(context).pushReplacementNamed('/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050505),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 40.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 40),
              // Cyberspace Messenger Shield Logo
              Center(
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0A0A0A),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: _isOtpSent ? const Color(0xFF00D1FF) : const Color(0xFF00FF9C),
                      width: 2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: (_isOtpSent ? const Color(0xFF00D1FF) : const Color(0xFF00FF9C)).withOpacity(0.25),
                        blurRadius: 20,
                        spreadRadius: 2,
                      )
                    ],
                  ),
                  child: Icon(
                    _isOtpSent ? Icons.vpn_key_rounded : Icons.cell_tower_rounded,
                    color: _isOtpSent ? const Color(0xFF00D1FF) : const Color(0xFF00FF9C),
                    size: 48,
                  ),
                ),
              ),
              const SizedBox(height: 32),
              
              // App Branding Text
              Text(
                "MAHRAJ MESSENGER",
                style: GoogleFonts.spaceGrotesk(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              
              // Dynamic Technical Status line
              Text(
                _isOtpSent 
                    ? "DECIPHERING HANDSHAKE OVER SECURE RECEPTOR" 
                    : "ZERO TRUST DATA CHANNEL NODE GATEWAY",
                style: GoogleFonts.firaCode(
                  color: _isOtpSent ? const Color(0xFF00D1FF) : const Color(0xFF00FF9C),
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.0,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),

              // Dynamic interface rendering based on current state
              if (!_isOtpSent) ...[
                // PHONE INPUT PORT
                Text(
                  "SECURE NODE ID (PHONE NUMBER)",
                  style: GoogleFonts.spaceGrotesk(
                    color: Colors.white70,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  style: GoogleFonts.firaCode(color: const Color(0xFF00FF9C), fontSize: 15),
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.phone_iphone_sharp, color: Color(0xFF00FF9C), size: 20),
                    hintText: "+91 XXXXX XXXXX",
                    hintStyle: GoogleFonts.firaCode(color: Colors.grey[700]),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Colors.white10, width: 1.5),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFF00FF9C), width: 1.5),
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                
                // REQUEST OTP TRIGGER
                GestureDetector(
                  onTap: _isLoading ? null : _requestOtp,
                  child: Container(
                    height: 56,
                    decoration: BoxDecoration(
                      color: const Color(0xFF0A0A0A),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFF00FF9C), width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF00FF9C).withOpacity(0.15),
                          blurRadius: 10,
                        )
                      ],
                    ),
                    child: Center(
                      child: _isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(color: Color(0xFF00FF9C), strokeWidth: 2),
                            )
                          : Text(
                              "REQUEST OTP TRANSMISSION",
                              style: GoogleFonts.spaceGrotesk(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.5,
                                fontSize: 13,
                              ),
                            ),
                    ),
                  ),
                ),
              ] else ...[
                // OTP VERIFICATION PORT
                Text(
                  "ENTER SECURE VERIFICATION CODE",
                  style: GoogleFonts.spaceGrotesk(
                    color: Colors.white70,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _otpController,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  style: GoogleFonts.firaCode(
                    color: const Color(0xFF00D1FF),
                    fontSize: 18,
                    letterSpacing: 8.0,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                  decoration: InputDecoration(
                    counterText: "",
                    prefixIcon: const Icon(Icons.dialpad_sharp, color: Color(0xFF00D1FF), size: 20),
                    hintText: "XXXXXX",
                    hintStyle: GoogleFonts.firaCode(color: Colors.grey[700], letterSpacing: 8.0),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Colors.white10, width: 1.5),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFF00D1FF), width: 1.5),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                
                // BACK TO PHONE TRIGGER
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: _isLoading
                        ? null
                        : () {
                            setState(() {
                              _isOtpSent = false;
                              _otpController.clear();
                            });
                          },
                    icon: const Icon(Icons.arrow_back, color: Color(0xFF00D1FF), size: 16),
                    label: Text(
                      "MODIFY PORT IDENTIFICATION",
                      style: GoogleFonts.spaceGrotesk(
                        color: const Color(0xFF00D1FF),
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                
                // VERIFY OTP TRIGGER
                GestureDetector(
                  onTap: _isLoading ? null : _verifyOtp,
                  child: Container(
                    height: 56,
                    decoration: BoxDecoration(
                      color: const Color(0xFF0A0A0A),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFF00D1FF), width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF00D1FF).withOpacity(0.15),
                          blurRadius: 10,
                        )
                      ],
                    ),
                    child: Center(
                      child: _isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(color: Color(0xFF00D1FF), strokeWidth: 2),
                            )
                          : Text(
                              "VERIFY SECURITY INTERCEPT",
                              style: GoogleFonts.spaceGrotesk(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.5,
                                fontSize: 13,
                              ),
                            ),
                    ),
                  ),
                ),
              ],
              
              const SizedBox(height: 48),
              // Cryptographic statement
              Column(
                children: [
                  const Icon(Icons.lock_person_sharp, color: Colors.white24, size: 16),
                  const SizedBox(height: 8),
                  Text(
                    "PROTECTED UNDER STANDARD END-TO-END CRYPTO-ROUTINGS",
                    style: GoogleFonts.firaCode(
                      color: Colors.white24,
                      fontSize: 8,
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
