/**
 * ============================================================
 * HELP CONTENT - one registry, three doors in
 * ============================================================
 *
 * Every piece of portal guidance lives here: the searchable topics behind the
 * help bubble, the text behind every "?" mark, and the welcome tour's stops.
 * Write a topic once and it is findable all three ways; there is no second
 * copy anywhere to drift out of date.
 *
 * VOICE: pastor-facing, same register as the tabs themselves. "On your
 * website", never "published". No church-specific content - this file is
 * platform chrome shared by every tenant, so nothing here may mention
 * trucking, CFT, or any one church's setup (the same rule as lib/legal.ts).
 *
 * Plain data, deliberately importable from client components: the search box
 * runs in the browser over this array. At ~35 topics of short prose the cost
 * is a few KB gzipped in an authed admin area, which is fine - if this ever
 * grows devotionals-sized, split the topic bodies behind a dynamic import.
 *
 * ASCII straight quotes only (ground rule 7).
 */

export type HelpTopic = {
  /** Stable id, referenced by HelpMark call sites: "prayer.flow". */
  id: string;
  /** The portal route this topic belongs to, for the "On this page" group. */
  tab: string;
  /** Sidebar label of that tab, shown as the group heading in the panel. */
  tabLabel: string;
  title: string;
  /** Paragraphs. Short - two or three sentences each. */
  body: string[];
  /** What a pastor might type into search. Lowercase. */
  keywords: string[];
};

export type TourStep = {
  /**
   * CSS selector for the element to highlight, or null for a centered card.
   * Sidebar links carry data-tour="<href>"; group headers carry
   * data-tour-group="<label>". A selector that matches nothing falls back to
   * a centered card and warns in development - see welcome-tour.tsx.
   */
  target: string | null;
  title: string;
  body: string;
  /** Whether the mobile sidebar drawer must be open for this step. */
  inSidebar?: boolean;
};

/* ------------------------------------------------------------------ */
/* Topics                                                              */
/* ------------------------------------------------------------------ */

