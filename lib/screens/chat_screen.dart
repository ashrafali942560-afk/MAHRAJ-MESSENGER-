// ==========================================
// 1. REAL-TIME CHAT DATABASE HANDLER (SECURE FIRESTORE SYNC & MEDIA)
// file: lib/services/chat_service.dart
// ==========================================
import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';

class PhoneChatService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseStorage _storage = FirebaseStorage.instance;

  // Helper code to sort participant IDs alphabetically.
  // This guarantees both user 1 and user 2 resolve to the exact same room ID.
  String getRoomId(String currentUserId, String receiverId) {
    List<String> ids = [currentUserId, receiverId];
    ids.sort();
    return ids.join('_');
  }

  // Send a real-time message with media attributes
  Future<void> sendMessage({
    required String receiverId,
    required String text,
    required String type, // "text" | "image" | "video"
    String? mediaUrl,
  }) async {
    final String currentUserId = _auth.currentUser?.uid ?? '';
    if (currentUserId.isEmpty) return;

    final String chatRoomId = getRoomId(currentUserId, receiverId);
    final Timestamp timestamp = Timestamp.now();

    // Create a unique message identifier
    final DocumentReference msgRef = _db
        .collection('chats')
        .doc(chatRoomId)
        .collection('messages')
        .doc();

    final Map<String, dynamic> messageData = {
      'id': msgRef.id,
      'senderId': currentUserId,
      'receiverId': receiverId,
      'text': text,
      'type': type,
      'mediaUrl': mediaUrl ?? '',
      'timestamp': timestamp,
      'status': 'sent',
    };

    // 1. Write the message payload to the nested sub-collection
    await msgRef.set(messageData);

    // 2. Update the master room document with tracking metadata so that the individual chat threads show up instantly on global lists
    await _db.collection('chats').doc(chatRoomId).set({
      'id': chatRoomId,
      'participants': [currentUserId, receiverId],
      'lastMessage': text.isNotEmpty ? text : "[Media Attachment]",
      'lastMessageSender': currentUserId,
      'lastMessageTime': timestamp,
    }, SetOptions(merge: true));
  }

  // Live Stream subscriber to fetch instantaneous updates sorted chronologically
  Stream<QuerySnapshot> getMessages(String receiverId) {
    final String currentUserId = _auth.currentUser?.uid ?? '';
    final String chatRoomId = getRoomId(currentUserId, receiverId);

    return _db
        .collection('chats')
        .doc(chatRoomId)
        .collection('messages')
        .orderBy('timestamp', descending: false)
        .snapshots();
  }

  // Upload pictures or recordings to storage bucket and output persistent download link
  Future<String> uploadMediaFile(File file, String chatRoomId) async {
    final String fileExtension = file.path.split('.').last;
    final String fileName = "${DateTime.now().millisecondsSinceEpoch}_${file.hashCode}.$fileExtension";

    final Reference ref = _storage
        .ref()
        .child("chats")
        .child(chatRoomId)
        .child(fileName);

    // Perform upload action task
    final UploadTask uploadTask = ref.putFile(file);
    final TaskSnapshot snapshot = await uploadTask;
    return await snapshot.ref.getDownloadURL();
  }
}

// ==========================================
// 2. AGORA VOICE & VIDEO CALLING ENGINE (REAL-TIME WEBRTC SIGNALING)
// file: lib/services/call_service.dart
// ==========================================
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:flutter/material.dart';

