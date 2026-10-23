# 00 START HERE — Challenger Hub / Focus 4.0 + Orbit Signature
## HANDOFF מלא לשיחה חדשה | 23.10.2026 | השלב הבא: אייקונים מקוריים + צילומי ממשק אמיתיים

**מסמך זה הוא נקודת ההמשך העדכנית.** הוא מחליף את מסמכי 2.6/2.7 כאנדאוף של *עיצוב ופיתוח Focus*, אך אינו מחליף אותם כמקור לפרטי תפעול ה־Production וה־rollback ההיסטוריים.

**מסמך Drive הראשי:** https://docs.google.com/document/d/17F67U_HVlwEcC1odry_551IyzVEfHRODc2lJqwc66GI/edit
**מאגר:** https://github.com/nocturney/challenger-hub
**PR פיתוח/בדיקה פעיל:** https://github.com/nocturney/challenger-hub/pull/14
**גרסת בדיקה:** https://github.com/nocturney/challenger-hub/releases/tag/v4.0.0-orbit-preview.1
**גלריית צילומי מסך אמיתיים:** https://github.com/nocturney/challenger-hub/blob/test/focus-orbit-preview-1/docs/previews/focus-orbit-test-v1/README.md

---

## 01 | מה המשתמש מבקש עכשיו — ממשיכים לבצע, לא מתכננים מחדש

המשתמש אישר בהתלהבות את הארכיטקטורה הנקייה של Focus 4.0 ואת זהות המותג Orbit Signature. הוא ראה מוקאפ AI של דף תוכנה לדוגמה עם אייקון מקורי בצד שמאל ו־screenshot משמעותי בצד ימין, אהב מאוד את הכיוון, וביקש בפירוש: **"מדהים! צא לעבודה, אני רוצה לראות את זה חי :)"**.

ההחלטה המעשית: **לבנות בתוך גרסת בדיקה אמיתית, אינטראקטיבית ומבודדת** דף פרויקט עשיר, עם אייקונים רשמיים של התוכנות וצילומי מסך אותנטיים ומאומתים ממקורותיהן, תוך שמירה על המינימליזם של Focus. גם בקטגוריות רוצים אייקונים קוויים אחידים — אך התמונות בדף הפרויקט הן העדיפות הראשונה. לא מסתפקים במוקאפ AI נוסף ולא במסמך המלצות בלבד.

המשתמש תיקן בצדק הצהרה קודמת של העוזר שאין לו גישה לבצע שינויים: **הגישה קיימת** דרך GitHub ו־Remote Desktop Commander למחשבים המחוברים, וגם Google Drive. יש להשתמש בכלים ולבצע בבטחה, במקום לומר שאין גישה או לבקש ממנו לעשות את העבודה המכנית. אין צורך באישור חדש לעבודת Staging/Preview שאינה משנה Production. אין לפרוס ל־Production, להפעיל התקנות או למזג PR ללא שער אישור נפרד.

## 02 | החלטות עיצוב מאושרות — לא לפתוח אותן מחדש

