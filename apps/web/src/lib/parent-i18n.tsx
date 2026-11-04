"use client";
/**
 * Parent portal language: English and Hindi. Only the parent layout mounts this provider.
 * Staff, owner and landing are English-only and must never import this file (shared components use
 * lib/lang-context.ts instead, which holds no dictionaries).
 */
import * as React from "react";
import { useSession } from "@/components/session-provider";
import { api } from "@/lib/api/client";
import { STUDENTS } from "@/lib/mock";
import { formatDateOn, formatINR } from "@/lib/time";
import type { Notif } from "@/lib/notifications";
import { enLive, hiLive } from "@/lib/parent-i18n-live";
import { LangCtx, interpolate, useLang, type Lang, type LangValue } from "@/lib/lang-context";

/* ------------------------------------------------------------------ English (the master list of keys) */
const en = {
  ...enLive,
  "app.loading": "Loading…",
  "lang.title": "Choose your language / अपनी भाषा चुनें",
  "lang.switch": "Language",
  "nav.label": "Parent",
  "nav.home": "Home","nav.attendance": "Attendance", "nav.results": "Results", "nav.messages": "Messages", "nav.leave": "Leave",
  "nav.timetable": "Timetable", "nav.fees": "Fees", "nav.notices": "Notices", "nav.feedback": "Feedback",
  "hdr.switchChild": "Switch child", "hdr.yourChildren": "Children","hdr.class": "Class {c}",
  "hdr.changePassword": "Change password", "hdr.signOut": "Sign out",
  "hdr.notifications": "Notifications", "hdr.notificationsNew": "Notifications, {n} new",
 

  "home.title": "Today",
  "home.feedbackTitle": "Feedback requested",
  "home.allPaid": "Paid","home.due": "Due {date}",

  "mark.present": "Present", "mark.absent": "Absent", "mark.half": "Half day","mark.leave": "Leave","mark.holiday": "Holiday","mark.none": "Not marked",
  "inv.paid": "Paid", "inv.partial": "Partial","inv.unpaid": "Unpaid",

  "att.title": "Attendance","att.stat": "Attendance", "att.present": "Present", "att.absent": "Absent", "att.half": "Half",
  "att.prev": "Previous month", "att.next": "Next month", "att.days": "S,M,T,W,T,F,S", "att.legendHalf": "Half day", "att.legendLeave": "Leave", "att.legendAbsent": "Absent", 

  "res.title": "Results","res.emptyTitle": "No results",
  "res.download": "Report card","res.subject": "Subject", "res.marks": "Marks", "res.grade": "Grade", "res.total": "Total", "res.classTeacher": "Remark: ",
  "rc.default": "Report card","rc.unavailable": "Not available.","rc.done": "Downloaded","rc.fail": "Could not create. Try again.",
  "grade.label": "Grades: ","grade.below": "{grade} below {n}", "grade.pass": "Pass {p}%.",

  "lv.title": "Leave","lv.apply": "Apply",
  "lv.emptyTitle": "No requests",
  "lv.teacher": "Teacher", "lv.applied": "Applied {date}","lv.approved": "Approved {date}","lv.decided": "Decided {date}","lv.cancel": "Cancel",
  "lv.cancelTitle": "Cancel request?","lv.cancelText": "The teacher will not see it.","lv.keep": "Keep","lv.cancelled": "Cancelled",
  "lv.s.pending": "Pending", "lv.s.approved": "Approved", "lv.s.rejected": "Rejected", "lv.s.cancelled": "Cancelled",
  "lv.h.none": "Full day", "lv.h.first": "First half","lv.h.second": "Second half","lv.days": "{n} days",
  "lvd.title": "Leave","lvd.desc": "For {name}","lvd.from": "From", "lvd.to": "To", "lvd.part": "Day part",
  "lvd.single": "One date only.","lvd.reason": "Reason", "lvd.placeholder": "e.g. Fever","lvd.cancel": "Cancel", "lvd.send": "Send",
  "lvd.sent": "Request sent",
  "lve.dates": "Choose dates.","lve.past": "Date is in the past.","lve.order": "End is before start.","lve.half": "Half day needs one date.",
  "lve.reason": "Add a reason.","lve.long": "Max {n} characters.","lve.overlap": "Dates already requested.",

  "tt.title": "Timetable",
  "tt.region": "Weekly timetable","tt.period": "Period", "tt.today": "Today", "tt.break": "Break", "tt.sub": "Sub: {name}",

  "fee.title": "Fees","fee.empty": "No invoices","fee.due": "Due {date}", "fee.closed": "Closed", "fee.payments": "Payments",
  "fee.carried": "carried over","fee.concession": "concession","fee.waived": "Late fee waived",
  "fee.total": "Total", "fee.paid": "Paid", "fee.balance": "Balance", "fee.closedNote": "Moved to {to}",
  "fee.noPayments": "No payments","fee.instalment": "Part {n}","fee.cancelledBySchool": "Cancelled","fee.receipt": "Receipt",
  "mode.cash": "Cash", "mode.cheque": "Cheque", "mode.upi": "UPI", "mode.bank_transfer": "Bank transfer",

  "nt.title": "Notices","nt.dateSheet": "Exam dates","nt.calendar": "Calendar",
  "kind.holiday": "Holiday", "kind.exam": "Exam", "kind.event": "Event",

  "fb.title": "Feedback","fb.none": "Nothing to rate",
  "fb.closes": "Closes {date} · Anonymous","fb.sent": "Sent", "fb.thanks": "Sent. Thank you.",
  "fb.classTeacher": "Class teacher", "fb.rating": "Rating for {name}", "fb.commentLabel": "Comment about {name} (optional)", "fb.commentPh": "Comment (optional)",
  "fb.send": "Send","fb.toast": "Thank you","star.one": "{n} star", "star.many": "{n} stars",

  "nf.title": "Notifications","nf.markAll": "Read all","nf.unread": "unread",
  "nt.attendance": "Attendance", "nt.present": "{name} is present today", "nt.absent": "{name} is absent today",
  "nt.firstHalf": "{name} attended the first half only", "nt.secondHalf": "{name} attended the second half only",
  "nt.feeTitle": "Fee reminder", "nt.feeBody": "{amount} due for {name} by {due}",
  "nt.noticeTitle": "New notice", "nt.examTitle": "Exam date sheet", "nt.resultTitle": "Result published", "nt.resultBody": "See {name}'s {title} result",
  "nt.leaveOk": "Leave approved", "nt.leaveOkBody": "Leave approved for {name}", "nt.leaveNo": "Leave not approved", "nt.leaveNoBody": "Leave rejected for {name}",
  "nt.reportTitle": "Report card ready", "nt.reportBody": "{name}'s report card is ready", "nt.newMessage": "New message",
  "nt.promoTitle": "New class", "nt.promoBody": "{name} is now in Class {c}.",
  "nt.stayTitle": "New year", "nt.stayBody": "{name} stays in Class {c}.",
  "nt.doneTitle": "Congratulations", "nt.doneBody": "{name} completed Class {c}.",
  "nt.feedbackTitle": "Feedback requested", "nt.feedbackBody": "Rate the teachers",
  "cg.label": "Promotion","cg.dismiss": "Dismiss",

  "msg.title": "Messages",
  "msg.teachers": "Teachers", "msg.previous": "Previous","msg.noTeachers": "No teachers yet","msg.noLonger": "Not teaching {subject}",
  "msg.you": "You: ", "msg.none": "No messages","msg.prevTeacher": "Previous","msg.to": "Message to {name}", "msg.write": "Message {name}",
  "msg.back": "Back", "msg.list": "Messages", "msg.hello": "No messages yet","msg.send": "Send",
  "msg.inactive": "{teacher} no longer teaches {subject}.",
  "upd.title": "Notices","upd.none": "No notices","upd.unread": "Unread: ", 
  "upd.filter": "Filter updates", "upd.all": "All", "upd.school": "School", "upd.general": "General", "upd.empty": "None",
  "upd.aria": "{what} from {who}", "upd.schoolNotice": "School notice","tag.classTeacher": "Class teacher", "tag.unread": "Unread",
  "me.deleted": "This conversation no longer exists.", "me.write": "Write a message first.", "me.long": "Keep the message within {n} characters.",
  "me.left": "{name} has left school, so this conversation is read-only.", "me.notTeach": "{staff} no longer teaches {subject} to {name}.",

  "pw.title": "Change password", "pw.desc": "Keep it private.","pw.current": "Current password", "pw.new": "New password",
  "pw.hint": "8+ characters","pw.again": "Repeat password","pw.cancel": "Cancel", "pw.min": "At least 8 characters.","pw.match": "Passwords do not match.",
  "pw.same": "Use a new password.","pw.changed": "Password changed", "pw.changedLive": "Other devices signed out.",
  "pw.changedDemo": "Use it next time.","pw.fail": "Could not change.",
  "home.result": "Result",
  "home.notice": "Notice",
  "home.next": "Next class",
  "home.noClass": "No class",
} as const;