export const HELP_TOPICS: HelpTopic[] = [
  /* ---- Home ---- */
  {
    id: "home.overview",
    tab: "/portal",
    tabLabel: "Home",
    title: "What this page shows",
    body: [
      "This is a quick look at your website right now: how many sermons and events you have, how many announcements are showing, and whether any prayer requests are waiting for you.",
      "Nothing is edited here. Each number lives in its own tab in the sidebar - the counts just tell you where something needs your attention.",
    ],
    keywords: ["dashboard", "home", "counts", "overview", "start"],
  },

  /* ---- Edit My Website ---- */
  {
    id: "website.editing",
    tab: "/portal/website",
    tabLabel: "Edit My Website",
    title: "How editing works here",
    body: [
      "Every page of your website is made of sections, listed here in the order visitors see them. Open a section with \"Edit\" to change what it says.",
      "There is no save button for the words - your changes save by themselves about a second after you stop typing, and they are live on your website straight away. \"Saved and live on the website\" at the bottom of the card confirms each save.",
      "The arrows move a section up or down the page. The \"Show on my website\" checkbox takes a section off your website without losing what it says - untick it and the words wait here until you want them back.",
    ],
    keywords: ["edit", "save", "autosave", "words", "text", "section", "hide", "show", "reorder", "move"],
  },
  {
    id: "website.pages",
    tab: "/portal/website",
    tabLabel: "Edit My Website",
    title: "Switching between pages",
    body: [
      "The row of buttons at the top is your website's pages - Home, About, Visit and the rest. Pick one to see and edit that page's sections.",
      "You are always editing the page named on the button you picked, in the order a visitor scrolls it.",
    ],
    keywords: ["pages", "switch", "home page", "about", "visit", "which page"],
  },
  {
    id: "website.photos",
    tab: "/portal/website",
    tabLabel: "Edit My Website",
    title: "Photos inside sections",
    body: [
      "Where a section has a photo, the field opens a picker over your photo library - the same photos you uploaded in the Photos tab. Upload there once, use them anywhere here.",
      "You can also paste a web address directly if the picture lives somewhere else.",
    ],
    keywords: ["photo", "image", "picture", "banner", "picker", "library"],
  },

  /* ---- Church Details ---- */
  {
    id: "details.identity",
    tab: "/portal/details",
    tabLabel: "Church Details",
    title: "Name and contact details",
    body: [
      "Your church's name, tagline, address, phone and email. These appear in your website's header, its footer, and on your contact page - change them once here and every page updates.",
    ],
    keywords: ["name", "address", "phone", "email", "tagline", "contact"],
  },
  {
    id: "details.services",
    tab: "/portal/details",
    tabLabel: "Church Details",
    title: "Service times",
    body: [
      "When your church meets. Each line has a day, a time, an optional label like \"Bible study\", and a note for whether it is streamed.",
      "These show on your website's home page and visit page, and on your portal home.",
    ],
    keywords: ["service", "times", "meet", "sunday", "schedule", "when", "streamed"],
  },
  {
    id: "details.branding",
    tab: "/portal/details",
    tabLabel: "Church Details",
    title: "Colors and logo",
    body: [
      "Your website's three colors and your logo. Changing a color restyles your whole website at once - buttons, headings, highlights, everything.",
      "The logo picker uses your photo library, so upload the logo in the Photos tab first if it is not there yet.",
    ],
    keywords: ["color", "colours", "logo", "brand", "branding", "theme", "look"],
  },
  {
    id: "details.links",
    tab: "/portal/details",
    tabLabel: "Church Details",
    title: "Giving, video and social links",
    body: [
      "Three kinds of links live here. Giving is where your website's Give button sends people. Video channels are your YouTube channels - sermons can say which one they came from. Social is your church's own accounts, shown in your website's footer.",
      "If you have more than one giving or video link, \"Use this one\" marks which is the main one. Only the main giving link gets the Give button.",
      "Looking for giving reports or transaction history? Those live in your Tithe.ly dashboard, not here - there is a link to it above the giving list.",
    ],
    keywords: ["give", "giving", "tithely", "tithe.ly", "youtube", "channel", "facebook", "social", "links", "reports", "donations"],
  },

  /* ---- Photos ---- */
  {
    id: "photos.upload",
    tab: "/portal/photos",
    tabLabel: "Photos",
    title: "Upload once, use anywhere",
    body: [
      "This is your photo library. Upload a photo here and every other tab can use it - an event, a person on your team, your logo, a page banner - without uploading it again.",
      "Photos are automatically shrunk to a sensible size before they upload, so a full-size phone photo will not slow your website down or eat your data.",
    ],
    keywords: ["upload", "photo", "picture", "image", "library", "add photo", "size"],
  },
  {
    id: "photos.gallery",
    tab: "/portal/photos",
    tabLabel: "Photos",
    title: "The public photo gallery",
    body: [
      "Each photo has a checkbox for your website's photo gallery. Ticked, the photo appears there for visitors; unticked, it stays in your library for your own use only.",
      "Uploading a photo does not put it in the gallery by itself - you choose.",
    ],
    keywords: ["gallery", "public", "show", "visitors"],
  },
  {
    id: "photos.remove",
    tab: "/portal/photos",
    tabLabel: "Photos",
    title: "Removing a photo",
    body: [
      "Before a photo is removed, the portal checks where it is being used - an event, a team member, a page section - and tells you, so nothing on your website loses its picture by surprise.",
      "Give photos a short title and a description of what is in them; the description is read aloud to visitors who use a screen reader.",
    ],
    keywords: ["remove", "delete", "used", "where", "alt text", "description"],
  },

  /* ---- Announcements ---- */
  {
    id: "announcements.overview",
    tab: "/portal/announcements",
    tabLabel: "Announcements",
    title: "How announcements work",
    body: [
      "Announcements appear on your website's home page. A new one stays off your website until you tick \"Show on my website\", so you can write it before anyone sees it.",
      "The arrows set the order they appear in. The top announcement here is the top announcement on your website.",
    ],
    keywords: ["announcement", "bulletin", "notice", "post", "order"],
  },
  {
    id: "announcements.expiry",
    tab: "/portal/announcements",
    tabLabel: "Announcements",
    title: "Take it down on a date",
    body: [
      "Give an announcement a take-down date and it removes itself from your website after that day - no tidying up needed. This is the easiest way to keep the board from filling with old notices.",
      "An expired announcement stays in this list, marked, so you can find it again or reuse it. Leave the date blank to keep an announcement up until you take it down yourself.",
    ],
    keywords: ["expire", "expiry", "date", "take down", "remove", "old"],
  },

  /* ---- Prayer Wall ---- */
  {
    id: "prayer.flow",
    tab: "/portal/prayer",
    tabLabel: "Prayer Wall",
    title: "Where requests go",
    body: [
      "When someone sends a prayer request from your website, it lands in \"Needs your eye\" - nothing appears publicly until you decide.",
      "From there each request goes one of four ways: onto your public prayer wall, kept private (prayed over but never published), archived (dealt with, kept for the record), or deleted for good.",
      "Private and Archived are folded away below, not gone - open them any time to reconsider a request.",
    ],
    keywords: ["prayer", "request", "pending", "moderate", "approve", "wall", "waiting"],
  },
  {
    id: "prayer.approve",
    tab: "/portal/prayer",
    tabLabel: "Prayer Wall",
    title: "Putting a request on the wall",
    body: [
      "Before you publish a request, you choose the name that shows with it. People often sign with more than they would want public - trim it to a first name, or leave the box blank to post it anonymously.",
      "\"Put it on the wall\" publishes it to your website immediately, where visitors can tap that they have prayed for it.",
    ],
    keywords: ["approve", "publish", "name", "anonymous", "wall"],
  },
  {
    id: "prayer.private",
    tab: "/portal/prayer",
    tabLabel: "Prayer Wall",
    title: "Keep private, archive, or delete?",
    body: [
      "\"Keep private\" is for a request someone would want read and prayed over but not posted - a diagnosis, a family matter. It is a real choice, not a rejection.",
      "\"Archive\" sets a request aside: dealt with, kept for the record, never published. Delete is underneath for the rare request that should not be kept at all - it cannot be undone.",
      "\"Take it down\" on a published request returns it to the unread pile - the undo for publishing.",
    ],
    keywords: ["private", "archive", "delete", "take down", "hide", "reject"],
  },

  /* ---- Sermon Builder ---- */
  {
    id: "builder.how",
    tab: "/portal/sermon-builder",
    tabLabel: "Sermon Builder",
    title: "What the Sermon Builder is for",
    body: [
      "It writes a full first draft - usually 2000 to 3000 words - from what you tell it: a passage, a style, and the direction you want the message to take. Think of it as a study partner who types fast, not as the preacher. The words become yours when you edit them.",
      "It is most useful on the weeks when the passage is chosen and the shape is not, or when you know what you want to say and the blank page is the obstacle. It is least useful when you already have the sermon in your head - then it is faster to write it yourself.",
      "The sermon is written in front of you and saves itself as a draft the moment it finishes. Nothing appears on your website until you publish it.",
    ],
    keywords: ["generate", "ai", "write", "sermon builder", "draft", "what is", "when to use"],
  },
  {
    id: "builder.form",
    tab: "/portal/sermon-builder",
    tabLabel: "Sermon Builder",
    title: "Filling in the form",
    body: [
      "Title is the only thing required, and a working title is fine - you can change it after you read the draft. Service date sets the sermon's date; leave it blank and you can add it later.",
      "The passage is picked book, then chapter, then verses (\"1-10\", or leave blank for the whole chapter). The chapter list only offers chapters the book actually has.",
      "Style changes how the sermon is built - expository walks the text verse by verse, topical follows a theme, narrative leans on story, and the rest are named for who or what they are for.",
      "\"Guidance and notes\" is the box that makes the difference. It is where you say what this congregation is walking through, a story you want included, a point to press hard, or one to avoid. The more you put here, the less generic the draft.",
    ],
    keywords: ["title", "date", "passage", "book", "chapter", "verses", "style", "notes", "guidance", "form"],
  },
  {
    id: "builder.includes",
    tab: "/portal/sermon-builder",
    tabLabel: "Sermon Builder",
    title: "\"What the sermon includes\"",
    body: [
      "These six tick boxes change what goes into the sermon itself, before it is written. They are not filters applied afterwards - untick one and that section is never asked for.",
      "Include Scripture text prints the passage into the manuscript so you are not reading from two places. Life applications adds the \"so what does this mean on Monday\" section. Illustrations adds stories and word pictures. Relevant quotes brings in outside voices. Call to action ends by asking for a response.",
      "Appropriate humor is off by default, deliberately - humor lands differently in every room, and yours is the judgement that should decide it.",
    ],
    keywords: ["include", "toggles", "scripture", "applications", "humor", "illustrations", "quotes", "call to action"],
  },
  {
    id: "builder.addons",
    tab: "/portal/sermon-builder",
    tabLabel: "Sermon Builder",
    title: "\"Also create\" - the add-ons",
    body: [
      "Tick these before generating and the builder writes the week's other pieces from the same sermon, so they say the same thing:",
      "Daily Devotional - a short reading (300-500 words) on the passage, with a reflection, a prayer and a question. Small Group Discussion - five to seven questions for a group that heard the sermon. Kids Ministry Lesson - a plan for ages 4 to 12: objective, story, key verse, activity, craft or song, prayer. Bulletin Notes - a short write-up for the printed bulletin.",
      "Presentation Slides - eight to twelve slides with short bullets, one per main point and one per key scripture, ready to type into your slide software. Social Media Posts - one post each for Facebook, Instagram, X and a text blast, written to the right length for each.",
      "Each piece is made separately, so if one fails the rest are unharmed: a Retry button appears for just that piece, and your sermon is already saved either way.",
    ],
    keywords: ["devotional", "small group", "kids", "bulletin", "slides", "social", "add-on", "retry", "also create"],
  },
  {
    id: "builder.limit",
    tab: "/portal/sermon-builder",
    tabLabel: "Sermon Builder",
    title: "The daily limit",
    body: [
      "Each church can generate 10 sermons a day. The count resets at midnight UTC, and the number left today is shown next to the Generate button.",
      "Only pressing Generate counts. Editing a draft, retrying a single add-on, publishing, and printing are all free and unlimited - so there is no reason to hold back on reworking a sermon you already have.",
      "If you run out, nothing is lost: every draft you generated is saved and waiting in Sermon Library.",
    ],
    keywords: ["limit", "cap", "10", "generations", "left", "resets", "midnight", "used up"],
  },
  {
    id: "builder.editing",
    tab: "/portal/sermon-builder",
    tabLabel: "Sermon Builder",
    title: "Editing the manuscript - read this before you leave the page",
    body: [
      "The full manuscript is edited here, on this page, in the session where it was generated. Rework it, fix the summary, print it, publish it - all from the panel that appears once the sermon is written.",
      "Once you navigate away, the manuscript is saved but there is not yet a screen that reopens it for editing. Sermon Library manages a sermon's details - title, passage, date, video link, summary - and does not show the manuscript itself.",
      "So finish your edits before you leave, or print a copy. We know this is the wrong way round and a way to reopen a manuscript is planned; until then, treat leaving this page as the point of no return for the text.",
    ],
    keywords: ["edit", "manuscript", "reopen", "leave", "lost", "library", "later", "again"],
  },
  {
    id: "builder.video",
    tab: "/portal/sermon-builder",
    tabLabel: "Sermon Builder",
    title: "Publishing before the video exists",
    body: [
      "A published built sermon appears on your website's sermons page as a text card - title, passage, date and summary - with no video needed. Preach it, upload the recording later.",
      "When the video is on YouTube, open this sermon in Sermon Library and paste the video link there. The card and the video become one entry, with your written summary kept.",
    ],
    keywords: ["video", "youtube", "attach", "publish", "card", "later"],
  },

  /* ---- Sermon Library ---- */
  {
    id: "sermons.status",
    tab: "/portal/sermons",
    tabLabel: "Sermon Library",
    title: "The three-way switch",
    body: [
      "Every sermon is in one of three states, picked from the dropdown on its card. \"Not on your website yet\" is where new sermons start - you can fill in the video and notes before anyone sees it. \"On your website\" shows it to visitors. \"Taken down (kept here)\" removes it from your website but keeps everything you wrote.",
      "\"Taken down\" is almost always what you want instead of Remove - Remove deletes the sermon for good.",
    ],
    keywords: ["status", "publish", "draft", "taken down", "hide", "show", "live"],
  },
  {
    id: "sermons.youtube",
    tab: "/portal/sermons",
    tabLabel: "Sermon Library",
    title: "Videos and your channels",
    body: [
      "Videos from your YouTube channels appear on your website's sermons page automatically. Adding a sermon here is how you say more about one - its passage, series, a summary - and those details take over from the automatic listing for that video.",
      "Paste the whole YouTube link into the video field; the portal pulls the video out of it. If your church has more than one channel, the \"Which channel\" picker says which one the sermon belongs to.",
    ],
    keywords: ["youtube", "video", "link", "channel", "automatic", "series", "passage"],
  },

  /* ---- Notes ---- */
  {
    id: "notes.overview",
    tab: "/portal/notes",
    tabLabel: "Notes",
    title: "What Notes is for",
    body: [
      "A notebook that lives with your website instead of in a drawer. Sermon prep, the thing you promised to follow up on, what needs saying at the next board meeting, the outline of an event - anything worth writing down where you will find it again.",
      "A note can carry a type, a Bible passage, a link to one of your sermons and a reminder date, so it can be found by any of those later rather than only by scrolling.",
      "Nothing here ever appears on your public website. Notes are for you and your team.",
    ],
    keywords: ["notes", "notebook", "what is", "write", "jot", "keep", "remember"],
  },
  {
    id: "notes.types",
    tab: "/portal/notes",
    tabLabel: "Notes",
    title: "Note types",
    body: [
      "The Type dropdown labels what a note is, so a long list stays findable. The choices are Sermon prep, General, Reminder, Church admin, Event planning, and Other.",
      "Nothing behaves differently based on the type - it does not change formatting or who can see it. It is there so that six months from now you can tell at a glance which notes were sermon work and which were the building committee.",
    ],
    keywords: ["type", "category", "sermon prep", "reminder", "church admin", "event planning", "general"],
  },
  {
    id: "notes.scripture",
    tab: "/portal/notes",
    tabLabel: "Notes",
    title: "Adding a passage to a note",
    body: [
      "Pick a book, then a chapter, then optionally a verse or a range - the chapter list only offers chapters the book actually has, so you cannot pick Philemon 4.",
      "The passage shows on the note so you can find it by reference later. Leave the book on \"No reference\" for a note that is not about a passage.",
    ],
    keywords: ["scripture", "passage", "bible", "book", "chapter", "verse", "reference"],
  },
  {
    id: "notes.sermon",
    tab: "/portal/notes",
    tabLabel: "Notes",
    title: "Attaching a note to a sermon",
    body: [
      "\"Attach to a sermon\" links a note to one of the sermons in your Sermon Library, so prep notes stay with the message they belong to.",
      "The list shows sermons you have added to your library. A video that is only on your YouTube channel is not there yet - add it to Sermon Library first and it becomes attachable.",
    ],
    keywords: ["attach", "sermon", "link", "prep", "library"],
  },
  {
    id: "notes.shared",
    tab: "/portal/notes",
    tabLabel: "Notes",
    title: "Who sees these notes",
    body: [
      "Notes are shared with everyone who can sign in to this portal for your church - they are a team notebook, not a private one. Each note shows who wrote it.",
      "Nothing here ever appears on your public website.",
    ],
    keywords: ["private", "shared", "who can see", "team", "visible"],
  },
  {
    id: "notes.editor",
    tab: "/portal/notes",
    tabLabel: "Notes",
    title: "Formatting a note",
    body: [
      "The toolbar above the note box does bold, italic and underline, plus a font, a text color and a highlighter - select some text first, then pick from the toolbar.",
      "A note can also carry a type (sermon prep, reminder, church admin and so on), a Bible passage picked book-chapter-verse, and an attachment to one of your sermons.",
    ],
    keywords: ["bold", "italic", "underline", "highlight", "color", "font", "format", "toolbar"],
  },
  {
    id: "notes.reminders",
    tab: "/portal/notes",
    tabLabel: "Notes",
    title: "Reminders",
    body: [
      "Give a note a reminder date and it appears in \"Upcoming reminders\" at the top of this tab until the date passes.",
      "Reminders show here only - the portal does not send emails or phone notifications. Check in here to see what is coming up.",
    ],
    keywords: ["reminder", "remind", "date", "upcoming", "notification", "email"],
  },
  {
    id: "notes.print",
    tab: "/portal/notes",
    tabLabel: "Notes",
    title: "Printing a note",
    body: [
      "The Print button on a note prints just that note - its title, its type and passage, and the note itself - not the whole page. Handy for taking sermon prep to the pulpit on paper.",
    ],
    keywords: ["print", "paper", "pulpit"],
  },

  /* ---- Events ---- */
  {
    id: "events.overview",
    tab: "/portal/events",
    tabLabel: "Events",
    title: "How events work",
    body: [
      "A new event stays off your website until you tick \"Show on my website\". Give it a start time, a place, and a photo from your library if you like.",
      "The event's type (in person, retreat) drives the filter buttons on your website's events page - visitors use them to narrow the list.",
      "The times you type are the times visitors see, exactly as written.",
    ],
    keywords: ["event", "calendar", "add", "type", "filter", "time", "when"],
  },
  {
    id: "events.calendar",
    tab: "/portal/events",
    tabLabel: "Events",
    title: "The month view",
    body: [
      "The calendar toggle shows the same events laid out on a month grid, with arrows to move between months. It is another view of the same list, not a separate calendar - anything you change shows in both.",
    ],
    keywords: ["month", "calendar", "view", "grid"],
  },

  /* ---- Groups & Studies ---- */
  {
    id: "groups.overview",
    tab: "/portal/groups",
    tabLabel: "Groups & Studies",
    title: "How groups work",
    body: [
      "The groups and studies on your website's groups page. Each one has its meeting day and time, how often it meets, and whether it happens in person, by video call or by phone - that last choice drives the filter buttons visitors use.",
      "The arrows set the order on your website. Put the group a newcomer should find first at the top.",
      "New groups stay off your website until you tick \"Show on my website\".",
    ],
    keywords: ["group", "study", "bible study", "meeting", "day", "time", "order", "filter"],
  },

  /* ---- Ministries ---- */
  {
    id: "ministries.overview",
    tab: "/portal/ministries",
    tabLabel: "Ministries",
    title: "How ministries work",
    body: [
      "The organizations listed under \"Ministries we support\" on your website's about page - usually partners your church works with rather than programs you run, so each one links to its own website.",
      "The arrows set the order. New ministries stay off your website until you tick \"Show on my website\".",
    ],
    keywords: ["ministry", "ministries", "partner", "support", "about"],
  },

  /* ---- Our Team ---- */
  {
    id: "team.overview",
    tab: "/portal/team",
    tabLabel: "Our Team",
    title: "How the team page works",
    body: [
      "The people on your website's team page. Each person has a name, a role, a short bio, and a photo picked from your photo library.",
      "A new person starts hidden, so you can finish their bio before visitors see them - tick \"Show on my website\" when they are ready. The order here is the order on your website.",
    ],
    keywords: ["team", "staff", "people", "pastor", "bio", "photo", "order", "hide"],
  },
];