1. **Focus 4.0** הוא מבנה המידע המועדף: שלושה אזורי עליון בלבד — Explore / My software / Activity. מסך בית עם חיפוש מרכזי ו־17 תחומים; תוצאות בטבלה קריאה; דף פרויקט מלא; ניווט תקין Back/Forward. **ללא** sidebar קבוע, מפת קשרים, כרטיסיות אינסופיות, אפקטים חלליים או ריבוי dashboards.
2. **Orbit Signature** הוא המותג שנבחר: ירוק־מרווה, גרפיט ושמנת; גרסת Flat לכותרת ב־Light, גרסה בהירה מותאמת ל־Dark, אייקון אפליקציה ירוק. אין לחזור לכחול־סגול זוהר. הלוגוטייפ "challenger" נשאר נקי.
3. האייקונים לכל קטגוריה: סט קטן, עקבי, קווי ומינימליסטי, בגוון עדין; לא עיטור לכל רכיב ולא palette חדשה.
4. האייקונים המקוריים של התוכנות: **ברשימות** קטנים לזיהוי מהיר, **בדף הפרויקט** ברורים יותר ליד שם התוכנה. כאשר אין נכס רשמי מאומת, להציג fallback של התחום.
5. **Screenshot אמיתי אחד, גדול ומעודן, בדף התוכנה**, עם מקור ידוע. אין למלא את מסך Explore בתמונות גדולות. 2–3 תמונות נוספות הן הרחבה מותנית בזמינות נכסים אמיתיים ואיכותיים.
6. דף Blender שהודגם ב־23 באוקטובר היה **הדמיית AI, לא צילום מסך אמיתי ולא פיצ'ר שהוטמע**. הנתונים שבהדמיה (דירוג 4.7, כמות ביקורות, "Community verified", כרטיסי תכונות וכו') **אינם נתונים מוכחים של המוצר** ואסור להעתיקם. חשוב: **Blender אינו מופיע כרשומה ב־152 פרויקטי המחקר הנוכחיים**; הדמו הראשוני צריך להתבסס על פרויקט *שקיים באמת* בקטלוג (למשל Compositor או Dune 3D).
7. טקסט UI באנגלית; תקשורת עם המשתמש בעברית. לבצע QA מצילומי מסך של הדפדפן האמיתי, להבדיל בבירור ממוקאפ.

## 03 | מצב הפרויקט המאומת עכשיו — 23.10.2026

מאגר GitHub: nocturney/challenger-hub; קוד זמין, GitHub connector עם גישה, מחשבים עם Desktop Commander. מאומתות שש מכונות Online (Chris, MacMiniOffice.local, Chris-3DPC, Chris-Mini-PC, Mac-Bedroom.local, MacMiniOffice2.local). שני מחשבי הבדיקה הראשיים הם **Chris (Windows)** ו־**MacMiniOffice.local (macOS)**. בתחילת כל שיחה יש לבצע list_devices מחדש — לא להניח ש־device IDs או סטטוסים לא השתנו.

שרשרת PRs (כולם OPEN, Draft, אינם ממוזגים נכון לבדיקה):
- PR #11 — Focus 4.0 architecture: branch concept/focus-v4-task-first → base feat/observatory-v3-architecture; HEAD 5a8ac4740921a8f6bce9a19aa4e2bdec3d044456.
- PR #12 — Orbit Signature integration: branch feat/orbit-signature-brand-v1 → base concept/focus-v4-task-first; HEAD 38bc18e697d3ab8c7e171e07ddf5bb3a1b0a0c8d.
- PR #14 — Standalone offline Preview: branch test/focus-orbit-preview-1 → base feat/orbit-signature-brand-v1; HEAD f47cb2cd600d8ee81a5a2e02bb02956734a51c66.
- **מסקנה:** יש ענפים מדורגים; לא לבצע merge ישיר של PR #14 אל main או להניח שיש feature parity. לעבוד בענף חדש המתבסס על test/focus-orbit-preview-1 או בענף מבודד אחר בהתאם לאסטרטגיית PR ברורה.

גרסת בדיקה שכבר פורסמה והורצה: **v4.0.0-orbit-preview.1**, GitHub Release מסוג **Pre-release** בלבד, עם ZIP ל־Windows ול־macOS.
- Windows download: https://github.com/nocturney/challenger-hub/releases/download/v4.0.0-orbit-preview.1/Challenger-FocusOrbit-PREVIEW-4.0.0-orbit.1-Windows.zip
- macOS download: https://github.com/nocturney/challenger-hub/releases/download/v4.0.0-orbit-preview.1/Challenger-FocusOrbit-PREVIEW-4.0.0-orbit.1-macOS.zip

Preview **4.0.0-orbit.preview.1** עובד מהארכיון המקומי האמיתי, ללא backend חי: 164 רשומות (12 managed + 152 independent), 17 תחומים, 28 תוצאות ל־3D & CAD, 5 ל־Photoshop, מתוכן 73 מועמדי מחקר לא מאומתים להתקנה. **הקטלוג נשמר נכון ל־10.10.2026** ולכן אין להציג אותו כמידע חי. My software ו־Activity בגרסת ה־offline מסומנים כלא זמינים, ולא זייפנו מצב התקנות/תורים.

