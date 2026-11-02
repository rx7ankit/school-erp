/**
 * Words that only the connected (live) parent portal needs. Merged into the dictionaries of lib/parent-i18n.tsx.
 * `hiLive` is typed against `enLive`, so a missing or extra Hindi key fails the type check.
 */
export const enLive = {
  "nav.records": "Records",
  "pl.retry": "Retry",
  "pl.error": "Could not load. Try again.",
  "pl.offline": "No connection. Try again.",
  "pl.readOnly": "Read only. Child has left.",
  "pl.leftNote": "{name} left school. Read only.",
  "pl.noChildrenTitle": "No child linked",
  "pl.noChildrenText": "Ask the school office.",

  "pl.overdue": "Overdue",
  "pl.previousDues": "Previous dues",
  "pl.lateWaived": "Late fee waived",
  "pl.lateWaivedWhy": "Late fee waived: {reason}",
  "pl.libOverdue": "{n} books overdue",

  
  "pl.noTimetable": "No timetable",

  "pl.absentMark": "Absent",
  "pl.rank": "Rank {rank}/{n}",
  "pl.attachOptional": "Attachment",
  "pl.attach": "Attach file",
  "pl.removeFile": "Remove",
  "pl.fileBig": "{name} is over 10 MB.",
  "pl.maxFiles": "Up to {n} files.",
  "pl.viewNote": "View note",
  "pl.markRead": "Mark read",
  "pl.noHolidays": "No holidays",
  "pl.noNotifications": "None yet",
  "pl.pickTeacher": "Choose a teacher.",
  "pl.seen": "Seen",
  "pl.sent": "Sent",
  "rcp.title": "Receipt","rcp.no": "No. {no}",
  "rcp.student": "Student", "rcp.class": "Class", "rcp.scholar": "Scholar no.", "rcp.invoice": "Invoice", "rcp.when": "Date","rcp.paidBy": "Mode","rcp.by": "By",
  "rcp.amount": "Amount","rcp.balance": "Balance","rcp.note": "Computer generated, no signature needed.","rcp.print": "Print","rcp.pdf": "PDF",
  "rec.title": "Records",
  "cert.title": "Certificates", "cert.none": "No certificates","cert.issued": "Issued {date}", "cert.download": "Download","cert.done": "Downloaded",
  "cert.transfer": "Transfer certificate", "cert.bonafide": "Bonafide certificate", "cert.character": "Character certificate",
  "lib.title": "Library","lib.none": "No books","lib.due": "Due {date}", "lib.overdue": "{n} overdue", "lib.late": "{n} days late", "lib.fine": "Fine {amount}",
  "lib.fines": "Fines","lib.finePaid": "Paid","lib.fineUnpaid": "Unpaid","lib.finePartial": "{amount} left", "lib.fineClosed": "Carried over",
} as const;

export const hiLive: Record<keyof typeof enLive, string> = {
  "nav.records": "रिकॉर्ड",
  "pl.retry": "दोबारा",
  "pl.error": "लोड नहीं हुआ। दोबारा कोशिश करें।",
  "pl.offline": "कनेक्शन नहीं। दोबारा कोशिश करें।",
  "pl.readOnly": "केवल देखें। बच्चे ने स्कूल छोड़ा।",
  "pl.leftNote": "{name} ने स्कूल छोड़ा। केवल देखें।",
  "pl.noChildrenTitle": "कोई बच्चा जुड़ा नहीं",
  "pl.noChildrenText": "स्कूल कार्यालय से पूछें।",

  "pl.overdue": "समय सीमा पार",
  "pl.previousDues": "पिछला बकाया",
  "pl.lateWaived": "विलंब शुल्क माफ़",
  "pl.lateWaivedWhy": "विलंब शुल्क माफ़: {reason}",
  "pl.libOverdue": "{n} किताबें देर से",

  
  "pl.noTimetable": "समय सारणी नहीं",

  "pl.absentMark": "अनुपस्थित",
  "pl.rank": "रैंक {rank}/{n}",
  "pl.attachOptional": "संलग्न फ़ाइल",
  "pl.attach": "फ़ाइल जोड़ें",
  "pl.removeFile": "हटाएँ",
  "pl.fileBig": "{name} 10 MB से बड़ी है।",
  "pl.maxFiles": "अधिकतम {n} फ़ाइलें।",
  "pl.viewNote": "नोट देखें",
  "pl.markRead": "पढ़ा",
  "pl.noHolidays": "कोई छुट्टी नहीं",
  "pl.noNotifications": "अभी कुछ नहीं",
  "pl.pickTeacher": "शिक्षक चुनें।",
  "pl.seen": "देखा गया",
  "pl.sent": "भेजा गया",
  "rcp.title": "रसीद","rcp.no": "क्रमांक {no}",
  "rcp.student": "विद्यार्थी", "rcp.class": "कक्षा", "rcp.scholar": "स्कॉलर नंबर", "rcp.invoice": "बिल", "rcp.when": "तारीख","rcp.paidBy": "तरीका","rcp.by": "प्राप्तकर्ता",
  "rcp.amount": "राशि","rcp.balance": "बाकी","rcp.note": "कंप्यूटर से बनी, हस्ताक्षर ज़रूरी नहीं।","rcp.print": "प्रिंट","rcp.pdf": "PDF",
  "rec.title": "रिकॉर्ड",
  "cert.title": "प्रमाणपत्र", "cert.none": "कोई प्रमाणपत्र नहीं","cert.issued": "जारी: {date}", "cert.download": "डाउनलोड","cert.done": "डाउनलोड हुआ",
  "cert.transfer": "स्थानांतरण प्रमाणपत्र", "cert.bonafide": "बोनाफाइड प्रमाणपत्र", "cert.character": "चरित्र प्रमाणपत्र",
  "lib.title": "पुस्तकालय","lib.none": "कोई किताब नहीं","lib.due": "लौटाने की तारीख {date}", "lib.overdue": "{n} देर से", "lib.late": "{n} दिन देर से", "lib.fine": "जुर्माना {amount}",
  "lib.fines": "जुर्माना","lib.finePaid": "जमा","lib.fineUnpaid": "बाकी","lib.finePartial": "{amount} बाकी", "lib.fineClosed": "आगे बढ़ा",
};
