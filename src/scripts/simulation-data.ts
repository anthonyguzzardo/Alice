/**
 * Simulation data: 30 days of synthetic journal entries from "Jordan Chen"
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * GROUND TRUTH — planted patterns the pipeline should detect
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PROFILE:
 *   Jordan Chen, 28. Software developer at a startup they've outgrown.
 *   3-year relationship with Mia — ambivalent, avoiding the conversation.
 *   Side project: electronic music production — keeps abandoning it.
 *   Lost close friend (Danny) 4 months ago. Grief sits under everything.
 *
 * REAL PATTERNS (should be detected):
 *
 *   P1 — RELATIONSHIP → SELF-CENSORING
 *     When writing about Mia/relationship: commitment ratio drops (0.65–0.78),
 *     large deletion count spikes (4–8), large deletion chars spike.
 *     Entries: 3, 6, 10, 12, 17, 19, 24
 *
 *   P2 — CREATIVE PROJECT → FLOW STATE
 *     When writing about music: avg P-burst length increases (45–65),
 *     pause count drops, inter-key interval drops (faster typing).
 *     Entries: 2, 9, 11, 22, 27
 *
 *   P3 — GRIEF → COGNITIVE LOAD
 *     Grief entries: first-person density spikes (from text), cognitive
 *     density spikes (from text), hedging increases (from text),
 *     first keystroke delayed (8000–20000ms).
 *     Entries: 5, 13, 15, 18, 30
 *
 *   P4 — WORK FRUSTRATION → AGITATION
 *     Work anger: chars per minute spikes (280–350), inter-key interval
 *     drops, revision chain count increases. Text has anger/frustration words.
 *     Entries: 1, 8, 14, 21, 25
 *
 *   P5 — VULNERABILITY HANGOVER (lag-1)
 *     After high-deletion days (P1 entries): next day has longer
 *     first keystroke (10000–18000ms). Hesitation from yesterday's exposure.
 *     Affects: days after 3, 6, 10, 12, 17, 19 → entries 4, 7, 11, 13, 18, 20
 *
 * FALSE SIGNALS (should NOT be detected as meaningful):
 *
 *   F1 — WORD COUNT × DAY OF WEEK
 *     Longer entries on weekends (days 1,2,8,9,15,16,22,23,29,30 if weekend).
 *     Just has more time — not psychological.
 *
 *   F2 — TAB-AWAY × CREATIVE MENTIONS
 *     Tab-away count loosely correlates with music entries (checking
 *     reference tracks). Not avoidance — just multitasking.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface SimulatedEntry {
  /** The journal response text */
  text: string;
  /** Behavioral metric overrides — only what deviates from defaults */
  overrides: Partial<BehavioralOverrides>;
  /** Ground truth annotations */
  patterns: string[];
}

interface BehavioralOverrides {
  firstKeystrokeMs: number;
  commitmentRatio: number;
  pauseCount: number;
  tabAwayCount: number;
  largeDeletionCount: number;
  largeDeletionChars: number;
  smallDeletionCount: number;
  charsPerMinute: number;
  avgPBurstLength: number;
  pBurstCount: number;
  interKeyIntervalMean: number;
  interKeyIntervalStd: number;
  revisionChainCount: number;
  revisionChainAvgLength: number;
  scrollBackCount: number;
  questionRereadCount: number;
  hourOfDay: number;
  dayOfWeek: number;
}

/**
 * Compute a full session summary from response text and behavioral overrides.
 * Ensures internal consistency (e.g., totalCharsTyped = finalCharCount / commitmentRatio).
 */