בדיקות שנעשו בהצלחה: Windows ו־macOS, רוחבים 1590 / 1040 / 768 / 430 / 320, Light/Dark, כניסה לתחומים, חיפוש, dossier, בדיקות מקורות אייקון, 0 שגיאות JS, 0 בקשות כתיבה, 405 לפעולות POST/PUT/DELETE, 73 מועמדים מוגנים. בנוסף **17 מבחני Node** למבנה Focus/Orbit עברו.

מצב שירותים בזמן בדיקה נוכחית: בשני המחשבים 127.0.0.1:17961 פועל ומחזיר GET /api/health עם mode READ_ONLY_OFFLINE_PREVIEW ו־live=false. פורטים 17873 (Production backend) ו־17951 (Focus Stage) **לא פעלו בזמן הבדיקה**; זה אינו אישור למחוק את ההתקנות או להניח ש־Production הוחלף. גרסת התפעול האחרונה שתועדה היא UI 2.7.0 ו־backend 2.5.7.

## 04 | נתיבי עבודה וכלי גישה

Windows Chris:
- Git repo: D:\Velvet\Installers\CraftSuite\ChallengerHub-DiscoveryRepo-v2.6.0
- Focus+Orbit Staging: D:\Velvet\Installers\CraftSuite\Center\FocusCandidate-v4.0.0
- חבילת בדיקה פעילה: D:\Velvet\Installers\CraftSuite\Center\Challenger-FocusOrbit-PREVIEW-4.0.0-orbit.1
- מקור build/QA: <repo>\tools\preview-build\build.cjs, browser-qa.cjs, preview-server.cjs
- תיעוד QA של גרסת הבדיקה: <preview>\_qa\browser-qa.json
- ב־Chris ענף העבודה היה test/focus-orbit-preview-1, clean, בזמן האימות הנוכחי.

macOS MacMiniOffice.local:
- Focus+Orbit Staging: /Users/chris/Library/Application Support/OfficeOps/CraftSuite/Center/FocusCandidate-v4.0.0
- חבילת Preview: /Users/chris/Library/Application Support/OfficeOps/CraftSuite/Center/Challenger-FocusOrbit-PREVIEW-4.0.0-orbit.1
- עותק מקור Preview: /Users/chris/Library/Application Support/OfficeOps/CraftSuite/ChallengerHubFocusOrbitPreviewSource
- Chrome/Edge ו־Node זמינים; אין צורך ב־API בתשלום.

שרת Preview: http://127.0.0.1:17961/ — זמין **רק במחשב שעליו הוא פועל**, קשור ל־127.0.0.1, מציג מידע ארכיוני Read-only. אין לשלוח כתובת localhost למשתמש בטלפון כהבטחה שתיפתח מרחוק. לצפייה מרחוק להשתמש בגלריית GitHub אמיתית, או ב־GitHub Release.

כלים שיש להפעיל בשיחה החדשה בפועל: GitHub connector (fetch_file, PRs, branches), Remote Desktop Commander (list_devices, read_file, edit/write, start_process וקריאת output) ו־Google Drive. לא לטעון שאין אפשרות לעבודה מהממשק. בדיקות/קידוד במחשבים מורשים; להימנע מ־Codex quota כמנוע סוכנים ומ־APIs מחויבים לפי שימוש. אפשר לנצל Claude Code דרך מנוי CLI במידת הצורך, בלי להבטיח זמינות בלתי בדוקה. עבודה מקבילית במסלולים עצמאיים ללא כתיבה מתחרה לאותם קבצים.

## 05 | גילוי חשוב: כבר יש מערכת לאייקונים רשמיים — חובה למחזר

