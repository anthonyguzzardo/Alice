/**
 * Neutral prompts for calibration sessions.
 * These should elicit real writing (not one-word answers) without
 * emotional charge. The system picks one at random each time.
 *
 * Categories are organized by COGNITIVE TASK TYPE, not topic, so that
 * each prompt demands a materially different kind of thinking even when
 * two prompts share a subject domain.
 *
 * All prompts produce knowledge-telling (reciting known facts or procedures),
 * not knowledge-transforming (generating new understanding). This makes
 * calibration sessions the floor for KT detection.
 */
export const CALIBRATION_PROMPTS: string[] = [
  // ---------------------------------------------------------------------------
  // OBSERVATION — describe what's around you now
  // ---------------------------------------------------------------------------
  "Describe the room you're sitting in right now.",
  "What's on your desk or table right now? List everything you can see.",
  "Describe the view from the nearest window.",
  "Look around and describe three objects within arm's reach.",
  "Describe the lighting in the room you're in right now.",
  "Describe the temperature right now and how it feels.",
  "What does the street outside look like right now?",
  "What's the most cluttered area in your space right now? Describe it.",
  "Describe the ceiling above you.",
  "What does your kitchen counter look like right now?",
  "Describe what you're wearing right now, piece by piece.",
  "What's in your pockets or bag right now?",
  "Describe what the sky looks like right now.",
  "Pick up the nearest object. Describe its weight and texture.",
  "What's the most colorful thing in your field of vision right now?",
  "If you walked out your front door and turned left, what would you see?",
  "Describe the floor beneath your feet right now. Material, texture, condition.",
  "Describe the nearest door in detail. Handle, frame, finish, state.",

  // ---------------------------------------------------------------------------
  // RECENT MEMORY — what did you do/see/eat recently
  // ---------------------------------------------------------------------------
  "Describe what you did this morning in as much detail as you can remember.",
  "What did you eat yesterday? Walk through it meal by meal.",
  "What's the last show or movie you watched? What happened in it?",
  "Describe the last conversation you had with someone today.",
  "What did you do exactly one week ago today? Try to remember.",
  "What did you wear yesterday?",
  "What was the first thing you saw when you opened your eyes this morning?",
  "What's the last thing you searched for online?",
  "What's the last photo you took? Describe what's in it.",
  "Describe the last thing you bought and why you bought it.",
  "What three things did you do right before sitting down here?",
  "Describe the last time you opened a cabinet or drawer. What was inside?",
  "What was the last door you walked through before sitting down here?",
  "Describe the last time you looked at the time. What were you doing?",
  "What's the last thing you threw away? Describe it.",

  // ---------------------------------------------------------------------------
  // ROUTINE AND PROCESS — walk through how you do X
  // ---------------------------------------------------------------------------
  "Walk through how you make your favorite meal, step by step.",
  "Describe your evening wind-down routine.",
  "Walk through your morning hygiene routine step by step.",
  "Describe how you typically end your workday.",
  "Walk through the last errand you ran.",
  "Describe how you do your laundry from start to finish.",
  "Walk through how you take a shower from start to finish.",
  "Walk through the steps you take to lock up when you leave home.",
  "Walk through how you pay for something at a store.",
  "Describe how you sort your mail or packages when they arrive.",
  "Describe your routine when you first get to your desk or workspace.",
  "Walk through how you organize your week.",
  "Walk through the steps of making a sandwich.",
  "Describe how you pack a bag when you're going somewhere for the day.",
  "Walk through how you get ready when you're running late.",

  // ---------------------------------------------------------------------------
  // OBJECT EXPLANATION — describe X to someone who has never seen one
  // ---------------------------------------------------------------------------
  "Describe a paperclip to someone who has never seen one.",
  "Describe a zipper to someone who has never seen one.",
  "Describe a safety pin to someone who has never seen one.",
  "Describe a doorknob to someone who has never seen one.",
  "Describe a light switch to someone who has never seen one.",
  "Describe a hinge to someone who has never seen one.",
  "Describe a candle to someone who has never seen one.",
  "Describe a flashlight to someone who has never seen one.",
  "Describe a padlock to someone who has never seen one.",
  "Describe a rubber band to someone who has never seen one.",
  "Describe a stapler to someone who has never seen one.",
  "Describe chopsticks to someone who has never seen them.",
  "Describe a corkscrew to someone who has never seen one.",
  "Describe a compass to someone who has never seen one.",
  "Describe a pair of scissors to someone who has never seen them.",
  "Describe a magnifying glass to someone who has never seen one.",
  "Describe a calculator to someone who has never seen one.",
  "Describe a refrigerator to someone who has never seen one.",
  "Describe a washing machine to someone who has never seen one.",
  "Describe a vacuum cleaner to someone who has never seen one.",
  "Describe a toaster to someone who has never seen one.",
  "Describe a whisk to someone who has never seen one.",
  "Describe an abacus to someone who has never seen one.",
  "Describe a slide rule to someone who has never seen one.",
  "Describe a binder clip to someone who has never seen one.",
  "Describe a tape dispenser to someone who has never seen one.",
  "Describe a colander to someone who has never seen one.",
  "Describe a coffee maker to someone who has never seen one.",
  "Describe a microwave to someone who has never seen one.",
  "Describe a blender to someone who has never seen one.",

  // ---------------------------------------------------------------------------
  // PROCEDURAL INSTRUCTION — explain how to X
  // ---------------------------------------------------------------------------
  "Explain how to tie a shoe.",
  "Explain how to crack an egg.",
  "Explain how to boil an egg.",
  "Explain how to chop an onion.",
  "Explain how to mince garlic.",
  "Explain how to cook rice on a stovetop.",
  "Explain how to cook pasta and drain it without losing any.",
  "Explain how to fold a fitted sheet.",
  "Explain how to sew a button back onto a shirt.",
  "Explain how to thread a needle.",
  "Explain how to iron a dress shirt.",
  "Explain how to sharpen a kitchen knife.",
  "Explain how to clean a cast iron pan.",
  "Explain how to hang a picture level on a wall.",
  "Explain how to patch a small hole in drywall.",
  "Explain how to plant a seed in a pot.",
  "Explain how to knead bread dough.",
  "Explain how to replace a light bulb in a ceiling fixture.",
  "Explain how to use a tape measure accurately.",
  "Explain how to paint a wall without leaving roller marks.",
  "Explain how to drive a nail without bending it.",
  "Explain how to parallel park a car.",
  "Explain how to fold a T-shirt for packing.",
  "Explain how to make a bed with hospital corners.",
  "Explain how to unclog a kitchen sink.",
  "Explain how to polish a pair of leather shoes.",
  "Explain how to whip cream by hand.",
  "Explain how to peel a hard-boiled egg cleanly.",

  // ---------------------------------------------------------------------------
  // CONSTRAINED DESCRIPTION — describe X without using specific words
  // ---------------------------------------------------------------------------
  "Describe a fork without using the words \"eat,\" \"food,\" or \"metal.\"",
  "Describe a spoon without using the words \"eat,\" \"soup,\" or \"round.\"",
  "Describe a knife without using the words \"cut,\" \"sharp,\" or \"blade.\"",
  "Describe a cup without using the words \"drink,\" \"hold,\" or \"liquid.\"",
  "Describe a chair without using the words \"sit,\" \"legs,\" or \"back.\"",
  "Describe a bed without using the words \"sleep,\" \"mattress,\" or \"soft.\"",
  "Describe a window without using the words \"glass,\" \"see,\" or \"open.\"",
  "Describe a door without using the words \"open,\" \"close,\" or \"wood.\"",
  "Describe a book without using the words \"read,\" \"pages,\" or \"words.\"",
  "Describe a clock without using the words \"time,\" \"hands,\" or \"tick.\"",
  "Describe a shoe without using the words \"foot,\" \"walk,\" or \"lace.\"",
  "Describe a car without using the words \"drive,\" \"wheels,\" or \"road.\"",
  "Describe a guitar without using the words \"music,\" \"strings,\" or \"play.\"",
  "Describe a piano without using the words \"keys,\" \"music,\" or \"play.\"",
  "Describe a bicycle without using the words \"ride,\" \"wheels,\" or \"pedal.\"",
  "Describe an apple without using the words \"red,\" \"fruit,\" or \"tree.\"",
  "Describe a banana without using the words \"yellow,\" \"fruit,\" or \"peel.\"",
  "Describe a watermelon without using the words \"red,\" \"green,\" or \"seed.\"",
  "Describe a pencil without using the words \"write,\" \"wood,\" or \"lead.\"",
  "Describe a blanket without using the words \"warm,\" \"soft,\" or \"bed.\"",
  "Describe a lamp without using the words \"light,\" \"bulb,\" or \"on.\"",
  "Describe a pillow without using the words \"soft,\" \"head,\" or \"sleep.\"",
  "Describe a coat without using the words \"wear,\" \"warm,\" or \"winter.\"",
  "Describe a television without using the words \"watch,\" \"screen,\" or \"show.\"",
  "Describe a boat without using the words \"water,\" \"float,\" or \"sail.\"",

  // ---------------------------------------------------------------------------
  // FLUENT GENERATION — name as many X as you can
  // ---------------------------------------------------------------------------
  "Name as many animals as you can in 60 seconds.",
  "Name as many animals that fly as you can.",
  "Name as many animals that swim as you can.",
  "Name as many fruits as you can.",
  "Name as many vegetables as you can.",
  "Name as many kinds of cheese as you can.",
  "Name as many kinds of bread as you can.",
  "Name as many spices as you can.",
  "Name as many herbs as you can.",
  "Name as many kinds of pasta as you can.",
  "Name as many breeds of dog as you can.",
  "Name as many kinds of bird as you can.",
  "Name as many musical instruments as you can.",
  "Name as many sports as you can.",
  "Name as many countries as you can.",
  "Name as many rivers as you can.",
  "Name as many languages as you can.",
  "Name as many teas as you can.",
  "Name as many desserts as you can.",
  "Name as many ice cream flavors as you can.",

  // ---------------------------------------------------------------------------
  // SENSORY: TASTE — describe the taste of X to someone who's never had it
  // ---------------------------------------------------------------------------
  "Describe the taste of water to someone who has never had it.",
  "Describe the taste of plain white rice to someone who has never had it.",
  "Describe the taste of a ripe banana to someone who has never had it.",
  "Describe the taste of celery to someone who has never had it.",
  "Describe the taste of dark chocolate to someone who has never had it.",
  "Describe the taste of honey to someone who has never had it.",
  "Describe the taste of a lemon to someone who has never had it.",
  "Describe the taste of olive oil to someone who has never had it.",
  "Describe the taste of black pepper to someone who has never had it.",
  "Describe the taste of a fresh strawberry to someone who has never had it.",
  "Describe the taste of butter to someone who has never had it.",
  "Describe the taste of a mango to someone who has never had it.",

  // ---------------------------------------------------------------------------
  // SENSORY: SMELL — describe the smell of X to someone who's never smelled it
  // ---------------------------------------------------------------------------
  "Describe the smell of coffee brewing to someone who has never smelled it.",
  "Describe the smell of bread baking to someone who has never smelled it.",
  "Describe the smell of cut grass to someone who has never smelled it.",
  "Describe the smell of a campfire to someone who has never smelled it.",
  "Describe the smell of petrichor after rain to someone who has never smelled it.",
  "Describe the smell of ocean air to someone who has never smelled it.",
  "Describe the smell of a struck match to someone who has never smelled it.",
  "Describe the smell of pine trees to someone who has never smelled it.",
  "Describe the smell of lavender to someone who has never smelled it.",
  "Describe the smell of an old book to someone who has never smelled it.",
  "Describe the smell of fresh laundry to someone who has never smelled it.",
  "Describe the smell of cinnamon to someone who has never smelled it.",

  // ---------------------------------------------------------------------------
  // SENSORY: TEXTURE — describe the feel of X to someone who's never felt it
  // ---------------------------------------------------------------------------
  "Describe the feel of silk to someone who has never felt it.",
  "Describe the feel of raw denim to someone who has never felt it.",
  "Describe the feel of velvet to someone who has never felt it.",
  "Describe the feel of wet wool to someone who has never felt it.",
  "Describe the feel of leather to someone who has never felt it.",
  "Describe the feel of coarse sand to someone who has never felt it.",
  "Describe the feel of tree bark to someone who has never felt it.",
  "Describe the feel of smooth river stones to someone who has never felt it.",
  "Describe the feel of raw bread dough to someone who has never felt it.",
  "Describe the feel of grass underfoot to someone who has never felt it.",
  "Describe the feel of a pinecone to someone who has never felt it.",
  "Describe the feel of corduroy to someone who has never felt it.",

  // ---------------------------------------------------------------------------
  // SENSORY: SOUND — describe the sound of X to someone who's never heard it
  // ---------------------------------------------------------------------------
  "Describe the sound of rain on a window to someone who has never heard it.",
  "Describe the sound of a door slamming to someone who has never heard it.",
  "Describe the sound of a key turning in a lock to someone who has never heard it.",
  "Describe the sound of footsteps on gravel to someone who has never heard it.",
  "Describe the sound of typing on a keyboard to someone who has never heard it.",
  "Describe the sound of a clock ticking to someone who has never heard it.",
  "Describe the sound of velcro being pulled apart to someone who has never heard it.",
  "Describe the sound of paper being crumpled to someone who has never heard it.",
  "Describe the sound of water boiling to someone who has never heard it.",
  "Describe the sound of scissors cutting paper to someone who has never heard it.",
  "Describe the sound of a pencil being sharpened to someone who has never heard it.",
  "Describe the sound of a creaking floorboard to someone who has never heard it.",

  // ---------------------------------------------------------------------------
  // SPATIAL MEMORY — describe a place from memory
  // ---------------------------------------------------------------------------
  "Walk through the layout of your home, room by room.",
  "Describe a grocery store you know well, aisle by aisle.",
  "Describe a coffee shop you know well.",
  "Describe a park you know well in physical detail.",
  "Describe a school hallway from your memory.",
  "Describe a classroom from your memory.",
  "Describe a library you've spent time in.",
  "Describe a hotel room you've stayed in.",
  "Describe an airport terminal you've passed through.",
  "Walk through the path from your bed to your kitchen.",
  "Describe the inside of your car or the vehicle you use most.",
  "Describe a street corner you pass often.",
  "Walk through the route from your front door to the nearest store.",
  "Describe the area around where you live.",
  "Describe a staircase you climb often.",
  "Describe a restaurant you've eaten at more than once. The physical space.",
  "Describe a gas station you've been to recently.",
  "Describe a waiting room you've sat in.",

  // ---------------------------------------------------------------------------
  // PERSPECTIVE SHIFT — describe X from an unusual vantage point or frame
  // ---------------------------------------------------------------------------
  "Describe the room you're in as if writing stage directions for a play.",
  "Describe the room you're in from the perspective of a ceiling camera.",
  "Describe the room you're in from knee height.",
  "Describe the room you're in as if narrating for an audiobook.",
  "Describe the sounds you can hear right now, ordered from nearest to farthest.",
  "Describe everything on the nearest shelf, left to right.",
  "Describe everything you can see that is made of metal.",
  "Describe everything within arm's reach by texture rather than name.",

  // ---------------------------------------------------------------------------
  // ENUMERATION — count or list specific things
  // ---------------------------------------------------------------------------
  "How many windows are in the room you're in? Describe each one.",
  "Count the light sources in your room. Describe them.",
  "List everything you can see that's blue.",
  "How many apps did you open on your phone today? Name them.",
  "Count the electronics in the room. Describe what each one does.",
  "List every surface in the room you're in.",
  "List everything you ate and drank today in order.",
  "How many doors can you see from where you're sitting? Describe each one.",
];
