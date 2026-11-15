export type Language = "en" | "hi" | "mr" | "bn";

export const LANGUAGES: Array<{ id: Language; label: string }> = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिन्दी" },
  { id: "mr", label: "मराठी" },
  { id: "bn", label: "বাংলা" },
];

type Copy = {
  nav: { home: string; globe: string; atlas: string; investigate: string; learn: string; data: string; dataMethod: string };
  language: string;
  footerData: string;
  footerNote: string;
  footerLink: string;
  learn: {
    eyebrow: string;
    title: string;
    intro: string;
    readTitle: string;
    cards: Array<{ title: string; text: string }>;
    glossary: string;
  };
  assistant: {
    open: string;
    close: string;
    title: string;
    ai: string;
    catalogue: string;
    simple: string;
    expert: string;
    find: string;
    prompt: string;
    choose: string;
    scan: string;
    scanning: string;
    ask: string;
    key: string;
    connect: string;
    noResult: string;
  };
  site: {
    homeHeadline: string; homeIntro: string; investigate: string; explore: string; atlasTitle: string; atlasText: string; atlasButton: string; finished: string; how: string; demos: string; honest: string;
    aboutEyebrow: string; aboutTitle: string; aboutIntro: string; data: string; statistics: string; sources: string; privacy: string; limits: string; references: string; variables: string; aiUse: string;
  };
  flow: { what: string; where: string; when: string; results: string; chooseVariable: string; choosePlace: string; chooseYears: string; readEvidence: string };
};

const english: Copy = {
  nav: { home: "Home", globe: "Globe", atlas: "Atlas", investigate: "Investigate", learn: "Learn", data: "Data", dataMethod: "Data & method" },
  language: "Language",
  footerData: "Data: NASA POWER (MERRA-2) and NASA GIBS. Not endorsed by NASA.",
  footerNote: "NASA Space Apps Challenge 2026, Nagpur. Results describe trends, not causes.",
  footerLink: "Data, method and privacy",
  learn: {
    eyebrow: "Learn",
    title: "The detective's handbook",
    intro: "A simple guide to turn a wiggly line into a careful answer.",
    readTitle: "How to read a result",
    cards: [
      { title: "1. Look at the line", text: "Each dot is one year. The white line shows the usual rate of change. The shaded band shows the uncertainty." },
      { title: "2. Read the verdict", text: "Significant means the pattern is steady enough to stand out. Not significant means the data cannot separate a trend from normal ups and downs." },
      { title: "3. Ask how big", text: "A small change can be clear. A big change can still be uncertain when the years jump around. Compare it with the average." },
      { title: "4. Check the warnings", text: "Short records, similar years, and different methods can make an answer less certain." },
    ],
    glossary: "Simple glossary",
  },
  assistant: {
    open: "Open result helper",
    close: "Close result helper",
    title: "RESULT HELPER",
    ai: "AI explanation",
    catalogue: "Catalogue only",
    simple: "simple",
    expert: "expert",
    find: "Find useful variables",
    prompt: "Describe a place or question",
    choose: "Choose variables from the list, then run the scan.",
    scan: "Scan real NASA POWER data…",
    scanning: "Scanning real NASA POWER data…",
    ask: "Ask about the computed result",
    key: "Gemini key (optional)",
    connect: "Connect",
    noResult: "No analysis has been run yet. Run an analysis first; I can then explain its result.",
  },
  site: { homeHeadline: "Is this place really changing, or is it just a wet year?", homeIntro: "Pick a place. TERRASCAN gets real NASA data and tests whether rain, heat, humidity or sunshine is changing.", investigate: "Investigate a place", explore: "Explore the globe", atlasTitle: "Which Vidarbha districts are really changing?", atlasText: "Run the same careful test for all 11 districts.", atlasButton: "Open the Vidarbha atlas", finished: "A finished investigation", how: "How a detective works", demos: "Try a demo investigation", honest: "Honest by design", aboutEyebrow: "Data and method", aboutTitle: "What is under the hood", aboutIntro: "TERRASCAN asks NASA for data and does the statistics on your device.", data: "Data", statistics: "Statistics", sources: "NASA data and partner resources", privacy: "Privacy", limits: "Limits you should know", references: "References", variables: "Variables", aiUse: "AI use" },
  flow: { what: "What?", where: "Where?", when: "When?", results: "Results", chooseVariable: "Choose a variable", choosePlace: "Choose a place", chooseYears: "Choose years", readEvidence: "Read the evidence" },
};