לפני פיתוח מערכת Media חדשה, להסתכל בקוד הקיים:
- official-icons.json: schema challenger-official-icons.v1, **78** רשומות. סטטוסים: source-confirmed = **56**, official-file-confirmed = **19**, not-verified = **3**. כלומר **75** עם סטטוס מקור מאושר/מאומת ב־manifest. אין להסיק מכך שכל 75 הקבצים נגישים ומוצגים כרגע; חייבים לבדוק bytes וחיבור UI.
- official-icons.js: implemention של accepted()/iconMeta()/iconFor(), בדיקת התאמה בין repo למקור, נתיבי GitHub רשמיים, raw.githubusercontent.com מוגבל, MIME/חתימות PNG/SVG/WebP/JPEG/ICO, סינון SVG מסוכן, מגבלת 1.9MB, קאש TTL שבעה ימים, hash וקובצי localDerived במקרים מיוחדים.
- server.js: כבר קיים **GET /api/icon/:repo**; בפרויקטים עצמאיים הוא קורא officialIcons.iconFor(app), וב־managed את המקור הרשמי/מנגנון קיים.
- האפליקציה Focus הנוכחית **עדיין אינה משתמשת בנתיב הזה בממשק**: app.js בונה את תוצאות הטבלה בפונקציה renderRow(a), ואת דף הפרויקט בפונקציה renderDocument(a), בלי רכיב מדיה. renderHome() בונה את disciplineList ו־recentList. הנתיב התפעולי והסכמות הישנות קיימים; אין צורך לפתוח מחדש מחקר גדול לגבי איך להשיג אייקונים.
- 152 רשומות curated, רק 78 כרגע מכוסות ב־manifest; שאר הרשומות ללא אימות מקור מאושר מחייבות fallback ולא שיוך אייקון משוער.

**זה החיסכון המרכזי של השיחה הבאה:** להתחבר קודם לתשתית proven existing, ולא לבנות scraper חדש, לא לשאוב favicon של מותג אחר, לא להשתמש ב־API מסחרי לחיפוש לוגואים.

## 06 | תכנית יישום טכנית נדרשת

**A — הפרדת שכבת מדיה ממדיניות ההתקנות.**
להוסיף manifest ייעודי, למשל project-media.v1.json, עם רשומות ממופות לפי repo ID. לקשר לאייקון הקיים בלי לשכפל לוגיקה, ולהגדיר mediaType, מקור מאומת, copyright/license/attribution כאשר ידוע, תאריך בדיקה, checksum, MIME, מידות, יחס רוחב־גובה, provenance, status (approved / pending / rejected), fallback. אין לשנות installAdapter, reviewStatus או לסמן research candidate כמאומת רק משום שמצאנו תמונה.

**B — official icon.**
ב־Live Staging להשתמש בהגנה/route הקיים GET /api/icon/:repo כל עוד השרת הקיים זמין לקריאה בטוחה. ב־standalone preview האופליין אין route כזה; יש לארוז עותקי מדיה מאומתים בלבד אל נכסים מקומיים, עם manifest hashes, ולהרחיב את whitelist של preview-server.cjs לנתיבים המקומיים החדשים בלבד. אין hotlink חיצוני מהדפדפן ואין חיבור רשת לאתר צד ג' בזמן render. אייקונים שמקורם אינו ניתן לאימות — fallback לתחום. להגן על SVG (ללא scripts, external resources, foreignObject) ועל URL/path traversal.

**C — screenshot authenticity.**
לצילום מוצר להשתמש במקורות שהמפתח/הפרויקט שולטים בהם: README עם תמונת UI אמיתית, docs, אתר מוצר רשמי או screenshot רשמי בריליס. יש לרשום URL מקור, raw asset path, repo owner, תאריך והצהרת רישוי/תנאי שימוש ככל שניתן. לא לבחור promotional artwork בלי ממשק ולא להפוך הדמיית AI או צילומי Blender מלאכותיים ל־"צילום אותנטי". כאשר אין הוכחה/זכויות מתאימות — אין להציג תמונה גדולה; להשתמש ב־placeholder אלגנטי ללא מצג שווא או פשוט להשאיר אזור משלים מטיפוגרפיה ומטא־דאטה.