/* ------------------------------------------------------------------ */
/* The welcome tour                                                    */
/* ------------------------------------------------------------------ */

export const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    title: "Welcome to your portal",
    body: "Everything on your website is edited from here, and nothing goes live until you say so. This tour takes about a minute - let me show you where things live.",
  },
  {
    target: '[data-tour="/portal/website"]',
    inSidebar: true,
    title: "Edit My Website",
    body: "The words and photos on every page of your website. Changes save as you type and go live straight away.",
  },
  {
    target: '[data-tour="/portal/details"]',
    inSidebar: true,
    title: "Church Details",
    body: "Your name, contact details, service times, colors and links - change them once, every page updates.",
  },
  {
    target: '[data-tour="/portal/photos"]',
    inSidebar: true,
    title: "Photos",
    body: "Your photo library. Upload a photo once here and use it anywhere - events, your team, your logo.",
  },
  {
    target: '[data-tour="/portal/announcements"]',
    inSidebar: true,
    title: "Announcements",
    body: "Notices for your website's home page. Give one a take-down date and it removes itself when the day passes.",
  },
  {
    target: '[data-tour="/portal/prayer"]',
    inSidebar: true,
    title: "Prayer Wall",
    body: "Prayer requests from your website land here first. Nothing shows publicly until you approve it.",
  },
  {
    /*
     * Two stops where there was one. The Preach group covers three tools
     * that do genuinely different jobs, and a single card describing all
     * three was a list rather than an introduction - the builder in
     * particular is the biggest thing in the portal and was getting one
     * clause.
     */
    target: '[data-tour="/portal/sermon-builder"]',
    inSidebar: true,
    title: "Sermon Builder",
    body: "Give it a passage, a style and your own direction, and it writes a full first draft you edit and make yours. Ten a day, and nothing reaches your website until you publish it.",
  },
  {
    target: '[data-tour="/portal/notes"]',
    inSidebar: true,
    title: "Sermon Library and Notes",
    body: "Sermon Library is every message on your website - add a video, write a summary, take one down. Notes is a shared notebook for sermon prep and reminders, visible to everyone with portal access at your church.",
  },
  {
    target: '[data-tour-group="People"]',
    inSidebar: true,
    title: "Events and your team",
    body: "Events runs your website's calendar. Our Team is the people on your team page - photos, roles and bios.",
  },
  {
    target: '[data-tour="view-site"]',
    title: "See it live",
    body: "This opens your website in a new tab, any time. What you see there is what your visitors see.",
  },
  {
    target: '[data-tour="help-bubble"]',
    title: "Forget anything?",
    body: "I am right here. Click this bubble to search for help, read about the page you are on, or take this tour again.",
  },
];

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