export type TKey = keyof typeof en;

/* ------------------------------------------------------------------ Hindi. Missing or extra keys fail the type check. */
const hi: Record<TKey, string> = {
  ...hiLive,
  "app.loading": "लोड हो रहा है…",
  "lang.title": "Choose your language / अपनी भाषा चुनें",
  "lang.switch": "भाषा",
  "nav.label": "अभिभावक",
  "nav.home": "होम","nav.attendance": "उपस्थिति", "nav.results": "परिणाम", "nav.messages": "संदेश", "nav.leave": "छुट्टी",
  "nav.timetable": "समय सारणी", "nav.fees": "फीस", "nav.notices": "नोटिस", "nav.feedback": "फ़ीडबैक",
  "hdr.switchChild": "बच्चा बदलें", "hdr.yourChildren": "बच्चे","hdr.class": "कक्षा {c}",
  "hdr.changePassword": "पासवर्ड बदलें", "hdr.signOut": "साइन आउट",
  "hdr.notifications": "सूचनाएँ", "hdr.notificationsNew": "सूचनाएँ, {n} नई",
 

  "home.title": "आज",
  "home.feedbackTitle": "फ़ीडबैक चाहिए",
  "home.allPaid": "जमा","home.due": "अंतिम तिथि {date}",

  "mark.present": "उपस्थित", "mark.absent": "अनुपस्थित", "mark.half": "आधा दिन","mark.leave": "छुट्टी","mark.holiday": "अवकाश","mark.none": "दर्ज नहीं",
  "inv.paid": "जमा", "inv.partial": "आंशिक","inv.unpaid": "बाकी",

  "att.title": "उपस्थिति","att.stat": "उपस्थिति", "att.present": "उपस्थित", "att.absent": "अनुपस्थित", "att.half": "आधा",
  "att.prev": "पिछला महीना", "att.next": "अगला महीना", "att.days": "र,सो,मं,बु,गु,शु,श", "att.legendHalf": "आधा दिन", "att.legendLeave": "छुट्टी", "att.legendAbsent": "अनुपस्थित", 

  "res.title": "परिणाम","res.emptyTitle": "कोई परिणाम नहीं",
  "res.download": "रिपोर्ट कार्ड","res.subject": "विषय", "res.marks": "अंक", "res.grade": "ग्रेड", "res.total": "कुल", "res.classTeacher": "टिप्पणी: ",
  "rc.default": "रिपोर्ट कार्ड","rc.unavailable": "उपलब्ध नहीं।","rc.done": "डाउनलोड हुआ","rc.fail": "नहीं बन सका। दोबारा कोशिश करें।",
  "grade.label": "ग्रेड: ","grade.below": "{n} से कम: {grade}", "grade.pass": "पास {p}%।",

  "lv.title": "छुट्टी","lv.apply": "आवेदन",
  "lv.emptyTitle": "कोई आवेदन नहीं",
  "lv.teacher": "शिक्षक", "lv.applied": "आवेदन {date}","lv.approved": "स्वीकृत {date}","lv.decided": "निर्णय {date}","lv.cancel": "रद्द करें",
  "lv.cancelTitle": "आवेदन रद्द करें?","lv.cancelText": "शिक्षक इसे नहीं देखेंगे।","lv.keep": "रहने दें","lv.cancelled": "रद्द हुआ",
  "lv.s.pending": "लंबित", "lv.s.approved": "स्वीकृत", "lv.s.rejected": "अस्वीकृत", "lv.s.cancelled": "रद्द",
  "lv.h.none": "पूरा दिन", "lv.h.first": "पहला भाग","lv.h.second": "दूसरा भाग","lv.days": "{n} दिन",
  "lvd.title": "छुट्टी","lvd.desc": "{name} के लिए","lvd.from": "से", "lvd.to": "तक", "lvd.part": "दिन का भाग",
  "lvd.single": "केवल एक तारीख।","lvd.reason": "कारण", "lvd.placeholder": "जैसे: बुखार","lvd.cancel": "रद्द करें", "lvd.send": "भेजें",
  "lvd.sent": "आवेदन भेजा",
  "lve.dates": "तारीखें चुनें।","lve.past": "तारीख बीत चुकी है।","lve.order": "अंत तारीख पहले है।","lve.half": "आधे दिन के लिए एक तारीख।",
  "lve.reason": "कारण लिखें।","lve.long": "अधिकतम {n} अक्षर।","lve.overlap": "इन तारीखों का आवेदन है।",

  "tt.title": "समय सारणी",
  "tt.region": "साप्ताहिक समय सारणी","tt.period": "पीरियड", "tt.today": "आज", "tt.break": "अंतराल", "tt.sub": "स्थानापन्न: {name}",

  "fee.title": "फीस","fee.empty": "कोई बिल नहीं","fee.due": "अंतिम तिथि {date}", "fee.closed": "बंद", "fee.payments": "भुगतान",
  "fee.carried": "आगे आया","fee.concession": "रियायत","fee.waived": "विलंब शुल्क माफ़",
  "fee.total": "कुल", "fee.paid": "जमा", "fee.balance": "बाकी", "fee.closedNote": "{to} में जोड़ा",
  "fee.noPayments": "कोई भुगतान नहीं","fee.instalment": "किस्त {n}","fee.cancelledBySchool": "रद्द","fee.receipt": "रसीद",
  "mode.cash": "नकद", "mode.cheque": "चेक", "mode.upi": "UPI", "mode.bank_transfer": "बैंक ट्रांसफर",

  "nt.title": "नोटिस","nt.dateSheet": "परीक्षा तिथि","nt.calendar": "कैलेंडर",
  "kind.holiday": "अवकाश", "kind.exam": "परीक्षा", "kind.event": "कार्यक्रम",

  "fb.title": "फ़ीडबैक","fb.none": "अभी कुछ नहीं",
  "fb.closes": "अंतिम तिथि {date} · गुप्त","fb.sent": "भेजा गया", "fb.thanks": "भेज दिया। धन्यवाद।",
  "fb.classTeacher": "कक्षा शिक्षक", "fb.rating": "{name} के लिए रेटिंग", "fb.commentLabel": "{name} के बारे में टिप्पणी (वैकल्पिक)", "fb.commentPh": "टिप्पणी (वैकल्पिक)",
  "fb.send": "भेजें","fb.toast": "धन्यवाद","star.one": "{n} स्टार", "star.many": "{n} स्टार",

  "nf.title": "सूचनाएँ","nf.markAll": "सब पढ़ें","nf.unread": "अपठित",
  "nt.attendance": "उपस्थिति", "nt.present": "{name} आज उपस्थित है", "nt.absent": "{name} आज अनुपस्थित है",
  "nt.firstHalf": "{name} की उपस्थिति: केवल पहला आधा दिन", "nt.secondHalf": "{name} की उपस्थिति: केवल दूसरा आधा दिन",
  "nt.feeTitle": "फीस की याद", "nt.feeBody": "{name} की {amount} फीस {due} तक",
  "nt.noticeTitle": "नई सूचना", "nt.examTitle": "परीक्षा तिथि-पत्र", "nt.resultTitle": "परिणाम जारी हुआ", "nt.resultBody": "{name} का {title} का परिणाम देखें",
  "nt.leaveOk": "छुट्टी स्वीकृत", "nt.leaveOkBody": "{name} की छुट्टी स्वीकृत हो गई है", "nt.leaveNo": "छुट्टी स्वीकृत नहीं हुई", "nt.leaveNoBody": "{name} की छुट्टी अस्वीकृत की गई है",
  "nt.reportTitle": "रिपोर्ट कार्ड तैयार", "nt.reportBody": "{name} का रिपोर्ट कार्ड तैयार है", "nt.newMessage": "नया संदेश",
  "nt.promoTitle": "नई कक्षा", "nt.promoBody": "{name} अब कक्षा {c} में है।",
  "nt.stayTitle": "नया सत्र", "nt.stayBody": "{name} कक्षा {c} में ही है।",
  "nt.doneTitle": "बधाई हो", "nt.doneBody": "{name} ने कक्षा {c} पूरी की।",
  "nt.feedbackTitle": "फ़ीडबैक माँगा गया है", "nt.feedbackBody": "शिक्षकों को रेट करें",
  "cg.label": "कक्षा","cg.dismiss": "बंद करें",

  "msg.title": "संदेश",
  "msg.teachers": "शिक्षक", "msg.previous": "पिछले","msg.noTeachers": "अभी कोई शिक्षक नहीं","msg.noLonger": "अब {subject} नहीं",
  "msg.you": "आप: ", "msg.none": "कोई संदेश नहीं","msg.prevTeacher": "पिछले","msg.to": "{name} को संदेश", "msg.write": "{name} को लिखें",
  "msg.back": "वापस", "msg.list": "संदेश", "msg.hello": "अभी कोई संदेश नहीं","msg.send": "भेजें",
  "msg.inactive": "{teacher} अब {subject} नहीं पढ़ाते।",
  "upd.title": "नोटिस","upd.none": "कोई नोटिस नहीं","upd.unread": "अपठित: ", 
  "upd.filter": "अपडेट छाँटें", "upd.all": "सभी", "upd.school": "स्कूल", "upd.general": "सामान्य", "upd.empty": "कुछ नहीं",
  "upd.aria": "{who} की ओर से {what}", "upd.schoolNotice": "स्कूल का नोटिस","tag.classTeacher": "कक्षा शिक्षक", "tag.unread": "अपठित",
  "me.deleted": "यह बातचीत अब मौजूद नहीं है।", "me.write": "पहले संदेश लिखें।", "me.long": "संदेश {n} अक्षरों के भीतर रखें।",
  "me.left": "{name} ने स्कूल छोड़ दिया है, इसलिए यह बातचीत केवल पढ़ने के लिए है।", "me.notTeach": "{staff} अब {name} को {subject} नहीं पढ़ाते।",

  "pw.title": "पासवर्ड बदलें", "pw.desc": "इसे गुप्त रखें।","pw.current": "मौजूदा पासवर्ड", "pw.new": "नया पासवर्ड",
  "pw.hint": "8+ अक्षर","pw.again": "पासवर्ड दोबारा","pw.cancel": "रद्द करें", "pw.min": "कम से कम 8 अक्षर।","pw.match": "पासवर्ड मेल नहीं खाते।",
  "pw.same": "नया पासवर्ड चुनें।","pw.changed": "पासवर्ड बदल गया", "pw.changedLive": "दूसरे डिवाइस साइन आउट हुए।",
  "pw.changedDemo": "अगली बार इसे इस्तेमाल करें।","pw.fail": "नहीं बदल सका।",
  "home.result": "परिणाम", "home.notice": "नोटिस", "home.next": "अगली कक्षा", "home.noClass": "कक्षा नहीं",
};

