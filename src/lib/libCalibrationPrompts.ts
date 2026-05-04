/**
 * Neutral prompts for calibration sessions.
 *
 * MEASUREMENT GOAL
 * Establish a within-subject baseline of keystroke dynamics during
 * knowledge-telling cognition (Bereiter & Scardamalia, 1987): direct memory
 * probe and recitation, no synthesis, no emotional load. Calibration sessions
 * become the floor against which journal sessions are compared for KT
 * detection, drift, and daily delta.
 *
 * DESIGN RULES
 *  1. Knowledge-telling only. Each prompt must be answerable by direct probe
 *     of memory (episodic, perceptual, or procedural). No prompt should
 *     require synthesizing across domains, evaluating tradeoffs, taking a
 *     position, or constructing new understanding. Knowledge-transforming
 *     prompts contaminate the baseline.
 *  2. Active recall over free description. A prompt that demands a real
 *     mental search ("what did you eat last night") produces richer and more
 *     informative keystroke variation than one that affords pattern-completion
 *     ("describe a paperclip"). Templated, decoration-style prompts induce
 *     auto-pilot typing, which is task-avoidance dynamics, not recitation
 *     dynamics. That degrades the measurement.
 *  3. Surface-form variety inside each cognitive family. Within a family
 *     (e.g. recent autobiographical recall) every prompt opens differently
 *     and asks for a different slice of memory. No template is allowed to
 *     repeat more than a few times across the whole pool.
 *  4. Adult register. Prompts address a competent adult with a busy life. No
 *     "explain to someone who has never seen one." No object-identification
 *     of trivial household items. No taboo-word puzzles. No sensory imagery
 *     directed at hypothetical naive observers.
 *
 * COGNITIVE FAMILIES
 *   - Present observation       (perceptual scan of immediate environment)
 *   - Recent autobiographical   (episodic recall of the last hours/days)
 *   - Personal procedural       (recitation of habitual routines)
 *   - Place memory              (spatial recall of known environments)
 *   - Enumeration               (concrete counting / listing in scene)
 *   - Perspective and framing   (re-describing the scene from a fixed angle)
 *   - Verbal fluency (canonical)(Wikipedia: animals, supermarket, letter S,
 *                                etc.; bounded set, not extended templates)
 *   - Recent inputs             (last book, video, news, recommendation)
 *   - Bodily attention          (interoception / proprioception, no synthesis)
 *   - Hidden inventory          (location-cued recall: what is behind / inside
 *                                a closed thing, retrieved without looking)
 *   - Intangible inventory      (digital and abstract enumeration: tabs,
 *                                charges, contacts, files)
 *   - Object provenance         (history of a specific physical object owned)
 *   - Semantic recall           (long-term factual memory: numbers, lyrics,
 *                                languages, names from earlier life)
 *   - Daily grain               (procedural at rare granularity: which knob,
 *                                which loop, which direction)
 *   - Known people              (neutral factual recall about specific known
 *                                others: preferences, habits, environments)
 *   - Temporal                  (concrete schedule and time recall)
 *   - Oblique inventory         (listing by unusual property: things with
 *                                moving parts, things with words on them)
 *
 * WHAT WAS REMOVED (and why)
 *   - "Describe a [paperclip|zipper|safety pin|hinge|...] to someone who has
 *     never seen one." 30+ prompts on the same template, all directed at
 *     trivial household objects. Reads as a teacher prompt addressed to a
 *     child. Suppresses engaged recall.
 *   - "Describe X without using the words Y, Z, W." Lexical-constraint puzzle.
 *     Pulls cognition toward problem-solving, not knowledge-telling, so the
 *     resulting keystroke trace is not a clean baseline.
 *   - "Describe the [taste|smell|feel|sound] of X to someone who has never
 *     [had|smelled|felt|heard] it." 48 prompts on near-identical templates,
 *     and the framing pulls toward analogy / metaphor generation, which is
 *     closer to knowledge-transforming than knowledge-telling.
 *   - Most "explain how to [tie a shoe|crack an egg|...]" generic life-skills
 *     prompts. Replaced with personal-procedural prompts about routines the
 *     subject actually performs, which afford real recall instead of
 *     condescending recitation.
 */