**D — עמוד Project Dossier.**
לשמור על ההיררכיה הקיימת ולהעשיר חלק עליון בלבד: identity column עם אייקון מאומת 56–72px, שם ותיאור; לצדו צילום ממשק איכותי אחד ביחס 16:9/16:10 עם כיתוב מקור קצר ותצוגה responsive. מתחת להמשיך את עובדות הפרויקט, השוואות תוכנה, release notes, caveats ו־source confidence שכבר קיימים. תמונה אינה משנה את אמינות מטא־הנתונים. אין להוסיף דירוג, ביקורות או תג "Verified" ללא מקור מוסמך.

**E — תוצאות/חיפוש.**
ב־renderRow(a) להוסיף אייקון 24–32px לצד שם התוכנה, בלי לשנות מבנה הטבלה וללא תמונות hero בתוצאות. Home יישאר שקט. תמונות מוטענות Lazy ובמידת האפשר עם מידות קבועות למניעת layout shift. טיפול ב־404, broken image, high DPI, Dark/Light, כותרות ארוכות ו־keyboard focus.

**F — Category icons.**
להגדיר 17 SVG קוויים או להשתמש באוסף Lucide עקבי שכבר זמין בפרויקט אם קיים; אותו stroke, viewBox ומרווח לכל התחומים. לשמור על אפור/גרפיט, עם ירוק Sage רק ל־hover/active. לא להפוך את Home לקיר אייקונים או להסיר את 17 שמות התחומים לטובת סמלים בלבד.

**G — אבטחת קבצים ורישוי.**
Cache של media צריך לשמור checksum, המקור ותוצאת בדיקה. להגדיר מגבלת גודל/פיקסלים, content sniff, MIME, פורמטים מותרים, sanitization, ללא גישה לרשת פרטית ב־media fetcher וללא עקיפת עמודים מוגנים. להפריד screenshot מקור אמיתי ממדיה תדמיתית. לתעד provenance ורישיון בכל פרויקט; אם המקור לא מתיר redistribution, להשאיר קישור למקור או placeholder במקום אריזה ב־ZIP ציבורי.

**H — אמת מצב.**
גרסת הבדיקה האופליין נשענת על ארכיון 10.10.2026. לאחר הוספת רכיבי מדיה להמשיך לסמן ARCHIVED CATALOG / NOT LIVE. My software / Activity אינם נתונים חיים ויש להשאירם מושבתים או מסומנים, לא להציג "12 Installed" אם לא נבדקו בזמן אמת. אין להפעיל production backend רק לשם צילום/נתוני Installed ללא בדיקת תופעות לוואי של scanner.start() ב־server.js.

## 07 | MVP ראשון: פרויקטים אמיתיים בלבד (מועמדים, לא נכסי screenshot מאושרים)

מקורות ה־icon manifest כבר מציינים נכס רשמי/מאומת לפרויקטים הבאים; **זמינות ורישוי screenshot נדרשים לבדיקה פרטנית**. לבחור מדגם מגוון של 10–15 ולדווח לכל אחד כמה הושלמו, כמה fallback:
1. Compositor — Design & Imaging
2. Composa — Design & Imaging
3. Dune 3D — 3D & Manufacturing
4. Material Maker — 3D & Manufacturing
5. Kiri:Moto — 3D & Manufacturing
6. Friction — Video & Motion
7. REAL Video Enhancer — Video & Motion
8. Infinite — Audio & Music
9. Zrythm — Audio & Music
10. EspoCRM — CRM & Sales
11. DocuSeal — Office & Productivity
12. Activepieces — Developer & Automation
13. MeshCentral — Security & Infrastructure
14. OpenHands — AI & Agents

לשלב דף הדגמה ראשון דווקא **Compositor או Dune 3D**, כי הם בקטלוג ויש להם official icon manifest, בניגוד ל־Blender שבמוקאפ. אם לא נמצא screenshot ראוי לאחד מהם, לעבור לפרויקט אחר מהרשימה שיש לו מקור מדיה אמיתי ולדווח בבהירות. **לא לבזבז מחזור פיתוח על השגת כל 14 ה־screenshots לפני הצגת דף עובד אחד.**

## 08 | מסלול ביצוע מומלץ לשיחה הבאה — ממשי ומקבילי

