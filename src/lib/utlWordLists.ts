/**
 * Word Lists for Extended Semantic Signal Computation
 *
 * Static Sets following the NRC_CATEGORIES pattern in nrc-emotions.ts.
 * Each list is curated from published research:
 *   - Boosters: Hyland 2005 (metadiscourse framework)
 *   - Connectives: Coh-Metrix (McNamara et al.)
 *   - POS proxies: approximation for idea density (Snowdon / Nun Study)
 *   - SUBTLEXus: Brysbaert & New 2009, top ~2000 by frequency
 *
 * LEXICON_VERSION should be bumped when any list changes, so historical
 * semantic signal scores remain comparable.
 */

export const LEXICON_VERSION = 1;

// ─── Booster words (certainty markers, Hyland 2005) ─────────────────
export const BOOSTER_WORDS = new Set([
  'clearly', 'obviously', 'definitely', 'certainly', 'undoubtedly',
  'absolutely', 'always', 'never', 'every', 'all',
  'sure', 'surely', 'indeed', 'truly', 'exactly',
  'completely', 'totally', 'entirely', 'fully', 'perfectly',
  'conclusively', 'undeniably', 'inevitably', 'unquestionably',
  'proves', 'proves', 'demonstrates', 'establishes', 'confirms',
  'guarantee', 'guarantees', 'guaranteed',
  'without doubt', 'no doubt', 'beyond question',
  'must', 'will',
]);

// ─── Contrastive connectives (differentiation markers) ──────────────
export const CONTRASTIVE_CONNECTIVES = new Set([
  'but', 'however', 'although', 'though', 'nevertheless',
  'nonetheless', 'despite', 'yet', 'conversely', 'whereas',
  'while', 'unlike', 'instead', 'rather', 'alternatively',
  'otherwise', 'notwithstanding', 'still', 'except',
  'on the other hand', 'in contrast',
]);

// ─── Integrative connectives (synthesis markers) ────────────────────
export const INTEGRATIVE_CONNECTIVES = new Set([
  'moreover', 'furthermore', 'additionally', 'also', 'indeed',
  'similarly', 'likewise', 'equally', 'besides', 'plus',
  'together', 'alongside', 'simultaneously',
]);

// ─── Causal connectives (deep cohesion) ─────────────────────────────
export const CAUSAL_CONNECTIVES = new Set([
  'because', 'therefore', 'since', 'thus', 'consequently',
  'hence', 'so', 'accordingly', 'as a result', 'due to',
  'owing to', 'caused', 'causes', 'causing', 'leads to',
  'results in', 'explains', 'reason',
]);

// ─── Temporal connectives (deep cohesion) ───────────────────────────
export const TEMPORAL_CONNECTIVES = new Set([
  'then', 'afterward', 'afterwards', 'before', 'previously',
  'meanwhile', 'subsequently', 'eventually', 'finally', 'initially',
  'later', 'earlier', 'next', 'soon', 'recently',
  'already', 'once', 'whenever', 'during', 'until',
]);

// ─── Intentional connectives (deep cohesion) ────────────────────────
export const INTENTIONAL_CONNECTIVES = new Set([
  'to', 'for', 'toward', 'towards', 'aim',
  'goal', 'purpose', 'intended', 'intending', 'meant',
  'designed', 'planned', 'hoping', 'trying', 'seeking',
]);

// ─── POS-proxy word lists for idea density (Snowdon et al. 1996) ────
// Propositions = verbs + adjectives + adverbs + prepositions + conjunctions
// These approximate POS tagging without an NLP library.

export const COMMON_PREPOSITIONS = new Set([
  'about', 'above', 'across', 'after', 'against', 'along', 'among',
  'around', 'at', 'before', 'behind', 'below', 'beneath', 'beside',
  'between', 'beyond', 'by', 'despite', 'down', 'during', 'except',
  'for', 'from', 'in', 'inside', 'into', 'like', 'near', 'of',
  'off', 'on', 'onto', 'out', 'outside', 'over', 'past', 'since',
  'through', 'throughout', 'to', 'toward', 'towards', 'under',
  'underneath', 'until', 'up', 'upon', 'with', 'within', 'without',
]);