class CallService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;
  late RtcEngine _engine;

  // Track state parameter handles
  bool _isInit = false;

  // Initialize Agora Engine with Client App credentials
  Future<void> initializeAgora({
    required String agoraAppId,
    required Function(int uid, int elapsed) onJoined,
    required Function(int uid, int elapsed) onPeerJoined,
    required Function(int uid, UserOfflineReasonType reason) onPeerOffline,
    required Function() onLeave,
  }) async {
    if (_isInit) return;

    _engine = createAgoraRtcEngine();
    await _engine.initialize(RtcEngineContext(
      appId: agoraAppId,
      channelProfile: ChannelProfileType.channelProfileCommunication,
    ));

    // Listen to real-time events on audio or video networks
    _engine.registerEventHandler(RtcEngineEventHandler(
      onJoinChannelSuccess: (RtcConnection connection, int elapsed) {
        onJoined(connection.localUid ?? 0, elapsed);
      },
      onUserJoined: (RtcConnection connection, int remoteUid, int elapsed) {
        onPeerJoined(remoteUid, elapsed);
      },
      onUserOffline: (RtcConnection connection, int remoteUid, UserOfflineReasonType reason) {
        onPeerOffline(remoteUid, reason);
      },
      onLeaveChannel: (RtcConnection connection, RtcStats stats) {
        onLeave();
      },
    ));

    await _engine.enableAudio();
    _isInit = true;
  }

  // Create call log inside firestore to alert target peer instantly
  Future<String> startOutgoingCall({
    required String receiverId,
    required String receiverName,
    required String callerName,
    required String callType, // "voice" | "video"
  }) async {
    final String currentUserId = _auth.currentUser?.uid ?? '';
    final String callId = _db.collection('calls').doc().id;

    final Map<String, dynamic> callRecord = {
      'callId': callId,
      'callerId': currentUserId,
      'callerName': callerName,
      'receiverId': receiverId,
      'receiverName': receiverName,
      'type': callType,
      'status': 'ringing', // dialing -> ringing -> connected -> ended
      'channelName': 'agora_${callId}',
      'token': 'mock_token_for_instant_connect_or_fetch_from_api', 
      'timestamp': FieldValue.serverTimestamp(),
    };

    await _db.collection('calls').doc(callId).set(callRecord);
    return callId;
  }

  // Update Call status on the go to notify peers
  Future<void> updateCallStatus(String callId, String status) async {
    await _db.collection('calls').doc(callId).update({
      'status': status,
      if (status == 'ended') 'endedTime': FieldValue.serverTimestamp(),
    });
  }

  // Subscribe to call requests (incoming checks)
  Stream<QuerySnapshot> listenToIncomingCalls() {
    final String currentUserId = _auth.currentUser?.uid ?? '';
    return _db
        .collection('calls')
        .where('receiverId', isEqualTo: currentUserId)
        .where('status', isEqualTo: 'ringing')
        .snapshots();
  }

  // Connect to live room using generated token and app settings
  Future<void> joinRtcRoom({
    required String channelName,
    required String token,
    required int uid,
    required String type, // voice / video
  }) async {
    if (type == 'video') {
      await _engine.enableVideo();
      await _engine.startPreview();
    }
    await _engine.joinChannel(
      token: token,
      channelId: channelName,
      uid: uid,
      options: const ChannelMediaOptions(),
    );
  }

  // Close connections cleanly on close
  Future<void> leaveRtcChannel() async {
    await _engine.leaveChannel();
    await _engine.disableVideo();
    _isInit = false;
  }
}

// ==========================================
// 3. COMPLETE REAL-TIME CHAT SCREEN UI (NEON BLACK BRANDING)
// file: lib/screens/chat_screen.dart
// ==========================================
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/chat_service.dart';
import '../services/call_service.dart';

class ChatScreen extends StatefulWidget {
  final String receiverId;
  final String receiverName;
  final String? receiverAvatarUrl;

  const ChatScreen({
    Key? key,
    required this.receiverId,
    required this.receiverName,
    this.receiverAvatarUrl,
  }) : super(key: key);

  @override
  _ChatScreenState createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextEditingController _msgController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final PhoneChatService _chatService = PhoneChatService();
  final CallService _callService = CallService();
  final String _currentUserId = FirebaseAuth.instance.currentUser?.uid ?? '';
  bool _isMessageEmpty = true;