/* ------------------------------------------------------------------ School data that is shown to parents (demo data and common labels).
 * Free text typed by the school (notice bodies, teacher remarks) is shown as written. */
const HI_DATA: Record<string, string> = {
  Mathematics: "गणित", English: "अंग्रेज़ी", Hindi: "हिन्दी", Science: "विज्ञान", "Social Science": "सामाजिक विज्ञान",
  School: "स्कूल", General: "सामान्य", Break: "अंतराल",
  Computer: "कंप्यूटर", "Half-yearly exams": "अर्धवार्षिक परीक्षाएँ", "Mid-term teacher feedback": "सत्र-मध्य शिक्षक फ़ीडबैक", "Term 1 teacher feedback": "टर्म 1 शिक्षक फ़ीडबैक",
  "Unit Test 2": "यूनिट टेस्ट 2", "Unit Test 1": "यूनिट टेस्ट 1", "Half-yearly": "अर्धवार्षिक", Annual: "वार्षिक",
  "Diwali Break": "दीवाली की छुट्टियाँ", "Half-yearly Exams": "अर्धवार्षिक परीक्षाएँ", "Annual Sports Day": "वार्षिक खेल दिवस", "Winter Break": "शीतकालीन अवकाश",
  "Diwali holidays announced": "दीवाली की छुट्टियों की घोषणा", "School will remain closed from 8 to 12 November. Classes resume on 13 November.": "8 से 12 नवंबर तक स्कूल बंद रहेगा। 13 नवंबर से कक्षाएँ फिर शुरू होंगी।",
  "Half-yearly exam timetable": "अर्धवार्षिक परीक्षा समय सारणी", "The timetable has been shared with class teachers. Parents will receive it in the app.": "समय सारणी कक्षा शिक्षकों को भेज दी गई है। अभिभावकों को यह ऐप में मिलेगी।",
  "Steady progress. Keep revising Mathematics.": "लगातार प्रगति हो रही है। गणित का अभ्यास जारी रखें।",
  Tuition: "ट्यूशन", "Activity and lab": "गतिविधि और प्रयोगशाला", Transport: "परिवहन", Admission: "प्रवेश",
  "Previous dues": "पिछला बकाया", "Late fee": "विलंब शुल्क", "Library fine": "पुस्तकालय जुर्माना", "Sibling discount": "भाई-बहन की रियायत", "RTE (full tuition waiver)": "आरटीई (पूरी ट्यूशन फीस माफ़)",
  "Staff child": "स्टाफ के बच्चे की रियायत", "Merit scholarship": "मेधावी छात्रवृत्ति",
  "Previous teacher": "पिछले शिक्षक",
};
const dataText = (s: string): string => {
  if (HI_DATA[s]) return HI_DATA[s];
  let m = /^Period (\d+)$/.exec(s); if (m) return `पीरियड ${m[1]}`;
  m = /^Term (\d+)$/.exec(s); if (m) return `टर्म ${m[1]}`;
  m = /^Unit Test (\d+)$/.exec(s); if (m) return `यूनिट टेस्ट ${m[1]}`;
  m = /^(.+) fee$/.exec(s); if (m && HI_DATA[m[1]]) return `${HI_DATA[m[1]]} शुल्क`;
  return s;
};