**M1 — Baseline & Branch (שני מחשבים):**
- לבצע list_devices; לוודא מצב repo, PR #14, SHA, והצלחת GET /api/health בפורט 17961 על Chris ו־MacMiniOffice. לא להניח ש־17873/17951 פועלים.
- ליצור ענף עבודה חדש המבוסס על test/focus-orbit-preview-1, למשל feat/focus-project-media-v1. לא לדרוס preview.release.1 ולא למזג ל־main.
- לשמור SHA/checksums של app.js, style.css, index.html, preview-server.cjs, build.cjs, installer/scanner ותמונת מדיה ראשונה. לעבוד רק ב־copy/staging.

**M2 — Asset audit & first genuine media:**
- לשחזר manifest ל־75 אייקונים ממקורות קיימים (בדיקת בקשת HTTP וכשרות bytes במועד העבודה), לדווח coverage נגיש/לא נגיש.
- להשיג 1–3 screenshots ממקור רשמי ניתן לאימות; לתעד מקור, בעלות/רישיון/הגבלות. אין להעתיק תמונות מההדמיה שנוצרה.
- לממש אחסון מקומי מאושר ונעול ב־preview, לא fetch אקראי בזמן render.

**M3 — Real live-feeling UI:**
- לממש renderRow אייקון+fallback.
- לממש renderDocument header עם genuine icon + genuine preview, נקי ודומה להיררכיה שאהב המשתמש; להציג gallery רק אם 2–3 מקורות טובים.
- להוסיף category icons מינימליסטיים ל־17 תחומים אם לא פוגע בקצב. לשמור על Orbit וטיפוגרפיית Focus.
- לבדוק ב־Chris וב־Mac בדפדפן אמיתי ולהציג **תמונות QA מקוריות** מהתוצאה, לא מוקאפ.

**M4 — Broaden + QA:**
- להרחיב ל־10–15 רשומות בהתאם לזמינות screenshot מורשה.
- בדיקות unit/contract + browser: 1590 / 1040 / 768 / 430 / 320, light/dark, 17 domains, 164 records, 28 3D, 5 Photoshop, project dossier, favicon/Orbit, screenshot loading, missing image fallback, alt/captions, shift/overflow, disconnected state, no fake badges/ratings, restricted research untouched, zero JS errors, 0 POST/PUT/DELETE.
- לוודא שאין שינוי בקבצי backend, installer, registry/scanner; להשתמש בהשוואת checksum.
- לדווח מה עובד/מה לא; לא להציג screenshot כ־source-verified בלי מסמך מקור.

**M5 — Deliverable:**
- Preview v4.0.0-orbit.preview.2 נפרד מ־preview.1, או תג גרסת מבחן חדש שלא מוחק ישן.
- ZIP נבדק ל־Windows/macOS; SHA256; הוראות הפעלה על localhost בפורט אחר אם .1 עדיין פועל.
- Draft PR נפרד וקישורי גלריית PNG אמתית; Pre-release בלבד, עם Change log ומבחנים אמיתיים.
- לשתף את המשתמש בדף הפרויקט החי ראשון, ורק אחר כך להרחיב את כל הרשימה.

ניתן לחלק עבודה עצמאית במקביל: ביקורת מקור/רישוי של media; פיתוח רכיב UI; בדיקות וייצוא סטטי — אבל לא לשתף אותו workspace בשתי כתיבות סותרות. אין לנצל Codex quota כמנוע סוכנים או API מחויב ללא אישור.

## 09 | Definition of Done — איפה עוצרים עם מסירה מוחשית

DONE רק כאשר:
[ ] דף *אחד לפחות* של פרויקט אמיתי בקטלוג מציג לוגו רשמי עם אסמכתא ו־screenshot מוצר אותנטי ומורשה; מסומן במפורש מקור.
[ ] חסרי media מקבלים fallback אלגנטי שאינו משקר.
[ ] רשימת תוצאות מציגה אייקונים קטנים בלי להרוס את הטבלה וה־mobile.
[ ] אייקוני קטגוריה מינימליסטיים משתלבים בלי להפוך את Home לעמוס.
[ ] Preview חדש בר־הפעלה מקומית; עובד ב־Windows ו־macOS; אין שינוי Production.
[ ] QA בדפדפן האמיתי משני המחשבים כולל screenshot gallery ותוצאות PASS/FAIL, בדיקות offline ו־no writes.
[ ] Draft PR וקובצי build/release מתועדים; קישורים עובדים; לא ממוזגים בלי אישור.
[ ] מיפוי coverage: מאומת, ממתין, חסר — לא הבטחה מעורפלת שכל 164 הדפים מצוידים בתמונות.