/**
 * Client-side search over the registry. Every word of the query must match
 * somewhere (title, keyword or body); results are ordered by where the
 * matches landed - titles first, then keywords, then body text.
 */
export function searchTopics(query: string): HelpTopic[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const scored: { topic: HelpTopic; score: number }[] = [];

  for (const topic of HELP_TOPICS) {
    const title = topic.title.toLowerCase();
    const keywords = topic.keywords.join(" ");
    const body = topic.body.join(" ").toLowerCase();

    let score = 0;
    let allMatched = true;

    for (const term of terms) {
      if (title.includes(term)) score += 3;
      else if (keywords.includes(term)) score += 2;
      else if (body.includes(term)) score += 1;
      else {
        allMatched = false;
        break;
      }
    }

    if (allMatched) scored.push({ topic, score });
  }

  return scored.sort((a, b) => b.score - a.score).map((entry) => entry.topic);
}

/** Topics for the tab the pastor is currently on. */
export function topicsForTab(pathname: string): HelpTopic[] {
  return HELP_TOPICS.filter((topic) => topic.tab === pathname);
}

/** One topic by id, for HelpMark. Null rather than throwing - a mark with a
    mistyped id renders nothing and warns, instead of crashing the tab. */
export function findTopic(id: string): HelpTopic | null {
  return HELP_TOPICS.find((topic) => topic.id === id) ?? null;
}