const translations: Record<Exclude<Language, "en">, Copy> = {
  hi: {
    nav: { home: "होम", globe: "ग्लोब", atlas: "एटलस", investigate: "जाँच", learn: "सीखें", data: "डेटा", dataMethod: "डेटा और तरीका" },
    language: "भाषा", footerData: "डेटा: NASA POWER (MERRA-2) और NASA GIBS। NASA ने इसका समर्थन नहीं किया है।", footerNote: "NASA Space Apps Challenge 2026, नागपुर। नतीजे रुझान बताते हैं, कारण नहीं।", footerLink: "डेटा, तरीका और निजता",
    learn: { eyebrow: "सीखें", title: "जासूस की छोटी किताब", intro: "टेढ़ी-मेढ़ी लाइन को समझने का आसान तरीका।", readTitle: "नतीजा कैसे पढ़ें", cards: [{ title: "1. लाइन देखें", text: "हर बिंदु एक साल है। सफेद लाइन बदलाव की सामान्य गति दिखाती है। छाया अनिश्चितता दिखाती है।" }, { title: "2. नतीजा पढ़ें", text: "महत्वपूर्ण का मतलब है कि पैटर्न साफ है। महत्वपूर्ण नहीं का मतलब है कि डेटा सामान्य उतार-चढ़ाव से अलग रुझान नहीं बता पा रहा।" }, { title: "3. बदलाव कितना है?", text: "छोटा बदलाव भी साफ हो सकता है। बहुत उतार-चढ़ाव हो तो बड़ा बदलाव भी पक्का नहीं होता। इसे औसत से मिलाएँ।" }, { title: "4. चेतावनी देखें", text: "कम साल, मिलते-जुलते साल और अलग तरीके नतीजे को कम पक्का बना सकते हैं।" }], glossary: "आसान शब्दावली" },
    assistant: { open: "नतीजा सहायक खोलें", close: "नतीजा सहायक बंद करें", title: "नतीजा सहायक", ai: "AI समझ", catalogue: "सूची", simple: "आसान", expert: "विशेषज्ञ", find: "काम के चर खोजें", prompt: "जगह या सवाल लिखें", choose: "सूची से चर चुनें, फिर स्कैन चलाएँ।", scan: "असली NASA POWER डेटा स्कैन करें…", scanning: "असली NASA POWER डेटा स्कैन हो रहा है…", ask: "गणना किए नतीजे के बारे में पूछें", key: "Gemini कुंजी (वैकल्पिक)", connect: "जोड़ें", noResult: "अभी कोई विश्लेषण नहीं चला है। पहले विश्लेषण चलाएँ; फिर मैं उसका नतीजा समझाऊँगा।" },
    site: { homeHeadline: "क्या यह जगह सच में बदल रही है, या यह बस एक गीला साल है?", homeIntro: "जगह चुनें। TERRASCAN असली NASA डेटा लेकर बारिश, गर्मी, नमी या धूप में बदलाव जाँचता है।", investigate: "जगह की जाँच करें", explore: "ग्लोब देखें", atlasTitle: "विदर्भ के कौन से जिले सच में बदल रहे हैं?", atlasText: "सभी 11 जिलों के लिए एक ही सावधान जाँच चलाएँ।", atlasButton: "विदर्भ एटलस खोलें", finished: "एक पूरा विश्लेषण", how: "जाँच कैसे होती है", demos: "डेमो जाँच आज़माएँ", honest: "ईमानदार डिज़ाइन", aboutEyebrow: "डेटा और तरीका", aboutTitle: "अंदर क्या है", aboutIntro: "TERRASCAN NASA से डेटा लेता है और आपके डिवाइस पर गणना करता है।", data: "डेटा", statistics: "आँकड़े", sources: "NASA डेटा और साथी स्रोत", privacy: "निजता", limits: "सीमाएँ", references: "संदर्भ", variables: "चर", aiUse: "AI का उपयोग" },
    flow: { what: "क्या?", where: "कहाँ?", when: "कब?", results: "नतीजे", chooseVariable: "चर चुनें", choosePlace: "जगह चुनें", chooseYears: "साल चुनें", readEvidence: "सबूत पढ़ें" },
  },
  mr: {
    nav: { home: "मुख्यपृष्ठ", globe: "ग्लोब", atlas: "अॅटलस", investigate: "तपासा", learn: "शिका", data: "डेटा", dataMethod: "डेटा आणि पद्धत" },
    language: "भाषा", footerData: "डेटा: NASA POWER (MERRA-2) आणि NASA GIBS. NASAचा अधिकृत पाठिंबा नाही.", footerNote: "NASA Space Apps Challenge 2026, नागपूर. निकाल कल दाखवतात, कारण नाही.", footerLink: "डेटा, पद्धत आणि गोपनीयता",
    learn: { eyebrow: "शिका", title: "तपासकाची छोटी पुस्तिका", intro: "वर-खाली होणारी रेषा सोप्या भाषेत समजून घ्या.", readTitle: "निकाल कसा वाचायचा", cards: [{ title: "1. रेषा पहा", text: "प्रत्येक बिंदू एक वर्ष आहे. पांढरी रेषा बदलाचा नेहमीचा वेग दाखवते. सावली अनिश्चितता दाखवते." }, { title: "2. निष्कर्ष वाचा", text: "महत्त्वाचा म्हणजे कल पुरेसा स्पष्ट आहे. महत्त्वाचा नाही म्हणजे सामान्य चढ-उतारांपेक्षा वेगळा कल डेटा सांगत नाही." }, { title: "3. बदल किती?", text: "लहान बदलही स्पष्ट असू शकतो. वर्षे खूप बदलत असतील तर मोठा बदलही नक्की नसतो. सरासरीशी तुलना करा." }, { title: "4. सूचना पहा", text: "कमी वर्षे, सारखी वर्षे आणि वेगवेगळ्या पद्धती निकाल कमी खात्रीचे करू शकतात." }], glossary: "सोपे शब्द" },
    assistant: { open: "निकाल मदतनीस उघडा", close: "निकाल मदतनीस बंद करा", title: "निकाल मदतनीस", ai: "AI स्पष्टीकरण", catalogue: "यादी", simple: "सोपे", expert: "तज्ज्ञ", find: "उपयुक्त चल शोधा", prompt: "ठिकाण किंवा प्रश्न लिहा", choose: "यादीतून चल निवडा आणि स्कॅन चालवा.", scan: "खरा NASA POWER डेटा स्कॅन करा…", scanning: "खरा NASA POWER डेटा स्कॅन होत आहे…", ask: "गणना केलेल्या निकालाबद्दल विचारा", key: "Gemini की (पर्यायी)", connect: "जोडा", noResult: "अजून विश्लेषण झालेले नाही. आधी विश्लेषण चालवा; मग मी त्याचा निकाल समजावेन." },
    site: { homeHeadline: "ही जागा खरोखर बदलत आहे का, की हे फक्त पावसाळी वर्ष आहे?", homeIntro: "जागा निवडा. TERRASCAN खरा NASA डेटा घेऊन पाऊस, उष्णता, आर्द्रता किंवा सूर्यप्रकाश बदलतो का ते तपासते.", investigate: "जागा तपासा", explore: "ग्लोब पहा", atlasTitle: "विदर्भातील कोणते जिल्हे खरोखर बदलत आहेत?", atlasText: "सर्व 11 जिल्ह्यांसाठी समान काळजीपूर्वक चाचणी चालवा.", atlasButton: "विदर्भ अॅटलस उघडा", finished: "पूर्ण झालेली तपासणी", how: "तपासणी कशी होते", demos: "डेमो तपासणी वापरा", honest: "प्रामाणिक रचना", aboutEyebrow: "डेटा आणि पद्धत", aboutTitle: "आत काय आहे", aboutIntro: "TERRASCAN NASAकडून डेटा घेते आणि तुमच्या साधनावर गणना करते.", data: "डेटा", statistics: "आकडेवारी", sources: "NASA डेटा आणि साथीचे स्रोत", privacy: "गोपनीयता", limits: "मर्यादा", references: "संदर्भ", variables: "चल", aiUse: "AI वापर" },
    flow: { what: "काय?", where: "कुठे?", when: "कधी?", results: "निकाल", chooseVariable: "चल निवडा", choosePlace: "जागा निवडा", chooseYears: "वर्षे निवडा", readEvidence: "पुरावा वाचा" },
  },
  bn: {
    nav: { home: "হোম", globe: "গ্লোব", atlas: "অ্যাটলাস", investigate: "তদন্ত", learn: "শিখুন", data: "ডেটা", dataMethod: "ডেটা ও পদ্ধতি" },
    language: "ভাষা", footerData: "ডেটা: NASA POWER (MERRA-2) এবং NASA GIBS। NASA এটি অনুমোদন করেনি।", footerNote: "NASA Space Apps Challenge 2026, নাগপুর। ফলাফল প্রবণতা দেখায়, কারণ নয়।", footerLink: "ডেটা, পদ্ধতি ও গোপনীয়তা",
    learn: { eyebrow: "শিখুন", title: "তদন্তকারীর ছোট বই", intro: "ওঠানামা করা রেখা সহজে বোঝার পথ।", readTitle: "ফলাফল কীভাবে পড়বেন", cards: [{ title: "১. রেখা দেখুন", text: "প্রতিটি বিন্দু একটি বছর। সাদা রেখা বদলের সাধারণ গতি দেখায়। ছায়া অনিশ্চয়তা দেখায়।" }, { title: "২. সিদ্ধান্ত পড়ুন", text: "গুরুত্বপূর্ণ মানে ধারা স্পষ্ট। গুরুত্বপূর্ণ নয় মানে স্বাভাবিক ওঠানামা থেকে আলাদা ধারা ডেটা বলতে পারছে না।" }, { title: "৩. বদল কতটা?", text: "ছোট বদলও স্পষ্ট হতে পারে। বছরগুলো বেশি বদলালে বড় বদলও নিশ্চিত নয়। গড়ের সঙ্গে তুলনা করুন।" }, { title: "৪. সতর্কতা দেখুন", text: "কম বছর, কাছাকাছি বছর ও আলাদা পদ্ধতি ফলকে কম নিশ্চিত করতে পারে।" }], glossary: "সহজ শব্দকোষ" },
    assistant: { open: "ফল সহায়ক খুলুন", close: "ফল সহায়ক বন্ধ করুন", title: "ফল সহায়ক", ai: "AI ব্যাখ্যা", catalogue: "তালিকা", simple: "সহজ", expert: "বিশেষজ্ঞ", find: "দরকারি চলক খুঁজুন", prompt: "জায়গা বা প্রশ্ন লিখুন", choose: "তালিকা থেকে চলক বাছুন, তারপর স্ক্যান চালান।", scan: "আসল NASA POWER ডেটা স্ক্যান করুন…", scanning: "আসল NASA POWER ডেটা স্ক্যান হচ্ছে…", ask: "গণনা করা ফল সম্পর্কে জিজ্ঞাসা করুন", key: "Gemini কী (ঐচ্ছিক)", connect: "যোগ করুন", noResult: "এখনও কোনো বিশ্লেষণ চালানো হয়নি। আগে বিশ্লেষণ চালান; তারপর আমি ফল বুঝিয়ে দেব।" },
    site: { homeHeadline: "এই জায়গাটি কি সত্যিই বদলাচ্ছে, নাকি এটি শুধু একটি ভেজা বছর?", homeIntro: "একটি জায়গা বাছুন। TERRASCAN আসল NASA ডেটা নিয়ে বৃষ্টি, তাপ, আর্দ্রতা বা সূর্যের আলো বদলাচ্ছে কি না পরীক্ষা করে।", investigate: "জায়গা তদন্ত করুন", explore: "গ্লোব দেখুন", atlasTitle: "বিদর্ভের কোন জেলাগুলি সত্যিই বদলাচ্ছে?", atlasText: "সব ১১টি জেলার জন্য একই সতর্ক পরীক্ষা চালান।", atlasButton: "বিদর্ভ অ্যাটলাস খুলুন", finished: "একটি সম্পূর্ণ তদন্ত", how: "তদন্ত কীভাবে হয়", demos: "একটি ডেমো দেখুন", honest: "সৎ নকশা", aboutEyebrow: "ডেটা ও পদ্ধতি", aboutTitle: "ভেতরে কী আছে", aboutIntro: "TERRASCAN NASA থেকে ডেটা নেয় এবং আপনার ডিভাইসে হিসাব করে।", data: "ডেটা", statistics: "পরিসংখ্যান", sources: "NASA ডেটা ও সঙ্গী উৎস", privacy: "গোপনীয়তা", limits: "যা জানা দরকার", references: "তথ্যসূত্র", variables: "চলক", aiUse: "AI ব্যবহার" },
    flow: { what: "কী?", where: "কোথায়?", when: "কখন?", results: "ফলাফল", chooseVariable: "চলক বাছুন", choosePlace: "জায়গা বাছুন", chooseYears: "বছর বাছুন", readEvidence: "প্রমাণ পড়ুন" },
  },
};

export function getCopy(language: Language): Copy {
  return language === "en" ? english : translations[language];
}