/* ------------------------------------------------------------------ storage */
const KEY = "krevo.parent.lang";
const EVT = "krevo:parent-lang";
let memory: Lang | "" = "";   // keeps the choice for this visit when localStorage is blocked
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };
const read = (): Lang | "" => { try { const v = localStorage.getItem(KEY); if (v === "en" || v === "hi") return v; } catch {} return memory; };
const write = (l: Lang) => { memory = l; try { localStorage.setItem(KEY, l); } catch {} window.dispatchEvent(new Event(EVT)); };

interface PrefsCtx { lang: Lang; chosen: boolean; ready: boolean; setLang: (l: Lang) => void }
const Prefs = React.createContext<PrefsCtx | null>(null);

/** The language the API remembers for this person. /auth/me gains a `language` field, so read it defensively. */
const serverLang = (me: unknown): Lang | null => {
  const v = (me as { language?: unknown } | null)?.language;
  return v === "en" || v === "hi" ? v : null;
};

export function LanguageProvider({ children, fontClass = "" }: { children: React.ReactNode; fontClass?: string }) {
  const { live, me } = useSession();
  // undefined on the server and while hydrating, so the first client render matches the server
  const stored = React.useSyncExternalStore<Lang | "" | undefined>(subscribe, read, () => undefined);
  const fromApi = live ? serverLang(me) : null;
  const lang: Lang = stored || fromApi || "en";
  const chosen = !!(stored || fromApi);

  const setLang = React.useCallback((l: Lang) => {
    write(l);
    if (live) { try { Promise.resolve(api.patch("/parent/preferences", { language: l })).catch(() => {}); } catch {} }   // fire and forget
  }, [live]);

  // Dialogs and menus render outside the layout, so the language marker and font go on <html> while the portal is mounted.
  React.useEffect(() => {
    const root = document.documentElement, prev = root.lang, classes = fontClass.split(" ").filter(Boolean);
    root.lang = lang === "hi" ? "hi-IN" : "en-IN";
    if (lang === "hi") { root.dataset.plang = "hi"; root.classList.add(...classes); }
    return () => { root.lang = prev || "en-IN"; delete root.dataset.plang; root.classList.remove(...classes); };
  }, [lang, fontClass]);

  const prefs = React.useMemo<PrefsCtx>(() => ({ lang, chosen, ready: stored !== undefined, setLang }), [lang, chosen, stored, setLang]);
  const value = React.useMemo<LangValue>(() => ({
    lang,
    t: (key, vars) => interpolate((lang === "hi" ? hi : en)[key], vars),
    d: (text) => (lang === "hi" ? dataText(text) : text),
  }), [lang]);
  return <Prefs.Provider value={prefs}><LangCtx.Provider value={value}>{children}</LangCtx.Provider></Prefs.Provider>;
}

