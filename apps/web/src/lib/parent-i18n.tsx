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
import { LangCtx, interpolate, useLang, type Lang, type LangValue } from "@/lib/lang-context";

/* ------------------------------------------------------------------ English (the master list of keys) */
const en = {
  "app.loading": "Loading…",
  "lang.title": "Choose your language / अपनी भाषा चुनें",
  "lang.hint": "You can change it any time from the top of the page.",
  "lang.switch": "Language",
  "nav.label": "Parent",
  "nav.home": "Home", "nav.attendance": "Attendance", "nav.results": "Results", "nav.messages": "Messages", "nav.leave": "Leave",
  "nav.timetable": "Timetable", "nav.fees": "Fees", "nav.notices": "Notices", "nav.feedback": "Feedback",
  "hdr.switchChild": "Switch child", "hdr.yourChildren": "Your children", "hdr.class": "Class {c}",
  "hdr.changePassword": "Change password", "hdr.signOut": "Sign out",
  "hdr.notifications": "Notifications", "hdr.notificationsNew": "Notifications, {n} new",
  "theme.light": "Switch to light theme", "theme.dark": "Switch to dark theme",

  "home.eyebrow": "Class {c} · Roll {r}", "home.title": "{name}'s school day.", "home.dimLeft": "Records are read-only.", "home.dimDefault": "Everything in one place.",
  "home.left": "{name} left school on {date}. Past records stay here. Messaging is off.",
  "home.feedbackTitle": "Feedback requested", "home.feedbackText": "The school would like to hear how the teachers are doing. Takes a minute.", "home.feedbackCta": "Give feedback",
  "home.today": "Today", "home.fees": "Fees", "home.allPaid": "All paid", "home.nothingPending": "Nothing is pending.", "home.due": "Due {date} · {status}",
  "home.feeDetails": "Fee details", "home.latestResult": "Latest result", "home.allResults": "All results", "home.latestNotice": "Latest notice", "home.allNotices": "All notices",
  "home.attendanceLink": "Attendance",
  "mark.present": "Present", "mark.absent": "Absent", "mark.half": "Half day", "mark.leave": "On leave", "mark.holiday": "No school today", "mark.none": "Not marked yet",
  "inv.paid": "Paid", "inv.partial": "Partly paid", "inv.unpaid": "Unpaid",

  "att.title": "Attendance.", "att.dim": "Day by day.", "att.stat": "Attendance", "att.hint": "Half days count as 0.5", "att.present": "Present", "att.absent": "Absent", "att.half": "Half days",
  "att.prev": "Previous month", "att.next": "Next month", "att.days": "S,M,T,W,T,F,S", "att.legendHalf": "Half day", "att.legendLeave": "Leave", "att.legendAbsent": "Absent", "att.holidays": "Grey numbers are holidays",

  "res.title": "Results.", "res.dim": "Published by the class teacher.", "res.emptyTitle": "No results yet", "res.emptyText": "Results appear here once the class teacher publishes them.",
  "res.published": "Published {date} IST", "res.download": "Download report card", "res.subject": "Subject", "res.marks": "Marks", "res.grade": "Grade", "res.total": "Total", "res.classTeacher": "Class teacher: ",
  "rc.default": "Report card", "rc.unavailable": "Report card is not available.", "rc.done": "Report card downloaded", "rc.fail": "Could not create the report card. Try again.",
  "grade.label": "Grades (percent): ", "grade.below": "{grade} below {n}", "grade.pass": "Pass is {p}% overall.",

  "lv.title": "Leave.", "lv.dim": "Ask for a day off.", "lv.apply": "Apply for leave", "lv.left": "{name} has left the school, so leave cannot be requested.",
  "lv.emptyTitle": "No leave requests yet", "lv.emptyText": "Apply here and the class teacher will approve or reject it. You get a notification either way.",
  "lv.teacher": "Teacher", "lv.applied": "Applied {date} IST", "lv.approved": "Approved {date}", "lv.decided": "Decided {date}", "lv.cancel": "Cancel request",
  "lv.cancelTitle": "Cancel this request?", "lv.cancelText": "The class teacher will no longer see it. You can apply again any time.", "lv.keep": "Keep request", "lv.cancelled": "Request cancelled",
  "lv.s.pending": "Pending", "lv.s.approved": "Approved", "lv.s.rejected": "Rejected", "lv.s.cancelled": "Cancelled",
  "lv.h.none": "Full day", "lv.h.first": "First half", "lv.h.second": "Second half", "lv.days": "{n} days",
  "lvd.title": "Apply for leave", "lvd.desc": "For {name}. The class teacher approves or rejects it.", "lvd.from": "From", "lvd.to": "To", "lvd.part": "Which part of the day",
  "lvd.single": "Half days are for a single date.", "lvd.reason": "Reason", "lvd.placeholder": "For example: fever, family function", "lvd.cancel": "Cancel", "lvd.send": "Send request",
  "lvd.sent": "Leave request sent", "lvd.sentText": "{name}'s class teacher will review it.",
  "lve.dates": "Choose the dates.", "lve.past": "Leave cannot start before today.", "lve.order": "The last day cannot be before the first day.", "lve.half": "A half day can only be for a single day.",
  "lve.reason": "Tell the school the reason.", "lve.long": "Keep the reason within {n} characters.", "lve.overlap": "There is already a leave request for these dates.",

  "tt.title": "Timetable.", "tt.dim": "The week at a glance.", "tt.note": "Times are school times (IST). Swipe sideways on a phone to see every day.",
  "tt.region": "Weekly timetable, scrolls sideways", "tt.period": "Period", "tt.today": "Today", "tt.break": "Break", "tt.sub": "Substitute: {name}",

  "fee.title": "Fees.", "fee.dim": "Paid at the school office.", "fee.empty": "No invoices yet.", "fee.due": "Due {date}", "fee.closed": "Closed", "fee.payments": "Payments",
  "fee.pay": "Please pay at the school office. The balance updates here once the office records your payment.",
  "fee.carried": "carried forward", "fee.concession": "concession", "fee.waived": "Late fee of {amount} waived by {by} on {date} IST. Reason: {reason}",
  "fee.total": "Total", "fee.paid": "Paid", "fee.balance": "Balance", "fee.closedNote": "Closed. The unpaid {amount} was carried forward to {to}.",
  "fee.noPayments": "No payments yet.", "fee.instalment": "Instalment {n}", "fee.cancelledBySchool": "Cancelled by school", "fee.receipt": "Download receipt",
  "mode.cash": "Cash", "mode.cheque": "Cheque", "mode.upi": "UPI", "mode.bank_transfer": "Bank transfer", "fee.lines": "Invoice lines",

  "nt.title": "Notices.", "nt.dim": "And the school calendar.", "nt.dateSheet": "Date sheet", "nt.notices": "Notices", "nt.calendar": "Calendar",
  "kind.holiday": "Holiday", "kind.exam": "Exam", "kind.event": "Event",

  "fb.title": "Feedback.", "fb.dim": "Tell the school how it is going.", "fb.none": "Nothing to answer right now.",
  "fb.closes": "Closes {date}. Your answers are anonymous to teachers.", "fb.sent": "Sent", "fb.thanks": "Thank you. Your feedback has been sent.",
  "fb.classTeacher": "Class teacher", "fb.rating": "Rating for {name}", "fb.commentLabel": "Comment about {name} (optional)", "fb.commentPh": "Add a comment (optional)",
  "fb.send": "Send feedback", "fb.toast": "Thank you for your feedback", "star.one": "{n} star", "star.many": "{n} stars",

  "nf.title": "Notifications.", "nf.new": "{n} new", "nf.caught": "All caught up.", "nf.markAll": "Mark all read", "nf.unread": "unread",
  "nt.attendance": "Attendance", "nt.present": "{name} is present today", "nt.absent": "{name} is absent today",
  "nt.firstHalf": "{name} attended the first half only", "nt.secondHalf": "{name} attended the second half only",
  "nt.feeTitle": "Fee reminder", "nt.feeBody": "Fee reminder: {amount} is due for {name} by {due}",
  "nt.noticeTitle": "New notice", "nt.examTitle": "Exam date sheet", "nt.resultTitle": "Result published", "nt.resultBody": "See {name}'s {title} result",
  "nt.leaveOk": "Leave approved", "nt.leaveOkBody": "Leave approved for {name}", "nt.leaveNo": "Leave not approved", "nt.leaveNoBody": "Leave rejected for {name}",
  "nt.reportTitle": "Report card ready", "nt.reportBody": "{name}'s report card is ready", "nt.newMessage": "New message",
  "nt.promoTitle": "New class", "nt.promoBody": "Congratulations! {name} is now in Class {c} for {year}.",
  "nt.stayTitle": "New year", "nt.stayBody": "{name} will continue in Class {c} for {year}.",
  "nt.doneTitle": "Congratulations", "nt.doneBody": "Congratulations! {name} has completed Class {c}.",
  "nt.feedbackTitle": "Feedback requested", "nt.feedbackBody": "Tell the school how the teachers are doing",
  "cg.label": "Congratulations", "cg.dismiss": "Dismiss",

  "msg.title": "Messages.", "msg.dim": "From your child's teachers.", "msg.left": "{name} has left school. Messages are read-only.",
  "msg.teachers": "Teachers", "msg.previous": "Previous teachers", "msg.noTeachers": "No teachers are assigned to this class yet.", "msg.noLonger": "No longer teaches {subject}",
  "msg.you": "You: ", "msg.none": "No messages yet", "msg.prevTeacher": "Previous teacher", "msg.to": "Message to {name}", "msg.write": "Write to {name}",
  "msg.back": "Back", "msg.list": "Messages", "msg.hello": "No messages yet. Say hello below.", "msg.send": "Send",
  "msg.inactive": "{teacher} no longer teaches {subject} to {child}, so you can't reply. Messages from your current {subject} teacher are under Teachers.",
  "msg.leftNote": "{child} has left school, so messages are read-only. You can still read the old ones.",
  "upd.title": "Updates", "upd.none": "No updates yet", "upd.unread": "Unread: ", "upd.desc": "School notices and class messages for {name}. Replies go to teachers, not here.",
  "upd.filter": "Filter updates", "upd.all": "All", "upd.school": "School", "upd.general": "General", "upd.empty": "Nothing here yet.",
  "upd.aria": "{what} from {who}", "upd.schoolNotice": "School notice", "tag.classTeacher": "Class teacher", "tag.unread": "Unread",
  "me.deleted": "This conversation no longer exists.", "me.write": "Write a message first.", "me.long": "Keep the message within {n} characters.",
  "me.left": "{name} has left school, so this conversation is read-only.", "me.notTeach": "{staff} no longer teaches {subject} to {name}.",

  "pw.title": "Change password", "pw.desc": "Only you should know it. Do not share it, even with the school office.", "pw.current": "Current password", "pw.new": "New password",
  "pw.hint": "At least 8 characters.", "pw.again": "Repeat new password", "pw.cancel": "Cancel", "pw.min": "Use at least 8 characters.", "pw.match": "The two new passwords do not match.",
  "pw.same": "Choose a password different from the current one.", "pw.changed": "Password changed", "pw.changedLive": "You are still signed in here. Other devices were signed out.",
  "pw.changedDemo": "Use the new password next time you sign in.", "pw.fail": "Could not change the password.",
} as const;