export const CALIBRATION_PROMPTS: string[] = [
  // ---------------------------------------------------------------------------
  // PRESENT OBSERVATION
  // ---------------------------------------------------------------------------
  "Look around. What's the first thing your eyes land on?",
  "Describe the room you're sitting in right now.",
  "What's on the surface closest to your hand?",
  "What can you see from where you're sitting that wasn't here a week ago?",
  "Describe the lighting right now. Sources, colors, where shadows fall.",
  "What's the temperature in the room, and how do you know?",
  "Three sounds you can hear, ordered nearest to farthest.",
  "What's the most recently moved object in your field of view?",
  "Pick up the closest object that isn't a phone or laptop. Describe it.",
  "How worn is the floor under you? Material, color, scuff marks.",
  "Describe the ceiling above you.",
  "What's out the nearest window right now?",
  "What are you wearing? Top to bottom, including anything in pockets.",
  "Closest book or printed thing. Title, condition, where it sits.",
  "What's plugged in within arm's reach?",
  "Describe the door of the room you're in.",
  "What time is it, and how does the light differ from an hour ago?",
  "Smells in the room right now, if any.",
  "What's the most colorful thing in the room?",
  "Describe whatever container is closest to you. Cup, bottle, box, bag.",
  "Look at your hands. Anything on them right now?",
  "What's currently making noise within ten feet of you?",
  "What's directly behind you that you can't see right now?",
  "Describe the seat you're in, including how comfortable it actually is.",
  "What's the dirtiest surface in the room? Be specific about why.",

  // ---------------------------------------------------------------------------
  // RECENT AUTOBIOGRAPHICAL RECALL
  // ---------------------------------------------------------------------------
  "Walk through your morning so far, in order.",
  "What did you eat last? Where, and what did it come on?",
  "Last person you spoke to out loud. Who, and roughly what about?",
  "Last text you sent. Who to, and what was it responding to?",
  "What's the most recent thing you searched online?",
  "What did you wear yesterday?",
  "Three things you did between waking up and sitting down here.",
  "Last photo on your phone. What's in it?",
  "What did you have for dinner the night before last?",
  "Who was the last person who came into your home?",
  "Last time you left your home. Where to, and how did you get there?",
  "Last package or piece of mail that arrived. What was it?",
  "Last money you spent in person, not online. On what.",
  "What time did you get out of bed today?",
  "Last screen you closed before opening this one.",
  "Describe what you did Saturday afternoon.",
  "Last conversation that lasted more than five minutes. Who, what about.",
  "What have you had to drink so far today?",
  "Last thing you carried from one room to another.",
  "What was the first thing you noticed on waking today?",
  "Last thing you wrote by hand.",
  "Last appointment, errand, or scheduled thing you went to.",
  "What did you do in the hour before sitting down here?",
  "Last cash transaction you remember. Where, how much.",
  "Last time you had to wait somewhere. Where, and how long.",

  // ---------------------------------------------------------------------------
  // PERSONAL PROCEDURAL
  // ---------------------------------------------------------------------------
  "What you do between sitting down at your desk and starting actual work.",
  "Your routine for closing the laptop at the end of the day.",
  "What you do before getting in bed, in the order you do it.",
  "How you make coffee, tea, or whatever your morning drink is.",
  "How you decide what to wear in the morning.",
  "Your routine for handling laundry from hamper to drawer.",
  "What you do when you walk in the door coming home.",
  "How you pack a bag for a day out of the house.",
  "Your routine for charging your devices overnight.",
  "How you handle the dishes after a meal.",
  "What you do when groceries arrive or come home with you.",
  "How you decide what to cook on a regular weeknight.",
  "Your routine for taking out the trash.",
  "How you check what's on your calendar for the week.",
  "Steps you take when leaving the house for more than an hour.",
  "Your routine for cleaning a particular room in your home.",
  "How you handle email at the start of a workday.",
  "What you do when you sit down to read.",
  "Your routine for getting out of the house in a hurry.",
  "How you actually fold (or don't fold) the clothes you own.",

  // ---------------------------------------------------------------------------
  // PLACE MEMORY
  // ---------------------------------------------------------------------------
  "Walk through your home, room by room, as if showing someone in for the first time.",
  "Describe the grocery store you go to most often, aisle by aisle as best you can.",
  "Layout of the place you used to live before this one.",
  "Describe a coffee shop or cafe you've been to more than five times.",
  "Walk through the route from your bed to the front door.",
  "Describe your kitchen as if drawing it from above.",
  "A street near your home you walk often. What's on it, in order?",
  "The closest pharmacy, store, or gas station. Describe its inside.",
  "A restaurant you've eaten at more than once. The physical layout.",
  "The room where you sleep. Walls, floor, what's in the corners.",
  "Walk through the route you take when you leave the house and turn right.",
  "A library, bookstore, or shop you know well. Layout.",
  "Describe the inside of the vehicle you ride in most often.",
  "A bathroom in your home, fixture by fixture.",
  "Walk through the closet or storage area you use most.",
  "A staircase you climb often. Describe it.",
  "The front of the building you live in, as someone walking up to it would see.",
  "Describe a park, trail, or outdoor space you visit regularly.",
  "Layout of the place you spent most weekday afternoons as a kid.",
  "The room a friend or family member lives in that you know best.",

  // ---------------------------------------------------------------------------
  // ENUMERATION
  // ---------------------------------------------------------------------------
  "Count the windows in your home. Where each one is.",
  "List the electronics in the room you're in.",
  "How many pairs of shoes do you own? Where they live.",
  "List everything in your fridge, top shelf to bottom.",
  "Count the doors between you and the street.",
  "List the apps you've used today, in order.",
  "Things you can see right now that are made of metal.",
  "How many cups, mugs, or glasses are in the room you're in?",
  "Books visible from where you're sitting. Titles or rough descriptions.",
  "List the chairs in your home.",
  "How many lamps and overhead lights does your home have?",
  "List everything in the bag, backpack, or pocket you reach for most.",
  "Count the plants in your home, if any. Where each one is.",
  "List what's currently on the kitchen counter.",
  "Subscriptions you currently pay for. As many as you can name.",

  // ---------------------------------------------------------------------------
  // PERSPECTIVE AND FRAMING
  // ---------------------------------------------------------------------------
  "Describe the room you're in as if writing stage directions.",
  "Describe what's on your desk from a bird's-eye view.",
  "Describe the room from the perspective of someone standing in the doorway.",
  "Describe your current view as a still photograph.",
  "Describe what's around you using only what you could touch without standing up.",
  "Describe the room as if walking someone through it on a phone call.",
  "Describe what's in front of you in shapes and colors only, no object names.",
  "Describe the room you're in if the lights were off and you had to navigate it from memory.",

  // ---------------------------------------------------------------------------
  // VERBAL FLUENCY (canonical neuropsych categories, bounded set)
  // ---------------------------------------------------------------------------
  "Name as many animals as you can. Keep going until you stall.",
  "Name as many things you'd find in a supermarket as you can.",
  "Name as many words starting with the letter S as you can.",
  "Name as many things you'd find in a kitchen as you can.",
  "Name as many countries as you can.",
  "Name as many tools as you can.",
  "Name as many words starting with the letter F as you can.",

  // ---------------------------------------------------------------------------
  // RECENT INPUTS (media, reading, recommendations)
  // ---------------------------------------------------------------------------
  "Last show or movie you watched. What happened in it?",
  "Last book or article you read more than a paragraph of. What was it about?",
  "Last podcast, song, or audio you remember. What was on it?",
  "Most recent piece of news you read. What was the story?",
  "Last thing someone recommended to you. What and who.",
  "What's the last screenshot you took, and why?",
  "A video, post, or short you watched recently. What was it.",
  "Last tab you closed without finishing. What was on it.",
  "Last image you saved or downloaded. What of.",
  "Last thing you sent to someone via link or share. What, and to whom.",

  // ---------------------------------------------------------------------------
  // BODILY ATTENTION
  // ---------------------------------------------------------------------------
  "Close your eyes for ten seconds. Open them. What do you notice that you weren't noticing before?",
  "What does the inside of your mouth feel like right now?",
  "Where in your body do you feel any tension right now?",
  "Sounds you can hear with your eyes closed that you weren't tracking with them open.",
  "The temperature on the back of your neck versus the front of your hands.",
  "Any taste in your mouth right now from anything you ate or drank earlier.",
  "Posture check. How are you actually sitting or standing right now?",
  "What you can smell right now if you breathe in slowly through your nose.",
  "How tired do your eyes feel, and where exactly is the tiredness.",
  "The weight of your phone in your hand or pocket.",
  "Where your weight is resting right now. Hips, feet, elbows.",
  "How your clothing is touching your skin in three different places.",

  // ---------------------------------------------------------------------------
  // HIDDEN INVENTORY (location-cued recall, no peeking)
  // ---------------------------------------------------------------------------
  "What's in the third drawer down in your kitchen?",
  "What's behind the door you most rarely open?",
  "What's on top of the highest shelf you can see?",
  "What's at the bottom of the bag you carry most?",
  "What's in the glove compartment of the vehicle you use most often?",
  "What's in the medicine cabinet?",
  "Top of your fridge. What lives up there?",
  "What's under your bed right now?",
  "What's in the freezer, top to bottom?",
  "Junk drawer. Inventory it from memory.",
  "What's behind the couch or under the cushions?",
  "What's on top of your dresser or nightstand?",
  "What's in the trunk of the car you ride in most?",
  "Inside the closet you opened most recently. Top shelf, hanging rod, floor.",
  "Inside the pantry or food cupboard. Shelf by shelf.",

  // ---------------------------------------------------------------------------
  // INTANGIBLE INVENTORY
  // ---------------------------------------------------------------------------
  "Recurring charges hitting your card every month. Name as many as you can.",
  "Browser tabs you currently have open. Approximate count, and any you'd hate to lose.",
  "Folders or labels in your email inbox.",
  "Files visible on your desktop right now.",
  "Apps that open automatically when your computer boots.",
  "Notification badges currently on your phone.",
  "Bookmarks you actually use.",
  "Saved cards or payment methods in any wallet app.",
  "Subscriptions you've canceled in the last year.",
  "Names in your phone contacts starting with M.",
  "Shortcuts and keybindings you use without thinking.",
  "Apps on the home screen of your phone, in order.",

  // ---------------------------------------------------------------------------
  // OBJECT PROVENANCE
  // ---------------------------------------------------------------------------
  "An object near you. Where did it come from? When did you get it?",
  "The cup or mug you use most often. Where it came from.",
  "A piece of clothing you're wearing. Where you got it, when, what it cost if you remember.",
  "An object you've kept for more than ten years. Its history.",
  "Last gift you received. From whom, when, on what occasion.",
  "Last thing you got for free. What and how.",
  "Something within sight that was once owned by someone else before you.",
  "An object in your home that came from a different country.",
  "The oldest piece of furniture in your home. Where it came from.",

  // ---------------------------------------------------------------------------
  // SEMANTIC RECALL (what you know from your life, retrieved cold)
  // ---------------------------------------------------------------------------
  "Phone numbers you can still recite from memory.",
  "Email addresses you can type from muscle memory.",
  "Songs you know all the lyrics to. List them.",
  "Movies you've watched more than three times.",
  "Books you've read more than once.",
  "Foreign-language phrases you remember from a class or trip.",
  "Names of teachers you had before age 12.",
  "Streets that border your neighborhood.",
  "Recipes you can cook without looking anything up.",
  "License plates you've memorized at any point in your life.",
  "Childhood phone numbers, addresses, or postal codes you still remember.",

  // ---------------------------------------------------------------------------
  // DAILY GRAIN (procedural at rare granularity)
  // ---------------------------------------------------------------------------
  "How you specifically tie your shoes. Knot type, which loop goes over which.",
  "How you turn on the shower in your home. Which knob, which direction, how long until it's hot.",
  "What sequence of buttons you press to take a screenshot on your phone.",
  "How you open and close a window in the room you're in right now.",
  "How you specifically lock your front door. Direction of turn, how it sounds.",
  "The sequence of taps to open the camera on your phone from the lock screen.",
  "How you actually use the toothpaste tube. Squeeze where, cap on or off, where it sits.",
  "Which side of the bed you get in on, and the exact motion of getting in.",
  "How you hold a pen. Which fingers, where it sits against the hand.",
  "How you open a fresh jar. Hand position, technique if it's stuck.",

  // ---------------------------------------------------------------------------
  // KNOWN PEOPLE (factual recall, neutral)
  // ---------------------------------------------------------------------------
  "Someone you live with or share space with. Ten things you know about their preferences. Food, sleep, weather, anything.",
  "A coworker or collaborator you've known longest. What they take in their coffee, where they live, how they get to work.",
  "A parent, sibling, or close friend. What's currently in their kitchen, as best you remember.",
  "Someone you saw last week. What they were wearing.",
  "A neighbor. What you actually know about them.",
  "A friend's home you've been to more than five times. Details about it.",
  "A person who works at a place you visit often. Anything specific you know about them.",
  "A relative you don't see often. What you remember of their home or habits.",

  // ---------------------------------------------------------------------------
  // TEMPORAL
  // ---------------------------------------------------------------------------
  "What's on your calendar for the next 48 hours?",
  "Last thing you set an alarm for, at what time.",
  "Days of this past week. Account for what you did each one.",
  "Three things on your to-do list right now.",
  "Last thing you added to a calendar invite or reminder.",
  "What times of day you actually eat, on a normal day.",
  "Months in the next year that already have something planned in them.",

  // ---------------------------------------------------------------------------
  // OBLIQUE INVENTORY (listing by unusual property)
  // ---------------------------------------------------------------------------
  "List the things in your home that exist primarily to hide other things.",
  "Objects in your home that have moving parts.",
  "Words written somewhere in the room right now. What they are and where.",
  "Things in your home that came in a box and are still in the box.",
  "Surfaces in the room you've never cleaned.",
  "Objects within sight that run on batteries.",
  "Things in your home that have your name written on them somewhere.",
  "Items in your home that change appearance over time. Plants, photos, furniture.",
  "Things in your home older than you are.",
  "Objects in the room that are designed to be replaced and aren't yet.",
];