/** `const t = useT(); t("nav.home")` or `t("home.title", { name })`. */
export function useT() {
  const c = React.useContext(LangCtx);
  if (!c) throw new Error("useT must be used inside the parent LanguageProvider.");
  return c.t;
}
/** Translate school data such as subject names (parent pages only). */
export { useData } from "@/lib/lang-context";
export function useLanguage() {
  const c = React.useContext(Prefs);
  if (!c) throw new Error("useLanguage must be used inside the parent LanguageProvider.");
  return c;
}

/* ------------------------------------------------------------------ helpers for parent pages */

/** The notification wording, in the parent's language. English matches lib/notifications.ts notifText. */
export function useNotifText() {
  const t = useT();
  const lang = useLang();
  return React.useCallback((n: Notif): { title: string; body: string } => {
    const s = STUDENTS.find((x) => x.id === n.studentId);
    const name = s?.name.split(" ")[0] ?? "";
    const p = n.params, c = p.classLabel ?? "", year = p.year ?? "";
    switch (n.type) {
      case "attendance_present": return { title: t("nt.attendance"), body: t("nt.present", { name }) };
      case "attendance_absent": return { title: t("nt.attendance"), body: t("nt.absent", { name }) };
      case "attendance_first_half": return { title: t("nt.attendance"), body: t("nt.firstHalf", { name }) };
      case "attendance_second_half": return { title: t("nt.attendance"), body: t("nt.secondHalf", { name }) };
      case "fee_reminder": return { title: t("nt.feeTitle"), body: t("nt.feeBody", { name, amount: formatINR(p.amountPaise ?? 0), due: p.dueOn ? formatDateOn(p.dueOn, "date", lang) : "" }) };
      case "notice": return { title: t("nt.noticeTitle"), body: dataIf(lang, p.title ?? "") };
      case "exam": return { title: t("nt.examTitle"), body: dataIf(lang, p.title ?? "") };
      case "result": return { title: t("nt.resultTitle"), body: t("nt.resultBody", { name, title: dataIf(lang, p.title ?? "") }) };
      case "leave_approved": return { title: t("nt.leaveOk"), body: t("nt.leaveOkBody", { name }) };
      case "leave_rejected": return { title: t("nt.leaveNo"), body: t("nt.leaveNoBody", { name }) };
      case "report_card": return { title: t("nt.reportTitle"), body: t("nt.reportBody", { name }) };
      case "broadcast": case "message": return { title: p.title ?? t("nt.newMessage"), body: p.body ?? "" };
      case "promotion_promoted": return { title: t("nt.promoTitle"), body: t("nt.promoBody", { name, c, year }) };
      case "promotion_stayed": return { title: t("nt.stayTitle"), body: t("nt.stayBody", { name, c, year }) };
      case "promotion_completed": return { title: t("nt.doneTitle"), body: t("nt.doneBody", { name, c }) };
      case "feedback": return { title: t("nt.feedbackTitle"), body: t("nt.feedbackBody") };
    }
  }, [t, lang]);
}
const dataIf = (lang: Lang, s: string) => (lang === "hi" ? dataText(s) : s);

