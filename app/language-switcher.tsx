"use client";

import { useEffect, useState } from "react";

const arabic: Record<string, string> = {
  "Opening ZION…": "جارٍ فتح ZION…",
  "Friends": "الأصدقاء",
  "Notifications": "الإشعارات",
  "Reels": "ريلز",
  "Your story": "قصتك",
  "Post video": "نشر فيديو",
  "Write a caption…": "اكتب وصفاً…",
  "Comments": "التعليقات",
  "Add a comment…": "أضف تعليقاً…",
  "Share": "مشاركة",
  "Accept & Play": "قبول ولعب",
  "No new notifications.": "لا توجد إشعارات جديدة.",
  "Communities": "المجتمعات",
  "Meetings": "الاجتماعات",
  "My Profile": "ملفي الشخصي",
  "My ZION Profile": "ملفي في ZION",
  "Find Friends": "البحث عن أصدقاء",
  "Profile & Settings": "الملف الشخصي والإعدادات",
  "Profile and settings": "الملف الشخصي والإعدادات",
  "Add or switch account": "إضافة حساب أو تبديله",
  "Add another account": "إضافة حساب آخر",
  "Switch account": "تبديل الحساب",
  "Log out of ZION": "تسجيل الخروج من ZION",
  "Log in": "تسجيل الدخول",
  "Create account": "إنشاء حساب",
  "Log in to ZION": "تسجيل الدخول إلى ZION",
  "Create ZION account": "إنشاء حساب ZION",
  "Unique username · any language": "اسم مستخدم فريد · بأي لغة",
  "Password · minimum 6 characters": "كلمة المرور · 6 أحرف على الأقل",
  "Please wait…": "يرجى الانتظار…",
  "Enter ZION": "الدخول إلى ZION",
  "Welcome to ZION": "مرحباً بك في ZION",
  "Meet kindly. Stay safely.": "تعارف بلطف. ابقَ آمناً.",
  "Allow notifications": "السماح بالإشعارات",
  "Allow friend request alerts?": "هل تسمح بتنبيهات طلبات الصداقة؟",
  "Decline": "رفض",
  "Allow": "سماح",
  "Notification Center": "مركز الإشعارات",
  "No new friend requests.": "لا توجد طلبات صداقة جديدة.",
  "Accept": "قبول",
  "Alerts": "التنبيهات",
  "Exact username": "اسم المستخدم الدقيق",
  "Add Friend": "إضافة صديق",
  "Requested": "تم الطلب",
  "Following": "تتابعه",
  "Follow": "متابعة",
  "Followers": "المتابعون",
  "ZION Profile": "ملف ZION",
  "Friend Profile": "ملف الصديق",
  "Country": "الدولة",
  "Gender": "الجنس",
  "Account created": "تاريخ إنشاء الحساب",
  "Online now": "متصل الآن",
  "Offline": "غير متصل",
  "Message your friend…": "اكتب رسالة لصديقك…",
  "Message community…": "اكتب رسالة للمجتمع…",
  "Gallery": "المعرض",
  "Send message": "إرسال الرسالة",
  "Start your conversation": "ابدأ المحادثة",
  "Message deleted": "تم حذف الرسالة",
  "Edit message": "تعديل الرسالة",
  "Delete this message?": "هل تريد حذف هذه الرسالة؟",
  "Delete": "حذف",
  "Edit": "تعديل",
  "Reply or mention": "رد أو إشارة",
  "Photo": "صورة",
  "Video": "فيديو",
  "Mute": "كتم الصوت",
  "Unmute": "إلغاء الكتم",
  "Speaker": "مكبر الصوت",
  "Sound off": "إيقاف الصوت",
  "Camera": "الكاميرا",
  "Camera off": "إيقاف الكاميرا",
  "End": "إنهاء",
  "End call": "إنهاء المكالمة",
  "Cancel": "إلغاء",
  "Waiting for permission…": "بانتظار الإذن…",
  "Call declined": "تم رفض المكالمة",
  "Typing…": "يكتب…",
  "Settings": "الإعدادات",
  "Appearance": "المظهر",
  "Privacy & Security": "الخصوصية والأمان",
  "Dark": "داكن",
  "Day": "فاتح",
  "Show country": "إظهار الدولة",
  "Online status": "حالة الاتصال",
  "Save settings": "حفظ الإعدادات",
  "One-time profile edit": "تعديل الملف لمرة واحدة",
  "Save once": "حفظ لمرة واحدة",
  "Add or change profile photo": "إضافة أو تغيير صورة الملف",
  "Create your profile": "أنشئ ملفك الشخصي",
  "Unique username": "اسم مستخدم فريد",
  "Male": "ذكر",
  "Female": "أنثى",
  "Other": "آخر",
  "Select your country": "اختر دولتك",
  "Choose from gallery": "اختر من المعرض",
  "Saving profile…": "جارٍ حفظ الملف…",
  "Account suspended": "تم تعليق الحساب",
  "Admin profiles": "ملفات الإدارة",
  "Ban": "حظر",
  "Unban": "إلغاء الحظر",
  "Search username": "البحث باسم المستخدم",
  "Private group chats": "محادثات جماعية خاصة",
  "+ Create": "+ إنشاء",
  "Community name": "اسم المجتمع",
  "Add trusted friends": "إضافة أصدقاء موثوقين",
  "Create encrypted community": "إنشاء مجتمع مشفر",
  "Encrypted community": "مجتمع مشفر",
  "Start this private community conversation.": "ابدأ محادثة المجتمع الخاصة.",
  "You": "أنت",
  "Member": "عضو",
  "Ready when you are": "جاهزون عندما تكون جاهزاً",
  "Meet someone": "تعرّف على شخص",
  "Meet a human, not a profile.": "تعرّف على إنسان، لا مجرد ملف.",
  "I confirm I am 18 or older": "أؤكد أن عمري 18 سنة أو أكثر",
  "Finding a thoughtful human…": "جارٍ البحث عن شخص مناسب…",
  "Your shared question": "سؤالكما المشترك",
  "Your stranger is here": "الشخص الآخر موجود",
  "Waiting for your stranger…": "بانتظار الشخص الآخر…",
  "Write something honest…": "اكتب شيئاً صادقاً…",
  "Share my answer": "مشاركة إجابتي",
  "Answer shared": "تمت مشاركة الإجابة",
  "Skip waiting · Next human": "تجاوز الانتظار · شخص آخر",
  "Both answers are in": "تم استلام الإجابتين",
  "Start your 10 minutes": "ابدأ الدقائق العشر",
  "Stranger is in this chat": "الشخص الآخر في المحادثة",
  "Stranger is reconnecting…": "جارٍ إعادة الاتصال…",
  "Write a message…": "اكتب رسالة…",
  "Next human": "شخص آخر",
  "Add friend": "إضافة صديق",
  "Send kindness": "إرسال بلطف",
  "Block and report this conversation": "حظر هذه المحادثة والإبلاغ عنها",
  "Join meeting": "الانضمام إلى الاجتماع",
  "Create meeting": "إنشاء اجتماع",
  "Meeting ID": "معرّف الاجتماع",
  "Passcode": "رمز المرور",
  "Incorrect username or password.": "اسم المستخدم أو كلمة المرور غير صحيحة.",
  "ZION could not connect. Please try again.": "تعذر اتصال ZION. حاول مرة أخرى.",
  "ZION connection timed out. Please try again.": "انتهت مهلة اتصال ZION. حاول مرة أخرى.",
  "Connection failed.": "فشل الاتصال.",
  "Please wait": "يرجى الانتظار",
  "Games": "الألعاب",
  "Play with Friends": "العب مع الأصدقاء",
  "Send game invitation": "إرسال دعوة للعبة",
  "Your turn": "دورك",
  "Friend’s turn": "دور صديقك",
  "Game finished": "انتهت اللعبة",
  "You won!": "لقد فزت!",
  "Recent games": "الألعاب الأخيرة",
  "Choose friend": "اختر صديقاً",
  "Play": "العب",
  "Last seen private": "آخر ظهور خاص",
  "Last seen just now": "آخر ظهور الآن",
};

