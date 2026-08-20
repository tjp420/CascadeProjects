/**
 * Tier 0 outreach pipeline — verify emails on company site before first send.
 * sent / sentAt synced with dashboard send log + docs/outreach-pipeline.md
 */
/**
 * O u t r e a c h  p r o s p e c t s.
 */
export const OUTREACH_PROSPECTS = [
  {
    id: "1",
    company: "OmbuLabs",
    contactName: "Ernesto",
    email: "hello@ombulabs.com",
    templateId: "email-3",
    sent: true,
    sentAt: "2026-05-30",
  },
  {
    id: "2",
    company: "OpenForge",
    contactName: "Jedidiah",
    email: "hello@openforge.io",
    templateId: "email-1",
    sent: true,
    sentAt: "2026-05-30",
  },
  {
    id: "3",
    company: "Swovo",
    contactName: "Michael",
    email: "info@swovo.com",
    templateId: "email-6",
    sent: true,
    sentAt: "2026-05-30",
    personalization:
      "Swovo's full-stack client work across fintech and healthcare is exactly where sample JSON and dashboard fixtures drift from what CI actually measures.",
  },
  {
    id: "4",
    company: "Electric Eye",
    contactName: "Shawn",
    email: "info@electriceye.io",
    templateId: "email-2",
    sent: true,
    sentAt: "2026-05-30",
    personalization:
      "Shopify-only agencies juggling multiple DTC rebuilds often see theme and app code reference fixture paths that aren't obvious until a client security review.",
  },
  {
    id: "5",
    company: "Fuel Made",
    contactName: "Ashley",
    email: "",
    templateId: "email-2",
    note: "Contact form",
    contactUrl: "https://fuelmade.com/pages/contact",
    personalization:
      "Fuel Made's senior-only Shopify + Klaviyo model means fewer hands on each repo — sample-path leaks in theme or app code hurt more at diligence time.",
  },
  {
    id: "6",
    company: "Ambaum",
    contactName: "David",
    email: "",
    templateId: "email-2",
    note: "Contact form",
    contactUrl: "https://ambaum.com/contact",
    personalization:
      "Ambaum's fractional-CTO model on Shopify Plus — custom apps, integrations, automation — is where sample paths often survive past staging into client reviews.",
  },
  {
    id: "7",
    company: "Parkfield Commerce",
    contactName: "Richard",
    email: "",
    templateId: "email-4",
    note: "LinkedIn",
    contactUrl: "https://linkedin.com/company/parkfieldcommerce",
    personalization:
      "Parkfield's EU + US commerce work puts you in the path of client audits that ask about mock data and unverifiable dashboard KPIs.",
  },
  {
    id: "8",
    company: "Coldsmoke Creative",
    contactName: "Mark",
    email: "",
    templateId: "email-2",
    note: "Contact form",
    contactUrl: "https://coldsmoke.co/pages/contact",
    personalization:
      "Plus migrations and headless builds are where legacy mock paths and fixture JSON often get copied forward — then surface in client security questionnaires.",
  },
  {
    id: "9",
    company: "Irish Titan",
    contactName: "Tom",
    email: "",
    templateId: "email-10",
    note: "LinkedIn",
    contactUrl: "https://linkedin.com/in/tom-ferrara-4257bb27",
    personalization:
      "Irish Titan's employee-only eng model is a strong handoff story — but AI-assisted code still introduces sample-path patterns Snyk/GHAS won't flag.",
  },
  {
    id: "10",
    company: "Goji Labs",
    contactName: "Adam",
    email: "hello@gojilabs.com",
    templateId: "email-5",
    personalization:
      "Goji's product-agency work for startups moving toward enterprise deals is when security questionnaires start asking how you govern AI-assisted development.",
  },
  {
    id: "11",
    company: "Hashrocket",
    contactName: "Team",
    email: "info@hashrocket.com",
    templateId: "email-3",
    personalization:
      "Hashrocket's Rails consultancy across client repos is exactly where sample-path patterns and mock JSON accumulate between audits.",
  },
  {
    id: "12",
    company: "Planet Argon",
    contactName: "Team",
    email: "hello@planetargon.com",
    templateId: "email-1",
    personalization:
      "Ruby shops shipping multiple client apps often see fixture paths under server/ or shared libs that client security reviews flag.",
  },
  {
    id: "13",
    company: "LaunchPad Lab",
    contactName: "Team",
    email: "info@launchpadlab.com",
    templateId: "email-4",
    personalization:
      "Product agencies with healthcare and civic clients need evidence that sample JSON and production code stay separated before audits.",
  },
  {
    id: "14",
    company: "Rootstrap",
    contactName: "Team",
    email: "hello@rootstrap.com",
    templateId: "email-5",
    personalization:
      "Rootstrap's startup-to-enterprise client motion is when security questionnaires ask about AI dev practices — not just dependency scanning.",
  },
  {
    id: "15",
    company: "Blue Label Labs",
    contactName: "Team",
    email: "info@bluelabellabs.com",
    templateId: "email-5",
    personalization:
      "Mobile and web product shops moving into enterprise deals often need evidence that dashboard metrics aren't fiction from sample files.",
  },
  {
    id: "16",
    company: "Skylark SEO",
    contactName: "Team",
    email: "hello@skylarkseo.com",
    templateId: "email-2",
    personalization:
      "Shopify agencies juggling multiple merchant rebuilds often see theme and app code reference fixture paths that dependency scans miss.",
  },
  {
    id: "17",
    company: "Fifth Effect",
    contactName: "Team",
    email: "hello@5e.studio",
    templateId: "email-2",
    personalization:
      "DTC growth partners running Shopify dev + CRO across client stores see mock JSON drift between projects faster than teams expect.",
  },
  {
    id: "18",
    company: "Belighted",
    contactName: "Team",
    email: "info@belighted.com",
    templateId: "email-7",
    personalization:
      "SaaS product studios with fintech and B2B clients often need mock-data hygiene evidence before the next compliance review.",
  },
  {
    id: "19",
    company: "Dev Agency",
    contactName: "Team",
    email: "hello@devagency.com",
    templateId: "email-8",
    personalization:
      "Agencies shipping custom Node/React for multiple clients accumulate sample paths that surface in vendor diligence — after Snyk is green.",
  },
  {
    id: "20",
    company: "Tennex",
    contactName: "Team",
    email: "hi@tenex.co",
    templateId: "email-2",
    personalization:
      "Shopify Plus agencies managing custom apps and integrations across merchants see sample-path leaks show up late in client reviews.",
  },
  {
    id: "21",
    company: "Forthgoing",
    contactName: "Team",
    email: "hello@forthgoing.com",
    templateId: "email-2",
    personalization:
      "Headless Shopify and Next.js rebuilds are where legacy mock paths and fixture JSON often get copied forward post-migration.",
  },
  {
    id: "22",
    company: "Netalico",
    contactName: "Team",
    email: "clients@netalico.com",
    templateId: "email-4",
    personalization:
      "Shopify Plus work for education and health clients puts you in the path of audits asking about mock data and sample fixtures.",
  },
  {
    id: "23",
    company: "Arcane",
    contactName: "Team",
    email: "hello@arcane.ag",
    templateId: "email-6",
    personalization:
      "Full-stack agencies using AI-assisted velocity still need a read-only check for sample paths under server/ and src/ before client handoff.",
  },
  {
    id: "24",
    company: "Synergy Labs",
    contactName: "Team",
    email: "hello@synergylabs.co",
    templateId: "email-8",
    personalization:
      "Product consultancies moving clients upmarket hit security questionnaires about AI-assisted development — beyond dependency scanning.",
  },
  {
    id: "25",
    company: "Uptech",
    contactName: "Team",
    email: "hello@uptech.team",
    templateId: "email-5",
    personalization:
      "Mobile product shops with enterprise-bound clients benefit from a pre-handoff scan for fiction KPIs and production-path leaks.",
  },
  {
    id: "26",
    company: "Brand New Box",
    contactName: "Team",
    email: "hello@brandnewbox.com",
    templateId: "email-3",
    personalization:
      "Rails product studios shipping custom web apps for clients accumulate mock JSON and sample paths that vendor reviews catch after CVE scans pass.",
  },
  {
    id: "27",
    company: "Canesta",
    contactName: "Team",
    email: "info@canesta.com",
    templateId: "email-2",
    personalization:
      "Seattle Shopify agencies running custom theme and app work across merchants see fixture drift between client repos — especially with AI-assisted velocity.",
  },
  {
    id: "28",
    company: "Expert Village Media",
    contactName: "Team",
    email: "info@expertvillagemedia.com",
    templateId: "email-2",
    personalization:
      "Shopify Plus dev shops juggling multiple brand rebuilds often see theme code reference sample paths that client security reviews flag.",
  },
  {
    id: "29",
    company: "Test Double",
    contactName: "Team",
    email: "hello@testdouble.com",
    templateId: "email-3",
    personalization:
      "Embedded Rails/JS consultancies see client repos pick up sample-path patterns and fiction KPIs in fixtures — a gap SAST tools rarely scope.",
  },
  {
    id: "30",
    company: "thoughtbot",
    contactName: "Team",
    email: "hello@thoughtbot.com",
    templateId: "email-3",
    personalization:
      "Product consultancies shipping Rails and React for multiple clients need a read-only pass on mock-data hygiene before handoff diligence.",
  },
  {
    id: "31",
    company: "Baunfire",
    contactName: "Team",
    email: "hello@baunfire.com",
    templateId: "email-8",
    personalization:
      "B2B SaaS design/dev shops moving clients upmarket hit security questionnaires about AI-assisted development and sample fixture hygiene.",
  },
  {
    id: "32",
    company: "COFA Media",
    contactName: "Team",
    email: "hello@cofamedia.com",
    templateId: "email-2",
    personalization:
      "Commerce agencies managing Shopify and custom integrations across clients see mock JSON drift show up in late-stage security reviews.",
  },
  {
    id: "33",
    company: "Absolute Web",
    contactName: "Team",
    email: "info@absoluteweb.com",
    templateId: "email-2",
    personalization:
      "Miami-based Shopify Plus work across retail clients is where theme and app sample paths often survive into production-path scans.",
  },
  {
    id: "34",
    company: "Disco Labs",
    contactName: "Team",
    email: "hello@discolabs.com",
    templateId: "email-2",
    personalization:
      "Shopify app and theme agencies shipping for multiple merchants benefit from a read-only check for sample-path leaks before client handoff.",
  },
  {
    id: "35",
    company: "Only Child",
    contactName: "Team",
    email: "hello@onlychild.co",
    templateId: "email-1",
    personalization:
      "Boutique dev shops shipping client web products often see fixture paths under server/ or src/ that dependency scanners never flag.",
  },
  {
    id: "36",
    company: "Profound",
    contactName: "Team",
    email: "hello@profound.co",
    templateId: "email-2",
    personalization:
      "Digital product agencies shipping custom web apps benefit from a read-only check for sample-path leaks before client handoff.",
  },
  {
    id: "37",
    company: "Cuberto",
    contactName: "Team",
    email: "hello@cuberto.com",
    templateId: "email-5",
    personalization:
      "Mobile product shops with enterprise clients need evidence that dashboard metrics aren't fiction from sample files.",
  },
  {
    id: "38",
    company: "Lullabot",
    contactName: "Team",
    email: "hello@lullabot.com",
    templateId: "email-3",
    personalization:
      "Drupal and React consultancies see client repos pick up sample-path patterns that SAST tools rarely scope.",
  },
  {
    id: "39",
    company: "Chapter Three",
    contactName: "Team",
    email: "hello@chapterthree.com",
    templateId: "email-3",
    personalization:
      "Drupal shops shipping multiple client apps often see fixture paths under server/ that client security reviews flag.",
  },
  {
    id: "40",
    company: "PreviousNext",
    contactName: "Team",
    email: "hello@previousnext.com.au",
    templateId: "email-2",
    personalization:
      "Australian Drupal agencies managing custom integrations across clients see mock JSON drift show up in late-stage reviews.",
  },
  {
    id: "41",
    company: "Mediacurrent",
    contactName: "Team",
    email: "hello@mediacurrent.com",
    templateId: "email-4",
    personalization:
      "Drupal agencies with healthcare and civic clients need evidence that sample JSON and production code stay separated before audits.",
  },
  {
    id: "42",
    company: "Evolving Web",
    contactName: "Team",
    email: "hello@evolvingweb.ca",
    templateId: "email-3",
    personalization:
      "Canadian Drupal consultancies across client repos accumulate sample-path patterns between audits.",
  },
  {
    id: "43",
    company: "Zivtech",
    contactName: "Team",
    email: "hello@zivtech.com",
    templateId: "email-2",
    personalization:
      "Philadelphia-based Drupal dev shops see fixture paths under server/ that dependency scanners never flag.",
  },
  {
    id: "44",
    company: "Commerce Guys",
    contactName: "Team",
    email: "hello@commerceguys.com",
    templateId: "email-2",
    personalization:
      "Drupal Commerce agencies juggling multiple merchant rebuilds often see theme code reference sample paths.",
  },
  {
    id: "45",
    company: "Amazee Labs",
    contactName: "Team",
    email: "hello@amazeelabs.com",
    templateId: "email-3",
    personalization:
      "Global Drupal agencies with EU clients hit security questionnaires about AI-assisted development practices.",
  },
  {
    id: "46",
    company: "Tandem",
    contactName: "Team",
    email: "hello@tandem.coop",
    templateId: "email-4",
    personalization:
      "Drupal cooperatives with civic clients need evidence that sample JSON and production code stay separated.",
  },
  {
    id: "47",
    company: "Tag1 Consulting",
    contactName: "Team",
    email: "hello@tag1consulting.com",
    templateId: "email-3",
    personalization:
      "Drupal consultancies see client repos pick up sample-path patterns that SAST tools rarely scope.",
  },
  {
    id: "48",
    company: "Knockout",
    contactName: "Team",
    email: "hello@knockout.io",
    templateId: "email-2",
    personalization:
      "Shopify Plus agencies managing custom apps across merchants see sample-path leaks show up late in reviews.",
  },
  {
    id: "49",
    company: "We Make Websites",
    contactName: "Team",
    email: "hello@wemakewebsites.com",
    templateId: "email-2",
    personalization:
      "UK Shopify agencies running custom theme work across merchants see fixture drift between client repos.",
  },
  {
    id: "50",
    company: "Eastside Co",
    contactName: "Team",
    email: "hello@eastside.co",
    templateId: "email-2",
    personalization:
      "London Shopify Plus work across retail clients is where theme sample paths often survive into production scans.",
  },
  {
    id: "51",
    company: "Reno",
    contactName: "Team",
    email: "hello@reno.co",
    templateId: "email-2",
    personalization:
      "Australian Shopify agencies juggling multiple brand rebuilds often see theme code reference sample paths.",
  },
  {
    id: "52",
    company: "Digital Natives",
    contactName: "Team",
    email: "hello@digitalnatives.com.au",
    templateId: "email-2",
    personalization:
      "Melbourne Shopify Plus dev shops see fixture paths under server/ that dependency scanners never flag.",
  },
  {
    id: "53",
    company: "Velir",
    contactName: "Team",
    email: "hello@velir.com",
    templateId: "email-4",
    personalization:
      "Boston-based Drupal agencies with enterprise clients need evidence that sample JSON and production code stay separated.",
  },
  {
    id: "54",
    company: "Acquia",
    contactName: "Team",
    email: "hello@acquia.com",
    templateId: "email-4",
    personalization:
      "Enterprise Drupal platform providers need evidence that sample JSON and production code stay separated before audits.",
  },
  {
    id: "55",
    company: "Pantheon",
    contactName: "Team",
    email: "hello@pantheon.io",
    templateId: "email-4",
    personalization:
      "Drupal hosting providers with enterprise clients need evidence that sample JSON and production code stay separated.",
  },
  {
    id: "56",
    company: "Platform.sh",
    contactName: "Team",
    email: "hello@platform.sh",
    templateId: "email-4",
    personalization:
      "Cloud platform providers with enterprise clients need evidence that sample JSON and production code stay separated.",
  },
  {
    id: "57",
    company: "CivicActions",
    contactName: "Team",
    email: "hello@civicactions.com",
    templateId: "email-4",
    personalization:
      "Drupal agencies with civic clients need evidence that sample JSON and production code stay separated before audits.",
  },
  {
    id: "58",
    company: "Palantir",
    contactName: "Team",
    email: "hello@palantir.net",
    templateId: "email-4",
    personalization:
      "Drupal agencies with government clients need evidence that sample JSON and production code stay separated before audits.",
  },
  {
    id: "59",
    company: "Appnovation",
    contactName: "Team",
    email: "hello@appnovation.com",
    templateId: "email-3",
    personalization:
      "Global Drupal consultancies across client repos accumulate sample-path patterns between audits.",
  },
  {
    id: "60",
    company: "Unleashed",
    contactName: "Team",
    email: "hello@unleashed.com",
    templateId: "email-2",
    personalization:
      "Shopify agencies managing custom apps and integrations across clients see mock JSON drift show up in reviews.",
  },
  {
    id: "61",
    company: "Gravity",
    contactName: "Team",
    email: "hello@gravity.ca",
    templateId: "email-2",
    personalization:
      "Canadian Shopify agencies running custom theme work across merchants see fixture drift between client repos.",
  },
  {
    id: "62",
    company: "Barefoot",
    contactName: "Team",
    email: "hello@barefoot.com",
    templateId: "email-2",
    personalization:
      "Shopify Plus agencies managing custom apps across merchants see sample-path leaks show up late in reviews.",
  },
  {
    id: "63",
    company: "Dawn",
    contactName: "Team",
    email: "hello@dawn.co",
    templateId: "email-2",
    personalization:
      "Shopify agencies juggling multiple merchant rebuilds often see theme and app code reference fixture paths.",
  },
  {
    id: "64",
    company: "Milk",
    contactName: "Team",
    email: "hello@milk.studio",
    templateId: "email-2",
    personalization:
      "Shopify Plus dev shops juggling multiple brand rebuilds often see theme code reference sample paths.",
  },
  {
    id: "65",
    company: "Eight",
    contactName: "Team",
    email: "hello@eight.io",
    templateId: "email-2",
    personalization:
      "Shopify agencies managing custom apps and integrations across clients see mock JSON drift show up in reviews.",
  },
  {
    id: "66",
    company: "Peach",
    contactName: "Team",
    email: "hello@peach.io",
    templateId: "email-2",
    personalization:
      "Shopify Plus agencies managing custom apps across merchants see sample-path leaks show up late in reviews.",
  },
  {
    id: "67",
    company: "The Taproom",
    contactName: "Team",
    email: "hello@thetaproom.io",
    templateId: "email-2",
    personalization:
      "Shopify agencies juggling multiple merchant rebuilds often see theme and app code reference fixture paths.",
  },
  {
    id: "68",
    company: "Shopify Plus Partners",
    contactName: "Team",
    email: "hello@shopify.com",
    templateId: "email-2",
    personalization:
      "Shopify Plus agencies managing custom apps and integrations across clients see mock JSON drift show up in reviews.",
  },
  {
    id: "69",
    company: "Yotpo",
    contactName: "Team",
    email: "hello@yotpo.com",
    templateId: "email-2",
    personalization:
      "Shopify app agencies shipping for multiple merchants benefit from a read-only check for sample-path leaks.",
  },
  {
    id: "70",
    company: "Klaviyo",
    contactName: "Team",
    email: "hello@klaviyo.com",
    templateId: "email-2",
    personalization:
      "Marketing automation agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "71",
    company: "Attentive",
    contactName: "Team",
    email: "hello@attentive.com",
    templateId: "email-2",
    personalization:
      "SMS marketing agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "72",
    company: "Postscript",
    contactName: "Team",
    email: "hello@postscript.io",
    templateId: "email-2",
    personalization:
      "SMS marketing agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "73",
    company: "Gorgias",
    contactName: "Team",
    email: "hello@gorgias.com",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "74",
    company: "Recharge",
    contactName: "Team",
    email: "hello@rechargepayments.com",
    templateId: "email-2",
    personalization:
      "Subscription agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "75",
    company: "Bold",
    contactName: "Team",
    email: "hello@boldcommerce.com",
    templateId: "email-2",
    personalization:
      "Shopify app agencies shipping for multiple merchants benefit from a read-only check for sample-path leaks.",
  },
  {
    id: "76",
    company: "LoyaltyLion",
    contactName: "Team",
    email: "hello@loyaltylion.com",
    templateId: "email-2",
    personalization:
      "Loyalty app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "77",
    company: "Yotpo Loyalty",
    contactName: "Team",
    email: "hello@yotpo.com",
    templateId: "email-2",
    personalization:
      "Loyalty app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "78",
    company: "Smile.io",
    contactName: "Team",
    email: "hello@smile.io",
    templateId: "email-2",
    personalization:
      "Loyalty app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "79",
    company: "Marsello",
    contactName: "Team",
    email: "hello@marsello.com",
    templateId: "email-2",
    personalization:
      "Loyalty app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "80",
    company: "Loyalty",
    contactName: "Team",
    email: "hello@loyalty.com",
    templateId: "email-2",
    personalization:
      "Loyalty app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "81",
    company: "Stamped.io",
    contactName: "Team",
    email: "hello@stamped.io",
    templateId: "email-2",
    personalization:
      "Review app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "82",
    company: "Yotpo Reviews",
    contactName: "Team",
    email: "hello@yotpo.com",
    templateId: "email-2",
    personalization:
      "Review app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "83",
    company: "Judge.me",
    contactName: "Team",
    email: "hello@judge.me",
    templateId: "email-2",
    personalization:
      "Review app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "84",
    company: "Loox",
    contactName: "Team",
    email: "hello@loox.io",
    templateId: "email-2",
    personalization:
      "Review app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "85",
    company: "Okendo",
    contactName: "Team",
    email: "hello@okendo.io",
    templateId: "email-2",
    personalization:
      "Review app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "86",
    company: "Reviews.io",
    contactName: "Team",
    email: "hello@reviews.io",
    templateId: "email-2",
    personalization:
      "Review app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "87",
    company: "Ryviu",
    contactName: "Team",
    email: "hello@ryviu.com",
    templateId: "email-2",
    personalization:
      "Review app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "88",
    company: "AliReviews",
    contactName: "Team",
    email: "hello@alireviews.com",
    templateId: "email-2",
    personalization:
      "Review app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "89",
    company: "Product Reviews",
    contactName: "Team",
    email: "hello@productreviews.com",
    templateId: "email-2",
    personalization:
      "Review app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "90",
    company: "Areviews",
    contactName: "Team",
    email: "hello@areviews.com",
    templateId: "email-2",
    personalization:
      "Review app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "91",
    company: "Opinew",
    contactName: "Team",
    email: "hello@opinew.com",
    templateId: "email-2",
    personalization:
      "Review app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "92",
    company: "Trustpilot",
    contactName: "Team",
    email: "hello@trustpilot.com",
    templateId: "email-2",
    personalization:
      "Review app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "93",
    company: "Yotpo UGC",
    contactName: "Team",
    email: "hello@yotpo.com",
    templateId: "email-2",
    personalization:
      "UGC app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "94",
    company: "Stackla",
    contactName: "Team",
    email: "hello@stackla.com",
    templateId: "email-2",
    personalization:
      "UGC app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "95",
    company: "Olapic",
    contactName: "Team",
    email: "hello@olapic.com",
    templateId: "email-2",
    personalization:
      "UGC app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "96",
    company: "Pixlee",
    contactName: "Team",
    email: "hello@pixlee.com",
    templateId: "email-2",
    personalization:
      "UGC app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "97",
    company: "Social Proof",
    contactName: "Team",
    email: "hello@socialproof.com",
    templateId: "email-2",
    personalization:
      "Social proof app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "98",
    company: "Fomo",
    contactName: "Team",
    email: "hello@fomo.com",
    templateId: "email-2",
    personalization:
      "Social proof app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "99",
    company: "Proof",
    contactName: "Team",
    email: "hello@proof.com",
    templateId: "email-2",
    personalization:
      "Social proof app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "100",
    company: "Nudgify",
    contactName: "Team",
    email: "hello@nudgify.com",
    templateId: "email-2",
    personalization:
      "Social proof app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "101",
    company: "Justuno",
    contactName: "Team",
    email: "hello@justuno.com",
    templateId: "email-2",
    personalization:
      "Popup app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "102",
    company: "Privy",
    contactName: "Team",
    email: "hello@privy.com",
    templateId: "email-2",
    personalization:
      "Popup app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "103",
    company: "Sumo",
    contactName: "Team",
    email: "hello@sumo.com",
    templateId: "email-2",
    personalization:
      "Popup app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "104",
    company: "OptinMonster",
    contactName: "Team",
    email: "hello@optinmonster.com",
    templateId: "email-2",
    personalization:
      "Popup app agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "105",
    company: "ConvertKit",
    contactName: "Team",
    email: "hello@convertkit.com",
    templateId: "email-2",
    personalization:
      "Email marketing agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "106",
    company: "Mailchimp",
    contactName: "Team",
    email: "hello@mailchimp.com",
    templateId: "email-2",
    personalization:
      "Email marketing agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "107",
    company: "Klaviyo",
    contactName: "Team",
    email: "hello@klaviyo.com",
    templateId: "email-2",
    personalization:
      "Email marketing agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "108",
    company: "Omnisend",
    contactName: "Team",
    email: "hello@omnisend.com",
    templateId: "email-2",
    personalization:
      "Email marketing agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "109",
    company: "ActiveCampaign",
    contactName: "Team",
    email: "hello@activecampaign.com",
    templateId: "email-2",
    personalization:
      "Email marketing agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "110",
    company: "Drip",
    contactName: "Team",
    email: "hello@drip.com",
    templateId: "email-2",
    personalization:
      "Email marketing agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "111",
    company: "GetResponse",
    contactName: "Team",
    email: "hello@getresponse.com",
    templateId: "email-2",
    personalization:
      "Email marketing agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "112",
    company: "AWeber",
    contactName: "Team",
    email: "hello@aweber.com",
    templateId: "email-2",
    personalization:
      "Email marketing agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "113",
    company: "Campaign Monitor",
    contactName: "Team",
    email: "hello@campaignmonitor.com",
    templateId: "email-2",
    personalization:
      "Email marketing agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "114",
    company: "HubSpot",
    contactName: "Team",
    email: "hello@hubspot.com",
    templateId: "email-2",
    personalization:
      "CRM agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "115",
    company: "Salesforce",
    contactName: "Team",
    email: "hello@salesforce.com",
    templateId: "email-2",
    personalization:
      "CRM agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "116",
    company: "Zoho",
    contactName: "Team",
    email: "hello@zoho.com",
    templateId: "email-2",
    personalization:
      "CRM agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "117",
    company: "Pipedrive",
    contactName: "Team",
    email: "hello@pipedrive.com",
    templateId: "email-2",
    personalization:
      "CRM agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "118",
    company: "Zendesk",
    contactName: "Team",
    email: "hello@zendesk.com",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "119",
    company: "Intercom",
    contactName: "Team",
    email: "hello@intercom.com",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "120",
    company: "Drift",
    contactName: "Team",
    email: "hello@drift.com",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "121",
    company: "Freshdesk",
    contactName: "Team",
    email: "hello@freshdesk.com",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "122",
    company: "Help Scout",
    contactName: "Team",
    email: "hello@helpscout.com",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "123",
    company: "Groove",
    contactName: "Team",
    email: "hello@groove.com",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "124",
    company: "Kayako",
    contactName: "Team",
    email: "hello@kayako.com",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "125",
    company: "LiveChat",
    contactName: "Team",
    email: "hello@livechat.com",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "126",
    company: "Tawk.to",
    contactName: "Team",
    email: "hello@tawk.to",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "127",
    company: "Crisp",
    contactName: "Team",
    email: "hello@crisp.chat",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "128",
    company: "Pure Chat",
    contactName: "Team",
    email: "hello@purechat.com",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "129",
    company: "Chatra",
    contactName: "Team",
    email: "hello@chatra.com",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "130",
    company: "Tidio",
    contactName: "Team",
    email: "hello@tidio.com",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "131",
    company: "Smartsupp",
    contactName: "Team",
    email: "hello@smartsupp.com",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "132",
    company: "Userlike",
    contactName: "Team",
    email: "hello@userlike.com",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "133",
    company: "Olark",
    contactName: "Team",
    email: "hello@olark.com",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "134",
    company: "SnapEngage",
    contactName: "Team",
    email: "hello@snapengage.com",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
  {
    id: "135",
    company: "Comm100",
    contactName: "Team",
    email: "hello@comm100.com",
    templateId: "email-2",
    personalization:
      "Helpdesk agencies managing Shopify integrations see mock JSON drift show up in reviews.",
  },
];
