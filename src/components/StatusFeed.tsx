import React, { useState, useEffect } from "react";
import { Plus, User, FileText, Image, Film, Clock, ChevronRight, X, Trash2, Eye, Video, Sparkles, Upload } from "lucide-react";
import { StatusStory } from "../types";
import { addStatusStory } from "../lib/state";
import { compressImageBase64 } from "../lib/imageCompressor";

interface StatusFeedProps {
  statuses: StatusStory[];
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
  onDeleteStatus?: (storyId: string) => Promise<void>;
  onViewStatus?: (storyId: string, viewerId: string, viewerName: string, viewerAvatar: string) => Promise<void>;
}

export function StatusFeed({
  statuses,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onDeleteStatus,
  onViewStatus
}: StatusFeedProps) {
  // We store the userId of the active story we are looking at to fetch live data reactively
  const [activeStoryUserId, setActiveStoryUserId] = useState<string | null>(null);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<"upload" | "link">("upload");
  const [showViewersDrawer, setShowViewersDrawer] = useState(false);

  // Status inputs
  const [storyText, setStoryText] = useState("");
  const [storyMedia, setStoryMedia] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Gallery Upload inputs
  const [selectedFileType, setSelectedFileType] = useState<"image" | "video" | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Group statuses by user so we don't duplicate circles
  const groups: Record<string, StatusStory[]> = {};
  statuses.forEach(s => {
    if (!groups[s.userId]) groups[s.userId] = [];
    groups[s.userId].push(s);
  });

  // Derived live active story group & current active story
  const activeStoryGroup = activeStoryUserId ? groups[activeStoryUserId] || null : null;
  const currentStoryObj = activeStoryGroup && activeStoryIdx < activeStoryGroup.length ? activeStoryGroup[activeStoryIdx] : null;

  // Track / log a Status View whenever active story changes
  useEffect(() => {
    if (activeStoryGroup && currentStoryObj) {
      if (currentStoryObj.userId !== currentUserId && onViewStatus) {
        onViewStatus(currentStoryObj.id, currentUserId, currentUserName, currentUserAvatar).catch(err => {
          console.warn("Could not log status view", err);
        });
      }
    }
  }, [activeStoryGroup, activeStoryIdx, currentStoryObj, currentUserId, currentUserName, currentUserAvatar, onViewStatus]);

  // Story Viewer progression timer
  useEffect(() => {
    let timer: number;
    if (activeStoryUserId && activeStoryGroup) {
      timer = window.setTimeout(() => {
        if (activeStoryIdx < activeStoryGroup.length - 1) {
          setActiveStoryIdx(prev => prev + 1);
        } else {
          setActiveStoryUserId(null);
          setActiveStoryIdx(0);
          setShowViewersDrawer(false);
        }
      }, 5000); // 5 seconds per story
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [activeStoryUserId, activeStoryGroup, activeStoryIdx]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setFileError("Please select a valid image or video file.");
      return;
    }

    if (file.size > 2.5 * 1024 * 1024) {
      setFileError("File size is too large (Max 2.5MB). Please choose a smaller file.");
      return;
    }

    setSelectedFileType(isImage ? "image" : "video");
    const reader = new FileReader();
    reader.onload = async () => {
      let rawData = reader.result as string;
      if (isImage) {
        try {
          // Compress high resolution gallery photos so they load lightning-fast and bypass Firestore size caps
          rawData = await compressImageBase64(rawData, 600, 600, 0.75);
        } catch (err) {
          console.warn("Failed compression, uploading raw file", err);
        }
      }
      setFilePreview(rawData);
    };
    reader.readAsDataURL(file);
  };

  const handlePostStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storyText.trim() && !filePreview && !storyMedia) return;

    setSubmitting(true);
    try {
      let finalMedia = filePreview || storyMedia;
      let finalMediaType: "image" | "video" | undefined = selectedFileType || undefined;

      if (!finalMedia && addMode === "link") {
        // Fallback placeholder images
        finalMedia = [
          "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=600",
          "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&q=80&w=600",
          "https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&q=80&w=600"
        ][Math.floor(Math.random() * 3)];
        finalMediaType = "image";
      }

      await addStatusStory({
        userId: currentUserId,
        userName: currentUserName,
        userAvatar: currentUserAvatar,
        text: storyText,
        mediaUrl: finalMedia || undefined,
        mediaType: finalMediaType
      });

      setStoryText("");
      setStoryMedia("");
      setFilePreview(null);
      setSelectedFileType(null);
      setFileError(null);
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

  const myStatusGroup = groups[currentUserId] || null;

  return (
    <div id="status-feed-container" className="flex flex-col gap-5 p-4 bg-[#050505] h-full overflow-y-auto select-none">
      
      {/* Post Status Action Trigger Card */}
      <div className="bg-[#0A0A0A] rounded-xl p-4 border border-[#00FF9C]/25 flex items-center justify-between shadow-[0_4px_20px_rgba(0,255,156,0.05)]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={currentUserAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200"}
              alt="Me"
              className="w-12 h-12 rounded-full border border-gray-800 object-cover"
            />
            <button
              id="open-add-story-btn"
              onClick={() => {
                setAddMode("upload");
                setShowAddForm(true);
              }}
              className="absolute -bottom-1.5 -right-1.5 bg-[#00FF9C] text-[#050505] hover:bg-[#00FF9C]/80 transition w-5.5 h-5.5 rounded-full flex items-center justify-center border border-[#050505]"
            >
              <Plus className="w-4 h-4 text-[#050505] font-bold" />
            </button>
          </div>
          <div>
            <h4 className="text-white text-sm font-semibold tracking-wide">My Status</h4>
            <p className="text-gray-400 text-xs mt-0.5">
              {myStatusGroup ? `${myStatusGroup.length} updates active` : "Tap + to share gallery photos or videos"}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {myStatusGroup && (
            <button
              onClick={() => {
                setActiveStoryUserId(currentUserId);
                setActiveStoryIdx(0);
              }}
              className="px-3 py-1.5 bg-[#00FF9C]/10 border border-[#00FF9C]/30 hover:bg-[#00FF9C]/20 rounded font-mono text-xxs tracking-wider text-[#00FF9C]"
            >
              VIEW MINE //
            </button>
          )}
          <button
            onClick={() => {
              setAddMode("upload");
              setShowAddForm(true);
            }}
            className="px-3 py-1.5 border border-[#00FF9C]/50 hover:bg-[#00FF9C]/10 rounded font-mono text-xxs tracking-wider text-[#00FF9C]"
          >
            SHARE // +
          </button>
        </div>
      </div>

      {/* Add Story Form Modal Overlay */}
      {showAddForm && (
        <div id="add-story-overlay" className="fixed inset-0 z-40 bg-[#050505]/95 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#080808] border-2 border-[#00FF9C]/40 rounded-2xl p-5 shadow-[0_0_25px_rgba(0,255,156,0.2)]">
            <div className="flex justify-between items-center border-b border-white/5 pb-2.5 mb-3">
              <h3 className="text-white text-xs font-bold tracking-wider uppercase font-mono text-[#00FF9C] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#00FF9C]" /> Publish New Status
              </h3>
              <button 
                onClick={() => {
                  setShowAddForm(false);
                  setFilePreview(null);
                  setSelectedFileType(null);
                  setFileError(null);
                }} 
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector Option tabs */}
            <div className="flex border border-white/5 rounded-lg p-0.5 mb-4 bg-black/40">
              <button
                type="button"
                onClick={() => {
                  setAddMode("upload");
                  setStoryMedia("");
                }}
                className={`flex-1 py-1 text-[10px] font-mono rounded font-bold transition uppercase ${
                  addMode === "upload" ? "bg-[#00FF9C] text-[#050505]" : "text-gray-400 hover:text-white"
                }`}
              >
                Gallery Pick
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddMode("link");
                  setFilePreview(null);
                  setSelectedFileType(null);
                }}
                className={`flex-1 py-1 text-[10px] font-mono rounded font-bold transition uppercase ${
                  addMode === "link" ? "bg-[#00FF9C] text-[#050505]" : "text-gray-400 hover:text-white"
                }`}
              >
                Custom Link
              </button>
            </div>
            
            <form onSubmit={handlePostStory} className="space-y-4">
              {addMode === "upload" ? (
                <div className="space-y-3">
                  <label className="block text-xxs font-mono text-gray-400 uppercase">Choose Photo or Video from Gallery</label>
                  
                  {filePreview ? (
                    <div className="relative border-2 border-[#00FF9C]/20 bg-black/40 rounded-xl p-2.5 flex flex-col items-center justify-center min-h-[140px]">
                      {selectedFileType === "video" ? (
                        <video 
                          src={filePreview} 
                          className="max-h-28 rounded-lg object-contain w-full" 
                          controls 
                          muted 
                        />
                      ) : (
                        <img 
                          src={filePreview} 
                          alt="Upload preview" 
                          className="max-h-28 rounded-lg object-contain" 
                        />
                      )}
                      
                      <button
                        type="button"
                        onClick={() => {
                          setFilePreview(null);
                          setSelectedFileType(null);
                        }}
                        className="absolute top-2.5 right-2 application-action bg-black/80 hover:bg-stone-900 border border-white/10 text-red-400 p-1 rounded-full text-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[9px] text-[#00FF9C] font-mono mt-1.5 uppercase">
                        {selectedFileType === "video" ? "🎥 Video Track Selected" : "🖼️ Image Selected"}
                      </span>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-white/10 hover:border-[#00FF9C]/30 bg-black/20 rounded-xl cursor-pointer transition">
                      <Upload className="w-6 h-6 text-gray-500 mb-1" />
                      <span className="text-[10px] font-mono text-gray-400 text-center px-4">
                        Drag or click to choose photo / video
                      </span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  )}

                  {fileError && (
                    <p className="text-[10px] text-red-400 font-mono text-center">
                      {fileError}
                    </p>
                  )}
                  
                  <p className="text-[9px] text-gray-500 font-mono text-center leading-tight">
                    Statuses are kept live or automatically deleted from Firestore after 24 hrs.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xxs font-mono text-gray-400 mb-1 uppercase">Media Web Link (Optional)</label>
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
              )}

              <div>
                <label className="block text-xxs font-mono text-gray-400 mb-1 uppercase">Status Caption / Message</label>
                <textarea
                  id="story-text-input"
                  rows={2}
                  value={storyText}
                  onChange={e => setStoryText(e.target.value)}
                  placeholder="Type a caption status..."
                  className="w-full bg-[#050505] border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#00FF9C] font-sans placeholder-gray-600 resize-none"
                  maxLength={150}
                  required={!filePreview && !storyMedia}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setFilePreview(null);
                    setSelectedFileType(null);
                    setFileError(null);
                  }}
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
              const lastStory = group[group.length - 1];
              const isMe = userId === currentUserId;
              return (
                <div
                  id={`story-group-${userId}`}
                  key={userId}
                  onClick={() => {
                    setActiveStoryUserId(userId);
                    setActiveStoryIdx(0);
                  }}
                  className="bg-[#0A0A0A] rounded-xl p-3 border border-white/5 hover:border-[#00FF9C]/20 cursor-pointer flex items-center justify-between hover:shadow-[0_4px_10px_rgba(0,0,0,0.3)] transition animate-in fade-in"
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
                        <span className="text-[9px] px-1.5 py-0.5 bg-white/5 border border-[#00FF9C]/20 rounded text-[#00FF9C] font-mono">
                          {group.length} {group.length === 1 ? 'update' : 'updates'}
                        </span>
                      </h4>
                      <p className="text-gray-400 text-xxs font-mono mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#00FF9C]" /> Today, {formatTime(lastStory.timestamp)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isMe && (
                      <span className="text-[10px] font-mono text-[#00FF9C] bg-[#00FF9C]/5 border border-[#00FF9C]/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {group.reduce((acc, curr) => acc + (curr.viewers?.length || 0), 0)} views
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen Story Viewer Progress Modal */}
      {activeStoryUserId && activeStoryGroup && currentStoryObj && (
        <div id="story-viewer-overlay" className="fixed inset-0 z-50 bg-[#050505] flex flex-col justify-between items-center p-4 font-sans select-none">
          
          {/* Automatic Progress Bars Top Strip */}
          <div className="w-full max-w-lg flex gap-1 mt-2 pointer-events-none">
            {activeStoryGroup.map((story, idx) => (
              <div key={story.id} className="flex-1 h-1 bg-gray-900 rounded overflow-hidden">
                <div
                  className={`h-full bg-[#00FF9C] rounded transition-all ${
                    idx < activeStoryIdx ? "w-full" : idx === activeStoryIdx ? "w-full" : "w-0"
                  }`}
                  style={{
                    transition: idx === activeStoryIdx ? "width 5000ms linear" : "width 150ms ease-out"
                  }}
                />
              </div>
            ))}
          </div>

          {/* User Header Details */}
          <div className="w-full max-w-lg flex items-center justify-between mt-3.5 px-1 pb-4 border-b border-white/5 z-10">
            <div className="flex items-center gap-3">
              <img
                src={currentStoryObj.userAvatar}
                alt="Avatar"
                className="w-9 h-9 rounded-full object-cover border border-[#00FF9C]"
              />
              <div>
                <h4 className="text-white text-xs font-semibold">{currentStoryObj.userName}</h4>
                <p className="text-xxs text-[#00FF9C] font-mono">{formatTime(currentStoryObj.timestamp)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {currentStoryObj.userId === currentUserId && onDeleteStatus && (
                <button
                  id="delete-story-btn"
                  title="Delete Status"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const idToDelete = currentStoryObj.id;
                    await onDeleteStatus(idToDelete);
                    if (activeStoryGroup.length <= 1) {
                      setActiveStoryUserId(null);
                    } else {
                      setActiveStoryIdx(0);
                    }
                  }}
                  className="w-8 h-8 rounded-full border border-red-500/30 bg-red-950/20 hover:bg-red-500/30 text-red-400 hover:text-red-350 flex items-center justify-center transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => {
                  setActiveStoryUserId(null);
                  setShowViewersDrawer(false);
                }}
                className="w-8 h-8 rounded-full border border-white/5 bg-gray-950 flex items-center justify-center text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Core Content Area */}
          <div className="flex-1 w-full max-w-lg flex flex-col justify-center items-center py-6 relative">
            {currentStoryObj.mediaUrl ? (
              <div className="w-full max-h-[45vh] rounded-xl overflow-hidden border border-white/5 relative flex items-center justify-center bg-gray-950 p-1">
                {currentStoryObj.mediaType === "video" ? (
                  <video
                    src={currentStoryObj.mediaUrl}
                    controls
                    autoPlay
                    loop
                    className="max-w-full max-h-[40vh] object-contain"
                  />
                ) : (
                  <img
                    src={currentStoryObj.mediaUrl}
                    alt="Story media"
                    className="max-w-full max-h-[40vh] object-contain"
                  />
                )}
              </div>
            ) : null}

            {/* Status text caption */}
            {currentStoryObj.text && (
              <p className="text-white text-sm md:text-base font-medium text-center max-w-md px-4 mt-5 leading-relaxed tracking-wide">
                {currentStoryObj.text}
              </p>
            )}

            {/* View counter at the bottom center (WhatsApp-style) */}
            {currentStoryObj.userId === currentUserId && (
              <div className="absolute bottom-4 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setShowViewersDrawer(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#00FF9C]/10 border border-[#00FF9C]/30 hover:bg-[#00FF9C]/20 text-[#00FF9C] rounded-full text-xxs font-mono tracking-wider transition uppercase"
                >
                  <Eye className="w-3.5 h-3.5 text-[#00FF9C]" />
                  {currentStoryObj.viewers?.length || 0} views
                </button>
              </div>
            )}
          </div>

          {/* Progression Quick navigation buttons */}
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
                  setActiveStoryUserId(null);
                  setShowViewersDrawer(false);
                }
              }}
              className="text-xxs font-mono text-[#00FF9C] hover:text-white"
            >
              NEXT STORY //
            </button>
          </div>

          {/* Viewed by Drawer sheet (WhatsApp-style) */}
          {showViewersDrawer && currentStoryObj.userId === currentUserId && (
            <div className="fixed inset-x-0 bottom-0 top-[35%] bg-[#080808] border-t-2 border-[#00FF9C]/40 rounded-t-3xl z-50 flex flex-col p-5 shadow-[0_-10px_25px_rgba(0,255,156,0.15)] animate-in slide-in-from-bottom duration-300">
              <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-4">
                <h3 className="text-[#00FF9C] text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Viewed by ({currentStoryObj.viewers?.length || 0})
                </h3>
                <button 
                  onClick={() => setShowViewersDrawer(false)}
                  className="text-gray-400 hover:text-white px-2.5 py-1 rounded bg-white/5 text-[9px] font-mono hover:bg-white/10"
                >
                  CLOSE
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {!currentStoryObj.viewers || currentStoryObj.viewers.length === 0 ? (
                  <div className="text-center py-12">
                    <Eye className="w-8 h-8 text-gray-700 mx-auto mb-1.5" />
                    <p className="text-gray-500 font-mono text-xxs">No views yet. Share status link to contacts!</p>
                  </div>
                ) : (
                  currentStoryObj.viewers.map((viewer, vIdx) => (
                    <div key={vIdx} className="flex items-center justify-between p-2 rounded-lg bg-[#0E0E0E] border border-white/5 hover:border-[#00FF9C]/10 transition">
                      <div className="flex items-center gap-2.5">
                        <img 
                          src={viewer.userAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200"} 
                          alt={viewer.userName}
                          className="w-8 h-8 rounded-full object-cover border border-[#00FF9C]/20"
                        />
                        <div>
                          <h4 className="text-white text-xs font-semibold">{viewer.userName}</h4>
                          <span className="text-[8px] font-mono uppercase text-gray-400">CONTACT</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono text-gray-500">
                        Today, {formatTime(viewer.timestamp)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
