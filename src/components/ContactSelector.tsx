import React, { useState, useEffect, useRef } from "react";
import { 
  Search, User, Sparkles, MessageSquare, ArrowLeft,
  Smartphone, Loader2, Check, Share2, Database, UserPlus, X, Trash2,
  UserCheck, UserX, Clock, CheckCircle
} from "lucide-react";
import { UserProfile, FriendRequest } from "../types";
import { 
  findUserByUsername,
  deleteUserProfile,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  listenFriendRequests,
  getActiveLocalUser
} from "../lib/state";
import { auth } from "../firebase";

interface ContactSelectorProps {
  contacts: UserProfile[];
  currentUserId: string;
  onSelectContact: (uid: string) => void;
  onClose: () => void;
  activeChatPartnerIds?: string[];
}

export function ContactSelector({
  contacts,
  currentUserId,
  onSelectContact,
  onClose,
  activeChatPartnerIds = []
}: ContactSelectorProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "username">("all");

  // Friend Requests Tracking
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);

  // Username search states
  const [usernameSearch, setUsernameSearch] = useState("");
  const [usernameSearchResult, setUsernameSearchResult] = useState<UserProfile | null>(null);
  const [usernameSearchState, setUsernameSearchState] = useState<"idle" | "searching" | "found" | "not_found" | "error">("idle");
  const usernameSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Optimized real-time search states for the main search input
  const [globalSearchResult, setGlobalSearchResult] = useState<UserProfile | null>(null);
  const [globalSearchState, setGlobalSearchState] = useState<"idle" | "searching" | "found" | "not_found" | "error">("idle");
  const globalSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Optimized real-time global profile lookup for the main search bar
  useEffect(() => {
    if (globalSearchTimeoutRef.current) {
      clearTimeout(globalSearchTimeoutRef.current);
    }

    const trimmed = search.trim().toLowerCase().replace("@", "");
    if (!trimmed || trimmed.length < 2) {
      setGlobalSearchResult(null);
      setGlobalSearchState("idle");
      return;
    }

    setGlobalSearchState("searching");
    globalSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const found = await findUserByUsername(trimmed);
        if (found && found.uid !== currentUserId) {
          setGlobalSearchResult(found);
          setGlobalSearchState("found");
        } else {
          setGlobalSearchResult(null);
          setGlobalSearchState("not_found");
        }
      } catch (err) {
        console.error("Failed to query user by username in main search:", err);
        setGlobalSearchState("error");
      }
    }, 300); // Fast 300ms debounce

    return () => {
      if (globalSearchTimeoutRef.current) clearTimeout(globalSearchTimeoutRef.current);
    };
  }, [search, currentUserId]);

  // Listen to Friend Requests
  useEffect(() => {
    const unsub = listenFriendRequests(currentUserId, (list) => {
      setFriendRequests(list);
    });
    return unsub;
  }, [currentUserId]);

  const getSenderDetails = () => {
    const localUser = getActiveLocalUser();
    if (localUser) return localUser;
    
    // Fallback if live firebase is authenticated but profile isn't in local storage yet
    const liveUser = auth.currentUser;
    return {
      uid: currentUserId,
      displayName: liveUser?.displayName || "MAHRAJ User",
      photoURL: liveUser?.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
      phone: "",
      isOnline: true,
      bio: "Available on MAHRAJ"
    };
  };

  // Debounced username lookup directly against Firestore or simulated local fallback
  useEffect(() => {
    if (usernameSearchTimeoutRef.current) {
      clearTimeout(usernameSearchTimeoutRef.current);
    }

    const trimmed = usernameSearch.trim().toLowerCase().replace("@", "");
    if (!trimmed || trimmed.length < 2) {
      setUsernameSearchResult(null);
      setUsernameSearchState("idle");
      return;
    }

    setUsernameSearchState("searching");
    usernameSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const found = await findUserByUsername(trimmed);
        if (found && found.uid !== currentUserId) {
          setUsernameSearchResult(found);
          setUsernameSearchState("found");
        } else {
          setUsernameSearchResult(null);
          if (trimmed.length >= 2) {
            setUsernameSearchState("not_found");
          } else {
            setUsernameSearchState("idle");
          }
        }
      } catch (err) {
        console.error("Failed to query user by username:", err);
        setUsernameSearchState("error");
      }
    }, 450);

    return () => {
      if (usernameSearchTimeoutRef.current) clearTimeout(usernameSearchTimeoutRef.current);
    };
  }, [usernameSearch, currentUserId]);

  // Find UIDs of users who have mutual accepted friendship requests
  const acceptedFriendUids = friendRequests
    .filter(req => req.status === "accepted")
    .map(req => req.senderId === currentUserId ? req.receiverId : req.senderId);

  const isFriend = (uid: string) => {
    return uid === "ai-bot" || acceptedFriendUids.includes(uid);
  };

  const filteredLocal = contacts.filter(contact => {
    if (contact.uid === currentUserId) return false;
      
    const matchesName = contact.displayName.toLowerCase().includes(search.toLowerCase());
    const matchesUsername = contact.username
      ? contact.username.toLowerCase().includes(search.toLowerCase())
      : false;
    const matchesEmail = contact.email
      ? contact.email.toLowerCase().includes(search.toLowerCase())
      : false;
      
    return matchesName || matchesUsername || matchesEmail;
  });

  return (
    <div id="contact-selector-root" className="fixed inset-0 z-40 bg-[#050505] flex flex-col h-full text-white font-sans">
      {/* Header */}
      <div className="p-4 bg-[#0A0A0A] border-b border-[#00FF9C]/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button id="close-contacts-btn" onClick={onClose} className="p-1 rounded hover:bg-white/5 transition">
            <ArrowLeft className="w-5 h-5 text-[#00FF9C]" />
          </button>
          <div>
            <h2 className="text-sm font-bold tracking-wider uppercase text-white font-mono flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#00FF9C]" /> Profile Discover
            </h2>
            <p className="text-xxs text-[#00FF9C] font-mono">Search and connect across the network</p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-black/60 rounded-xl p-1 border border-white/5 shrink-0">
          <button 
            id="tab-all-contacts"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1 font-mono text-[9px] tracking-wider uppercase rounded-lg transition-all duration-200 ${
              activeTab === "all" 
                ? "bg-[#00FF9C]/15 border border-[#00FF9C]/30 text-[#00FF9C] font-bold" 
                : "text-gray-500 hover:text-white border border-transparent"
            }`}
          >
            All Active
          </button>
          <button 
            id="tab-synced-contacts"
            onClick={() => setActiveTab("username")}
            className={`px-3 py-1 font-mono text-[9px] tracking-wider uppercase rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
              activeTab === "username" 
                ? "bg-[#00D1FF]/15 border border-[#00D1FF]/30 text-[#00D1FF] font-bold" 
                : "text-gray-500 hover:text-white border border-transparent"
            }`}
          >
            Username Search
          </button>
        </div>
      </div>

      {activeTab === "all" ? (
        <>
          {/* Main Search Tab */}
          <div className="p-3 bg-[#080808] border-b border-white/5">
            <div className="relative font-sans">
              <input
                id="search-contacts-input"
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search active, or enter a username to search network..."
                className="w-full bg-[#050505] border border-white/10 rounded-xl py-2.5 pl-9 pr-8 text-xs text-white focus:outline-none focus:border-[#00FF9C] font-mono placeholder-gray-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]"
              />
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3.5" />
              {search && (
                <button 
                  onClick={() => setSearch("")} 
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 bg-[#050505] space-y-3">
            
            {/* 1.5 PENDING INCOMING REQUESTS LIST */}
            {(() => {
              const pendingRequests = friendRequests.filter(r => r.receiverId === currentUserId && r.status === "pending");
              if (pendingRequests.length === 0) return null;
              return (
                <div id="pending-requests-section" className="space-y-2 p-1 border-b border-white/5 pb-4 mb-2">
                  <span className="text-[10px] font-mono text-orange-400 uppercase tracking-widest block pl-1.5 pb-1 flex items-center gap-1.5 font-bold">
                    <Clock className="w-3.5 h-3.5 animate-pulse" /> Pending Friend Requests ({pendingRequests.length})
                  </span>
                  {pendingRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between p-3 rounded-2xl bg-orange-950/10 border border-orange-500/20 shadow-[0_4px_15px_rgba(249,115,22,0.02)]">
                      <div className="flex items-center gap-3">
                        <img 
                          src={req.senderPhotoURL} 
                          alt={req.senderName} 
                          className="w-10 h-10 rounded-full object-cover border border-orange-500/20" 
                        />
                        <div>
                          <h4 className="text-xs font-bold text-white font-mono tracking-wide uppercase">{req.senderName}</h4>
                          <p className="text-[9px] text-orange-400 font-mono">Wants to chat with you</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0 pl-1">
                        <button
                          id={`btn-accept-${req.id}`}
                          onClick={async () => {
                            await acceptFriendRequest(req.id);
                          }}
                          className="px-2.5 py-1.5 bg-[#00FF9C] hover:bg-emerald-400 text-black font-bold rounded-lg text-[9px] font-mono uppercase tracking-wider flex items-center gap-1 transition-all"
                        >
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button
                          id={`btn-decline-${req.id}`}
                          onClick={async () => {
                            await declineFriendRequest(req.id);
                          }}
                          className="px-2 py-1.5 bg-red-950/20 border border-red-500/30 text-red-400 hover:text-red-550 rounded-lg text-[9px] font-mono uppercase transition"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Real-time Global Search Match Engine inside main view */}
            {globalSearchState !== "idle" && (
              <div id="global-realtime-search-container" className="p-1 space-y-1.5 border-b border-white/5 pb-4 mb-2">
                <span className="text-[10px] font-mono text-[#00D1FF] uppercase tracking-widest block pl-1.5 pb-1 flex items-center gap-1.5 font-bold">
                  <Database className="w-3.5 h-3.5 animate-pulse" /> Real-time Network Search
                </span>

                {globalSearchState === "searching" && (
                  <div className="flex items-center gap-2 py-3 justify-center text-gray-500 font-mono text-xxs bg-black/40 rounded-xl border border-white/5">
                    <Loader2 className="w-3.5 h-3.5 text-[#00D1FF] animate-spin" />
                    <span>Searching directory for "@{search}"...</span>
                  </div>
                )}

                {globalSearchState === "found" && globalSearchResult && (() => {
                  const g = globalSearchResult;
                  const req = friendRequests.find(r => 
                    (r.senderId === currentUserId && r.receiverId === g.uid) ||
                    (r.senderId === g.uid && r.receiverId === currentUserId)
                  );

                  return (
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-[#0E0E0E] border-2 border-[#00D1FF]/30 shadow-[0_4px_20px_rgba(0,209,255,0.06)] animate-in fade-in slide-in-from-bottom-2 duration-350">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <img 
                            src={g.photoURL} 
                            alt={g.displayName} 
                            className="w-10 h-10 rounded-full object-cover border border-[#00D1FF]/20" 
                          />
                          {g.isOnline && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00FF9C] border-2 border-[#0A0A0A] animate-pulse" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold font-mono text-white tracking-wide uppercase truncate">{g.displayName}</h4>
                            <span className="text-[8px] font-mono text-[#00D1FF] bg-[#00D1FF]/10 px-1 py-0.5 rounded font-semibold">@{g.username}</span>
                          </div>
                          <p className="text-[10px] text-gray-400 font-semibold truncate max-w-[150px] font-sans">{g.bio}</p>
                        </div>
                      </div>

                      <div className="shrink-0 pl-1">
                        {(!req || req.status === "declined") ? (
                          <button
                            id="btn-global-send-request"
                            onClick={async () => {
                              const me = getSenderDetails();
                              await sendFriendRequest(
                                currentUserId, 
                                me.displayName, 
                                me.photoURL, 
                                g.uid, 
                                g.displayName, 
                                g.photoURL
                              );
                            }}
                            className="px-3 py-1.5 bg-[#00D1FF] hover:bg-sky-400 text-black font-semibold rounded-lg text-[9px] font-mono uppercase tracking-wider flex items-center gap-1 transition-all"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> ADD
                          </button>
                        ) : req.status === "pending" ? (
                          req.senderId === currentUserId ? (
                            <button
                              disabled
                              className="px-2.5 py-1 text-[9px] font-mono uppercase tracking-wide bg-sky-950/20 border border-sky-500/20 text-sky-450 rounded-lg flex items-center gap-1"
                            >
                              <Clock className="w-3 h-3 animate-pulse" /> SENT
                            </button>
                          ) : (
                            <div className="flex gap-1">
                              <button
                                onClick={async () => {
                                  await acceptFriendRequest(req.id);
                                }}
                                className="px-2 py-1 bg-[#00FF9C] hover:bg-emerald-400 text-black font-bold rounded text-[9px] font-mono uppercase transition flex items-center gap-1"
                              >
                                Accept
                              </button>
                            </div>
                          )
                        ) : (
                          <button
                            onClick={() => onSelectContact(g.uid)}
                            className="px-3 py-1.5 bg-[#00FF9C] text-black font-semibold rounded-lg text-[9px] font-mono tracking-wider uppercase transition flex items-center gap-1"
                          >
                            <MessageSquare className="w-3 h-3" /> CHAT
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {globalSearchState === "not_found" && (
                  <div className="p-3 bg-red-950/5 border border-dashed border-red-500/10 rounded-xl text-center">
                    <p className="text-[10px] text-gray-400 font-mono">No global user node registered under exact username &ldquo;@{search}&rdquo;</p>
                  </div>
                )}
              </div>
            )}

            {/* 2. LOCAL DIRECTORY LISTING */}
            <div className="space-y-1.5 p-1">
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block pl-1.5 pb-1">
                Active Registry Directory ({filteredLocal.length})
              </span>
              
              {filteredLocal.length === 0 ? (
                <div className="text-center py-16 px-6 text-gray-500 font-mono text-xs max-w-sm mx-auto space-y-4">
                  <div className="w-12 h-12 bg-[#0A0A0A] border border-orange-500/30 rounded-full flex items-center justify-center text-orange-450 text-lg mx-auto">
                    📡
                  </div>
                  <p className="text-gray-400 uppercase tracking-wider text-xxs font-bold font-mono">No Contacts Found</p>
                  <p className="normal-case text-gray-500 text-[11px] leading-relaxed font-sans">
                    No active connections match your query. Search and send a request via the Username Search tab.
                  </p>
                </div>
              ) : (
                filteredLocal.map(contact => {
                  const isBot = contact.uid === "ai-bot";
                  return (
                    <div
                      id={`contact-item-${contact.uid}`}
                      key={contact.uid}
                      onClick={() => onSelectContact(contact.uid)}
                      className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all duration-300 ${
                        isBot 
                          ? "bg-[#00FF9C]/5 border-[#00FF9C]/20 hover:border-[#00FF9C] hover:shadow-[0_0_15px_rgba(0,255,156,0.1)] animate-pulse" 
                          : "bg-[#0A0A0A] border-white/5 hover:border-[#00FF9C]/30 hover:bg-[#0E0E0E]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={contact.photoURL}
                            alt={contact.displayName}
                            className="w-10 h-10 rounded-full object-cover border border-[#050505]"
                          />
                          {contact.isOnline && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00FF9C] border-2 border-[#0A0A0A] animate-pulse" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-white tracking-wide flex items-center gap-1.5 uppercase font-mono">
                            {contact.displayName}
                            {isBot && (
                              <span className="flex items-center gap-1 bg-[#00FF9C]/10 border border-[#00FF9C] text-[#00FF9C] px-1.5 py-0.5 rounded text-[8px] font-mono tracking-widest uppercase">
                                <Sparkles className="w-2.5 h-2.5" /> AI SYSTEM
                              </span>
                            )}
                          </h4>
                          <p className="text-xxs text-gray-400 font-sans mt-0.5 max-w-[180px] truncate">{contact.bio}</p>
                          <p className="text-xxs text-[#00D1FF] font-mono mt-0.5">
                            {contact.username ? `@${contact.username}` : contact.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {activeChatPartnerIds.includes(contact.uid) ? (
                          <span 
                            id={`contact-status-active-badge-${contact.uid}`}
                            className="px-2.5 py-1 text-[8px] font-mono font-bold bg-[#00FF9C]/20 border border-[#00FF9C]/50 text-[#00FF9C] rounded-full tracking-widest flex items-center gap-1 shadow-[0_0_10px_rgba(0,255,156,0.2)] animate-pulse"
                            title="Direct Chat Established"
                          >
                            ACTIVE
                          </span>
                        ) : (
                          <span 
                            id={`contact-status-inactive-badge-${contact.uid}`}
                            className="p-2 border border-white/5 hover:border-[#00FF9C]/40 rounded-full bg-gray-950/50 flex"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-[#00FF9C]" />
                          </span>
                        )}

                        {!isBot && (
                          <button
                            id={`btn-delete-contact-${contact.uid}`}
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm(`Are you sure you want to remove ${contact.displayName} from contacts?`)) {
                                await deleteUserProfile(contact.uid);
                              }
                            }}
                            className="p-2 border border-white/5 hover:border-red-500/40 hover:bg-red-950/25 rounded-full bg-gray-950/50 flex transition text-gray-500 hover:text-red-500 cursor-pointer"
                            title="Remove Contact"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : (
        /* Username Search & Friend request System */
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#050505] animate-fadeIn">
          
          {/* Own Profile Info Card */}
          {(() => {
            const me = getSenderDetails();
            // Try to find the actual username from the me object, or use clean fallback
            const myUsername = me.username || "unset";
            return (
              <div className="bg-[#0E0E0E] rounded-3xl p-5 border border-[#00D1FF]/25 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#00D1FF]/10 text-[#00D1FF] border border-[#00D1FF]/30 rounded-2xl shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold tracking-wider text-white uppercase font-mono">Your Chat node Identity</h3>
                    <p className="text-[10px] text-[#00D1FF] font-mono">
                      {myUsername !== "unset" ? `@${myUsername}` : "No username. Create one in Settings!"}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 leading-normal font-sans">
                  Share your username with friends. They can look you up securely to send a chat authorization query. Once you accept, instant message traffic routing begins.
                </p>
              </div>
            );
          })()}

          {/* Search Input Box */}
          <div className="space-y-3">
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold">
              Secure Username Discovery
            </span>
            <div className="relative font-sans">
              <span className="absolute left-3 top-3 text-[#00D1FF] font-mono text-xs font-bold">@</span>
              <input
                id="username-search-field-input"
                type="text"
                value={usernameSearch}
                onChange={e => setUsernameSearch(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                placeholder="Enter target username..."
                className="w-full bg-[#0E0E0E] border border-white/5 focus:border-[#00D1FF] rounded-xl py-2.5 pl-8 pr-8 text-xs text-white focus:outline-none font-mono placeholder-gray-700 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
              />
              {usernameSearch && (
                <button 
                  onClick={() => setUsernameSearch("")} 
                  className="absolute right-3 top-3.5 text-gray-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Search result display panel */}
          <div className="space-y-3 pt-2">
            {usernameSearchState === "searching" && (
              <div className="py-12 flex flex-col items-center gap-2 text-center text-gray-500 font-mono text-xxs">
                <Loader2 className="w-5 h-5 text-[#00D1FF] animate-spin" />
                <p className="animate-pulse">Locating registry node for "@{usernameSearch}"...</p>
              </div>
            )}

            {usernameSearchState === "found" && usernameSearchResult && (() => {
              const u = usernameSearchResult;
              const req = friendRequests.find(r => 
                (r.senderId === currentUserId && r.receiverId === u.uid) ||
                (r.senderId === u.uid && r.receiverId === currentUserId)
              );

              return (
                <div className="bg-[#0E0E0E] border-2 border-[#00D1FF]/30 rounded-3xl p-4 space-y-4 shadow-[0_4px_25px_rgba(0,209,255,0.05)] animate-slideUp">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <img 
                        src={u.photoURL} 
                        alt={u.displayName} 
                        className="w-12 h-12 rounded-full object-cover border-2 border-[#00D1FF]/20" 
                      />
                      {u.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00FF9C] border-2 border-[#0E0E0E] animate-pulse" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wide truncate">{u.displayName}</h4>
                        <span className="bg-[#00D1FF]/10 text-[#00D1FF] text-[8px] font-mono px-1 rounded border border-[#00D1FF]/20 font-bold uppercase tracking-wider">@{u.username}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium truncate mt-0.5">{u.bio || "No status bio available"}</p>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3 flex items-center justify-between">
                    <span className="text-[9px] font-mono text-gray-550">Registry Node ID: {u.uid.substring(0, 10)}...</span>
                    
                    <div>
                      {(!req || req.status === "declined") ? (
                        <button
                          id="username-btn-send-request"
                          onClick={async () => {
                            const me = getSenderDetails();
                            await sendFriendRequest(
                              currentUserId, 
                              me.displayName, 
                              me.photoURL, 
                              u.uid, 
                              u.displayName, 
                              u.photoURL
                            );
                          }}
                          className="px-3.5 py-2 bg-[#00D1FF] hover:bg-sky-400 text-black font-semibold rounded-xl text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all outline-none"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Send Friend Request
                        </button>
                      ) : req.status === "pending" ? (
                        req.senderId === currentUserId ? (
                          <div className="px-3 py-1.5 bg-sky-950/20 border border-sky-500/30 text-[#00D1FF] rounded-xl text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 animate-pulse" /> Outgoing Pending
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              id="username-btn-accept"
                              onClick={async () => {
                                await acceptFriendRequest(req.id);
                              }}
                              className="px-3 py-1.5 bg-[#00FF9C] hover:bg-emerald-400 text-black font-extrabold rounded-lg text-[10px] font-mono uppercase tracking-wider transition flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" /> Accept
                            </button>
                            <button
                              id="username-btn-decline"
                              onClick={async () => {
                                await declineFriendRequest(req.id);
                              }}
                              className="px-3 py-1.5 bg-red-950/25 border border-red-500/30 text-red-400 hover:bg-red-550 rounded-lg text-[10px] font-mono uppercase transition"
                            >
                              Decline
                            </button>
                          </div>
                        )
                      ) : (
                        <button
                          id="username-btn-start-chat"
                          onClick={() => onSelectContact(u.uid)}
                          className="px-4 py-2 bg-[#00FF9C] hover:bg-emerald-400 text-black font-extrabold rounded-xl text-[10px] font-mono tracking-wider uppercase transition flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,255,156,0.3)]"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Start Chat
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {usernameSearchState === "not_found" && (
              <div className="p-6 bg-red-950/10 border-2 border-dashed border-red-500/20 rounded-3xl text-center space-y-2 py-8">
                <p className="text-sm font-bold text-red-400 font-mono tracking-wider uppercase">User not found</p>
                <p className="text-[10px] text-gray-500 max-w-xs mx-auto leading-normal font-sans">
                  The username "<span className="text-white font-mono">@{usernameSearch}</span>" is not linked to any registration nodes in our network directory. Try another search.
                </p>
              </div>
            )}

            {usernameSearchState === "idle" && !usernameSearch && (
              <div className="text-center py-16 text-gray-550 font-mono text-xxs border border-white/5 p-4 rounded-3xl bg-[#090909]">
                🔑 Enter an exact username in the input above to query user nodes, invite them, and start chatting securely once accepted!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
