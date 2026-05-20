import React, { useState, useEffect } from "react";
import { Plus, User, FileText, Image, Film, Clock, ChevronRight, X } from "lucide-react";
import { StatusStory } from "../types";
import { addStatusStory } from "../lib/state";

interface StatusFeedProps {
  statuses: StatusStory[];
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
}

export function StatusFeed({
  statuses,
  currentUserId,
  currentUserName,
  currentUserAvatar
}: StatusFeedProps) {
  const [activeStoryGroup, setActiveStoryGroup] = useState<StatusStory[] | null>(null);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Status inputs
  const [storyText, setStoryText] = useState("");
  const [storyMedia, setStoryMedia] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Group statuses by user so we don't duplicate circles
  const groups: Record<string, StatusStory[]> = {};
  statuses.forEach(s => {
    if (!groups[s.userId]) groups[s.userId] = [];
    groups[s.userId].push(s);
  });

  // Story Viewer progression timer
  useEffect(() => {
    let timer: number;
    if (activeStoryGroup) {
      timer = window.setTimeout(() => {
        if (activeStoryIdx < activeStoryGroup.length - 1) {
          setActiveStoryIdx(prev => prev + 1);
        } else {
          setActiveStoryGroup(null);
          setActiveStoryIdx(0);
        }
      }, 4000); // 4 seconds per story
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [activeStoryGroup, activeStoryIdx]);

  const handlePostStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storyText.trim() && !storyMedia) return;

    setSubmitting(true);
    try {
      // If no custom media URL is given, let's pick a random neon-colored graphics placeholder
      const chosenMedia = storyMedia || (storyMedia.includes("http") ? storyMedia : [
        "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=600",
        "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&q=80&w=600",
        "https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&q=80&w=600"
      ][Math.floor(Math.random() * 3)]);

      await addStatusStory({
        userId: currentUserId,
        userName: currentUserName,
        userAvatar: currentUserAvatar,
        text: storyText,
        mediaUrl: storyText.length > 0 && Math.random() > 0.5 ? "" : chosenMedia
      });

      setStoryText("");
      setStoryMedia("");
      setShowAddForm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const getMediaThumbnail = (group: StatusStory[]) => {
    const last = group[group.length - 1];
    return last.mediaUrl || last.userAvatar;
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "Just now";
    }
  };

  return (
    <div id="status-feed-container" className="flex flex-col gap-5 p-4 bg-[#050505] h-full overflow-y-auto">
      
      {/* Post Status Action Trigger Card */}
      <div className="bg-[#0A0A0A] rounded-xl p-4 border border-[#00FF9C]/20 flex items-center justify-between shadow-[0_4px_20px_rgba(0,255,156,0.05)]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={currentUserAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200"}
              alt="Me"
              className="w-12 h-12 rounded-full border border-gray-800 object-cover"
            />
            <button
              id="open-add-story-btn"
              onClick={() => setShowAddForm(true)}
              className="absolute -bottom-1.5 -right-1.5 bg-[#00FF9C] text-[#050505] hover:bg-[#00FF9C]/80 transition w-5.5 h-5.5 rounded-full flex items-center justify-center border border-[#050505]"
            >
              <Plus className="w-4 h-4 text-[#050505] font-bold" />
            </button>
          </div>
          <div>
            <h4 className="text-white text-sm font-semibold tracking-wide">My Status</h4>
            <p className="text-gray-400 text-xs mt-0.5">Share text, photos, or code snippets</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowAddForm(true)}
          className="px-3 py-1.5 border border-[#00FF9C]/50 hover:bg-[#00FF9C]/10 rounded font-mono text-xxs tracking-wider text-[#00FF9C]"
        >
          POST STATE // +
        </button>
      </div>

      {/* Add Story Form Modal Overlay */}
      {showAddForm && (
        <div id="add-story-overlay" className="fixed inset-0 z-40 bg-[#050505]/90 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#080808] border-2 border-[#00FF9C]/40 rounded-2xl p-5 shadow-[0_0_25px_rgba(0,255,156,0.2)]">
            <div className="flex justify-between items-center border-b border-white/5 pb-2.5 mb-4">
              <h3 className="text-white text-sm font-bold tracking-wider uppercase font-mono text-[#00FF9C]">Publish New Status</h3>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handlePostStory} className="space-y-4">
              <div>
                <label className="block text-xxs font-mono text-gray-400 mb-1 uppercase">Say something...</label>
                <textarea
                  id="story-text-input"
                  rows={3}
                  value={storyText}
                  onChange={e => setStoryText(e.target.value)}
                  placeholder="What's your current vibe, Syed Sahab?"
                  className="w-full bg-[#050505] border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#00FF9C] font-sans placeholder-gray-600 resize-none"
                  maxLength={150}
                  required
                />
              </div>

              <div>
                <label className="block text-xxs font-mono text-gray-400 mb-1 uppercase">Media URL (Optional)</label>
                <input
                  id="story-media-input"
                  type="url"
                  value={storyMedia}
                  onChange={e => setStoryMedia(e.target.value)}
                  placeholder="https://images.unsplash.com/photos..."
                  className="w-full bg-[#050505] border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#00FF9C] font-mono placeholder-gray-700"
                />
                <p className="text-xxs text-gray-600 font-mono mt-1">Leave blank to use an aesthetic random cyberpunk fallback banner</p>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-gray-400 hover:text-white border border-white/5 rounded text-xs font-mono"
                >
                  CANCEL
                </button>
                <button
                  id="submit-story-btn"
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#00FF9C] hover:bg-[#00FF9C]/80 text-[#050505] hover:shadow-[0_0_10px_rgba(0,255,156,0.5)] rounded font-mono font-bold text-xs tracking-wider uppercase transition"
                >
                  {submitting ? "POSTING..." : "PUBLISH"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stories Listing (Neon Rings) */}
      <div className="space-y-3">
        <h3 className="text-[#00FF9C] font-mono text-xxs tracking-widest uppercase border-b border-[#00FF9C]/10 pb-1.5">RECENT UPDATES</h3>
        
        {Object.keys(groups).length === 0 ? (
          <div className="text-center py-10">
            <Clock className="w-10 h-10 text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 font-mono text-xs">No active states shared in last 24h</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {Object.entries(groups).map(([userId, group]) => {
              const lastStory = group[0];
              const isMe = userId === currentUserId;
              return (
                <div
                  id={`story-group-${userId}`}
                  key={userId}
                  onClick={() => {
                    setActiveStoryGroup(group);
                    setActiveStoryIdx(0);
                  }}
                  className="bg-[#0A0A0A] rounded-xl p-3 border border-white/5 hover:border-[#00FF9C]/20 cursor-pointer flex items-center justify-between hover:shadow-[0_4px_10px_rgba(0,0,0,0.3)] transition"
                >
                  <div className="flex items-center gap-3.5">
                    {/* Glowing circular outer border matching group size */}
                    <div className="relative p-0.5 rounded-full flex items-center justify-center border-2 border-dashed border-[#00FF9C] animate-[spin_60s_linear_infinite] hover:border-solid">
                      <img
                        src={getMediaThumbnail(group)}
                        alt={lastStory.userName}
                        className="w-11 h-11 rounded-full object-cover border border-[#050505]"
                      />
                    </div>
                    <div>
                      <h4 className="text-white text-xs font-semibold tracking-wide flex items-center gap-1.5">
                        {isMe ? "My Status" : lastStory.userName}
                        <span className="text-xxs px-1.5 bg-white/5 border border-[#00FF9C]/20 rounded text-[#00FF9C] font-mono">{group.length} update</span>
                      </h4>
                      <p className="text-gray-400 text-xxs font-mono mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#00FF9C]" /> Today, {formatTime(lastStory.timestamp)}
                      </p>
                    </div>
                  </div>
                  
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen Story Viewer Progress Modal */}
      {activeStoryGroup && (
        <div id="story-viewer-overlay" className="fixed inset-0 z-50 bg-[#050505] flex flex-col justify-between items-center p-4 font-sans">
          
          {/* Automatic Progress Bars Top Strip */}
          <div className="w-full max-w-lg flex gap-1 mt-2">
            {activeStoryGroup.map((story, idx) => (
              <div key={story.id} className="flex-1 h-1.5 bg-gray-950 rounded overflow-hidden">
                <div
                  className={`h-full bg-[#00FF9C] rounded transition-all duration-[4000ms] ${
                    idx < activeStoryIdx ? "w-full" : idx === activeStoryIdx ? "w-full" : "w-0"
                  }`}
                  style={{
                    transition: idx === activeStoryIdx ? "width 4000ms linear" : "width 150ms ease-out"
                  }}
                />
              </div>
            ))}
          </div>

          {/* User Header Details */}
          <div className="w-full max-w-lg flex items-center justify-between mt-3.5 px-1 pb-4 border-b border-white/5 z-10">
            <div className="flex items-center gap-3">
              <img
                src={activeStoryGroup[activeStoryIdx].userAvatar}
                alt="Avatar"
                className="w-9 h-9 rounded-full object-cover border border-[#00FF9C]"
              />
              <div>
                <h4 className="text-white text-xs font-semibold">{activeStoryGroup[activeStoryIdx].userName}</h4>
                <p className="text-xxs text-[#00FF9C] font-mono">{formatTime(activeStoryGroup[activeStoryIdx].timestamp)}</p>
              </div>
            </div>
            
            <button
              onClick={() => setActiveStoryGroup(null)}
              className="w-8 h-8 rounded-full border border-white/5 bg-gray-950 flex items-center justify-center text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Core Content Area */}
          <div className="flex-1 w-full max-w-lg flex flex-col justify-center items-center py-6 relative">
            {activeStoryGroup[activeStoryIdx].mediaUrl ? (
              <div className="w-full max-h-[50vh] rounded-xl overflow-hidden border border-white/5 relative flex items-center justify-center bg-gray-950">
                <img
                  src={activeStoryGroup[activeStoryIdx].mediaUrl}
                  alt="Story graphic"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : null}

            {/* Status text comment with premium typography */}
            <p className="text-white text-base md:text-lg font-medium text-center max-w-md px-4 mt-6 leading-relaxed tracking-wide">
              {activeStoryGroup[activeStoryIdx].text}
            </p>
          </div>

          {/* Progression Quick buttons */}
          <div className="w-full max-w-lg flex justify-between px-1 mb-8">
            <button
              onClick={() => {
                if (activeStoryIdx > 0) {
                  setActiveStoryIdx(prev => prev - 1);
                }
              }}
              className="text-xxs font-mono text-gray-500 hover:text-[#00FF9C]"
              disabled={activeStoryIdx === 0}
            >
              // PREV STORY
            </button>
            <button
              onClick={() => {
                if (activeStoryIdx < activeStoryGroup.length - 1) {
                  setActiveStoryIdx(prev => prev + 1);
                } else {
                  setActiveStoryGroup(null);
                }
              }}
              className="text-xxs font-mono text-[#00FF9C] hover:text-white"
            >
              NEXT STORY //
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