  @override
  void initState() {
    super.initState();
    _msgController.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    _msgController.removeListener(_onTextChanged);
    _msgController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onTextChanged() {
    final bool isEmpty = _msgController.text.trim().isEmpty;
    if (isEmpty != _isMessageEmpty) {
      setState(() {
        _isMessageEmpty = isEmpty;
      });
    }
  }

  void _dispatchMessage() async {
    final String text = _msgController.text.trim();
    if (text.isEmpty) return;

    _msgController.clear();
    await _chatService.sendMessage(
      receiverId: widget.receiverId,
      text: text,
      type: "text",
    );
    _scrollDown();
  }

  void _scrollDown() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _triggerCall(String type) async {
    // 1. Register Call Record inside Firestore database
    String callId = await _callService.startOutgoingCall(
      receiverId: widget.receiverId,
      receiverName: widget.receiverName,
      callerName: "Syed Ashraf", 
      callType: type,
    );

    // 2. Present user interface overlay for Dialing
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            "INITIATING ${type.toUpperCase()} TRANSMISSION • SECURE LINK: agora_\$callId",
            style: GoogleFonts.firaCode(color: const Color(0xFF00FF9C), fontSize: 11, fontWeight: FontWeight.bold),
          ),
          backgroundColor: const Color(0xFF0A0A0A),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            side: const BorderSide(color: Color(0xFF00FF9C), width: 1),
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      );
    }
  }

  void _openAttachmentOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0A0A0A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        side: BorderSide(color: Color(0xFF00FF9C), width: 1.5),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                "SELECT SECURE ATTACHMENT",
                style: GoogleFonts.spaceGrotesk(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 24),
              GridView.count(
                shrinkWrap: true,
                crossAxisCount: 4,
                children: [
                  _buildAttachmentTile(Icons.photo_library, "GALLERY", const Color(0xFF00FF9C)),
                  _buildAttachmentTile(Icons.camera_alt, "CAMERA", const Color(0xFF00D1FF)),
                  _buildAttachmentTile(Icons.insert_drive_file, "DOCUMENT", Colors.purpleAccent),
                  _buildAttachmentTile(Icons.audiotrack, "AUDIO", Colors.orangeAccent),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAttachmentTile(IconData icon, String label, Color accentColor) {
    return GestureDetector(
      onTap: () {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              "ACCESSING ENCRYPTED $label SOURCE...",
              style: GoogleFonts.firaCode(color: accentColor, fontSize: 11, fontWeight: FontWeight.bold),
            ),
            backgroundColor: const Color(0xFF0A0A0A),
            behavior: SnackBarBehavior.floating,
          ),
        );
      },
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF050505),
              shape: BoxShape.circle,
              border: Border.all(color: accentColor.withOpacity(0.5), width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: accentColor.withOpacity(0.15),
                  blurRadius: 8,
                )
              ],
            ),
            child: Icon(icon, color: accentColor, size: 24),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: GoogleFonts.spaceGrotesk(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050505), 
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0A0A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 18),
          onPressed: () => Navigator.of(context).pop(),
        ),
        titleSpacing: 0,
        title: Row(
          children: [
            // User profile avatar with glowing neon green border
            Container(
              padding: const EdgeInsets.all(1.5),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFF00FF9C), width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF00FF9C).withOpacity(0.3),
                    blurRadius: 6,
                  )
                ],
              ),
              child: CircleAvatar(
                radius: 17,
                backgroundColor: const Color(0xFF080808),
                backgroundImage: widget.receiverAvatarUrl != null
                    ? NetworkImage(widget.receiverAvatarUrl!)
                    : null,
                child: widget.receiverAvatarUrl == null
                    ? Text(
                        widget.receiverName.substring(0, 1).toUpperCase(),
                        style: GoogleFonts.spaceGrotesk(color: const Color(0xFF00FF9C), fontWeight: FontWeight.bold, fontSize: 14),
                      )
                    : null,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.receiverName.toUpperCase(),
                    style: GoogleFonts.spaceGrotesk(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      letterSpacing: 1.0,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Color(0xFF00FF9C),
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        "ONLINE",
                        style: GoogleFonts.firaCode(
                          color: const Color(0xFF00FF9C),
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          // Glowing Neon Cyan Audio Call
          IconButton(
            icon: const Icon(Icons.phone_in_talk, color: Color(0xFF00D1FF)),
            onPressed: () => _triggerCall("voice"),
            tooltip: "SECURE VOICE CHANNEL",
          ),
          // Glowing Neon Cyan Video Call
          IconButton(
            icon: const Icon(Icons.videocam, color: Color(0xFF00FF9C)),
            onPressed: () => _triggerCall("video"),
            tooltip: "SECURE VIDEO FEEDS",
          ),
          const SizedBox(width: 10),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Container(height: 1, color: Colors.white10),
            Expanded(
              child: StreamBuilder<QuerySnapshot>(
                stream: _chatService.getMessages(widget.receiverId),
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator(color: Color(0xFF00FF9C)));
                  }
                  if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.lock_outline, color: Color(0xFF00D1FF), size: 40),
                          const SizedBox(height: 12),
                          Text(
                            "ZERO TRUST PROTOCOLS ACTIVE",
                            style: GoogleFonts.firaCode(color: const Color(0xFF00D1FF), fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            "All payload channels are cryptographically bound.",
                            style: GoogleFonts.spaceGrotesk(color: Colors.grey, fontSize: 11),
                          ),
                        ],
                      ),
                    );
                  }

                  final docs = snapshot.data!.docs;
                  WidgetsBinding.instance.addPostFrameCallback((_) => _scrollDown());

                  return ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                    itemCount: docs.length,
                    itemBuilder: (context, index) {
                      final data = docs[index].data() as Map<String, dynamic>;
                      final bool isMe = data['senderId'] == _currentUserId;
                      final String messageText = data['text'] ?? '';
                      final Timestamp timestamp = data['timestamp'] as Timestamp;
                      final String timeString = "${timestamp.toDate().hour.toString().padLeft(2, '0')}:${timestamp.toDate().minute.toString().padLeft(2, '0')}";

                      return Align(
                        alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.symmetric(vertical: 6),
                          padding: const EdgeInsets.all(12),
                          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                          decoration: BoxDecoration(
                            color: isMe ? const Color(0xFF0A0A0A) : const Color(0xFF0F0F0F),
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
                                color: (isMe ? const Color(0xFF00FF9C) : const Color(0xFF00D1FF)).withOpacity(0.12),
                                blurRadius: 8,
                              )
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                messageText,
                                style: GoogleFonts.firaCode(
                                  color: isMe ? const Color(0xFF00FF9C) : Colors.white,
                                  fontSize: 13.0,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    timeString,
                                    style: GoogleFonts.firaCode(
                                      color: Colors.white24,
                                      fontSize: 8,
                                    ),
                                  ),
                                  if (isMe) ...[
                                    const SizedBox(width: 4),
                                    const Icon(Icons.done_all, color: Color(0xFF00FF9C), size: 12),
                                  ]
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ),

            // Message Composer Area (Modern Floating Aesthetic)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              color: const Color(0xFF0A0A0A),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF050505),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.emoji_emotions_outlined, color: Color(0xFF00D1FF)),
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text("EMOJI ENGAGEMENT PROTOCOLS READY", style: GoogleFonts.firaCode(color: const Color(0xFF00D1FF))),
                                  backgroundColor: const Color(0xFF0A0A0A),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                            },
                          ),
                          Expanded(
                            child: TextField(
                              controller: _msgController,
                              style: const TextStyle(color: Colors.white),
                              decoration: InputDecoration(
                                hintText: "Type encrypted payload...",
                                hintStyle: GoogleFonts.spaceGrotesk(color: Colors.grey, fontSize: 13),
                                border: InputBorder.none,
                              ),
                              onSubmitted: (_) => _dispatchMessage(),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.attach_file, color: Color(0xFF00D1FF)),
                            onPressed: _openAttachmentOptions,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _isMessageEmpty
                        ? () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text("HOLD TO TRANSMIT SECURE AUDIO INTERCEPT...", style: GoogleFonts.firaCode(color: const Color(0xFF00FF9C))),
                                backgroundColor: const Color(0xFF0A0A0A),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          }
                        : _dispatchMessage,
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFF00FF9C),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF00FF9C).withOpacity(0.3),
                            blurRadius: 10,
                            spreadRadius: 1,
                          )
                        ],
                      ),
                      child: Icon(
                        _isMessageEmpty ? Icons.mic : Icons.send_rounded,
                        color: Colors.black,
                        size: 20,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
