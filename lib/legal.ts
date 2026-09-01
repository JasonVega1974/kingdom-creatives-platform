import type { Church } from "@/lib/church";

/**
 * ============================================================
 * LEGAL DOCUMENTS - platform templates, tenant facts
 * ============================================================
 *
 * TEMPLATE - NEEDS LEGAL REVIEW BEFORE ANYONE RELIES ON IT. See FF-50.
 *
 * WHY THESE ARE NOT church_sections ROWS
 *
 * Everything in `church_sections` is pastor-editable by design - that is the
 * entire purpose of the registry in lib/portal/sections.ts. Legal text in there
 * means a pastor can edit "we never see your card number" into something that
 * is not true, which is a liability rather than a feature. The terms are the
 * platform's; only the FACTS are the tenant's.
 *
 * It also means a legal page exists for a new church on day one. A seeded-rows
 * approach would need a data migration per tenant before /privacy resolved at
 * all, and the failure mode is a 404 where a policy should be.
 *
 * So: the wording lives here and is identical for every tenant. The name,
 * domain and contact address come from the `churches` row, which is already
 * per-tenant and already editable in Church Details. Nothing is typed in.
 *
 * ACCURACY. This text was written against an audit of what the platform
 * actually does, not from a boilerplate generator. Statements that are easy to
 * get wrong and were checked live:
 *
 *   - the public site sets NO cookies (verified: no Set-Cookie on / or
 *     /portal/login)
 *   - fonts are self-hosted by next/font at build time, so there is no runtime
 *     request to Google and no font cookie
 *   - youtube-nocookie.com is contacted only after someone clicks play
 *   - giving is an outbound link to Tithe.ly; no payment data reaches us
 *
 * If any of those change, this file is wrong and must change with them.
 */

/**
 * The date shown on every document.
 *
 * One constant rather than a per-document field, because all three were written
 * together and are revised together. It is a literal rather than a build date -
 * "last updated" must mean when the WORDING changed, not when the site was last
 * deployed, or it silently claims a review that never happened.
 */
export const LEGAL_UPDATED = "1 September 2026";

/** Where platform-level questions go, as opposed to church-level ones. */
export const PLATFORM_NAME = "Kingdom Creatives LLC";
export const PLATFORM_EMAIL = "info@kingdom-creatives.com";
export const PLATFORM_URL = "https://kingdom-creatives.com";

export type LegalDoc = {
  slug: "privacy" | "terms" | "cookies";
  title: string;
  /** Rendered under the title. */
  intro: string[];
  sections: { heading: string; body: string[] }[];
};

/** The tenant facts every document substitutes. Never hardcoded. */
function facts(church: Church) {
  return {
    name: church.name ?? church.slug,
    domain: church.custom_domain ?? "this website",
    email: church.email,
    address: church.address,
  };
}

/** A sentence naming who to contact, built from whatever the church has set. */
function contactSentence(church: Church): string {
  const { name, email } = facts(church);
  return email
    ? `Questions about this website or the information it holds: contact ${name} at ${email}. Questions about the platform itself: ${PLATFORM_EMAIL}.`
    : `Questions about this website or the information it holds: contact ${name} directly. Questions about the platform itself: ${PLATFORM_EMAIL}.`;
}

function operatedBy(church: Church): string {
  const { name, domain } = facts(church);
  return `${name} operates ${domain} on the Kingdom Creatives platform, provided by ${PLATFORM_NAME}. ${name} is responsible for the content of this site; ${PLATFORM_NAME} provides the software and hosting.`;
}

export function privacyPolicy(church: Church): LegalDoc {
  const { name, email } = facts(church);

  return {
    slug: "privacy",
    title: "Privacy Policy",
    intro: [operatedBy(church), contactSentence(church)],
    sections: [
      {
        heading: "What this site collects",
        body: [
          `This site collects information in only three places, and only when you choose to type something in. There is no analytics, no advertising, and no tracking of visitors.`,
          `Prayer requests. The text of your request, and a display name if you choose to give one. The name is optional - leave it blank and the request is anonymous. A person at ${name} reads every request before it appears publicly, and nothing appears unless they approve it.`,
          `Plan a Visit. Your name, one email address or phone number, and anything you write in the message. This is used so ${name} can reply to you, and nothing else.`,
          `Staff accounts. People who manage this website sign in with an email address and password. This does not apply to visitors.`,
        ],
      },
      {
        heading: "Giving - we do not collect payment information",
        body: [
          `Gifts are handled entirely by Tithe.ly on Tithe.ly's own website. Clicking Give takes you there.`,
          `Card numbers, bank details and billing addresses are never sent to this website, never pass through it, and are never stored by ${name} or ${PLATFORM_NAME}. What you give and how is governed by Tithe.ly's own privacy policy.`,
        ],
      },
      {
        heading: "A limit worth knowing about prayer requests",
        body: [
          `A prayer request is stored with its text and optional display name and nothing else - no email address, no account, no identifier.`,
          `That is deliberate: it is what allows a request to be genuinely anonymous. It also means we cannot contact you about your request, and cannot find it on your behalf later. If you want a request removed, contact ${name}${email ? ` at ${email}` : ""} and describe it well enough to be identified.`,
        ],
      },
      {
        heading: "Who else handles this information",
        body: [
          `Supabase, which provides the database and staff sign-in, hosted in the United States. Vercel, which hosts and serves the website.`,
          `Both act as processors: they hold the data so the site can work, and do not use it for their own purposes.`,
          `Your information is not sold, and is not shared for advertising. It is not shared with other churches on the platform - each church can see only its own.`,
        ],
      },
      {
        heading: "How long it is kept",
        body: [
          `Prayer requests and visit enquiries are kept until ${name} deletes them. There is no automatic expiry, because a prayer request is not the kind of thing to discard on a timer.`,
        ],
      },
      {
        heading: "Your choices",
        body: [
          `You can ask what is held about you, ask for it to be corrected, or ask for it to be deleted. Contact ${name}${email ? ` at ${email}` : ""}, or ${PLATFORM_EMAIL} if it concerns the platform rather than this church.`,
          `Depending on where you live you may have further rights under data protection law. We will honour them.`,
        ],
      },
      {
        heading: "Children",
        body: [
          `This site is not directed at children and does not knowingly collect information from them. If you believe a child has submitted something, contact ${name} and it will be removed.`,
        ],
      },
    ],
  };
}

