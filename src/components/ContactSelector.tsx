import React, { useState, useEffect, useRef } from "react";
import { 
  Search, User, Sparkles, MessageSquare, ArrowLeft, Phone, 
  Smartphone, Loader2, Check, Share2, Database, UserPlus, X 
} from "lucide-react";
import { UserProfile } from "../types";
import { 
  findUserByPhone, 
  SyncedContact, 
  getSyncedContactsLocal, 
  saveSyncedContactsLocal 
} from "../lib/state";

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
  const [activeTab, setActiveTab] = useState<"all" | "synced">("all");

  // Phone search states
  const [phoneSearchResult, setPhoneSearchResult] = useState<UserProfile | null>(null);
  const [phoneSearchState, setPhoneSearchState] = useState<"idle" | "searching" | "found" | "not_found" | "error">("idle");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Syncing states
  const [syncedContacts, setSyncedContacts] = useState<SyncedContact[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState("");

  // Load previously synced contacts on mount
  useEffect(() => {
    const saved = getSyncedContactsLocal();
    setSyncedContacts(saved);
  }, []);

  // Helper to normalize and check if query is primary numeric
  const isNumericQuery = (queryStr: string) => {
    const cleaned = queryStr.replace(/[^\d+]/g, "");
    return cleaned.length >= 3;
  };

  // Debounced phone-lookup directly against Firestore or simulated local fallback
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = search.trim();
    if (!trimmed || !isNumericQuery(trimmed)) {
      setPhoneSearchResult(null);
      setPhoneSearchState("idle");
      return;
    }

    setPhoneSearchState("searching");
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const found = await findUserByPhone(trimmed);
        if (found && found.uid !== currentUserId) {
          setPhoneSearchResult(found);
          setPhoneSearchState("found");
        } else {
          setPhoneSearchResult(null);
          // Only flag not_found if the query has significant digits to represent a phone destination
          if (trimmed.replace(/[^\d]/g, "").length >= 5) {
            setPhoneSearchState("not_found");
          } else {
            setPhoneSearchState("idle");
          }
        }
      } catch (err) {
        console.error("Failed to query user phone number:", err);
        setPhoneSearchState("error");
      }
    }, 450);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [search, currentUserId]);

  // E.164 conversion helper
  const formatToE164 = (phone: string) => {
    const cleaned = phone.replace(/[^\d+]/g, "");
    if (cleaned.startsWith("+")) return cleaned;
    if (cleaned.length === 10) return `+91${cleaned}`;
    if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
    return cleaned;
  };

  // WhatsApp-Style Native Bridge Contacts Permission & Sync Process
  const handleRequestContactsSync = async () => {
    setIsSyncing(true);
    setSyncStep("Acquiring 'Read Contacts' permission from Android...");

    // Register a global web-hook callback on the window object
    // When the native App finishes loading, it can run:
    // window.onAndroidContactsSynced(JSON.stringify([{name: "X", phone: "Y"}]))
    (window as any).onAndroidContactsSynced = async (contactsJson: string) => {
      setSyncStep("Contacts received. Formulating secure E.164 structures...");
      try {
        const contactsList = JSON.parse(contactsJson) as Array<{ name: string; phone: string }>;
        
        // Match numbers in Firestore database
        const checkedContacts: SyncedContact[] = [];
        let index = 0;
        
        for (const contact of contactsList) {
          setSyncStep(`Matching ${contact.name} (${index + 1}/${contactsList.length}) against node...`);
          const e164 = formatToE164(contact.phone);
          const foundProfile = await findUserByPhone(e164);
          
          checkedContacts.push({
            name: contact.name,
            phone: e164,
            isRegistered: !!foundProfile,
            profile: foundProfile || undefined
          });
          index++;
        }

        saveSyncedContactsLocal(checkedContacts);
        setSyncedContacts(checkedContacts);
        setSyncStep("Sync finished flawlessly.");
        setTimeout(() => setIsSyncing(false), 800);
      } catch (err) {
        console.error("Contact parsing failed:", err);
        setSyncStep("Mismatch or malformed contacts payload.");
        setTimeout(() => setIsSyncing(false), 2000);
      }
    };

    // If native platform exists, invoke it
    if ((window as any).AndroidInterface && typeof (window as any).AndroidInterface.requestContacts === "function") {
      try {
        (window as any).AndroidInterface.requestContacts();
        return;
      } catch (e) {
        console.warn("Android native invocation error, starting simulation fallback", e);
      }
    }

    // Fallback/Web simulation if native bridge is absent
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSyncStep("Reading client address book contacts...");
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const mockPhonebook = [
      { name: "Syed Ashraf (CEO)", phone: "+91 91111 88888" },
      { name: "Zoya Khan (Design)", phone: "+91 77777 55555" },
      { name: "Piyush Dev (Flutter)", phone: "98888 77777" },
      { name: "Aditi Sharma", phone: "+91 88888 88888" },
      { name: "Raj Malhotra", phone: "90000 12345" }
    ];

    const checkedContacts: SyncedContact[] = [];
    for (let idx = 0; idx < mockPhonebook.length; idx++) {
      const contact = mockPhonebook[idx];
      setSyncStep(`Comparing ${contact.name} (${idx + 1}/${mockPhonebook.length}) in Firestore database...`);
      await new Promise(resolve => setTimeout(resolve, 400));
      const e164 = formatToE164(contact.phone);
      const foundProfile = await findUserByPhone(e164);

      checkedContacts.push({
        name: contact.name,
        phone: e164,
        isRegistered: !!foundProfile,
        profile: foundProfile || undefined
      });
    }

    saveSyncedContactsLocal(checkedContacts);
    setSyncedContacts(checkedContacts);
    setSyncStep("All contacts linked successfully!");
    await new Promise(resolve => setTimeout(resolve, 600));
    setIsSyncing(false);
  };

  // Filter existing registered contacts for general list (matches searches)
  const normalizePhone = (phoneStr: string) => {
    return phoneStr.replace(/[^0-9+]/g, "");
  };

  const filteredLocal = contacts.filter(contact => {
    if (contact.uid === currentUserId) return false;
    const normSearch = normalizePhone(search);
    const normPhone = normalizePhone(contact.phone);
    
    const matchesName = contact.displayName.toLowerCase().includes(search.toLowerCase());
    const matchesPhone = normSearch.length > 2 
      ? normPhone.includes(normSearch) 
      : contact.phone.toLowerCase().includes(search.toLowerCase());
      
    return matchesName || matchesPhone;
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
              <Smartphone className="w-4 h-4 text-[#00FF9C]" /> Contact Discovery
            </h2>
            <p className="text-xxs text-[#00FF9C] font-mono">Zero-trust registration & invitation layers</p>
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
            onClick={() => setActiveTab("synced")}
            className={`px-3 py-1 font-mono text-[9px] tracking-wider uppercase rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
              activeTab === "synced" 
                ? "bg-[#00D1FF]/15 border border-[#00D1FF]/30 text-[#00D1FF] font-bold" 
                : "text-gray-500 hover:text-white border border-transparent"
            }`}
          >
            Phonebook Sync
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
                placeholder="Search by name, plus code, or E.164 phone..."
                className="w-full bg-[#050505] border border-white/5 rounded-lg py-2.5 pl-9 pr-8 text-xs text-white focus:outline-none focus:border-[#00FF9C] font-mono placeholder-gray-700"
              />
              <Search className="w-4 h-4 text-gray-600 absolute left-3 top-3.5" />
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
            
            {/* 1. FIRESTORE EXPLICIT LOOKUP RESULTS (if input is numeric/phone digits) */}
            {phoneSearchState !== "idle" && (
              <div id="firestore-lookup-panel" className="bg-[#0E0E0E] border-2 border-[#00FF9C]/20 rounded-2xl p-4 mx-1 mt-1 space-y-3 shadow-[0_4px_25px_rgba(0,255,156,0.03)] animate-fadeIn">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[9px] font-mono text-[#00FF9C] uppercase tracking-widest flex items-center gap-1.5 font-bold">
                    <Database className="w-3 h-3 animate-pulse" /> Firestore Phone Matching Inquiry
                  </span>
                  <span className="text-xxs px-1.5 py-0.5 bg-black rounded-md font-mono text-gray-550 border border-white/5">E.164 index lookup</span>
                </div>

                {phoneSearchState === "searching" && (
                  <div className="flex items-center gap-2.5 py-4 justify-center text-gray-400 font-mono text-xs">
                    <Loader2 className="w-4 h-4 text-[#00FF9C] animate-spin" />
                    <span>Verifying user status for "{formatToE164(search)}"</span>
                  </div>
                )}

                {phoneSearchState === "found" && phoneSearchResult && (
                  <div className="flex items-center justify-between bg-black/60 rounded-xl p-3 border border-[#00FF9C]/30 transition hover:border-[#00FF9C]/50">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img 
                          src={phoneSearchResult.photoURL} 
                          alt={phoneSearchResult.displayName} 
                          className="w-10 h-10 rounded-full object-cover border border-[#00FF9C]/20" 
                        />
                        {phoneSearchResult.isOnline && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00FF9C] border-2 border-[#0A0A0A] animate-pulse" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold font-mono text-white tracking-wide uppercase">{phoneSearchResult.displayName}</h4>
                        <p className="text-[10px] text-gray-400 font-semibold truncate max-w-[130px] font-sans">{phoneSearchResult.bio}</p>
                        <p className="text-xxs text-[#00FF9C] font-mono font-medium mt-0.5">{phoneSearchResult.phone}</p>
                      </div>
                    </div>

                    <button
                      id="start-chat-discovered-btn"
                      onClick={() => onSelectContact(phoneSearchResult.uid)}
                      className="px-3.5 py-2 bg-gradient-to-r from-[#00FF9C] to-[#00D1FF] hover:opacity-90 active:scale-95 text-black font-semibold rounded-xl text-[10px] font-mono tracking-wider uppercase transition flex items-center gap-1.5 shadow-[0_2px_10px_rgba(0,255,156,0.3)] cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Start Chat
                    </button>
                  </div>
                )}

                {phoneSearchState === "not_found" && (
                  <div className="p-3 bg-red-950/10 border-2 border-dashed border-red-500/20 rounded-xl text-center space-y-2 py-4">
                    <div className="w-8 h-8 rounded-full bg-red-950/30 flex items-center justify-center text-red-500 mx-auto">⚠️</div>
                    <p className="text-xs font-bold text-red-400 font-mono tracking-wider">User not found on this app</p>
                    <p className="text-[10px] text-gray-500 max-w-xs mx-auto leading-normal">
                      The phone number "<span className="text-white font-mono">{formatToE164(search)}</span>" is not synced with any registration node.
                    </p>
                    <button 
                      onClick={() => {
                        const smsText = encodeURIComponent("Hey! Join me on MAHRAJ Messenger, the secure neon messaging system. Let's chat securely!");
                        window.open(`sms:${formatToE164(search)}?body=${smsText}`);
                      }}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg font-mono text-[9px] tracking-wider uppercase border border-white/10 mx-auto block transition"
                    >
                      💌 Send SMS invitation
                    </button>
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
                phoneSearchState === "idle" && (
                  <div className="text-center py-16 px-6 text-gray-500 font-mono text-xs max-w-sm mx-auto space-y-4">
                    <div className="w-12 h-12 bg-[#0A0A0A] border border-orange-500/30 rounded-full flex items-center justify-center text-orange-450 text-lg mx-auto">
                      📡
                    </div>
                    <p className="text-gray-400 uppercase tracking-wider text-xxs font-bold">Unregistered Destination</p>
                    <p className="normal-case text-gray-500 text-[11px] leading-relaxed">
                      No registered user matches "<span className="text-[#00FF9C] font-semibold">{search}</span>" in our database.
                    </p>
                  </div>
                )
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
                          <p className="text-xxs text-[#00FF9C] font-mono mt-0.5">{contact.phone}</p>
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
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : (
        /* Device Contacts Sync tab */
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#050505]">
          
          <div className="bg-[#0E0E0E] rounded-3xl p-5 border border-[#00D1FF]/25 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#00D1FF]/10 text-[#00D1FF] border border-[#00D1FF]/30 rounded-2xl">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xs font-bold tracking-wider text-white uppercase font-mono">WhatsApp-Style Phonebook Sync</h3>
                <p className="text-[10px] text-[#00D1FF] font-mono">Check device contacts with registered database</p>
              </div>
            </div>
            
            <p className="text-[11px] text-gray-450 leading-relaxed">
              When triggered, the app requests the standard <span className="text-[#00D1FF] font-mono font-bold font-semibold bg-[#00D1FF]/10 px-1 rounded">Read Contacts</span> Android hardware permission. Once granted, phonebook records are normalized to standard E.164 numbers, compared locally and securely via query indices, linking friends directly!
            </p>

            {isSyncing ? (
              <div className="p-4 bg-black/40 border border-[#00D1FF]/20 rounded-2xl flex flex-col items-center gap-3 py-6 justify-center text-center">
                <Loader2 className="w-6 h-6 text-[#00D1FF] animate-spin" />
                <p className="font-mono text-[10px] tracking-wider text-white uppercase font-bold animate-pulse">Discovery session live</p>
                <p className="font-sans text-[11px] text-gray-400 max-w-xs">{syncStep}</p>
              </div>
            ) : (
              <button 
                id="native-sync-contacts-btn"
                onClick={handleRequestContactsSync}
                className="w-full py-3.5 bg-gradient-to-r from-[#00D1FF] to-[#00FF9C] hover:opacity-90 active:scale-98 text-black font-bold uppercase text-[11px] font-mono tracking-widest rounded-2xl shadow-[0_4px_15px_rgba(0,180,255,0.25)] flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
              >
                <Smartphone className="w-4 h-4" /> Discover & Sync Contacts
              </button>
            )}
          </div>

          {/* Sync list display */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold">
                Synced Results ({syncedContacts.length})
              </span>
              {syncedContacts.length > 0 && (
                <button 
                  onClick={() => {
                    saveSyncedContactsLocal([]);
                    setSyncedContacts([]);
                  }}
                  className="text-xxs font-mono text-red-400 hover:text-red-300 transition"
                >
                  Clear Cache
                </button>
              )}
            </div>

            {syncedContacts.length === 0 ? (
              <div className="text-center py-16 text-gray-500 font-mono text-xxs border border-white/5 p-4 rounded-3xl mx-1 bg-[#090909]">
                💔 No active synced records in index directory. Click "Discover & Sync Contacts" above to begin.
              </div>
            ) : (
              <div className="space-y-2">
                {syncedContacts.map((contact, i) => {
                  return (
                    <div 
                      key={i} 
                      className={`p-3 rounded-2xl bg-[#0A0A0A] border flex items-center justify-between transition duration-200 ${
                        contact.isRegistered 
                          ? "border-[#00FF9C]/25" 
                          : "border-white/5 opacity-80"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {contact.isRegistered && contact.profile ? (
                            <img 
                              src={contact.profile.photoURL} 
                              alt={contact.name} 
                              className="w-9 h-9 rounded-full object-cover border border-[#00FF9C]/20" 
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-xs font-bold text-gray-400">
                              {contact.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {contact.isRegistered && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00FF9C] border-2 border-[#0A0A0A]" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold font-mono text-white leading-none">{contact.name}</span>
                            {contact.isRegistered ? (
                              <span className="bg-[#00FF9C]/15 border border-[#00FF9C]/30 text-[#00FF9C] text-[8px] font-mono font-bold tracking-widest uppercase rounded px-1 scale-90">Matched</span>
                            ) : (
                              <span className="bg-white/5 border border-white/10 text-gray-500 text-[8px] font-mono tracking-widest uppercase rounded px-1 scale-90">Invite</span>
                            )}
                          </div>
                          <p className="text-xxs text-gray-400 font-mono mt-1">{contact.phone}</p>
                        </div>
                      </div>

                      <div>
                        {contact.isRegistered && contact.profile ? (
                          <button
                            id={`sync-start-chat-${i}`}
                            onClick={() => onSelectContact(contact.profile!.uid)}
                            className="px-3 py-1.5 bg-[#00FF9C]/15 border border-[#00FF9C]/40 text-[#00FF9C] hover:bg-[#00FF9C]/25 rounded-xl font-mono text-[9px] font-semibold tracking-wider uppercase transition flex items-center gap-1 cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3" /> Chat
                          </button>
                        ) : (
                          <button
                            id={`sync-invite-${i}`}
                            onClick={() => {
                              const smsText = encodeURIComponent("Join me on MAHRAJ Messenger, the ultra-secure neon communication app! Chat encrypted.");
                              window.open(`sms:${contact.phone}?body=${smsText}`);
                            }}
                            className="px-3 py-1.5 bg-transparent border border-white/10 hover:border-white/30 text-gray-450 hover:text-white rounded-xl font-mono text-[9px] tracking-wider uppercase transition flex items-center gap-1 cursor-pointer"
                          >
                            <Share2 className="w-3 w-3" /> Invite
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