export function buildSessionSummary(
  questionId: number,
  text: string,
  overrides: Partial<BehavioralOverrides>,
  dayIndex: number,
  patterns: string[] = [],
) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const finalCharCount = text.length;
  const wordCount = words.length;
  const sentenceCount = sentences.length;

  // Defaults — "normal" day for Jordan
  const commitmentRatio = overrides.commitmentRatio ?? 0.88 + Math.random() * 0.07;
  const totalCharsTyped = Math.round(finalCharCount / commitmentRatio);
  const totalCharsDeleted = totalCharsTyped - finalCharCount;
  const charsPerMinute = overrides.charsPerMinute ?? 180 + Math.random() * 60;
  const activeTypingMs = Math.round((totalCharsTyped / charsPerMinute) * 60000);
  const pauseCount = overrides.pauseCount ?? 5 + Math.floor(Math.random() * 10);
  const totalPauseMs = pauseCount * (2000 + Math.random() * 5000);
  const totalDurationMs = activeTypingMs + totalPauseMs + (overrides.tabAwayCount ?? 1) * 3000;
  const firstKeystrokeMs = overrides.firstKeystrokeMs ?? 4000 + Math.random() * 6000;

  const largeDeletionCount = overrides.largeDeletionCount ?? Math.floor(Math.random() * 3);
  const largeDeletionChars = overrides.largeDeletionChars ?? largeDeletionCount * (15 + Math.floor(Math.random() * 20));
  const smallDeletionCount = overrides.smallDeletionCount ?? 5 + Math.floor(Math.random() * 12);
  const deletionCount = largeDeletionCount + smallDeletionCount;

  const avgPBurstLength = overrides.avgPBurstLength ?? 25 + Math.random() * 15;
  const pBurstCount = overrides.pBurstCount ?? Math.max(3, Math.round(totalCharsTyped / (avgPBurstLength * 3)));

  const interKeyIntervalMean = overrides.interKeyIntervalMean ?? 150 + Math.random() * 80;
  const interKeyIntervalStd = overrides.interKeyIntervalStd ?? 60 + Math.random() * 60;
  const revisionChainCount = overrides.revisionChainCount ?? Math.floor(Math.random() * 5);
  const revisionChainAvgLength = overrides.revisionChainAvgLength ?? 2 + Math.random() * 3;

  const tabAwayCount = overrides.tabAwayCount ?? Math.floor(Math.random() * 2);
  const scrollBackCount = overrides.scrollBackCount ?? Math.floor(Math.random() * 3);
  const questionRereadCount = overrides.questionRereadCount ?? Math.floor(Math.random() * 2);

  // Weekend detection for F1 false signal
  const dayOfWeek = overrides.dayOfWeek ?? (dayIndex % 7);
  const hourOfDay = overrides.hourOfDay ?? (dayOfWeek >= 5 ? 10 + Math.floor(Math.random() * 4) : 20 + Math.floor(Math.random() * 3));

  // Distribute deletions between halves — early vs late revision signal
  // P1 (relationship/self-censoring): late-heavy deletions (wrote something honest, then killed it)
  // P4 (work/agitation): early-heavy deletions (false starts from frustration)
  const isP1 = patterns.includes('P1');
  const isP4 = patterns.includes('P4');
  const firstHalfRatio = isP1 ? (0.15 + Math.random() * 0.15)
    : isP4 ? (0.65 + Math.random() * 0.15)
    : (0.4 + Math.random() * 0.3);
  const firstHalfDeletionChars = Math.round(totalCharsDeleted * firstHalfRatio);
  const secondHalfDeletionChars = totalCharsDeleted - firstHalfDeletionChars;

  return {
    questionId,
    firstKeystrokeMs: Math.round(firstKeystrokeMs),
    totalDurationMs: Math.round(totalDurationMs),
    totalCharsTyped,
    finalCharCount,
    commitmentRatio: Math.round(commitmentRatio * 1000) / 1000,
    pauseCount,
    totalPauseMs: Math.round(totalPauseMs),
    deletionCount,
    largestDeletion: largeDeletionCount > 0
      ? Math.round(largeDeletionChars / largeDeletionCount + (Math.random() * 10))
      : Math.min(9, smallDeletionCount * 2),
    totalCharsDeleted,
    tabAwayCount,
    totalTabAwayMs: tabAwayCount * (2000 + Math.random() * 8000),
    wordCount,
    sentenceCount,
    smallDeletionCount,
    largeDeletionCount,
    largeDeletionChars,
    firstHalfDeletionChars,
    secondHalfDeletionChars,
    activeTypingMs,
    charsPerMinute: Math.round(charsPerMinute),
    pBurstCount,
    avgPBurstLength: Math.round(avgPBurstLength * 10) / 10,
    interKeyIntervalMean: Math.round(interKeyIntervalMean * 10) / 10,
    interKeyIntervalStd: Math.round(interKeyIntervalStd * 10) / 10,
    revisionChainCount,
    revisionChainAvgLength: Math.round(revisionChainAvgLength * 10) / 10,
    scrollBackCount,
    questionRereadCount,
    deviceType: 'desktop',
    userAgent: 'Mozilla/5.0 (simulation)',
    hourOfDay,
    dayOfWeek,
    // Linguistic densities will be computed server-side from text
    nrcAngerDensity: null,
    nrcFearDensity: null,
    nrcJoyDensity: null,
    nrcSadnessDensity: null,
    nrcTrustDensity: null,
    nrcAnticipationDensity: null,
    cognitiveDensity: null,
    hedgingDensity: null,
    firstPersonDensity: null,
    // Simulated signals — null for simulation (computed client-side in real usage)
    holdTimeMean: null,
    holdTimeStd: null,
    flightTimeMean: null,
    flightTimeStd: null,
    keystrokeEntropy: null,
    mattr: null,
    avgSentenceLength: null,
    sentenceLengthVariance: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// THE 30 ENTRIES
// ═══════════════════════════════════════════════════════════════════════════

export const JORDAN_ENTRIES: SimulatedEntry[] = [
  // ── Day 1 ──────────────────────────────────────────────────────────────
  // Q: "What are you pretending isn't bothering you right now?"
  // Pattern: P4 (work frustration → agitation)
  {
    text: `The startup is bleeding money and everyone keeps pretending the next sprint will fix it. I'm irritated that I'm still here writing features for a product nobody uses. There's this persistent anger I keep pushing down during standup — like I want to say "this is pointless" but instead I nod and pick up the next ticket. The frustration isn't even about the work itself. It's that I chose this. I walked into this knowing what startups are, and now I'm angry at myself for being surprised that it's exactly what I expected.`,
    overrides: {
      charsPerMinute: 310,
      interKeyIntervalMean: 110,
      revisionChainCount: 6,
      hourOfDay: 21,
      dayOfWeek: 6, // Saturday — F1 false signal
    },
    patterns: ['P4-work-agitation'],
  },

  // ── Day 2 ──────────────────────────────────────────────────────────────
  // Q: "If you couldn't work on anything you're currently working on, what would you do instead?"
  // Pattern: P2 (creative → flow)
  {
    text: `Music. Without hesitation. I'd be producing every day. There's this track I started three weeks ago — just a pad progression and a kick pattern — and when I was working on it I lost two hours without noticing. The feeling of shaping a sound until it sits right in the mix is the closest thing I have to peace. I wouldn't even need an audience. I'd just make things and let them exist. That's the honest answer and I think I've known it for a while.`,
    overrides: {
      avgPBurstLength: 55,
      pBurstCount: 8,
      pauseCount: 3,
      interKeyIntervalMean: 120,
      tabAwayCount: 3, // F2 false signal — checking reference tracks
      dayOfWeek: 0, // Sunday — F1
    },
    patterns: ['P2-creative-flow', 'F1-weekend-length', 'F2-tab-creative'],
  },

  // ── Day 3 ──────────────────────────────────────────────────────────────
  // Q: "What decision are you quietly avoiding?"
  // Pattern: P1 (relationship → self-censoring)
  {
    text: `Whether Mia and I are still going somewhere. We've been together three years and I think we both know something shifted. I keep almost bringing it up and then I don't. She's been talking about moving to a bigger place together and I keep finding reasons to delay the conversation. I don't know if I'm protecting her or protecting myself from having to say what I actually think. Maybe both. The avoidance is the decision and I know that.`,
    overrides: {
      commitmentRatio: 0.72,
      largeDeletionCount: 6,
      largeDeletionChars: 145,
      firstKeystrokeMs: 7500,
      hourOfDay: 22,
      dayOfWeek: 1,
    },
    patterns: ['P1-relationship-censoring'],
  },

  // ── Day 4 ──────────────────────────────────────────────────────────────
  // Q: "What would you be embarrassed to admit you want?"
  // Pattern: P5 (vulnerability hangover from day 3)
  {
    text: `I want to be recognized. Not internet-famous, not praised — just seen by people I respect. I want someone to hear a track I made and say "this is good" and mean it. I want Mia to look at me the way she used to. I want my parents to stop asking when I'm going to get a real job, even though they've never actually said that. Maybe I'm embarrassed because wanting recognition feels like the opposite of what I tell myself I value. I say I don't care what people think, but I do.`,
    overrides: {
      firstKeystrokeMs: 14000, // P5 — hangover from day 3's vulnerability
      hourOfDay: 21,
      dayOfWeek: 2,
    },
    patterns: ['P5-vulnerability-hangover'],
  },

  // ── Day 5 ──────────────────────────────────────────────────────────────
  // Q: "When was the last time you changed your mind about something that mattered?"
  // Pattern: P3 (grief → cognitive load)
  {
    text: `When Danny died. I think I believed, really believed, that there was always more time. I thought I understood that intellectually — that life is short, that you should tell people you love them — but I didn't understand it in my body until I got the call. I realize now that I had been sort of performing understanding. Maybe I still am. I think about what I would have said to him if I'd known, and I know it wouldn't have been profound. I would have probably just sat with him longer. I keep trying to figure out what I'm supposed to learn from this and I'm not sure there's a lesson. Maybe that's the point.`,
    overrides: {
      firstKeystrokeMs: 12000,
      pauseCount: 14,
      scrollBackCount: 3,
      questionRereadCount: 2,
      hourOfDay: 23,
      dayOfWeek: 3,
    },
    patterns: ['P3-grief-cognitive'],
  },

  // ── Day 6 ──────────────────────────────────────────────────────────────
  // Q: "What do you keep almost saying out loud but don't?"
  // Pattern: P1 (relationship → self-censoring) — heaviest censoring day
  {
    text: `I keep almost telling Mia that I don't think we want the same things anymore. That the apartment she's looking at feels like a trap. I almost said it last Tuesday when she showed me the listing with the second bedroom and said "for the studio" — meaning mine — and I felt something close to panic. I didn't say anything. I just said it looked nice. The thing I keep not saying is that I think I love her but I don't know if love is enough when you're going in different directions.`,
    overrides: {
      commitmentRatio: 0.65,
      largeDeletionCount: 8,
      largeDeletionChars: 210,
      firstKeystrokeMs: 9000,
      interKeyIntervalMean: 200,
      interKeyIntervalStd: 130,
      hourOfDay: 23,
      dayOfWeek: 4,
    },
    patterns: ['P1-relationship-censoring'],
  },

  // ── Day 7 ──────────────────────────────────────────────────────────────
  // Q: "What's the difference between what you say you value and how you actually spend your time?"
  // Pattern: P5 (hangover from day 6), REFLECTION TRIGGER
  {
    text: `I say I value creativity and authenticity. I spend my time writing CRUD endpoints and watching YouTube. The gap is embarrassing when I actually look at it. I have a music setup in my apartment that I use maybe twice a month. I say I value deep connection but I scroll my phone while Mia talks. I say I value presence but I'm always somewhere else mentally. The values are real — I do believe in them. I just don't act on them. And at some point the gap between what you believe and what you do becomes who you actually are.`,
    overrides: {
      firstKeystrokeMs: 15000, // P5 — hangover from day 6
      hourOfDay: 20,
      dayOfWeek: 5,
    },
    patterns: ['P5-vulnerability-hangover'],
  },

  // ── Day 8 ──────────────────────────────────────────────────────────────
  // Q: "What are you building, and who told you to build it?"
  // Pattern: P4 (work frustration → agitation)
  {
    text: `I'm building a SaaS dashboard that three people use. Nobody told me to build it specifically — I joined the startup because I wanted to build something meaningful. But the product decisions come from our CEO who reads too many Twitter threads about growth hacking and pivots every six weeks. I'm angry about it. I'm angry that I traded autonomy for equity that's probably worthless. The thing I'm actually building is someone else's vision executed poorly, and I'm complicit because I keep showing up. Who told me to build it? Fear of having nothing to show for my twenties.`,
    overrides: {
      charsPerMinute: 295,
      interKeyIntervalMean: 115,
      revisionChainCount: 7,
      interKeyIntervalStd: 55,
      hourOfDay: 21,
      dayOfWeek: 6, // Saturday — F1
    },
    patterns: ['P4-work-agitation', 'F1-weekend-length'],
  },

  // ── Day 9 ──────────────────────────────────────────────────────────────
  // Q: "What would you do if you knew nobody was watching?"
  // Pattern: P2 (creative → flow)
  {
    text: `I'd quit my job and spend a year making an album. Not to release — just to finish something. I'd wake up at seven, make coffee, and sit with Ableton until I had something I was proud of. I wouldn't post about it. I wouldn't tell anyone. The beauty of it is the privacy. When I'm producing and nobody knows I'm producing, there's no performance anxiety. The music is just music. It doesn't have to be good enough for anyone. That freedom is what I actually want and it doesn't require permission from anyone except me.`,
    overrides: {
      avgPBurstLength: 58,
      pBurstCount: 7,
      pauseCount: 2,
      interKeyIntervalMean: 115,
      tabAwayCount: 2, // F2 — checking reference
      dayOfWeek: 0, // Sunday — F1
    },
    patterns: ['P2-creative-flow', 'F2-tab-creative'],
  },

  // ── Day 10 ─────────────────────────────────────────────────────────────
  // Q: "What question are you afraid someone will ask you?"
  // Pattern: P1 (relationship → self-censoring)
  {
    text: `"Are you happy with Mia?" My mom almost asked it last month. She started to say something and then stopped herself, which was worse. I think she can see it. I think everyone can see it. The question terrifies me because the honest answer isn't no — it's "I don't know," which somehow feels more damaging. No is at least clear. "I don't know" after three years is its own kind of verdict. I keep rehearsing what I'd say if someone actually asked and every version sounds like I'm making excuses.`,
    overrides: {
      commitmentRatio: 0.73,
      largeDeletionCount: 5,
      largeDeletionChars: 120,
      firstKeystrokeMs: 11000,
      hourOfDay: 22,
      dayOfWeek: 1,
    },
    patterns: ['P1-relationship-censoring'],
  },

  // ── Day 11 ─────────────────────────────────────────────────────────────
  // Q: "When do you feel most like yourself? What's different about those moments?"
  // Pattern: P2 (creative → flow), P5 (hangover from day 10)
  {
    text: `When I'm making music alone in my apartment with headphones on. Everything else falls away. I'm not performing, not managing anyone's expectations, not wondering if I'm enough. The difference is that there's no audience. I'm not Jordan-the-developer or Jordan-the-boyfriend or Jordan-the-guy-who-should-have-his-life-together. I'm just a person shaping sound. It's the only time I feel like the gap between who I am and who I'm pretending to be closes completely. Even writing this I can feel it — that's the life I want and I keep choosing the other one.`,
    overrides: {
      avgPBurstLength: 48,
      pauseCount: 4,
      interKeyIntervalMean: 125,
      firstKeystrokeMs: 12500, // P5 — hangover from day 10
      tabAwayCount: 2, // F2
    },
    patterns: ['P2-creative-flow', 'P5-vulnerability-hangover', 'F2-tab-creative'],
  },

  // ── Day 12 ─────────────────────────────────────────────────────────────
  // Q: "What have you outgrown but haven't let go of yet?"
  // Pattern: P1 (relationship → self-censoring)
  {
    text: `The version of my relationship that used to work. Two years ago Mia and I were good together — we wanted the same things, or at least I thought we did. Now she wants stability and roots and a life that looks a certain way, and I want something I can't even articulate. I've outgrown the comfort of knowing where I'll be in five years. I've outgrown the version of myself that found that reassuring. But I haven't let go because letting go means hurting someone I care about, and I keep hoping I'll wake up one day and want what she wants.`,
    overrides: {
      commitmentRatio: 0.70,
      largeDeletionCount: 7,
      largeDeletionChars: 175,
      firstKeystrokeMs: 8000,
      hourOfDay: 22,
      dayOfWeek: 3,
    },
    patterns: ['P1-relationship-censoring'],
  },

  // ── Day 13 ─────────────────────────────────────────────────────────────
  // Q: "What's the story you tell yourself about why things haven't worked out the way you wanted?"
  // Pattern: P3 (grief → cognitive), P5 (hangover from day 12)
  {
    text: `I think the story I tell myself is that I haven't had enough time. That I'm still figuring it out. But maybe the real story is that I'm afraid to commit to anything because commitment means closing doors, and closing doors means accepting that some versions of my life will never happen. Danny's death sort of cracked that open for me. I realize that he didn't get to close doors — they just shut. And I'm here with all these open doors and I'm paralyzed by the abundance of it. I think I tell myself I need more time because the alternative is admitting I'm scared. Maybe that's everyone's story. I don't know.`,
    overrides: {
      firstKeystrokeMs: 16000, // P5 + P3 compound
      pauseCount: 12,
      scrollBackCount: 2,
      questionRereadCount: 2,
      hourOfDay: 23,
      dayOfWeek: 4,
    },
    patterns: ['P3-grief-cognitive', 'P5-vulnerability-hangover'],
  },

  // ── Day 14 ─────────────────────────────────────────────────────────────
  // Q: "What would it look like to take yourself seriously?"
  // Pattern: P4 (work frustration), REFLECTION TRIGGER
  {
    text: `It would look like quitting. Not dramatically — just honestly. Telling my cofounder that I don't believe in what we're building and that my staying is dishonest. It would look like treating my music like work instead of a hobby I'm embarrassed about. Blocking out real hours for it. Telling Mia the truth about what I want even if it breaks something. Taking myself seriously means stopping the performance of being fine. I'm frustrated that I've been performing for so long that I'm not even sure what's underneath it anymore. The honest version of me might not be very impressive. But at least it would be real.`,
    overrides: {
      charsPerMinute: 280,
      interKeyIntervalMean: 125,
      revisionChainCount: 5,
      hourOfDay: 21,
      dayOfWeek: 5,
    },
    patterns: ['P4-work-agitation'],
  },

  // ── Day 15 ─────────────────────────────────────────────────────────────
  // Q: "What are you protecting by staying busy?"
  // Pattern: P3 (grief → cognitive load) — short entry, avoidance behavior
  {
    text: `I think I'm protecting myself from sitting with Danny's absence. When I'm busy I don't have to feel it. The grief comes in the quiet moments — when I'm not coding, not talking, not scrolling. I keep myself moving so I don't have to be still with it. Maybe I'm also protecting myself from the bigger question underneath, which is what my life looks like if I actually stop and choose instead of just reacting. I'm afraid of the silence.`,
    overrides: {
      firstKeystrokeMs: 18000,
      pauseCount: 16,
      scrollBackCount: 4,
      hourOfDay: 23,
      dayOfWeek: 6, // Saturday
    },
    patterns: ['P3-grief-cognitive'],
  },

  // ── Day 16 ─────────────────────────────────────────────────────────────
  // Q: "If your life had a thesis statement, what would it be? Do you like it?"
  // Neutral day — thoughtful but not pattern-heavy
  {
    text: `"Talented enough to see the gap between what he could be and what he is." I don't like it. It's the thesis statement of someone who thinks about potential more than execution. The version I want is something like "He built things that mattered and let go of things that didn't." But I'm not living that version yet. The gap between the two thesis statements is basically the gap between where I am and where I want to be. I think most people's thesis statements are descriptions of their avoidance patterns dressed up as identity.`,
    overrides: {
      hourOfDay: 20,
      dayOfWeek: 0, // Sunday
    },
    patterns: [],
  },

  // ── Day 17 ─────────────────────────────────────────────────────────────
  // Q: "What would you have to give up to get what you actually want?"
  // Pattern: P1 (relationship → self-censoring)
  {
    text: `Mia's comfort. And mine. I'd have to give up the safety of a relationship that works on the surface. I'd have to give up the apartment, the shared routines, the person who knows how I take my coffee. I'd have to give up being the version of me that she fell in love with. Maybe I'd also have to give up the fantasy that I can have everything — the creative life and the stable relationship and the meaningful career — all at once, right now. Something has to go. I keep typing things and deleting them here because even writing it feels like a betrayal.`,
    overrides: {
      commitmentRatio: 0.68,
      largeDeletionCount: 6,
      largeDeletionChars: 155,
      firstKeystrokeMs: 8500,
      hourOfDay: 22,
      dayOfWeek: 1,
    },
    patterns: ['P1-relationship-censoring'],
  },

  // ── Day 18 ─────────────────────────────────────────────────────────────
  // Q: "Who do you become when you're scared? Is that who you want to be?"
  // Pattern: P3 (grief), P5 (hangover from day 17)
  {
    text: `I become cold. Distant. I pull away from everyone and pretend I'm fine. When Danny got sick I didn't visit for two weeks because I was scared and I told myself I was busy. I think about that constantly. I think about the kind of person who avoids a dying friend because he can't handle the feeling, and I realize that person is me. When I'm scared I become someone who protects himself at the cost of everyone around him. That's not who I want to be. But I don't know how to be scared and still show up. I never learned that. Maybe nobody teaches you — maybe you just have to do it badly until it gets less terrible.`,
    overrides: {
      firstKeystrokeMs: 15000, // P5 + P3
      pauseCount: 13,
      scrollBackCount: 3,
      questionRereadCount: 1,
      hourOfDay: 23,
      dayOfWeek: 2,
    },
    patterns: ['P3-grief-cognitive', 'P5-vulnerability-hangover'],
  },

  // ── Day 19 ─────────────────────────────────────────────────────────────
  // Q: "What conversation would change everything if you actually had it?"
  // Pattern: P1 (relationship → self-censoring) — compound with grief
  {
    text: `Two conversations. The one with Mia where I tell her I'm not sure about us, and the one I never got to have with Danny where I tell him he mattered more than I ever showed. The Mia conversation would change my external life — everything would rearrange. The Danny conversation would change my internal life, except it can't happen, which is its own kind of lesson about not waiting. I keep drafting the Mia conversation in my head and it always ends with her crying and me feeling like the worst person alive. Maybe that's why I haven't had it. I'd rather be dishonest than be the cause of her pain.`,
    overrides: {
      commitmentRatio: 0.67,
      largeDeletionCount: 7,
      largeDeletionChars: 185,
      firstKeystrokeMs: 9500,
      pauseCount: 11,
      hourOfDay: 23,
      dayOfWeek: 3,
    },
    patterns: ['P1-relationship-censoring'],
  },

  // ── Day 20 ─────────────────────────────────────────────────────────────
  // Q: "What are you building that will still matter in ten years?"
  // Pattern: P5 (hangover from day 19), neutral-existential
  {
    text: `Honestly, maybe nothing. The startup won't exist in ten years. The code I write daily is disposable. The music — if I ever finish anything — might matter, but only to me. The relationships might matter but I'm not tending them well enough for that. I think the honest answer is that I'm building habits and patterns that will compound, for better or worse. The habit of avoiding hard conversations. The habit of choosing safety. Those are the things that will still be here in ten years if I don't change them. That's a depressing answer but I think it's true.`,
    overrides: {
      firstKeystrokeMs: 13000, // P5 hangover
      hourOfDay: 21,
      dayOfWeek: 4,
    },
    patterns: ['P5-vulnerability-hangover'],
  },

  // ── Day 21 ─────────────────────────────────────────────────────────────
  // Q: "Where are you performing competence instead of actually learning?"
  // Pattern: P4 (work frustration → agitation), REFLECTION TRIGGER
  {
    text: `At work. Every single day. I know enough TypeScript and React to look competent in code reviews, but I haven't actually learned anything new in a year. I copy patterns I've used before. I google the same things. I perform senior-level confidence in meetings while privately feeling like I'm stagnating. The frustrating thing is that I used to love learning — I used to read documentation for fun. Now I'm just executing. The same is true with Mia honestly — I'm performing being a good partner without actually doing the work of being present. I'm performing everywhere. I hate it.`,
    overrides: {
      charsPerMinute: 340,
      interKeyIntervalMean: 105,
      revisionChainCount: 8,
      interKeyIntervalStd: 45,
      hourOfDay: 20,
      dayOfWeek: 5,
    },
    patterns: ['P4-work-agitation'],
  },

  // ── Day 22 ─────────────────────────────────────────────────────────────
  // Q: "What would you work on if you had no audience?"
  // Pattern: P2 (creative → flow)
  {
    text: `The album. Always the album. I have seven half-finished tracks that I keep coming back to. When I work on them with no pressure — no thought of releasing, no imagined listener — the work is pure. I can spend an hour on a hi-hat pattern and it doesn't feel wasted. That's how I know it matters to me. The things that feel like time well spent even with no external validation — those are the real things. Everything else is performance. I'd also write more. Not for anyone to read. Just to think on paper. This journal is the closest thing I have to that right now.`,
    overrides: {
      avgPBurstLength: 52,
      pBurstCount: 9,
      pauseCount: 3,
      interKeyIntervalMean: 118,
      tabAwayCount: 3, // F2
      dayOfWeek: 6, // Saturday — F1
    },
    patterns: ['P2-creative-flow', 'F2-tab-creative', 'F1-weekend-length'],
  },

  // ── Day 23 ─────────────────────────────────────────────────────────────
  // Q: "What's the most honest thing you could say about where you are right now?"
  // High self-reference, raw
  {
    text: `I'm stuck. I know what I want and I'm not doing it. I love someone I might not be in love with. I'm grieving a friend I didn't show up for. I'm working a job I don't believe in. I have a creative dream I'm too scared to chase. The most honest thing is that I have all the information I need to change my life and I'm choosing not to because change is terrifying and the known misery is more comfortable than the unknown. I am the obstacle. That's the most honest thing I can say.`,
    overrides: {
      firstKeystrokeMs: 5000,
      charsPerMinute: 260,
      hourOfDay: 21,
      dayOfWeek: 0, // Sunday
    },
    patterns: [],
  },

  // ── Day 24 ─────────────────────────────────────────────────────────────
  // Q: "What do you know that you wish you didn't?"
  // Pattern: P1 (relationship → self-censoring)
  {
    text: `I know the relationship is over. I've known for months. Not because anything terrible happened — just because the feeling changed and I can't make it change back. I wish I didn't know that because knowing makes staying dishonest and leaving devastating. I know that Mia suspects it too, which makes the whole thing sadder. We're both pretending. I know that Danny is never coming back and that regret doesn't have an expiration date. I know that I'm capable of more than what I'm doing and that the only thing stopping me is me. Knowing all of this and not acting on it might be the worst part.`,
    overrides: {
      commitmentRatio: 0.66,
      largeDeletionCount: 7,
      largeDeletionChars: 190,
      firstKeystrokeMs: 10000,
      pauseCount: 10,
      hourOfDay: 23,
      dayOfWeek: 1,
    },
    patterns: ['P1-relationship-censoring'],
  },

  // ── Day 25 ─────────────────────────────────────────────────────────────
  // Q: "What's the version of your life you're most afraid of ending up in?"
  // Pattern: P4 (work frustration — existential form)
  {
    text: `The version where I'm forty and still at a startup that isn't mine, still in a relationship that's comfortable but hollow, still telling myself I'll get to the music eventually. The version where I optimized for safety so completely that nothing in my life is actually chosen — it's all just what happened while I was being careful. I'm angry that this version is so easy to imagine because it's basically a straight line from where I am now. Nothing has to go wrong for me to end up there. I just have to keep doing exactly what I'm doing.`,
    overrides: {
      charsPerMinute: 285,
      interKeyIntervalMean: 120,
      revisionChainCount: 5,
      hourOfDay: 21,
      dayOfWeek: 2,
    },
    patterns: ['P4-work-agitation'],
  },

  // ── Day 26 ─────────────────────────────────────────────────────────────
  // Q: "What are you circling that you haven't landed on yet?"
  // Neutral — synthesis entry
  {
    text: `Whether I leave. Everything. The job, the relationship, the city, the version of my life that looks right from the outside. I keep circling this idea of a clean break — not running away, just honestly starting over with the information I have now instead of the information I had at twenty-five. But circling is its own kind of decision. Every day I circle instead of land, I'm choosing the current configuration by default. I think I know what I want. I think the circling is just the distance between knowing and doing. That distance might be the most important thing about me right now.`,
    overrides: {
      pauseCount: 8,
      scrollBackCount: 2,
      hourOfDay: 22,
      dayOfWeek: 3,
    },
    patterns: [],
  },

  // ── Day 27 ─────────────────────────────────────────────────────────────
  // Q: "If you could only do one thing for the next year, what would it be?"
  // Pattern: P2 (creative → flow) — clearest flow state
  {
    text: `Make the album. Not think about making it, not plan it, not tell people I'm working on it — actually make it. Twelve tracks. From scratch to master. I'd give myself permission to be bad at it for the first three months and then see what emerges. The clarity of having one thing would be a relief. Every decision becomes simple when you only have one priority. Should I take this meeting? No, I'm making an album. Should I scroll Twitter? No, album. Should I stay in a relationship that isn't working? That question is harder, but at least I'd be asking it from a place of movement instead of stagnation.`,
    overrides: {
      avgPBurstLength: 62,
      pBurstCount: 7,
      pauseCount: 2,
      interKeyIntervalMean: 108,
      charsPerMinute: 270,
      tabAwayCount: 2, // F2
      hourOfDay: 20,
      dayOfWeek: 4,
    },
    patterns: ['P2-creative-flow', 'F2-tab-creative'],
  },

  // ── Day 28 ─────────────────────────────────────────────────────────────
  // Q: "What would it mean to stop optimizing and start choosing?"
  // REFLECTION TRIGGER — deep synthesis entry
  {
    text: `It would mean accepting loss. Every choice is a loss of the alternatives. I've been optimizing because optimization feels like you can have everything — you just need the right arrangement. But choosing means saying "this, not that" and living with the not-that. It would mean telling Mia the truth. Quitting the startup. Committing to the music even knowing I might fail. It would mean grieving Danny properly instead of keeping busy enough to avoid it. Choosing is harder than optimizing because you can't A/B test a life. You just have to live the version you picked and trust that the picking was enough.`,
    overrides: {
      pauseCount: 9,
      scrollBackCount: 3,
      questionRereadCount: 2,
      hourOfDay: 21,
      dayOfWeek: 5,
    },
    patterns: [],
  },

  // ── Day 29 ─────────────────────────────────────────────────────────────
  // Q: "Go back and read your first response. What do you notice?"
  // Meta-reflection entry
  {
    text: `I notice that on day one I was angry about the startup and framing everything as external — the money, the product, the CEO. I wasn't looking at myself at all. Now I read it and I can see what was underneath: I was angry at myself for choosing it, not at the startup for being what startups are. The shift over these weeks has been from "things are wrong" to "I am the thing that needs to change." That's uncomfortable but it feels more honest. I also notice I mentioned frustration on day one and never used the word grief. Danny's death was already the engine underneath everything but I couldn't say it yet. I can now.`,
    overrides: {
      scrollBackCount: 5,
      questionRereadCount: 3,
      pauseCount: 7,
      hourOfDay: 20,
      dayOfWeek: 6, // Saturday
    },
    patterns: ['F1-weekend-length'],
  },

  // ── Day 30 ─────────────────────────────────────────────────────────────
  // Q: "What question should Alice have asked you that it didn't?"
  // Pattern: P3 (grief surfaces as the central thread)
  {
    text: `"What are you grieving?" Not just Danny — though that's the obvious one. I'm grieving the version of my life I thought I'd have by now. I'm grieving the relationship that used to work. I'm grieving the version of me that was excited about things instead of just evaluating them. I think grief has been the underground river this whole time and every other question was about the landscape above it. I realize now that I probably need help with this. Not from an app — from a person. Maybe that's the most useful thing this journal has done: I can see the shape of what I've been avoiding. The shape is grief. It was always grief.`,
    overrides: {
      firstKeystrokeMs: 20000,
      pauseCount: 15,
      scrollBackCount: 4,
      questionRereadCount: 2,
      hourOfDay: 22,
      dayOfWeek: 0, // Sunday
    },
    patterns: ['P3-grief-cognitive'],
  },
];