export const COMMON_CONJUNCTIONS = new Set([
  'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
  'because', 'since', 'although', 'though', 'while', 'whereas',
  'unless', 'until', 'if', 'when', 'whenever', 'where', 'wherever',
  'whether', 'that', 'after', 'before', 'once', 'than',
]);

// Common verbs (high-frequency, covering major semantic categories)
export const COMMON_VERBS = new Set([
  'be', 'is', 'am', 'are', 'was', 'were', 'been', 'being',
  'have', 'has', 'had', 'having',
  'do', 'does', 'did', 'doing', 'done',
  'say', 'said', 'saying', 'says',
  'get', 'gets', 'got', 'getting', 'gotten',
  'make', 'makes', 'made', 'making',
  'go', 'goes', 'went', 'going', 'gone',
  'know', 'knows', 'knew', 'knowing', 'known',
  'take', 'takes', 'took', 'taking', 'taken',
  'see', 'sees', 'saw', 'seeing', 'seen',
  'come', 'comes', 'came', 'coming',
  'think', 'thinks', 'thought', 'thinking',
  'look', 'looks', 'looked', 'looking',
  'want', 'wants', 'wanted', 'wanting',
  'give', 'gives', 'gave', 'giving', 'given',
  'use', 'uses', 'used', 'using',
  'find', 'finds', 'found', 'finding',
  'tell', 'tells', 'told', 'telling',
  'ask', 'asks', 'asked', 'asking',
  'work', 'works', 'worked', 'working',
  'seem', 'seems', 'seemed', 'seeming',
  'feel', 'feels', 'felt', 'feeling',
  'try', 'tries', 'tried', 'trying',
  'leave', 'leaves', 'left', 'leaving',
  'call', 'calls', 'called', 'calling',
  'keep', 'keeps', 'kept', 'keeping',
  'let', 'lets', 'letting',
  'begin', 'begins', 'began', 'beginning', 'begun',
  'show', 'shows', 'showed', 'showing', 'shown',
  'hear', 'hears', 'heard', 'hearing',
  'play', 'plays', 'played', 'playing',
  'run', 'runs', 'ran', 'running',
  'move', 'moves', 'moved', 'moving',
  'live', 'lives', 'lived', 'living',
  'believe', 'believes', 'believed', 'believing',
  'hold', 'holds', 'held', 'holding',
  'bring', 'brings', 'brought', 'bringing',
  'happen', 'happens', 'happened', 'happening',
  'write', 'writes', 'wrote', 'writing', 'written',
  'sit', 'sits', 'sat', 'sitting',
  'stand', 'stands', 'stood', 'standing',
  'lose', 'loses', 'lost', 'losing',
  'pay', 'pays', 'paid', 'paying',
  'meet', 'meets', 'met', 'meeting',
  'include', 'includes', 'included', 'including',
  'continue', 'continues', 'continued', 'continuing',
  'set', 'sets', 'setting',
  'learn', 'learns', 'learned', 'learning',
  'change', 'changes', 'changed', 'changing',
  'lead', 'leads', 'led', 'leading',
  'understand', 'understands', 'understood', 'understanding',
  'watch', 'watches', 'watched', 'watching',
  'follow', 'follows', 'followed', 'following',
  'stop', 'stops', 'stopped', 'stopping',
  'create', 'creates', 'created', 'creating',
  'speak', 'speaks', 'spoke', 'speaking', 'spoken',
  'read', 'reads', 'reading',
  'allow', 'allows', 'allowed', 'allowing',
  'add', 'adds', 'added', 'adding',
  'spend', 'spends', 'spent', 'spending',
  'grow', 'grows', 'grew', 'growing', 'grown',
  'open', 'opens', 'opened', 'opening',
  'walk', 'walks', 'walked', 'walking',
  'win', 'wins', 'won', 'winning',
  'teach', 'teaches', 'taught', 'teaching',
  'offer', 'offers', 'offered', 'offering',
  'remember', 'remembers', 'remembered', 'remembering',
  'consider', 'considers', 'considered', 'considering',
  'appear', 'appears', 'appeared', 'appearing',
  'buy', 'buys', 'bought', 'buying',
  'serve', 'serves', 'served', 'serving',
  'die', 'dies', 'died', 'dying',
  'send', 'sends', 'sent', 'sending',
  'build', 'builds', 'built', 'building',
  'stay', 'stays', 'stayed', 'staying',
  'fall', 'falls', 'fell', 'falling', 'fallen',
  'cut', 'cuts', 'cutting',
  'reach', 'reaches', 'reached', 'reaching',
  'kill', 'kills', 'killed', 'killing',
  'remain', 'remains', 'remained', 'remaining',
  'suggest', 'suggests', 'suggested', 'suggesting',
  'raise', 'raises', 'raised', 'raising',
  'pass', 'passes', 'passed', 'passing',
  'sell', 'sells', 'sold', 'selling',
  'require', 'requires', 'required', 'requiring',
  'report', 'reports', 'reported', 'reporting',
  'decide', 'decides', 'decided', 'deciding',
  'pull', 'pulls', 'pulled', 'pulling',
  'develop', 'develops', 'developed', 'developing',
  'need', 'needs', 'needed', 'needing',
  'become', 'becomes', 'became', 'becoming',
  'mean', 'means', 'meant', 'meaning',
  'put', 'puts', 'putting',
  'start', 'starts', 'started', 'starting',
  'turn', 'turns', 'turned', 'turning',
  'help', 'helps', 'helped', 'helping',
  'show', 'shows', 'showed', 'shown', 'showing',
  'expect', 'expects', 'expected', 'expecting',
  'love', 'loves', 'loved', 'loving',
  'hate', 'hates', 'hated', 'hating',
  'fear', 'fears', 'feared', 'fearing',
  'hope', 'hopes', 'hoped', 'hoping',
  'wish', 'wishes', 'wished', 'wishing',
  'wonder', 'wonders', 'wondered', 'wondering',
  'realize', 'realizes', 'realized', 'realizing',
  'notice', 'notices', 'noticed', 'noticing',
  'imagine', 'imagines', 'imagined', 'imagining',
  'exist', 'exists', 'existed', 'existing',
  'matter', 'matters', 'mattered', 'mattering',
  'act', 'acts', 'acted', 'acting',
  'cause', 'caused', 'causes', 'causing',
  'choose', 'chooses', 'chose', 'choosing', 'chosen',
  'prove', 'proves', 'proved', 'proving', 'proven',
  'deny', 'denies', 'denied', 'denying',
  'avoid', 'avoids', 'avoided', 'avoiding',
  'accept', 'accepts', 'accepted', 'accepting',
  'struggle', 'struggles', 'struggled', 'struggling',
  'resist', 'resists', 'resisted', 'resisting',
  'protect', 'protects', 'protected', 'protecting',
  'force', 'forces', 'forced', 'forcing',
  'apply', 'applies', 'applied', 'applying',
  'explain', 'explains', 'explained', 'explaining',
  'identify', 'identifies', 'identified', 'identifying',
  'manage', 'manages', 'managed', 'managing',
  'miss', 'misses', 'missed', 'missing',
  'assume', 'assumes', 'assumed', 'assuming',
  'receive', 'receives', 'received', 'receiving',
  'involve', 'involves', 'involved', 'involving',
  'produce', 'produces', 'produced', 'producing',
  'enjoy', 'enjoys', 'enjoyed', 'enjoying',
  'describe', 'describes', 'described', 'describing',
  'recognize', 'recognizes', 'recognized', 'recognizing',
  'carry', 'carries', 'carried', 'carrying',
  'break', 'breaks', 'broke', 'breaking', 'broken',
  'fight', 'fights', 'fought', 'fighting',
  'catch', 'catches', 'caught', 'catching',
  'drive', 'drives', 'drove', 'driving', 'driven',
  'draw', 'draws', 'drew', 'drawing', 'drawn',
  'hang', 'hangs', 'hung', 'hanging',
  'throw', 'throws', 'threw', 'throwing', 'thrown',
  'connect', 'connects', 'connected', 'connecting',
  'reflect', 'reflects', 'reflected', 'reflecting',
]);

