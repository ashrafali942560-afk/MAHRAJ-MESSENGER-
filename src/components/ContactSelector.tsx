import React, { useState } from "react";
import { Search, User, Sparkles, MessageSquare, ArrowLeft, Phone } from "lucide-react";
import { UserProfile } from "../types";

interface ContactSelectorProps {
  contacts: UserProfile[];
  currentUserId: string;
  onSelectContact: (uid: string) => void;
  onClose: () => void;
}

export function ContactSelector({
  contacts,
  currentUserId,
  onSelectContact,
  onClose
}: ContactSelectorProps) {
  const [search, setSearch] = useState("");

  const normalizePhone = (phoneStr: string) => {
    return phoneStr.replace(/[^0-9+]/g, "");
  };

  const filtered = contacts.filter(contact => {
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
      <div className="p-4 bg-[#0A0A0A] border-b border-[#00FF9C]/20 flex items-center gap-3">
        <button id="close-contacts-btn" onClick={onClose} className="p-1 rounded hover:bg-white/5 transition">
          <ArrowLeft className="w-5 h-5 text-[#00FF9C]" />
        </button>
        <div>
          <h2 className="text-sm font-bold tracking-wider uppercase text-white font-mono">Select Contact</h2>
          <p className="text-xxs text-[#00FF9C] font-mono">{filtered.length} active destinations</p>
        </div>
      </div>

      {/* Code Filter / Search */}
      <div className="p-3 bg-[#080808] border-b border-white/5">
        <div className="relative font-sans">
          <input
            id="search-contacts-input"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or mobile number..."
            className="w-full bg-[#050505] border border-white/5 rounded-lg py-2.5 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-[#00FF9C] font-mono placeholder-gray-700"
          />
          <Search className="w-4 h-4 text-gray-600 absolute left-3 top-3.5" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 bg-[#050505] space-y-1.5">
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-6 text-gray-500 font-mono text-xs max-w-sm mx-auto space-y-4">
            <div className="w-12 h-12 bg-[#0A0A0A] border border-orange-500/30 rounded-full flex items-center justify-center text-orange-450 text-lg mx-auto">
              📡
            </div>
            <p className="text-gray-400 uppercase tracking-wider text-xxs font-bold">Unregistered Destination</p>
            <p className="normal-case text-gray-500 text-[11px] leading-relaxed">
              No registered user matches "<span className="text-[#00FF9C] font-semibold">{search}</span>" in our database.
            </p>
            <div className="pt-2">
              <span className="text-[10px] text-[#00D1FF] block bg-[#00D1FF]/5 border border-[#00D1FF]/20 rounded p-2.5 leading-snug">
                ⚡ Both users must have active accounts linked to Firebase Authentication to initiate chat channels.
              </span>
            </div>
          </div>
        ) : (
          filtered.map(contact => {
            const isBot = contact.uid === "ai-bot";
            return (
              <div
                id={`contact-item-${contact.uid}`}
                key={contact.uid}
                onClick={() => onSelectContact(contact.uid)}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
                  isBot 
                    ? "bg-[#00FF9C]/5 border-[#00FF9C]/20 hover:border-[#00FF9C] hover:shadow-[0_0_15px_rgba(0,255,156,0.1)]" 
                    : "bg-[#0A0A0A] border-white/5 hover:border-[#00FF9C]/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={contact.photoURL}
                      alt={contact.displayName}
                      className="w-11 h-11 rounded-full object-cover border border-[#050505]"
                    />
                    {contact.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00FF9C] border-2 border-[#0A0A0A] animate-pulse" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white tracking-wide flex items-center gap-1.5">
                      {contact.displayName}
                      {isBot && (
                        <span className="flex items-center gap-1 bg-[#00FF9C]/10 border border-[#00FF9C] text-[#00FF9C] px-1.5 py-0.5 rounded text-[9px] font-mono tracking-widest uppercase">
                          <Sparkles className="w-2.5 h-2.5 animate-bounce" /> AI CO-HOST
                        </span>
                      )}
                    </h4>
                    <p className="text-xxs text-gray-400 font-sans mt-0.5 max-w-[180px] truncate">{contact.bio}</p>
                    <p className="text-xxs text-[#00FF9C] font-mono mt-0.5">{contact.phone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="p-2 border border-white/5 hover:border-[#00FF9C]/40 rounded-full bg-gray-950/50">
                    <MessageSquare className="w-3.5 h-3.5 text-[#00FF9C]" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