מגבלה נפרדת שעדיין נשארת: **Focus 4.0 עדיין אינו מחליף תפעולית את UI 2.7.0**; התקנות/עדכונים/הפעלה/מקורות ושחזור עדיין לא הוחזרו ל־Focus החדש. זה Milestone עתידי משמעותי עם שער Production עצמאי, לא חלק מהצגת המדיה.

## 10 | הפניות לתיעוד קודם ולקוד

- Focus architecture: https://github.com/nocturney/challenger-hub/blob/concept/focus-v4-task-first/docs/FOCUS_V4_ARCHITECTURE.md
- Orbit brand v1: https://github.com/nocturney/challenger-hub/blob/feat/orbit-signature-brand-v1/docs/ORBIT_SIGNATURE_BRAND_V1.md
- Preview 1 manual: https://github.com/nocturney/challenger-hub/blob/test/focus-orbit-preview-1/tools/preview-build/README.md
- Focus/Orbit photos (real): https://github.com/nocturney/challenger-hub/blob/test/focus-orbit-preview-1/docs/previews/focus-orbit-test-v1/README.md
- Official image infrastructure: https://github.com/nocturney/challenger-hub/blob/test/focus-orbit-preview-1/official-icons.js
- Image manifest: https://github.com/nocturney/challenger-hub/blob/test/focus-orbit-preview-1/official-icons.json
- Current Focus rendering: https://github.com/nocturney/challenger-hub/blob/test/focus-orbit-preview-1/app.js
- Operational icon route/backend: https://github.com/nocturney/challenger-hub/blob/test/focus-orbit-preview-1/server.js
- Old production handoff 2.7.0 (historical source, not Focus media): https://docs.google.com/document/d/1pMP44oho6Snmrd2otY2rtKrlQyo-vmH98dBRTu1UkLI/edit

## 11 | פקודת המשך מומלצת — להדביק לשיחה חדשה

המשך בביצוע Challenger Hub Focus 4.0 + Orbit Signature על סמך האנדאוף הזה (Google Doc וקובץ GitHub). אל תסתפק בהצעות או במוקאפ נוסף. יש לך GitHub + Desktop Commander מול שישה מחשבים + Google Drive; גלה ובדוק את הכלים מחדש ופעל. קודם מחזר את official-icons.js / official-icons.json / GET /api/icon/:repo הקיימים, ואז הטמע אייקונים רשמיים אמיתיים וצילום ממשק מאומת בדף פרויקט אמיתי מתוך 164 הרשומות, כולל fallback; הוסף אייקונים מינימליסטיים לקטגוריות בלי להרוס את Focus 4. בנה Preview v2 נפרד ונעול לכתיבה, בדוק ב־Windows/macOS והעלה Draft PR, screenshots אמיתיים ו־Pre-release. אין לגעת ב־Production או למזג ללא אישור נפרד. דיווח על תוצאות ממשיות בלבד, ללא נתוני מקור מומצאים, ללא API בתשלום או Codex quota כסוכן.

---

## 12 | סטטוס ההאנדאוף עצמו

נוצר לשימור רציפות עבודה לשיחה חדשה בתאריך 23.10.2026. **אין לפרש את המסמך כאילו פיתוח מערכת snapshots כבר הושלם** — הוא ה־next milestone. ההכנה והפרסום של Preview 1, ה־QA, Orbit Signature ו־Focus 4 הם החלקים שכבר בוצעו. המוקאפ Blender הוא ויזואליזציה בלבד.

שינויי תוכן במסמך GitHub צריכים להישאר בענף הבדיקות / PR Draft, לא בפריסת Production.