// Common adjectives
export const COMMON_ADJECTIVES = new Set([
  'good', 'great', 'new', 'old', 'big', 'small', 'long', 'short',
  'high', 'low', 'large', 'little', 'young', 'important', 'different',
  'same', 'early', 'late', 'right', 'wrong', 'best', 'better', 'bad',
  'worse', 'worst', 'real', 'true', 'false', 'hard', 'easy', 'fast',
  'slow', 'strong', 'weak', 'deep', 'wide', 'dark', 'light', 'clear',
  'full', 'empty', 'open', 'close', 'hot', 'cold', 'warm', 'cool',
  'free', 'happy', 'sad', 'angry', 'afraid', 'alone', 'alive', 'dead',
  'aware', 'ready', 'able', 'unable', 'certain', 'sure', 'possible',
  'impossible', 'likely', 'unlikely', 'necessary', 'available', 'simple',
  'complex', 'difficult', 'beautiful', 'ugly', 'rich', 'poor', 'safe',
  'dangerous', 'quiet', 'loud', 'clean', 'dirty', 'fresh', 'strange',
  'normal', 'natural', 'political', 'social', 'human', 'personal',
  'physical', 'mental', 'emotional', 'spiritual', 'moral', 'cultural',
  'economic', 'public', 'private', 'whole', 'entire', 'complete',
  'specific', 'particular', 'general', 'common', 'rare', 'special',
  'unique', 'obvious', 'familiar', 'foreign', 'final', 'main',
  'major', 'minor', 'significant', 'serious', 'careful', 'present',
  'recent', 'current', 'previous', 'next', 'future', 'past',
]);