const hindi: Record<string, string> = {
  "Opening ZION…": "ZION खुल रहा है…", Friends: "दोस्त", Notifications: "सूचनाएँ",
  Reels: "रील्स", "Your story": "आपकी स्टोरी", "Post video": "वीडियो पोस्ट करें", "Write a caption…": "कैप्शन लिखें…",
  Comments: "कमेंट", "Add a comment…": "कमेंट जोड़ें…", Share: "शेयर", "Accept & Play": "स्वीकारें और खेलें", "No new notifications.": "कोई नई सूचना नहीं।",
  Communities: "समुदाय", Meetings: "मीटिंग", Games: "गेम्स", "My Profile": "मेरी प्रोफ़ाइल",
  "My ZION Profile": "मेरी ZION प्रोफ़ाइल", "Find Friends": "दोस्त खोजें",
  "Profile & Settings": "प्रोफ़ाइल और सेटिंग्स", "Profile and settings": "प्रोफ़ाइल और सेटिंग्स",
  "Add or switch account": "अकाउंट जोड़ें या बदलें", "Add another account": "दूसरा अकाउंट जोड़ें",
  "Switch account": "अकाउंट बदलें", "Log out of ZION": "ZION से लॉग आउट करें",
  "Log in": "लॉग इन", "Create account": "अकाउंट बनाएँ", "Log in to ZION": "ZION में लॉग इन करें",
  "Create ZION account": "ZION अकाउंट बनाएँ", "Unique username · any language": "विशिष्ट यूज़रनेम · कोई भी भाषा",
  "Password · minimum 6 characters": "पासवर्ड · कम से कम 6 अक्षर", "Please wait…": "कृपया प्रतीक्षा करें…",
  "Enter ZION": "ZION में जाएँ", "Welcome to ZION": "ZION में आपका स्वागत है",
  "Meet kindly. Stay safely.": "अच्छे से मिलें। सुरक्षित रहें।", "Allow notifications": "सूचनाएँ अनुमति दें",
  "Allow friend request alerts?": "फ्रेंड रिक्वेस्ट अलर्ट की अनुमति दें?", Decline: "अस्वीकार", Allow: "अनुमति दें",
  "Notification Center": "सूचना केंद्र", "No new friend requests.": "कोई नई फ्रेंड रिक्वेस्ट नहीं।", Accept: "स्वीकार",
  Alerts: "अलर्ट", "Exact username": "सही यूज़रनेम", "Add Friend": "दोस्त जोड़ें", Requested: "अनुरोध भेजा",
  Following: "फॉलो कर रहे हैं", Follow: "फॉलो करें", Followers: "फॉलोअर्स", "ZION Profile": "ZION प्रोफ़ाइल",
  "Friend Profile": "दोस्त की प्रोफ़ाइल", Country: "देश", Gender: "लिंग", "Account created": "अकाउंट बनाया गया",
  "Online now": "अभी ऑनलाइन", Offline: "ऑफलाइन", "Last seen private": "लास्ट सीन निजी है",
  "Last seen just now": "अभी देखा गया", "Message your friend…": "अपने दोस्त को संदेश लिखें…",
  "Message community…": "समुदाय में संदेश लिखें…", Gallery: "गैलरी", "Send message": "संदेश भेजें",
  "Start your conversation": "बातचीत शुरू करें", "Message deleted": "संदेश हटाया गया", "Edit message": "संदेश बदलें",
  "Delete this message?": "यह संदेश हटाएँ?", Delete: "हटाएँ", Edit: "बदलें", "Reply or mention": "जवाब या उल्लेख",
  Photo: "फोटो", Video: "वीडियो", Mute: "म्यूट", Unmute: "अनम्यूट", Speaker: "स्पीकर", "Sound off": "आवाज़ बंद",
  Camera: "कैमरा", "Camera off": "कैमरा बंद", End: "समाप्त", "End call": "कॉल समाप्त करें", Cancel: "रद्द करें",
  "Waiting for permission…": "अनुमति की प्रतीक्षा…", "Call declined": "कॉल अस्वीकार हुई", "Typing…": "टाइप कर रहे हैं…",
  Settings: "सेटिंग्स", Appearance: "दिखावट", "Privacy & Security": "गोपनीयता और सुरक्षा", Dark: "डार्क", Day: "लाइट",
  "Show country": "देश दिखाएँ", "Online status": "ऑनलाइन स्थिति", "Save settings": "सेटिंग्स सेव करें",
  "One-time profile edit": "एक बार प्रोफ़ाइल बदलाव", "Save once": "एक बार सेव करें",
  "Add or change profile photo": "प्रोफ़ाइल फोटो जोड़ें या बदलें", "Create your profile": "अपनी प्रोफ़ाइल बनाएँ",
  "Unique username": "विशिष्ट यूज़रनेम", Male: "पुरुष", Female: "महिला", Other: "अन्य",
  "Select your country": "अपना देश चुनें", "Choose from gallery": "गैलरी से चुनें", "Saving profile…": "प्रोफ़ाइल सेव हो रही है…",
  "Account suspended": "अकाउंट निलंबित", "Admin profiles": "एडमिन प्रोफ़ाइल", Ban: "बैन", Unban: "अनबैन",
  "Search username": "यूज़रनेम खोजें", "Private group chats": "निजी ग्रुप चैट", "+ Create": "+ बनाएँ",
  "Community name": "समुदाय का नाम", "Add trusted friends": "विश्वसनीय दोस्त जोड़ें",
  "Create encrypted community": "एन्क्रिप्टेड समुदाय बनाएँ", "Encrypted community": "एन्क्रिप्टेड समुदाय",
  "Start this private community conversation.": "यह निजी समुदाय बातचीत शुरू करें।", You: "आप", Member: "सदस्य",
  "Ready when you are": "आप तैयार तो हम तैयार", "Meet someone": "किसी से मिलें",
  "Meet a human, not a profile.": "एक इंसान से मिलें, सिर्फ प्रोफ़ाइल से नहीं।", "I confirm I am 18 or older": "मैं पुष्टि करता/करती हूँ कि मेरी उम्र 18 वर्ष या अधिक है",
  "Finding a thoughtful human…": "एक अच्छे इंसान को खोज रहे हैं…", "Your shared question": "आप दोनों का सवाल",
  "Your stranger is here": "दूसरा व्यक्ति यहाँ है", "Waiting for your stranger…": "दूसरे व्यक्ति की प्रतीक्षा…",
  "Write something honest…": "कुछ सच्चा लिखें…", "Share my answer": "मेरा जवाब साझा करें", "Answer shared": "जवाब साझा हुआ",
  "Skip waiting · Next human": "प्रतीक्षा छोड़ें · अगला व्यक्ति", "Both answers are in": "दोनों जवाब मिल गए",
  "Start your 10 minutes": "अपने 10 मिनट शुरू करें", "Stranger is in this chat": "दूसरा व्यक्ति चैट में है",
  "Stranger is reconnecting…": "दूसरा व्यक्ति फिर जुड़ रहा है…", "Write a message…": "संदेश लिखें…", "Next human": "अगला व्यक्ति",
  "Add friend": "दोस्त जोड़ें", "Send kindness": "प्यार से भेजें", "Block and report this conversation": "इस बातचीत को ब्लॉक और रिपोर्ट करें",
  "Join meeting": "मीटिंग में शामिल हों", "Create meeting": "मीटिंग बनाएँ", "Meeting ID": "मीटिंग आईडी", Passcode: "पासकोड",
  "Incorrect username or password.": "यूज़रनेम या पासवर्ड गलत है।", "ZION could not connect. Please try again.": "ZION कनेक्ट नहीं हो सका। फिर कोशिश करें।",
  "ZION connection timed out. Please try again.": "ZION कनेक्शन का समय समाप्त हुआ। फिर कोशिश करें।", "Connection failed.": "कनेक्शन विफल।",
  "Please wait": "कृपया प्रतीक्षा करें", "Play with Friends": "दोस्तों के साथ खेलें", "Send game invitation": "गेम आमंत्रण भेजें",
  "Your turn": "आपकी बारी", "Friend’s turn": "दोस्त की बारी", "Game finished": "गेम समाप्त", "You won!": "आप जीत गए!",
  "Recent games": "हाल के गेम", "Choose friend": "दोस्त चुनें", Play: "खेलें",
};