export function cookiePolicy(church: Church): LegalDoc {
  const { name } = facts(church);

  return {
    slug: "cookies",
    title: "Cookie Policy",
    intro: [
      operatedBy(church),
      `The short version: this website sets no cookies. The longer version explains the two exceptions, both of which you choose.`,
    ],
    sections: [
      {
        heading: "This site sets no cookies",
        body: [
          `Browsing this website sets no cookies at all. There is no analytics cookie, no advertising cookie, no tracking pixel, and no consent banner - because there is nothing to consent to.`,
          `The typefaces are served from this website rather than from Google, so no request is made to a font provider and no cookie is set by one.`,
        ],
      },
      {
        heading: "The sermon video, if you press play",
        body: [
          `The sermon on the home page shows a still image until you click it. Until that click, nothing is loaded from YouTube's player.`,
          `Clicking play loads a player from youtube-nocookie.com, Google's reduced-tracking embed. From that point Google may set cookies on your device under its own policy, and we have no control over them. If you would rather that did not happen, do not press play - the message is also on YouTube if you prefer to watch it there deliberately.`,
          `The still image itself is loaded from Google's image service when the page opens.`,
        ],
      },
      {
        heading: "Links to other places",
        body: [
          `Give, and any social links, take you to Tithe.ly, YouTube or Facebook. Those are separate websites with their own cookies and their own policies. Nothing is set on your device by ${name} when you follow one - it happens once you arrive.`,
        ],
      },
      {
        heading: "Staff sign-in",
        body: [
          `People who manage this website receive a session cookie when they sign in, so the site knows they are signed in. It is strictly necessary for that purpose, it is not used for tracking, and it does not apply to visitors.`,
        ],
      },
    ],
  };
}

export function termsOfUse(church: Church): LegalDoc {
  const { name, address } = facts(church);

  return {
    slug: "terms",
    title: "Terms of Use",
    intro: [operatedBy(church), contactSentence(church)],
    sections: [
      {
        heading: "Using this site",
        body: [
          `You are welcome to read, share and link to anything here. Please do not copy the site's content and present it as your own, attempt to break or overload it, or use it to send anything unlawful.`,
        ],
      },
      {
        heading: "What you submit",
        body: [
          `Prayer requests and visit enquiries are read by people at ${name}.`,
          `Please do not submit other people's personal information without their agreement, and do not submit anything unlawful, abusive, or intended to harm someone.`,
          `${name} decides what appears publicly. A prayer request may be published, kept private, edited as to the name shown, or declined, and there is no obligation to publish anything. A request that has been published may be taken down at any time.`,
        ],
      },
      {
        heading: "Giving",
        body: [
          `Gifts are processed by Tithe.ly under Tithe.ly's own terms, on Tithe.ly's website. Questions about a specific gift, including refunds, are between you and ${name}.`,
          `Whether a gift is tax-deductible depends on your circumstances and on the church's status. Ask a tax advisor; nothing on this site is tax advice.`,
        ],
      },
      {
        heading: "Content and accuracy",
        body: [
          `Service times, events and other details are kept up to date by ${name}, but may change. Where it matters, contact the church to confirm before travelling.`,
          `This site is provided as it is. Neither ${name} nor ${PLATFORM_NAME} promises that it will always be available or that a stream will be uninterrupted.`,
        ],
      },
      {
        heading: "Who is responsible for what",
        body: [
          `${name} is responsible for the content of this site and for how it handles what you submit. ${PLATFORM_NAME} provides the software and hosting and is responsible for those.`,
          `${PLATFORM_NAME} is not responsible for the content published by any church using the platform.`,
        ],
      },
      {
        heading: "Governing law",
        body: [
          `These terms are governed by the law of the state in which ${name} is established${address ? `, at ${address}` : ""}. Disputes about the platform itself are governed by the law applicable to ${PLATFORM_NAME}.`,
        ],
      },
    ],
  };
}

/** Every document, for the footer's legal row. */
export const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Use" },
  { href: "/cookies", label: "Cookie Policy" },
] as const;