// Common adverbs
export const COMMON_ADVERBS = new Set([
  'not', 'also', 'very', 'often', 'however', 'too', 'usually', 'really',
  'already', 'always', 'never', 'sometimes', 'still', 'just', 'now',
  'then', 'here', 'there', 'where', 'when', 'how', 'why', 'well',
  'even', 'actually', 'probably', 'perhaps', 'maybe', 'certainly',
  'clearly', 'simply', 'exactly', 'nearly', 'almost', 'quite',
  'rather', 'enough', 'especially', 'particularly', 'mostly', 'partly',
  'largely', 'entirely', 'completely', 'absolutely', 'definitely',
  'apparently', 'obviously', 'essentially', 'basically', 'generally',
  'typically', 'normally', 'naturally', 'finally', 'eventually',
  'suddenly', 'slowly', 'quickly', 'recently', 'frequently',
  'rarely', 'hardly', 'merely', 'only', 'otherwise', 'therefore',
  'thus', 'hence', 'consequently', 'accordingly', 'instead',
  'somehow', 'somewhat', 'anywhere', 'everywhere', 'nowhere',
  'together', 'apart', 'away', 'back', 'forward', 'again',
  'once', 'twice', 'ever', 'deeply', 'strongly', 'highly',
]);

// ─── Stopwords for content-word extraction ──────────────────────────
export const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
  'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were',
  'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'shall', 'can',
  'not', 'no', 'nor', 'so', 'if', 'then', 'than', 'that', 'this',
  'these', 'those', 'it', 'its', 'i', 'me', 'my', 'mine', 'we',
  'us', 'our', 'ours', 'you', 'your', 'yours', 'he', 'him', 'his',
  'she', 'her', 'hers', 'they', 'them', 'their', 'theirs',
  'what', 'which', 'who', 'whom', 'where', 'when', 'how', 'why',
  'am', 'being', 'having', 'doing', 'just', 'very', 'also', 'too',
  'up', 'out', 'about', 'into', 'over', 'after', 'before', 'between',
]);