const originalText = new WeakMap<Node, string>();
const originalAttributes = new WeakMap<Element, Record<string, string>>();
const attributes = ["placeholder", "title", "aria-label"];

type Language = "en" | "ar" | "hi";

function translated(value: string, language: Language) {
  const direct = (language === "ar" ? arabic : hindi)[value];
  if (direct) return direct;
  if (language === "hi")
    return value
      .replace(/ sent you a friend request$/, " ने आपको फ्रेंड रिक्वेस्ट भेजी")
      .replace(/^Replying to /, "जवाब: ")
      .replace(/^Waiting for /, "प्रतीक्षा: ")
      .replace(/^Last seen /, "लास्ट सीन ")
      .replace(/ day streak$/, " दिन की स्ट्रीक");
  return value
    .replace(/ sent you a friend request$/, " أرسل إليك طلب صداقة")
    .replace(/^Replying to /, "الرد على ")
    .replace(/^Waiting for /, "بانتظار ")
    .replace(/ day streak$/, " يوم متتالي")
    .replace(/^Maximum /, "الحد الأقصى ");
}

function updateText(node: Node, language: Language) {
  const parent = node.parentElement;
  if (!parent || parent.closest("script,style,[data-no-translate]")) return;
  const current = node.nodeValue ?? "";
  const trimmed = current.trim();
  if (!trimmed) return;
  if (language !== "en") {
    const previous = originalText.get(node);
    if (
      !previous ||
      (current !== previous &&
        current !== translated(previous, "ar") &&
        current !== translated(previous, "hi"))
    )
      originalText.set(node, current);
    const source = originalText.get(node) ?? current;
    const next = source.replace(source.trim(), translated(source.trim(), language));
    if (current !== next) node.nodeValue = next;
  } else {
    const source = originalText.get(node);
    if (source && current !== source) node.nodeValue = source;
  }
}

