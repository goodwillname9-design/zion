"use client";

import { useEffect, useState } from "react";

const arabic: Record<string, string> = {
  "Opening ZION…": "جارٍ فتح ZION…",
  "Friends": "الأصدقاء",
  "Notifications": "الإشعارات",
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
};

const originalText = new WeakMap<Node, string>();
const originalAttributes = new WeakMap<Element, Record<string, string>>();
const attributes = ["placeholder", "title", "aria-label"];

function translated(value: string) {
  const direct = arabic[value];
  if (direct) return direct;
  return value
    .replace(/ sent you a friend request$/, " أرسل إليك طلب صداقة")
    .replace(/^Replying to /, "الرد على ")
    .replace(/^Waiting for /, "بانتظار ")
    .replace(/ day streak$/, " يوم متتالي")
    .replace(/^Maximum /, "الحد الأقصى ");
}

function updateText(node: Node, language: "en" | "ar") {
  const parent = node.parentElement;
  if (!parent || parent.closest("script,style,[data-no-translate]")) return;
  const current = node.nodeValue ?? "";
  const trimmed = current.trim();
  if (!trimmed) return;
  if (language === "ar") {
    const previous = originalText.get(node);
    if (!previous || current !== translated(previous)) originalText.set(node, current);
    const source = originalText.get(node) ?? current;
    const next = source.replace(source.trim(), translated(source.trim()));
    if (current !== next) node.nodeValue = next;
  } else {
    const source = originalText.get(node);
    if (source && current !== source) node.nodeValue = source;
  }
}

function updateElement(element: Element, language: "en" | "ar") {
  if (element.closest("[data-no-translate]")) return;
  const saved = originalAttributes.get(element) ?? {};
  for (const attribute of attributes) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    if (language === "ar") {
      if (!saved[attribute] || current !== translated(saved[attribute]))
        saved[attribute] = current;
      element.setAttribute(attribute, translated(saved[attribute]));
    } else if (saved[attribute]) element.setAttribute(attribute, saved[attribute]);
  }
  originalAttributes.set(element, saved);
}

function updateTree(root: Node, language: "en" | "ar") {
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
  const [language, setLanguage] = useState<"en" | "ar">("en");

  useEffect(() => {
    const saved = localStorage.getItem("zion-language") === "ar" ? "ar" : "en";
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
    </div>
  );
}
