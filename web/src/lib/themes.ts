import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Calculator,
  Castle,
  Flame,
  Handshake,
  HeartPulse,
  Landmark,
  Megaphone,
  Mountain,
  PiggyBank,
  Shirt,
  Telescope,
  TrendingUp,
  Users,
} from "lucide-react";

/**
 * One thing to look for inside a theme. `query` is searched in "any" mode:
 * exact phrases separated by "|", any of which may match, and a phrase
 * starting with "-" is excluded. The phrases were checked against the real
 * transcripts, including caption misspellings (e.g. "IBIDA" for EBITDA).
 */
export interface LookFor {
  id: string;
  label: string;
  hint: string;
  query: string;
}

export interface Theme {
  id: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
  items: LookFor[];
}

export interface ThemeGroup {
  title: string;
  themes: Theme[];
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function theme(
  id: string,
  title: string,
  blurb: string,
  icon: LucideIcon,
  items: Omit<LookFor, "id">[]
): Theme {
  return { id, title, blurb, icon, items: items.map((it) => ({ ...it, id: slug(it.label) })) };
}

export const THEME_GROUPS: ThemeGroup[] = [
  {
    title: "Business moves",
    themes: [
      theme("finding-deals", "Finding the deal", "Where deals come from, and how to spot an owner who actually wants out.", Telescope, [
        { label: "Motivated sellers", hint: "Owners who need to sell: the key to his buying model.", query: "motivated seller" },
        { label: "Prospecting", hint: "Building a list of companies to approach.", query: "prospecting|deal flow" },
        { label: "Business brokers", hint: "Middlemen who sell companies, and how to handle them.", query: "business broker" },
        { label: "Your first deal", hint: "Getting the first acquisition done.", query: "first deal|first acquisition" },
        { label: "Downturns", hint: "Buying when the economy is under pressure.", query: "recession|economic pressure" },
      ]),
      theme("buying", "Buying companies", "Growing by buying businesses that already work, instead of starting from scratch.", Building2, [
        { label: "Acquisitions", hint: "Buying an existing company.", query: "acquisition|buy companies|buy a company|buying a company" },
        { label: "Roll-ups", hint: "Buying several similar companies and combining them.", query: "roll up" },
        { label: "Turnarounds", hint: "Fixing failing companies, and why his model isn't one.", query: "turnaround" },
        { label: "Private equity", hint: "Investment firms that buy companies with pooled money.", query: "private equity" },
        { label: "Government contracts", hint: "Companies whose customers are governments.", query: "government contracts" },
      ]),
      theme("financing", "Paying for it", "Buying a company with little or none of your own money.", PiggyBank, [
        { label: "Seller financing", hint: "The seller lets you pay part of the price later.", query: "seller financing|seller finance|owner financing" },
        { label: "Other people's money", hint: "Using lenders' and investors' money instead of yours.", query: "other people's money|OPM" },
        { label: "Non-recourse money", hint: "Loans you aren't personally on the hook for.", query: "non-recourse" },
        { label: "Personal guarantees", hint: "Signing to repay a loan yourself. He's against it.", query: "personal guarantee|personally guarantee" },
        { label: "Equity", hint: "Giving up part of the ownership.", query: "equity|-private equity" },
        { label: "Working capital", hint: "Cash to run the business day to day.", query: "working capital" },
      ]),
      theme("banks", "Banks & lenders", "Working with the people who lend the money.", Landmark, [
        { label: "Bankers", hint: "The people who approve the loans.", query: "banker" },
        { label: "Interest rates", hint: "How the cost of borrowing changes a deal.", query: "interest rates|interest rate" },
        { label: "Lines of credit", hint: "A standing loan the business can draw on.", query: "line of credit" },
        { label: "SBA loans", hint: "US government-backed small business loans.", query: "SBA" },
        { label: "Debt", hint: "Borrowed money, and how much a deal can carry.", query: "debt" },
      ]),
      theme("negotiating", "Offers & negotiating", "Making offers, signing letters of intent and knowing when to walk away.", Handshake, [
        { label: "Letters of intent (LOI)", hint: "A non-binding offer, signed before the details.", query: "LOI|letter of intent|letter of interest" },
        { label: "Term sheets", hint: "A summary of a deal's key terms.", query: "term sheet" },
        { label: "Negotiating", hint: "Bargaining over price and terms.", query: "negotiate|negotiation|negotiating" },
        { label: "Walking away", hint: "Knowing when to drop a deal.", query: "walk away|walked away" },
        { label: "Closing the deal", hint: "Getting it signed and done.", query: "close the deal|closing the deal" },
      ]),
      theme("numbers", "Due diligence & numbers", "Checking a business before you buy it, and the numbers that matter.", Calculator, [
        { label: "Due diligence", hint: "Checking the books, contracts and risks before buying.", query: "due diligence" },
        { label: "EBITDA", hint: "An operating-profit measure used to price companies.", query: "EBITDA|IBIDA|EBIDA" },
        { label: "Cash flow", hint: "The cash a business actually brings in.", query: "cash flow" },
        { label: "Valuations & multiples", hint: "What a company is worth, often a multiple of EBITDA.", query: "valuation|multiple of|times EBITDA" },
        { label: "Balance sheets", hint: "What a company owns and owes.", query: "balance sheet" },
        { label: "Margins", hint: "How much of each sale is profit.", query: "margins|margin" },
      ]),
      theme("team", "Your dream team & board", "The advisors, professionals and board members to have around you.", Users, [
        { label: "Dream team", hint: "His name for the advisors behind your deals.", query: "dream team" },
        { label: "Board members", hint: "Directors and non-executive directors.", query: "board members|non-executive directors|non-executive director|your board" },
        { label: "Lawyers & accountants", hint: "The professionals on every deal.", query: "lawyers and accountants|accountants and lawyers|lawyer" },
        { label: "Mentors", hint: "Finding a mentor and learning from one.", query: "mentor" },
        { label: "Success fees", hint: "Paying advisors only when a deal closes.", query: "success fee|engagement letter" },
      ]),
      theme("public", "Going public & shareholders", "Taking a company public, and the people who own it.", TrendingUp, [
        { label: "Going public (IPO)", hint: "Listing a company on a stock exchange.", query: "go public|going public|IPO|public company" },
        { label: "Shareholders", hint: "The people who own a company's shares.", query: "shareholder" },
        { label: "Majority control", hint: "Owning enough to make the decisions.", query: "majority shareholder|controlling interest" },
        { label: "Warrants & options", hint: "Rights to buy shares later at a set price.", query: "warrants|stock options" },
      ]),
      theme("selling", "Pitching & selling", "Getting the meeting, making the pitch and following up.", Megaphone, [
        { label: "Cold calls", hint: "Calling people who don't know you yet.", query: "cold call" },
        { label: "Presentations", hint: "Pitching to bankers, sellers and investors.", query: "presentation|PowerPoint" },
        { label: "The pitch", hint: "Selling the idea fast.", query: "pitch" },
        { label: "Following up", hint: "Staying on people after the first contact.", query: "follow up" },
        { label: "Rejection", hint: "Hearing no and keeping going.", query: "rejection|rejected" },
      ]),
      theme("image", "Image & reputation", "How you come across, and what you're known for.", Shirt, [
        { label: "First impressions", hint: "He says you get two: when you walk in, and when you speak.", query: "first impression" },
        { label: "How you dress", hint: "Clothes, grooming and looking the part.", query: "dress|dressed" },
        { label: "Reputation", hint: "What people say about you.", query: "reputation" },
        { label: "Track record", hint: "Your history of deals and results.", query: "track record" },
      ]),
    ],
  },
  {
    title: "Mindset & life",
    themes: [
      theme("performance", "High performance", "The habits and attitude behind big results.", Flame, [
        { label: "High performance", hint: "His core idea of what it takes.", query: "high performance|high performer|high performers" },
        { label: "Comfort zone", hint: "Getting out of it.", query: "comfort zone" },
        { label: "Excuses", hint: "Why they hold you back.", query: "excuses|-excuse me" },
        { label: "Quantum leap", hint: "His term for a sudden jump in results.", query: "quantum leap" },
        { label: "Goals", hint: "Setting goals and writing them down.", query: "goals" },
        { label: "Sacrifice", hint: "What you give up to get there.", query: "sacrifice" },
        { label: "Being on time", hint: "Punctuality.", query: "on time|punctual" },
      ]),
      theme("risk", "Fear, failure & risk", "Handling fear, making mistakes and taking risks.", Mountain, [
        { label: "Fear", hint: "Facing it.", query: "fear|afraid" },
        { label: "Failure", hint: "Failing, and getting back up.", query: "failure|failed" },
        { label: "Mistakes", hint: "Mistakes made, and ones to avoid.", query: "mistakes|mistake" },
        { label: "Risk", hint: "Taking risks and managing them.", query: "risk" },
        { label: "Confidence", hint: "Believing you can do it.", query: "confidence|confident" },
      ]),
      theme("life", "Health, family & friends", "Your health, and the people around you.", HeartPulse, [
        { label: "Health & exercise", hint: "Keeping your body up to the job.", query: "health|healthy|exercise|gym" },
        { label: "Sleep", hint: "Sleep and rest.", query: "sleep" },
        { label: "Spouses & partners", hint: "The person at home, and their support.", query: "spouse|your wife|your husband|husband and wife" },
        { label: "Friends", hint: "Who you spend your time with.", query: "friends" },
        { label: "Divorce", hint: "When relationships break down.", query: "divorce" },
      ]),
      theme("story", "His story & QLA", "Dan's own companies and his Quantum Leap Advantage program.", Castle, [
        { label: "Great Western Resources", hint: "The oil and gas company he built.", query: "Great Western" },
        { label: "Oil and gas", hint: "His background in the energy business.", query: "oil and gas" },
        { label: "Guthrie Castle", hint: "His castle in Scotland, and the seminars held there.", query: "Guthrie|castle" },
        { label: "QLA", hint: "Quantum Leap Advantage, his program.", query: "QLA|Quantum Leap Advantage" },
      ]),
    ],
  },
];

const BY_ID = new Map<string, { theme: Theme; item: LookFor }>();
for (const group of THEME_GROUPS)
  for (const t of group.themes)
    for (const item of t.items) BY_ID.set(item.id, { theme: t, item });

export function findLook(id: string): { theme: Theme; item: LookFor } | null {
  return BY_ID.get(id) ?? null;
}