/** Turns the English error strings of lib/leave.ts and lib/messaging.ts into the parent's language. Unknown text is returned as is. */
export function useErrorText() {
  const t = useT();
  const lang = useLang();
  return React.useCallback((msg: string): string => {
    const exact: Record<string, TKey> = {
      "Choose the dates.": "lve.dates", "Leave cannot start before today.": "lve.past", "The last day cannot be before the first day.": "lve.order",
      "A half day can only be for a single day.": "lve.half", "Tell the school the reason.": "lve.reason", "There is already a leave request for these dates.": "lve.overlap",
      "This conversation no longer exists.": "me.deleted", "Write a message first.": "me.write",
    };
    if (exact[msg]) return t(exact[msg]);
    let m = /^Keep the reason within (\d+) characters\.$/.exec(msg); if (m) return t("lve.long", { n: m[1] });
    m = /^Keep the message within (\d+) characters\.$/.exec(msg); if (m) return t("me.long", { n: m[1] });
    m = /^(.+) has left school, so this conversation is read-only\.$/.exec(msg); if (m) return t("me.left", { name: m[1] });
    m = /^(.+) no longer teaches (.+) to (.+)\.$/.exec(msg); if (m) return t("me.notTeach", { staff: m[1], subject: dataIf(lang, m[2]), name: m[3] });
    return msg;
  }, [t, lang]);
}
