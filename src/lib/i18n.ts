import { useState, useEffect } from "react";

export type LanguageCode = "en" | "hi" | "es" | "ar";

export const LANGUAGES: { code: LanguageCode; name: string; nativeName: string }[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "ar", name: "Arabic", nativeName: "العربية" }
];

export const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  en: {
    // Auth Screen
    welcome: "Welcome to Mahraj",
    tagline: "Secure, real-time messaging with instant verification",
    phone_input_label: "Enter Your Mobile Number",
    phone_placeholder: "example: +91 99999 11111",
    request_otp_btn: "Request Verification OTP",
    enter_otp_label: "Enter 6-Digit OTP Protocol PIN",
    otp_placeholder: "6 Digit Code",
    validate_otp_btn: "Verify & Initialize Client",
    resend_otp: "Resend Code",
    change_phone: "Change Phone Number",
    onboarding_title: "Configure Cryptographic Node Profile",
    onboarding_avatar: "Choose Avatar Signature",
    onboarding_name: "Display Identity Name",
    onboarding_bio: "Short Bio / Security Quote",
    onboarding_btn: "Initialize Node",

    // Main App
    app_title: "Mahraj",
    chats_tab: "Chats",
    status_tab: "Status",
    calls_tab: "Calls",
    search_contacts: "Search Contacts",
    no_chat_selected: "Select a contact to start secure communication",
    terminal_active: "Active",
    offline_status: "Offline",
    writing_response: "Typing...",
    type_message_placeholder: "Type a secure message...",
    unlocked_channel: "Transmission channel secured.",
    
    // Call overlays
    missed: "Missed Call",
    completed: "Completed",
    ringing: "Ringing...",
    connecting: "Connecting...",
    voice_call: "Voice Call",
    video_call: "Video Call",
    end_session: "End Session",
    decline: "Decline",
    accept: "Accept",

    // Settings
    settings_title: "Profile & System Settings",
    language_switcher: "App Language (Localization)",
    phone_update_section: "Change Phone Number Link",
    enter_new_phone: "Enter your new subscriber number",
    trigger_verification: "Trigger Firebase Phone Auth Verification",
    verifying_new_number: "Verifying transition to new phone node...",
    verify_new_otp_label: "Verify OTP for new phone verification:",
    submit_new_otp: "Validate & Update Node Number",
    confirm_update_success: "System Profile Node updated successfully to: ",
    cancel_btn: "Cancel Update",
    bio_label: "Status Message / Bio",
    bio_caption: "Changes are instantly persisted to the network",
    logout_btn: "Terminate Current Client Session",
    confirm_logout: "Confirm Node Deauthorization?",
    confirm_logout_warning: "All local session keys and tokens will be instantly destroyed.",
    cancel_logout_btn: "Cancel Protocol",
    confirm_terminate_btn: "Terminate Node"
  },
  hi: {
    // Auth Screen
    welcome: "महराज मैसेंजर में आपका स्वागत है",
    tagline: "त्वरित सत्यापन के साथ सुरक्षित, वास्तविक समय का संदेश",
    phone_input_label: "अपना मोबाइल नंबर दर्ज करें",
    phone_placeholder: "उदाहरण: +91 99999 11111",
    request_otp_btn: "सत्यापन वन-टाइम पासवर्ड (OTP) का अनुरोध करें",
    enter_otp_label: "6-अंकीय ओटीपी पिन दर्ज करें",
    otp_placeholder: "6 अंकों का कोड",
    validate_otp_btn: "सत्यापित करें और आरंभ करें",
    resend_otp: "कोड फिर से भेजें",
    change_phone: "दूसरा नंबर दर्ज करें",
    onboarding_title: "क्रिप्टोग्राफिक प्रोफाइल कॉन्फ़िगर करें",
    onboarding_avatar: "प्रोफ़ाइल चित्र चुनें",
    onboarding_name: "अपना नाम दर्ज करें",
    onboarding_bio: "बायो / सुरक्षा स्थिति",
    onboarding_btn: "प्रोफ़ाइल सहेजें",

    // Main App
    app_title: "महराज",
    chats_tab: "चैट",
    status_tab: "स्टेटस",
    calls_tab: "कॉल",
    search_contacts: "संपर्क खोजें",
    no_chat_selected: "सुरक्षित संचार शुरू करने के लिए किसी संपर्क का चयन करें",
    terminal_active: "सक्रिय",
    offline_status: "ऑफ़लाइन",
    writing_response: "लिख रहा है...",
    type_message_placeholder: "एक सुरक्षित संदेश टाइप करें...",
    unlocked_channel: "ट्रांसमिशन चैनल सुरक्षित है। एंड-टू-एंड एन्क्रिप्शन लागू किया गया है।",
    
    // Call overlays
    missed: "मिस्ड कॉल",
    completed: "पूर्ण",
    ringing: "घंटी बज रही है...",
    connecting: "कनेक्ट हो रहा है...",
    voice_call: "वॉयस कॉल",
    video_call: "वीडियो कॉल",
    end_session: "कॉल समाप्त करें",
    decline: "अस्वीकार करें",
    accept: "स्वीकार करें",

    // Settings
    settings_title: "प्रोफ़ाइल और सिस्टम सेटिंग्स",
    language_switcher: "ऐप भाषा (स्थानीयकरण)",
    phone_update_section: "फ़ोन नंबर अपडेट करें",
    enter_new_phone: "अपना नया मोबाइल नंबर दर्ज करें",
    trigger_verification: "फ़ायरबेस फ़ोन प्रमाणीकरण आरंभ करें",
    verifying_new_number: "नए फ़ोन नंबर का सत्यापन हो रहा है...",
    verify_new_otp_label: "नए फ़ोन के लिए ओटीपी दर्ज करें:",
    submit_new_otp: "सत्यापित करें और नंबर बदलें",
    confirm_update_success: "प्रोफ़ाइल नंबर सफलतापूर्वक अपडेट किया गया है: ",
    cancel_btn: "रद्द करें",
    bio_label: "स्टेटस मैसेज / बायो",
    bio_caption: "परिवर्तन तुरंत नेटवर्क पर सुरक्षित किए जाते हैं",
    logout_btn: "वर्तमान सत्र समाप्त करें (लॉगआउट)",
    confirm_logout: "सत्र समाप्त करने की पुष्टि करें?",
    confirm_logout_warning: "सभी स्थानीय सत्र कुंजियाँ और टोकन तुरंत नष्ट कर दिए जाएंगे।",
    cancel_logout_btn: "रद्द करें",
    confirm_terminate_btn: "लॉगआउट करें"
  },
  es: {
    // Auth Screen
    welcome: "Bienvenido a Mahraj",
    tagline: "Mensajería segura en tiempo real con verificación instantánea",
    phone_input_label: "Ingrese su número de móvil",
    phone_placeholder: "ejemplo: +91 99999 11111",
    request_otp_btn: "Solicitar OTP de Verificación",
    enter_otp_label: "Ingrese el PIN OTP de 6 dígitos",
    otp_placeholder: "Código de 6 dígitos",
    validate_otp_btn: "Verificar e Inicializar Cliente",
    resend_otp: "Reactivar Código",
    change_phone: "Cambiar número de teléfono",
    onboarding_title: "Configurar Perfil de Nodo Criptográfico",
    onboarding_avatar: "Elegir Firma de Avatar",
    onboarding_name: "Nombre de Identidad de Visualización",
    onboarding_bio: "Biografía breve / Cita de seguridad",
    onboarding_btn: "Inicializar Nodo",

    // Main App
    app_title: "Mahraj",
    chats_tab: "Chats",
    status_tab: "Estados",
    calls_tab: "Llamadas",
    search_contacts: "Buscar Contactos",
    no_chat_selected: "Seleccione un contacto para iniciar una comunicación segura",
    terminal_active: "Activo",
    offline_status: "Fuera de línea",
    writing_response: "Escribiendo...",
    type_message_placeholder: "Escriba un mensaje seguro...",
    unlocked_channel: "Canal de transmisión asegurado. Cifrado local de extremo a extremo.",
    
    // Call overlays
    missed: "Llamada perdida",
    completed: "Completada",
    ringing: "Llamando...",
    connecting: "Conectando...",
    voice_call: "Llamada de Voz",
    video_call: "Videollamada",
    end_session: "Terminar Sesión",
    decline: "Declinar",
    accept: "Aceptar",

    // Settings
    settings_title: "Configuración del Perfil y Sistema",
    language_switcher: "Idioma de la aplicación (Localización)",
    phone_update_section: "Actualizar Número Telefónico",
    enter_new_phone: "Ingrese su nuevo número de suscriptor",
    trigger_verification: "Iniciar Firebase Phone Auth",
    verifying_new_number: "Verificando transición al nuevo nodo...",
    verify_new_otp_label: "Verificar OTP para nuevo teléfono:",
    submit_new_otp: "Validar y Actualizar Número",
    confirm_update_success: "El nodo del perfil del sistema se actualizó con éxito a: ",
    cancel_btn: "Cancelar Actualización",
    bio_label: "Mensaje de Estado / Biografía",
    bio_caption: "Los cambios se guardan instantáneamente en la red",
    logout_btn: "Terminar Sesión del Cliente",
    confirm_logout: "¿Confirmar la desautorización del nodo?",
    confirm_logout_warning: "Todas las claves de sesión local se destruirán de inmediato.",
    cancel_logout_btn: "Cancelar Protocolo",
    confirm_terminate_btn: "Terminar Nodo"
  },
  ar: {
    // Auth Screen
    welcome: "مرحباً بك في مهراج",
    tagline: "رسائل آمنة في الوقت الفعلي مع تحقق فوري",
    phone_input_label: "أدخل رقم الهاتف المحمول الخاص بك",
    phone_placeholder: "مثال: +91 99999 11111",
    request_otp_btn: "طالب برمز تحقق OTP",
    enter_otp_label: "أدخل رمز تحقق OTP المكون من 6 أرقام",
    otp_placeholder: "رمز مكون من 6 أرقام",
    validate_otp_btn: "التحقق والبدء في تشغيل العميل",
    resend_otp: "إعادة إرسال الرمز",
    change_phone: "تغيير رقم الهاتف",
    onboarding_title: "تهيئة الملف التعريفي المشفر",
    onboarding_avatar: "اختر صورتك الرمزية",
    onboarding_name: "الاسم التعريفي المعروض",
    onboarding_bio: "نبذة قصيرة / عبارة أمان",
    onboarding_btn: "تأكيد الملف التعريفي",

    // Main App
    app_title: "مهراج",
    chats_tab: "المحادثات",
    status_tab: "الحالات",
    calls_tab: "المكالمات",
    search_contacts: "البحث في جهات الاتصال",
    no_chat_selected: "حدد جهة اتصال لبدء محادثة آمنة ومحمية",
    terminal_active: "نشط الآن",
    offline_status: "غير متصل",
    writing_response: "يكتب الآن...",
    type_message_placeholder: "اكتب رسالة مشفرة آمنة...",
    unlocked_channel: "قناة الاتصال مؤمنة. التشفير التام مطبق بالكامل.",
    
    // Call overlays
    missed: "مكالمة فائتة",
    completed: "مكتملة",
    ringing: "يرن...",
    connecting: "جاري الاتصال...",
    voice_call: "مكالمة صوتية",
    video_call: "مكالمة فيديو",
    end_session: "إنهاء الجلسة",
    decline: "رفض",
    accept: "قبول",

    // Settings
    settings_title: "إعدادات الحساب والنظام",
    language_switcher: "لغة التطبيق (الترجمة المستهدفة)",
    phone_update_section: "تحديث وتعديل رقم الهاتف",
    enter_new_phone: "أدخل رقم هاتفك الجديد والمطابق",
    trigger_verification: "تأكيد رقم الهاتف عبر خدمة Firebase Auth",
    verifying_new_number: "جاري التحقق من رقم الهاتف الجديد...",
    verify_new_otp_label: "أدخل رمز OTP للرقم الجديد للتأكيد:",
    submit_new_otp: "تأكيد وتغيير رقم الهاتف",
    confirm_update_success: "لقد تم تحديث رقم هاتف الملف التعريفي بنجاح إلى: ",
    cancel_btn: "إلغاء التحديث",
    bio_label: "الحالة / السيرة الذاتية",
    bio_caption: "يتم حفظ التغييرات والبيانات تلقائياً على الشبكة",
    logout_btn: "تسجيل الخروج من الجلسة الحالية",
    confirm_logout: "تأكيد الخروج من الشبكة الآمنة؟",
    confirm_logout_warning: "سوف يتم إتلاف مسارات الجلسة والمفاتيح المحلية بالكامل فوراً.",
    cancel_logout_btn: "إلغاء العملية",
    confirm_terminate_btn: "إنهاء الجلسة"
  }
};

export const getLanguageSetting = (): LanguageCode => {
  const saved = localStorage.getItem("mahraj_app_language");
  if (saved && (saved === "en" || saved === "hi" || saved === "es" || saved === "ar")) {
    return saved as LanguageCode;
  }
  return "en";
};

export const setLanguageSetting = (lang: LanguageCode) => {
  localStorage.setItem("mahraj_app_language", lang);
  window.dispatchEvent(new Event("language_updated"));
};

export function useTranslation() {
  const [lang, setLang] = useState<LanguageCode>(getLanguageSetting());

  useEffect(() => {
    const handleUpdate = () => {
      setLang(getLanguageSetting());
    };
    window.addEventListener("language_updated", handleUpdate);
    return () => {
      window.removeEventListener("language_updated", handleUpdate);
    };
  }, []);

  const t = (key: string): string => {
    return TRANSLATIONS[lang]?.[key] || TRANSLATIONS["en"]?.[key] || key;
  };

  return { t, currentLanguage: lang, setLanguage: setLanguageSetting };
}