function updateElement(element: Element, language: Language) {
  if (element.closest("[data-no-translate]")) return;
  const saved = originalAttributes.get(element) ?? {};
  for (const attribute of attributes) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    if (language !== "en") {
      if (
        !saved[attribute] ||
        (current !== saved[attribute] &&
          current !== translated(saved[attribute], "ar") &&
          current !== translated(saved[attribute], "hi"))
      )
        saved[attribute] = current;
      element.setAttribute(attribute, translated(saved[attribute], language));
    } else if (saved[attribute]) element.setAttribute(attribute, saved[attribute]);
  }
  originalAttributes.set(element, saved);
}

function updateTree(root: Node, language: Language) {
  if (root.nodeType === Node.TEXT_NODE) updateText(root, language);
  if (root instanceof Element) updateElement(root, language);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) updateText(node, language);
    else if (node instanceof Element) updateElement(node, language);
    node = walker.nextNode();
  }
}

export function LanguageSwitcher() {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const stored = localStorage.getItem("zion-language");
    const saved: Language = stored === "ar" || stored === "hi" ? stored : "en";
    window.setTimeout(() => setLanguage(saved), 0);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    localStorage.setItem("zion-language", language);
    updateTree(document.body, language);
    let pending = false;
    const observer = new MutationObserver((mutations) => {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(() => {
        pending = false;
        for (const mutation of mutations) {
          if (mutation.type === "characterData") updateText(mutation.target, language);
          mutation.addedNodes.forEach((node) => updateTree(node, language));
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  return (
    <div className="language-switcher" data-no-translate>
      <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>English</button>
      <button className={language === "ar" ? "active" : ""} onClick={() => setLanguage("ar")}>العربية</button>
      <button className={language === "hi" ? "active" : ""} onClick={() => setLanguage("hi")}>हिन्दी</button>
    </div>
  );
}