export type TKey = keyof typeof en;

/* ------------------------------------------------------------------ Hindi. Missing or extra keys fail the type check. */
const hi: Record<TKey, string> = {
  "app.loading": "लोड हो रहा है…",
  "lang.title": "Choose your language / अपनी भाषा चुनें",
  "lang.hint": "आप इसे पेज के ऊपर से कभी भी बदल सकते हैं।",
  "lang.switch": "भाषा",
  "nav.label": "अभिभावक",
  "nav.home": "मुख्य पृष्ठ", "nav.attendance": "उपस्थिति", "nav.results": "परिणाम", "nav.messages": "संदेश", "nav.leave": "छुट्टी",
  "nav.timetable": "समय सारणी", "nav.fees": "फीस", "nav.notices": "सूचनाएँ", "nav.feedback": "फ़ीडबैक",
  "hdr.switchChild": "बच्चा बदलें", "hdr.yourChildren": "आपके बच्चे", "hdr.class": "कक्षा {c}",
  "hdr.changePassword": "पासवर्ड बदलें", "hdr.signOut": "साइन आउट करें",
  "hdr.notifications": "सूचनाएँ", "hdr.notificationsNew": "सूचनाएँ, {n} नई",
  "theme.light": "लाइट थीम चुनें", "theme.dark": "डार्क थीम चुनें",

  "home.eyebrow": "कक्षा {c} · रोल {r}", "home.title": "{name} का स्कूल का दिन।", "home.dimLeft": "रिकॉर्ड केवल देखने के लिए हैं।", "home.dimDefault": "सब कुछ एक जगह।",
  "home.left": "{name} ने {date} को स्कूल छोड़ दिया। पुराने रिकॉर्ड यहीं रहेंगे। संदेश भेजना बंद है।",
  "home.feedbackTitle": "फ़ीडबैक माँगा गया है", "home.feedbackText": "स्कूल जानना चाहता है कि शिक्षक कैसा पढ़ा रहे हैं। इसमें बस एक मिनट लगता है।", "home.feedbackCta": "फ़ीडबैक दें",
  "home.today": "आज", "home.fees": "फीस", "home.allPaid": "सब जमा है", "home.nothingPending": "कुछ बाकी नहीं है।", "home.due": "अंतिम तिथि {date} · {status}",
  "home.feeDetails": "फीस का ब्योरा", "home.latestResult": "ताज़ा परिणाम", "home.allResults": "सभी परिणाम", "home.latestNotice": "ताज़ा सूचना", "home.allNotices": "सभी सूचनाएँ",
  "home.attendanceLink": "उपस्थिति",
  "mark.present": "उपस्थित", "mark.absent": "अनुपस्थित", "mark.half": "आधा दिन", "mark.leave": "छुट्टी पर", "mark.holiday": "आज स्कूल बंद है", "mark.none": "अभी दर्ज नहीं हुआ",
  "inv.paid": "जमा", "inv.partial": "आंशिक जमा", "inv.unpaid": "बाकी",

  "att.title": "उपस्थिति।", "att.dim": "दिन-प्रतिदिन।", "att.stat": "उपस्थिति", "att.hint": "आधे दिन को 0.5 गिना जाता है", "att.present": "उपस्थित", "att.absent": "अनुपस्थित", "att.half": "आधे दिन",
  "att.prev": "पिछला महीना", "att.next": "अगला महीना", "att.days": "र,सो,मं,बु,गु,शु,श", "att.legendHalf": "आधा दिन", "att.legendLeave": "छुट्टी", "att.legendAbsent": "अनुपस्थित", "att.holidays": "धूसर तारीखें छुट्टी के दिन हैं",

  "res.title": "परिणाम।", "res.dim": "कक्षा शिक्षक द्वारा जारी।", "res.emptyTitle": "अभी कोई परिणाम नहीं", "res.emptyText": "कक्षा शिक्षक के परिणाम जारी करते ही वे यहाँ दिखेंगे।",
  "res.published": "जारी: {date} IST", "res.download": "रिपोर्ट कार्ड डाउनलोड करें", "res.subject": "विषय", "res.marks": "अंक", "res.grade": "ग्रेड", "res.total": "कुल", "res.classTeacher": "कक्षा शिक्षक: ",
  "rc.default": "रिपोर्ट कार्ड", "rc.unavailable": "रिपोर्ट कार्ड उपलब्ध नहीं है।", "rc.done": "रिपोर्ट कार्ड डाउनलोड हो गया", "rc.fail": "रिपोर्ट कार्ड नहीं बन सका। कृपया दोबारा कोशिश करें।",
  "grade.label": "ग्रेड (प्रतिशत): ", "grade.below": "{n} से कम: {grade}", "grade.pass": "कुल मिलाकर पास होने के लिए {p}% चाहिए।",

  "lv.title": "छुट्टी का आवेदन।", "lv.dim": "एक दिन की छुट्टी माँगें।", "lv.apply": "छुट्टी के लिए आवेदन करें", "lv.left": "{name} ने स्कूल छोड़ दिया है, इसलिए छुट्टी का आवेदन नहीं हो सकता।",
  "lv.emptyTitle": "अभी कोई आवेदन नहीं", "lv.emptyText": "यहाँ आवेदन करें। कक्षा शिक्षक उसे स्वीकार या अस्वीकार करेंगे, और आपको सूचना मिलेगी।",
  "lv.teacher": "शिक्षक", "lv.applied": "आवेदन: {date} IST", "lv.approved": "स्वीकृत: {date}", "lv.decided": "निर्णय: {date}", "lv.cancel": "आवेदन रद्द करें",
  "lv.cancelTitle": "यह आवेदन रद्द करें?", "lv.cancelText": "कक्षा शिक्षक को यह आवेदन नहीं दिखेगा। आप कभी भी दोबारा आवेदन कर सकते हैं।", "lv.keep": "आवेदन रहने दें", "lv.cancelled": "आवेदन रद्द हो गया",
  "lv.s.pending": "लंबित", "lv.s.approved": "स्वीकृत", "lv.s.rejected": "अस्वीकृत", "lv.s.cancelled": "रद्द",
  "lv.h.none": "पूरा दिन", "lv.h.first": "पहला आधा दिन", "lv.h.second": "दूसरा आधा दिन", "lv.days": "{n} दिन",
  "lvd.title": "छुट्टी के लिए आवेदन", "lvd.desc": "{name} के लिए। कक्षा शिक्षक इसे स्वीकार या अस्वीकार करेंगे।", "lvd.from": "से", "lvd.to": "तक", "lvd.part": "दिन का कौन सा हिस्सा",
  "lvd.single": "आधा दिन केवल एक तारीख के लिए हो सकता है।", "lvd.reason": "कारण", "lvd.placeholder": "जैसे: बुखार, घर में कार्यक्रम", "lvd.cancel": "रद्द करें", "lvd.send": "आवेदन भेजें",
  "lvd.sent": "छुट्टी का आवेदन भेज दिया गया", "lvd.sentText": "{name} के कक्षा शिक्षक इसे देखेंगे।",
  "lve.dates": "तारीखें चुनें।", "lve.past": "छुट्टी आज से पहले की तारीख से शुरू नहीं हो सकती।", "lve.order": "आखिरी दिन पहले दिन से पहले नहीं हो सकता।", "lve.half": "आधा दिन केवल एक दिन के लिए हो सकता है।",
  "lve.reason": "स्कूल को कारण बताएँ।", "lve.long": "कारण {n} अक्षरों के भीतर रखें।", "lve.overlap": "इन तारीखों के लिए पहले से आवेदन मौजूद है।",

  "tt.title": "समय सारणी।", "tt.dim": "पूरे हफ़्ते की झलक।", "tt.note": "समय स्कूल का समय (IST) है। फ़ोन पर सारे दिन देखने के लिए बगल में स्वाइप करें।",
  "tt.region": "साप्ताहिक समय सारणी, बगल में स्क्रॉल करें", "tt.period": "पीरियड", "tt.today": "आज", "tt.break": "अंतराल", "tt.sub": "स्थानापन्न शिक्षक: {name}",

  "fee.title": "फीस।", "fee.dim": "स्कूल कार्यालय में जमा करें।", "fee.empty": "अभी कोई फीस बिल नहीं है।", "fee.due": "अंतिम तिथि {date}", "fee.closed": "बंद", "fee.payments": "भुगतान",
  "fee.pay": "कृपया फीस स्कूल कार्यालय में जमा करें। कार्यालय भुगतान दर्ज करेगा तो बाकी राशि यहाँ अपने आप बदल जाएगी।",
  "fee.carried": "आगे जोड़ी गई", "fee.concession": "रियायत", "fee.waived": "{amount} का विलंब शुल्क {by} ने {date} IST को माफ़ किया। कारण: {reason}",
  "fee.total": "कुल", "fee.paid": "जमा", "fee.balance": "बाकी", "fee.closedNote": "बंद। बाकी {amount} आगे {to} में जोड़ दिए गए।",
  "fee.noPayments": "अभी कोई भुगतान नहीं।", "fee.instalment": "किस्त {n}", "fee.cancelledBySchool": "स्कूल द्वारा रद्द", "fee.receipt": "रसीद डाउनलोड करें",
  "mode.cash": "नकद", "mode.cheque": "चेक", "mode.upi": "UPI", "mode.bank_transfer": "बैंक ट्रांसफर", "fee.lines": "बिल का ब्योरा",

  "nt.title": "सूचनाएँ।", "nt.dim": "और स्कूल का कैलेंडर।", "nt.dateSheet": "परीक्षा तिथि-पत्र", "nt.notices": "सूचनाएँ", "nt.calendar": "कैलेंडर",
  "kind.holiday": "अवकाश", "kind.exam": "परीक्षा", "kind.event": "कार्यक्रम",

  "fb.title": "फ़ीडबैक।", "fb.dim": "स्कूल को बताएँ कैसा चल रहा है।", "fb.none": "अभी कोई जवाब देना बाकी नहीं है।",
  "fb.closes": "{date} को बंद होगा। आपके जवाब शिक्षकों को नाम के बिना दिखते हैं।", "fb.sent": "भेजा गया", "fb.thanks": "धन्यवाद। आपका फ़ीडबैक भेज दिया गया है।",
  "fb.classTeacher": "कक्षा शिक्षक", "fb.rating": "{name} के लिए रेटिंग", "fb.commentLabel": "{name} के बारे में टिप्पणी (वैकल्पिक)", "fb.commentPh": "टिप्पणी लिखें (वैकल्पिक)",
  "fb.send": "फ़ीडबैक भेजें", "fb.toast": "आपके फ़ीडबैक के लिए धन्यवाद", "star.one": "{n} स्टार", "star.many": "{n} स्टार",

  "nf.title": "सूचनाएँ।", "nf.new": "{n} नई", "nf.caught": "सब देख लिया।", "nf.markAll": "सभी पढ़ी हुई करें", "nf.unread": "अपठित",
  "nt.attendance": "उपस्थिति", "nt.present": "{name} आज उपस्थित है", "nt.absent": "{name} आज अनुपस्थित है",
  "nt.firstHalf": "{name} की उपस्थिति: केवल पहला आधा दिन", "nt.secondHalf": "{name} की उपस्थिति: केवल दूसरा आधा दिन",
  "nt.feeTitle": "फीस की याद", "nt.feeBody": "फीस की याद: {name} की {amount} फीस {due} तक जमा करनी है",
  "nt.noticeTitle": "नई सूचना", "nt.examTitle": "परीक्षा तिथि-पत्र", "nt.resultTitle": "परिणाम जारी हुआ", "nt.resultBody": "{name} का {title} का परिणाम देखें",
  "nt.leaveOk": "छुट्टी स्वीकृत", "nt.leaveOkBody": "{name} की छुट्टी स्वीकृत हो गई है", "nt.leaveNo": "छुट्टी स्वीकृत नहीं हुई", "nt.leaveNoBody": "{name} की छुट्टी अस्वीकृत की गई है",
  "nt.reportTitle": "रिपोर्ट कार्ड तैयार", "nt.reportBody": "{name} का रिपोर्ट कार्ड तैयार है", "nt.newMessage": "नया संदेश",
  "nt.promoTitle": "नई कक्षा", "nt.promoBody": "बधाई हो! {name} अब {year} के लिए कक्षा {c} में है।",
  "nt.stayTitle": "नया सत्र", "nt.stayBody": "{year} में {name} की पढ़ाई कक्षा {c} में जारी रहेगी।",
  "nt.doneTitle": "बधाई हो", "nt.doneBody": "बधाई हो! {name} ने कक्षा {c} पूरी कर ली है।",
  "nt.feedbackTitle": "फ़ीडबैक माँगा गया है", "nt.feedbackBody": "स्कूल को बताएँ कि शिक्षक कैसा पढ़ा रहे हैं",
  "cg.label": "बधाई", "cg.dismiss": "बंद करें",

  "msg.title": "संदेश।", "msg.dim": "आपके बच्चे के शिक्षकों से।", "msg.left": "{name} ने स्कूल छोड़ दिया है। संदेश केवल पढ़ने के लिए हैं।",
  "msg.teachers": "शिक्षक", "msg.previous": "पिछले शिक्षक", "msg.noTeachers": "इस कक्षा में अभी कोई शिक्षक नहीं जुड़ा है।", "msg.noLonger": "अब {subject} नहीं पढ़ाते",
  "msg.you": "आप: ", "msg.none": "अभी कोई संदेश नहीं", "msg.prevTeacher": "पिछले शिक्षक", "msg.to": "{name} को संदेश", "msg.write": "{name} को लिखें",
  "msg.back": "वापस", "msg.list": "संदेश", "msg.hello": "अभी कोई संदेश नहीं। नीचे नमस्ते लिखें।", "msg.send": "भेजें",
  "msg.inactive": "{teacher} अब {child} को {subject} नहीं पढ़ाते, इसलिए आप जवाब नहीं दे सकते। {subject} के मौजूदा शिक्षक के संदेश \"शिक्षक\" में हैं।",
  "msg.leftNote": "{child} ने स्कूल छोड़ दिया है, इसलिए संदेश केवल पढ़ने के लिए हैं। पुराने संदेश आप अब भी पढ़ सकते हैं।",
  "upd.title": "अपडेट", "upd.none": "अभी कोई अपडेट नहीं", "upd.unread": "अपठित: ", "upd.desc": "{name} के लिए स्कूल की सूचनाएँ और कक्षा के संदेश। जवाब शिक्षकों को भेजे जाते हैं, यहाँ नहीं।",
  "upd.filter": "अपडेट छाँटें", "upd.all": "सभी", "upd.school": "स्कूल", "upd.general": "सामान्य", "upd.empty": "यहाँ अभी कुछ नहीं है।",
  "upd.aria": "{who} की ओर से {what}", "upd.schoolNotice": "स्कूल की सूचना", "tag.classTeacher": "कक्षा शिक्षक", "tag.unread": "अपठित",
  "me.deleted": "यह बातचीत अब मौजूद नहीं है।", "me.write": "पहले संदेश लिखें।", "me.long": "संदेश {n} अक्षरों के भीतर रखें।",
  "me.left": "{name} ने स्कूल छोड़ दिया है, इसलिए यह बातचीत केवल पढ़ने के लिए है।", "me.notTeach": "{staff} अब {name} को {subject} नहीं पढ़ाते।",

  "pw.title": "पासवर्ड बदलें", "pw.desc": "इसे सिर्फ़ आप जानें। इसे किसी को न बताएँ, स्कूल कार्यालय को भी नहीं।", "pw.current": "मौजूदा पासवर्ड", "pw.new": "नया पासवर्ड",
  "pw.hint": "कम से कम 8 अक्षर।", "pw.again": "नया पासवर्ड दोबारा लिखें", "pw.cancel": "रद्द करें", "pw.min": "कम से कम 8 अक्षर रखें।", "pw.match": "दोनों नए पासवर्ड एक जैसे नहीं हैं।",
  "pw.same": "ऐसा पासवर्ड चुनें जो मौजूदा पासवर्ड से अलग हो।", "pw.changed": "पासवर्ड बदल गया", "pw.changedLive": "आप यहाँ अब भी साइन इन हैं। दूसरे डिवाइस से साइन आउट कर दिया गया है।",
  "pw.changedDemo": "अगली बार साइन इन करते समय नया पासवर्ड इस्तेमाल करें।", "pw.fail": "पासवर्ड नहीं बदल सका।",
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
  "Previous dues": "पिछला बकाया", "Late fee": "विलंब शुल्क", "Sibling discount": "भाई-बहन की रियायत", "RTE (full tuition waiver)": "आरटीई (पूरी ट्यूशन फीस माफ़)",
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
const KEY = "scool.parent.lang";
const EVT = "scool:parent-lang";
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
