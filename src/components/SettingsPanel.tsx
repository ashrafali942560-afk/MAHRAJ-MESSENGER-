import React, { useState, useRef } from "react";
import { 
  X, Check, ChevronRight, Globe, Phone, RefreshCw, 
  ShieldCheck, ArrowRight, User, Key, LogOut, Bell, Upload, Image
} from "lucide-react";
import { UserProfile } from "../types";
import { LANGUAGES, useTranslation, LanguageCode } from "../lib/i18n";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth, isMockFirebase, getWebPushToken } from "../firebase";
import { saveUserProfile } from "../lib/state";

interface SettingsPanelProps {
  userProfile: UserProfile | null;
  onClose: () => void;
  onUpdateProfile: (updated: UserProfile) => void;
  onLogout: () => void;
  avatarPresets: string[];
  forceMockMode: boolean;
  onSetForceMockMode: (force: boolean) => void;
}

export function SettingsPanel({
  userProfile,
  onClose,
  onUpdateProfile,
  onLogout,
  avatarPresets,
  forceMockMode,
  onSetForceMockMode
}: SettingsPanelProps) {
  const { t, currentLanguage, setLanguage } = useTranslation();
  
  // Local profile states
  const [displayName, setDisplayName] = useState(userProfile?.displayName || "");
  const [bio, setBio] = useState(userProfile?.bio || "");
  const [avatar, setAvatar] = useState(userProfile?.photoURL || avatarPresets[0]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Phone Number Update flow states
  const [showPhoneUpdate, setShowPhoneUpdate] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [phoneGeneratedOtp, setPhoneGeneratedOtp] = useState("");
  const [phoneOtpNotification, setPhoneOtpNotification] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [phoneConfirmationResult, setPhoneConfirmationResult] = useState<any>(null);
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [phoneSystemAlert, setPhoneSystemAlert] = useState<{ title: string; message: string; type: "error" | "warning" | "success" } | null>(null);

  // FCM / VAPID States
  const [fcmTokenState, setFcmTokenState] = useState(userProfile?.fcmToken || "");
  const [isConfiguringFcm, setIsConfiguringFcm] = useState(false);
  const [fcmCopied, setFcmCopied] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setAvatar(base64);
      await handleSaveBasicInfo("photoURL", base64);
      setUploadingImage(false);
    };
    reader.onerror = () => {
      setUploadingImage(false);
      alert("Error reading chosen image file from your device.");
    };
    reader.readAsDataURL(file);
  };

  // Autosave generic info
  const handleSaveBasicInfo = async (field: "displayName" | "bio" | "photoURL", val: string) => {
    if (!userProfile) return;
    const updated = {
      ...userProfile,
      [field]: val
    };
    onUpdateProfile(updated);
    await saveUserProfile(updated);
  };

  // Process Phone Update flow
  const handleTriggerPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneSystemAlert(null);

    if (!newPhone.trim()) {
      setPhoneSystemAlert({
        title: "Input Required",
        message: "Please enter a valid phone number.",
        type: "warning"
      });
      return;
    }

    // Standardize new number
    let rawPhone = newPhone.trim().replace(/[\s-]/g, "");
    if (!rawPhone.startsWith("+")) {
      if (rawPhone.startsWith("91") && rawPhone.length >= 12) {
        rawPhone = "+" + rawPhone;
      } else {
        rawPhone = "+91" + rawPhone;
      }
    }
    const formattedNewPhone = rawPhone;

    if (formattedNewPhone.length < 11) {
      setPhoneSystemAlert({
        title: "Invalid Number",
        message: "Phone number is too short! Include both country code and full number (e.g. +91 99999 11111).",
        type: "warning"
      });
      return;
    }

    setIsVerifying(true);
    setPhoneOtpNotification(null);

    // If sandbox simulated modes
    if (isMockFirebase || forceMockMode) {
      const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
      setPhoneGeneratedOtp(mockCode);
      setPhoneOtpSent(true);
      setIsVerifying(false);
      setPhoneOtpNotification(`[SMS_GATEWAY] Verification PIN to link ${formattedNewPhone} is: ${mockCode}`);
      return;
    }

    let verifier: any = null;
    try {
      // Ensure the recaptcha-container is configured for phone updates
      let containerElement = document.getElementById('recaptcha-container');
      if (!containerElement) {
        containerElement = document.createElement('div');
        containerElement.id = 'recaptcha-container';
        containerElement.style.position = 'absolute';
        containerElement.style.opacity = '0';
        containerElement.style.pointerEvents = 'none';
        containerElement.style.width = '1px';
        containerElement.style.height = '1px';
        containerElement.style.overflow = 'hidden';
        document.body.appendChild(containerElement);
      }

      containerElement.innerHTML = ''; // Fresh DOM wrap

      verifier = new RecaptchaVerifier(auth, containerElement, {
        size: 'invisible',
        callback: () => {
          console.log("[MAHRAJ Auth PhoneUpdate] Invisible Recaptcha analyzed.");
        }
      });

      console.log("[MAHRAJ PhoneUpdate] Dispatching verification to: ", formattedNewPhone);
      const result = await signInWithPhoneNumber(auth, formattedNewPhone, verifier);
      setPhoneConfirmationResult(result);
      setPhoneOtpSent(true);
      setIsVerifying(false);
      setPhoneOtpNotification(`[SMS_GATEWAY] Verification PIN dispatched to ${formattedNewPhone}`);
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      const isBillingDisabled = 
        errorMsg.toLowerCase().includes("billing-not-enabled") || 
        errorMsg.toLowerCase().includes("billing") ||
        errorMsg.toLowerCase().includes("quota") ||
        errorMsg.toLowerCase().includes("limit") ||
        (error.code && (
          error.code.includes("billing-not-enabled") || 
          error.code.includes("quota-exceeded")
        ));

      if (verifier && typeof verifier.clear === "function") {
        try {
          verifier.clear();
        } catch (e) {
          console.warn("Recaptcha verifier error cleanup warning:", e);
        }
      }

      if (isBillingDisabled) {
        console.warn("Firebase Phone Auth: SMS dispatch limits or billing is disabled for updates. Enabling simulated update path.");
        onSetForceMockMode(true);
        // Fallback to high-fidelity simulated transition
        const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
        setPhoneGeneratedOtp(mockCode);
        setPhoneOtpSent(true);
        setIsVerifying(false);
        setPhoneOtpNotification(`[SMS_GATEWAY] MAHRAJ Verification PIN (Simulation Fallback) is: ${mockCode}`);
        setPhoneSystemAlert({
          title: "Simulation Pre-empted (Sms Limits Reach)",
          message: "The Firebase project has reached free-tier limits or has billing disabled. Verification bypass model has been activated. Copy the pin from the notification above.",
          type: "warning"
        });
      } else {
        console.error("Firebase Phone Update Connection Alert:", error);
        setPhoneSystemAlert({
          title: "Transmission Failed",
          message: `Verification request failed: ${errorMsg}`,
          type: "error"
        });
        setIsVerifying(false);
      }
    }
  };

  // Validate telephone code
  const handleVerifyPhoneUpdateOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneSystemAlert(null);
    if (!userProfile) return;

    let rawPhone = newPhone.trim().replace(/[\s-]/g, "");
    if (!rawPhone.startsWith("+")) {
      if (rawPhone.startsWith("91") && rawPhone.length >= 12) {
        rawPhone = "+" + rawPhone;
      } else {
        rawPhone = "+91" + rawPhone;
      }
    }
    const formattedNewPhone = rawPhone;

    if (isMockFirebase || forceMockMode) {
      if (phoneOtpCode !== phoneGeneratedOtp) {
        setPhoneSystemAlert({
          title: "Incorrect pin",
          message: "Invalid verification code. Please refer to the green alert banner for simulated PIN!",
          type: "error"
        });
        return;
      }

      // Sync updated user node
      const updated = {
        ...userProfile,
        phone: formattedNewPhone
      };
      onUpdateProfile(updated);
      await saveUserProfile(updated);
      
      setPhoneSystemAlert({
        title: "Database Update Complete",
        message: `${t("confirm_update_success")} ${formattedNewPhone}`,
        type: "success"
      });
      // Close forms
      setTimeout(() => {
        setShowPhoneUpdate(false);
        setPhoneOtpSent(false);
        setPhoneOtpCode("");
        setNewPhone("");
        setPhoneOtpNotification(null);
        setPhoneSystemAlert(null);
      }, 3000);
      return;
    }

    try {
      setIsVerifying(true);
      if (phoneConfirmationResult) {
        await phoneConfirmationResult.confirm(phoneOtpCode);
        
        // Code verified, save update
        const updated = {
          ...userProfile,
          phone: formattedNewPhone
        };
        onUpdateProfile(updated);
        await saveUserProfile(updated);
        
        setPhoneSystemAlert({
          title: "Database Update Complete",
          message: `${t("confirm_update_success")} ${formattedNewPhone}`,
          type: "success"
        });
        setTimeout(() => {
          setShowPhoneUpdate(false);
          setPhoneOtpSent(false);
          setPhoneOtpCode("");
          setNewPhone("");
          setPhoneOtpNotification(null);
          setPhoneSystemAlert(null);
        }, 3000);
      } else {
        setPhoneSystemAlert({
          title: "Session Missing",
          message: "No confirmation code found. Please re-enter number.",
          type: "error"
        });
      }
    } catch (error: any) {
      console.error("Invalid passcode check: ", error);
      setPhoneSystemAlert({
        title: "Checksum Failed",
        message: "Invalid verification code. Please double-check your OTP code.",
        type: "error"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Activate Cloud Web Push Notifications
  const handleActivatePush = async () => {
    setIsConfiguringFcm(true);
    try {
      const token = await getWebPushToken();
      if (token) {
        setFcmTokenState(token);
        if (userProfile) {
          const updated = {
            ...userProfile,
            fcmToken: token
          };
          onUpdateProfile(updated);
          await saveUserProfile(updated);
        }
      }
    } catch (e) {
      console.error("Error setting up active FCM session", e);
    } finally {
      setIsConfiguringFcm(false);
    }
  };

  const copyFcmTokenToClipboard = () => {
    if (!fcmTokenState) return;
    navigator.clipboard.writeText(fcmTokenState);
    setFcmCopied(true);
    setTimeout(() => setFcmCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#050505]/95 flex items-center justify-center p-4 overflow-y-auto">
      
      {/* simulated SMS received popover inside settings */}
      {phoneOtpNotification && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-[#0A0A0A] border-l-4 border-[#00FF9C] p-4 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.95)] animate-bounce flex items-center justify-between border border-[#00FF9C]/20">
          <div className="flex items-center gap-3">
            <span className="text-xl">💬</span>
            <div>
              <h4 className="text-[#00FF9C] font-mono text-xxs tracking-wider uppercase font-bold">INCOMING PHONE-UPDATE OTP</h4>
              <p className="text-white text-xs mt-0.5 font-mono">{phoneOtpNotification}</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setPhoneOtpCode(phoneGeneratedOtp);
              setPhoneOtpNotification(null);
            }} 
            className="text-xxs font-mono bg-[#00FF9C]/10 hover:bg-[#00FF9C]/20 text-[#00FF9C] border border-[#00FF9C]/30 rounded px-2.5 py-1.5 transition"
          >
            AUTO ENCODE
          </button>
        </div>
      )}

      <div className="w-full max-w-md bg-[#0A0A0A] border border-[#00FF9C]/20 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,255,156,0.15)] flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 bg-[#0F0F0F] border-b border-[#00FF9C]/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#00FF9C]" />
            <h2 className="text-[#00FF9C] text-xs font-bold tracking-widest uppercase font-mono">{t("settings_title")}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:text-white hover:bg-white/5 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          
          {/* Section 1: User Profile Signature Card */}
          <div className="flex flex-col items-center text-center space-y-4 pb-6 border-b border-white/5">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#00FF9C] shadow-[0_0_20px_rgba(0,255,156,0.2)] flex items-center justify-center bg-black/50">
                {uploadingImage ? (
                  <RefreshCw className="w-6 h-6 text-[#00FF9C] animate-spin" />
                ) : (
                  <img src={avatar} alt="Current avatar" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition duration-150">
                <Upload className="w-5 h-5 text-[#00FF9C] animate-bounce" />
                <span className="text-[8px] font-mono text-[#00FF9C] uppercase tracking-wider font-bold mt-1">Change photo</span>
              </div>
            </div>

            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            <button
              id="upload-custom-avatar-btn"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 border border-[#00FF9C]/30 hover:border-[#00FF9C] text-[#00FF9C] rounded-xl font-mono text-[10px] uppercase tracking-widest bg-emerald-950/20 hover:bg-emerald-950/40 transition cursor-pointer"
            >
              <Image className="w-3.5 h-3.5" />
              <span>{uploadingImage ? "Loading file..." : "Gallery Upload"}</span>
            </button>

            {/* Change Avatar Preset Keys */}
            <div>
              <span className="text-[10px] uppercase font-mono text-gray-500 tracking-wider block mb-2">Set avatar key</span>
              <div className="flex gap-2">
                {avatarPresets.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setAvatar(preset);
                      handleSaveBasicInfo("photoURL", preset);
                    }}
                    className={`relative w-9 h-9 rounded-full overflow-hidden border transition ${
                      avatar === preset ? "border-[#00FF9C] scale-105" : "border-transparent"
                    }`}
                  >
                    <img src={preset} alt="preset" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full text-left space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-gray-500 uppercase mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  onBlur={e => handleSaveBasicInfo("displayName", e.target.value)}
                  className="w-full bg-[#121212] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#00FF9C]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-gray-500 uppercase mb-1">{t("bio_label")}</label>
                <input
                  type="text"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  onBlur={e => handleSaveBasicInfo("bio", e.target.value)}
                  className="w-full bg-[#121212] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#00FF9C]"
                />
                <span className="text-[9px] text-gray-600 font-mono mt-1 block">{t("bio_caption")}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Localization - Language Switched */}
          <div className="space-y-3 pb-6 border-b border-white/5">
            <h3 className="text-xs font-bold font-mono text-gray-300 uppercase flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#00D1FF]" />
              {t("language_switcher")}
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs font-mono transition ${
                    currentLanguage === lang.code
                      ? "bg-[#00FF9C]/5 border-[#00FF9C] text-[#00FF9C]"
                      : "bg-[#121212] border-white/5 text-gray-400 hover:border-white/10 hover:text-white"
                  }`}
                >
                  <div className="flex flex-col items-start">
                    <span className="text-[11px] font-bold">{lang.name}</span>
                    <span className="text-[9px] text-gray-500">{lang.nativeName}</span>
                  </div>
                  {currentLanguage === lang.code && <Check className="w-3.5 h-3.5 text-[#00FF9C]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Firebase Verified Phone Number Dynamic Switcher */}
          <div className="space-y-3 pb-6 border-b border-white/5">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold font-mono text-gray-300 uppercase flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#00FF9C]" />
                {t("phone_update_section")}
              </h3>
              {!showPhoneUpdate && (
                <button
                  onClick={() => setShowPhoneUpdate(true)}
                  className="text-[10px] font-mono text-[#00FF9C] border border-[#00FF9C]/20 hover:border-[#00FF9C] rounded px-2.5 py-1 transition"
                >
                  UPDATE LINK
                </button>
              )}
            </div>

            <div className="bg-[#121212] p-4 rounded-xl border border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono text-gray-500 uppercase">ACTIVE DATABASE IDENTITY NODE</span>
                <p className="text-[#00FF9C] font-mono text-xs font-bold tracking-widest mt-0.5">{userProfile?.phone}</p>
              </div>
              <div className="bg-[#00FF9C]/10 border border-[#00FF9C]/30 text-[#00FF9C] px-2 py-1 rounded text-[9px] font-mono uppercase tracking-widest">
                VERIFIED
              </div>
            </div>

            {showPhoneUpdate && (
              <div className="mt-3 p-4 bg-[#141414] border-2 border-dashed border-[#00FF9C]/20 rounded-2xl space-y-4">
                <span className="text-[10px] font-mono text-[#00FF9C] uppercase tracking-wider block font-bold">Secure Transition Protocol</span>
                
                {phoneSystemAlert && (
                  <div id="settings-phone-system-banner" className="p-3 bg-yellow-950/20 border border-yellow-500/25 rounded-xl text-xxs leading-relaxed text-gray-300 relative animate-in fade-in duration-200">
                    <span className="font-mono text-[9px] text-yellow-500 font-bold tracking-widest uppercase block mb-0.5">
                      {phoneSystemAlert.type === "success" ? "✅" : "⚠️"} {phoneSystemAlert.title}
                    </span>
                    <p>{phoneSystemAlert.message}</p>
                  </div>
                )}
                
                {!phoneOtpSent ? (
                  <form onSubmit={handleTriggerPhoneOtp} className="space-y-3">
                    <label className="block text-[10px] font-mono text-gray-400 uppercase">{t("enter_new_phone")}</label>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={newPhone}
                        onChange={e => setNewPhone(e.target.value)}
                        placeholder="e.g. +91 99999 11111"
                        className="flex-1 bg-[#050505] border border-white/5 focus:border-[#00FF9C] rounded-xl px-3 py-2.5 text-xs text-white font-mono"
                      />
                      <button
                        type="submit"
                        disabled={isVerifying}
                        className="bg-[#00FF9C] hover:bg-[#00FF9C]/90 text-black px-4 rounded-xl text-xs font-mono font-bold flex items-center justify-center"
                      >
                        {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin text-black" /> : <ChevronRight className="w-4 h-4 text-black" />}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyPhoneUpdateOtp} className="space-y-3">
                    <div className="bg-lime-950/20 border border-lime-400/20 p-2.5 rounded-lg text-center text-lime-400 text-[10px] font-mono leading-relaxed">
                      {t("verifying_new_number")}
                    </div>
                    
                    <label className="block text-[10px] font-mono text-gray-400 uppercase">{t("verify_new_otp_label")}</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={phoneOtpCode}
                        onChange={e => setPhoneOtpCode(e.target.value)}
                        placeholder="6 Digit PIN"
                        className="flex-1 bg-[#050505] border border-white/5 focus:border-[#00FF9C] rounded-xl px-3 py-2.5 text-xs text-[#00FF9C] font-mono tracking-widest text-center"
                      />
                      <button
                        type="submit"
                        disabled={isVerifying}
                        className="bg-[#00FF9C] hover:bg-[#00FF9C]/90 text-black px-4 rounded-xl text-xs font-mono font-bold"
                      >
                        {isVerifying ? "Verifying" : "SUBMIT"}
                      </button>
                    </div>
                  </form>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowPhoneUpdate(false);
                    setPhoneOtpSent(false);
                    setNewPhone("");
                    setPhoneOtpNotification(null);
                  }}
                  className="text-center w-full text-[9px] font-mono text-gray-500 hover:text-white uppercase mt-1 tracking-wider"
                >
                  {t("cancel_btn")}
                </button>
              </div>
            )}
          </div>

          {/* Section 3.5: Cloud Push Notification Engine */}
          <div className="space-y-3 pt-3 border-t border-white/5">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold font-mono text-gray-300 uppercase flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#00FF9C]" />
                Web Push Cloud Gateway
              </h3>
              {!fcmTokenState && (
                <button
                  id="activate-push-btn"
                  onClick={handleActivatePush}
                  disabled={isConfiguringFcm}
                  className="text-[10px] font-mono text-[#00FF9C] border border-[#00FF9C]/20 hover:border-[#00FF9C] rounded px-2.5 py-1 transition cursor-pointer flex items-center gap-1"
                >
                  {isConfiguringFcm ? (
                    <RefreshCw className="w-3 h-3 animate-spin animate-infinite" />
                  ) : (
                    "ACTIVATE"
                  )}
                </button>
              )}
            </div>

            <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-mono text-gray-500 uppercase">NOTIFICATION ENGINE STATUS</span>
                  <p className={`font-mono text-xs font-bold tracking-widest ${fcmTokenState ? 'text-[#00FF9C]' : 'text-[#00D1FF]'}`}>
                    {fcmTokenState ? "CONNECTED (VAPID)" : "INACTIVE PROTOCOL"}
                  </p>
                </div>
                {fcmTokenState && (
                  <span className="bg-[#00FF9C]/10 border border-[#00FF9C]/30 text-[#00FF9C] px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-widest animate-pulse">
                    ONLINE
                  </span>
                )}
              </div>

              <div className="bg-[#181818] p-3 rounded-xl border border-white/5 space-y-2">
                <span className="text-[9px] font-mono text-gray-500 uppercase block">FCM CONFIGURATION PARAMS</span>
                
                <div className="space-y-1">
                  <span className="text-[8px] font-mono text-gray-600 uppercase block">TARGET VAPID PUBLIC KEY</span>
                  <div className="bg-[#0A0A0A] px-2 py-1.5 rounded border border-white/5 select-all overflow-x-auto">
                    <p className="text-gray-400 font-mono text-[9px] whitespace-nowrap scrollbar-none">
                      BCDVwQCFfbWdqCjrwpVJb7fMN5K-CQ0gOVL3NyA0wuohuCR-iT7naVXLjfugMYa9U971G2S8d5OXHCSKcl2gwcQ
                    </p>
                  </div>
                </div>

                {fcmTokenState && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[8px] font-mono text-gray-600 uppercase block">REGISTRATION TOKEN OUTPORT</span>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-[#050505] px-2.5 py-1.5 rounded border border-[#00D1FF]/20 overflow-x-auto max-h-[60px] scrollbar-thin">
                        <p className="text-[#00D1FF] font-mono text-[9px] whitespace-normal break-all">
                          {fcmTokenState}
                        </p>
                      </div>
                      <button
                        onClick={copyFcmTokenToClipboard}
                        className="bg-[#00D1FF]/10 hover:bg-[#00D1FF]/20 text-[#00D1FF] border border-[#00D1FF]/30 px-3 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase shrink-0 transition"
                      >
                        {fcmCopied ? "COPIED" : "COPY KEY"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Exit Credentials Protocol */}
          <div className="pt-2">
            {!showConfirmLogout ? (
              <button
                id="logout-btn"
                onClick={() => setShowConfirmLogout(true)}
                className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-[#FF3333] border border-[#FF3333]/30 rounded-xl font-mono text-xs font-bold tracking-widest uppercase transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> {t("logout_btn")}
              </button>
            ) : (
              <div className="border border-[#FF3333]/20 bg-[#120505]/40 p-3.5 rounded-xl flex flex-col gap-3">
                <p className="text-[#FF3333] text-xxs font-mono font-bold tracking-wider uppercase text-center animate-pulse">
                  ⚠️ {t("confirm_logout")} ⚠️
                </p>
                <p className="text-gray-400 text-[10px] leading-relaxed text-center font-sans">
                  {t("confirm_logout_warning")}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowConfirmLogout(false)}
                    className="flex-1 py-2 border border-white/10 hover:border-gray-500 rounded-lg font-mono text-xxs text-gray-300 uppercase transition cursor-pointer"
                  >
                    {t("cancel_logout_btn")}
                  </button>
                  <button
                    onClick={onLogout}
                    className="flex-1 py-2 bg-[#FF3333] hover:bg-red-700 text-white rounded-lg font-mono text-xxs font-bold uppercase transition cursor-pointer shadow-[0_0_10px_rgba(255,51,51,0.4)]"
                  >
                    {t("confirm_terminate_btn")}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
