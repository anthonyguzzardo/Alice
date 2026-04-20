# Aging and Longevity Campaign Brief

## Market Context

The aging-in-place technology market ($30B+ and growing) is dominated by physical monitoring: fall detection (Apple Watch, Medical Guardian), vitals monitoring (CarePredict, Lively), activity tracking (motion sensors, door sensors), and medication adherence (PillPack, MedMinder).

Cognitive monitoring is the missing layer. Physical decline is visible and measurable. Cognitive decline is invisible until it becomes undeniable. By the time a family notices word-finding difficulty, confusion, or personality changes, the underlying cognitive decline has been progressing for years.

Current options for cognitive monitoring are inadequate:
- **Annual cognitive screening** (MoCA at the PCP visit): Too infrequent, snapshot, and anxiety-producing. Patients dread it. Many avoid it entirely.
- **Brain training apps** (BrainHQ, Lumosity): Feel like tests. Users stop when they perform poorly, creating selection bias where the people who most need monitoring self-select out.
- **Wearable vitals** (Oura, Apple Watch): Measure physiological signals, not cognitive function. A person with perfect HRV and step count can have progressing cognitive decline.
- **In-home sensors** (CarePredict): Monitor physical activity patterns (gait, sleep, bathroom visits). Do not monitor cognition.

The family members, clinicians, and care providers who monitor aging adults need a cognitive monitoring solution that:
1. The aging adult will actually use daily for years
2. Does not feel like a test or surveillance
3. Detects trajectory changes early
4. Preserves the dignity of the person being monitored

**The dignity dimension is supported by demand research.** People across all age groups describe the harm of being measured. Alexandra Carmichael (tracked 40 metrics/day): *"I had stopped trusting myself. Letting the numbers drown out my intuition."* If younger, healthy adults experience metric-induced anxiety, the effect on aging adults facing cognitive concerns is amplified. Brain training apps confirm this: users who perform poorly stop using them, creating selection bias where the population most needing monitoring self-selects out. Alice's journal question model eliminates the performance dimension entirely.

## Target Personas

### Adult Child of Aging Parent (Primary Buyer)
- 45-65, geographically distant from parent
- Worried about cognitive decline but doesn't want to "test" their parent
- Has noticed small things (repetition, word-finding pauses, slight confusion) but nothing clinical
- Wants early warning without surveillance
- Willing to pay for peace of mind
- Emotionally complex: guilt about distance, fear of decline, desire to preserve parent's autonomy

### Geriatrician / Primary Care Provider
- Sees aging patients 1-2x/year
- Uses MoCA or Mini-Cog at annual wellness visit (3-5 minutes, limited sensitivity)
- Knows cognitive decline progresses between visits but has no continuous data
- Would welcome ecological cognitive data to supplement annual screening
- Time-constrained; needs low-burden integration into clinical workflow

### Memory Care / Senior Living Community Director
- Manages residents across the cognitive spectrum
- Needs to detect cognitive transitions (independent living to assisted, assisted to memory care)
- Currently relies on staff observation and periodic formal assessment
- Wants scalable cognitive monitoring across the resident population
- Concerned about family perception (surveillance vs. care)

### Longevity Clinic / Concierge Medicine Provider
- Serves health-optimizing clients (often 50-70, high net worth)
- Offers comprehensive biomarker panels (bloodwork, genomics, imaging)
- Cognitive biomarkers are a gap in the current longevity assessment toolkit
- Clients want to monitor cognitive health proactively, not just physically
- Willing to pay premium for cutting-edge assessment

## Value Proposition

Cognitive monitoring that doesn't feel like monitoring. The aging adult experiences a daily journal question. It is a thinking practice, not a test. Underneath, the signal engine tracks cognitive trajectory. Designated care partners (family, clinicians) can receive trajectory reports when signal patterns suggest cognitive change, without the user ever feeling surveilled or tested.

## How It Works

### For the Aging Adult
- One question per day, generated from their response history
- Questions become familiar in rhythm (daily practice) but novel in content (AI-generated, never repeated)
- No score, no grade, no performance feedback
- No indication that anything is being measured beyond a journal
- The experience is: "I answer a question each morning. It makes me think."

### For the Care Partner / Family
- Opt-in quarterly cognitive trajectory report (with the aging adult's consent)
- Report shows signal trend indicators: stable, improving, changing
- No raw signal data; no ability to read journal entries; no daily monitoring
- Alert threshold: notification only when multiple signal trajectories cross predefined change thresholds simultaneously (high confidence of meaningful change)
- The experience is: "I know Mom's thinking patterns are stable. If something changes, I'll know early."

### For the Clinician
- Annual or semi-annual cognitive trajectory summary available in clinical portal
- Signal trends contextualized against the patient's own baseline (within-subject change, not normative comparison)
- Supplements MoCA/Mini-Cog with 365 days of ecological data between visits
- Exportable to EHR (FHIR-compatible)
- The experience is: "I can see the cognitive trajectory between annual visits. The MoCA score now has context."

## Why This Works Where Brain Training Fails

Brain training apps (BrainHQ, Lumosity, CogniFit) fail as cognitive monitoring instruments because:

1. **Selection bias**: Users who perform poorly stop using them. The population that most needs monitoring self-selects out. Alice's journal question model does not create performance pressure. There is no score to fail at.

2. **Practice effects**: Users learn the games, improving scores through familiarity rather than cognitive improvement. Alice's questions are never repeated and cannot be anticipated or practiced.

3. **Motivation decay**: Game-based cognitive training becomes boring after weeks. The novelty wears off. Alice's AI-generated questions from response history maintain relevance because they are calibrated to the person, not a generic task library.

4. **Face validity problem**: Brain training feels like a test. Aging adults who are anxious about cognitive decline avoid cognitive tests. A daily journal question does not trigger test anxiety.

5. **Metric gaming**: Some users optimize scores through strategies that don't reflect genuine cognitive ability. Alice has no visible metrics to optimize.

## Key Differentiators

### vs. Annual Cognitive Screening (MoCA, Mini-Cog)
| Dimension | Annual Screen | Alice |
|---|---|---|
| Frequency | 1x/year | Daily |
| Temporal resolution | Single snapshot | Trajectory with slope and inflection points |
| Setting | Clinical (anxiety-producing) | Home (comfortable, routine) |
| Detection window | Detects moderate impairment | Designed for pre-clinical trajectory detection |
| Patient experience | "Am I losing it?" (test anxiety) | "What an interesting question" (journal practice) |
| Data between visits | None | 365 data points |

### vs. Brain Training Apps (BrainHQ, Lumosity)
| Dimension | Brain Training | Alice |
|---|---|---|
| User experience | Games and tasks (feels like testing) | Journal question (feels like thinking) |
| Self-selection | Poor performers stop (monitoring fails) | No performance feedback (no reason to stop) |
| Practice effects | Users learn the games | Questions never repeat |
| Motivation | Novelty decay after weeks | AI calibration maintains relevance |
| What it measures | Performance on specific tasks | Natural writing behavior (implicit signals) |

### vs. In-Home Physical Monitoring (CarePredict, motion sensors)
| Dimension | Physical Monitoring | Alice |
|---|---|---|
| Signal domain | Gait, activity, sleep, bathroom patterns | Cognition, language, processing speed |
| What it detects | Physical decline, fall risk | Cognitive decline |
| Privacy perception | Surveillance ("cameras in my home") | Practice ("I answer a question") |
| Dignity | Low (being watched) | High (being asked) |
| Complementarity | Physical + cognitive monitoring = comprehensive aging-in-place assessment |

### vs. Wearables (Apple Watch, Oura)
| Dimension | Wearables | Alice |
|---|---|---|
| Signal domain | Physiological (HR, HRV, SpO2, steps) | Cognitive-linguistic |
| Cognitive sensitivity | None (heart rate doesn't predict cognitive decline) | Designed specifically for cognitive trajectory |
| User burden | Wear a device (charging, skin irritation, aesthetics) | Answer a question (no hardware) |

## Key Messages

### For Adult Children
**"A journal that watches for cognitive change so you don't have to."**
You can't call every day and listen for word-finding pauses. You can't fly home every month for a MoCA. But you can give your parent a daily thinking practice that quietly tracks their cognitive trajectory and tells you if something changes.

**"No tests. No scores. No anxiety. Just a daily question."**
Your parent won't feel tested. They won't feel watched. They'll feel asked. There is a difference.

### For Clinicians
**"365 cognitive data points between annual visits."**
The MoCA tells you where they are today. Alice tells you how they got there. Trajectory context transforms a single screening score into a clinical narrative.

### For Senior Living
**"Dignified cognitive monitoring at scale."**
Every resident gets a daily thinking practice. Staff get aggregate cognitive health indicators across the community. Individual trajectories are clinically privileged. No resident feels surveilled.

### For Longevity Clinics
**"The cognitive biomarker panel your assessment is missing."**
You measure telomere length, inflammatory markers, metabolic panels, and VO2 max. You have nothing for cognition except a 5-minute screening test. Alice provides daily ecological cognitive trajectory data alongside your physiological biomarker suite.

## Objection Handling

**"My parent can barely use their phone. They won't do a daily app."**
Alice's interface is a single question and a text field. There are no menus, no navigation, no settings to configure. The daily question can be delivered via SMS for maximum simplicity. If they can send a text message, they can use Alice.

**"What if they stop using it? Doesn't that mean the monitoring stops?"**
Disengagement is itself a signal. A sudden drop in participation (especially after months of consistent use) is flagged as a trajectory event. Gradual decline in response length, increasing response latency, and eventual cessation form a recognizable pattern that the signal engine tracks. Stopping is not missing data; it is data.

**"Isn't this just surveillance with better branding?"**
No. Surveillance means someone can see what you're doing. Alice's care partner reports contain trajectory indicators (stable, changing), not content. No one can read the journal entries. The aging adult consents to trajectory sharing. They control who receives reports. They can revoke access at any time. The architecture enforces this; it is not a policy decision.

**"How is this different from just calling them every day?"**
Daily phone calls are wonderful but subjective. You notice change relative to last week, not last year. You rationalize ("they're just tired"). Alice's signal engine computes objective within-subject change trajectories across months and years, detecting gradual shifts that are invisible to casual observation.

**"What if the trajectory report causes unnecessary alarm?"**
The alert threshold requires multiple signal trajectories to cross predefined change thresholds simultaneously. Isolated single-signal fluctuations (a bad day, distraction, a cold) do not trigger alerts. The system is designed for specificity (few false alarms) over sensitivity (catching every possible change). False alarms undermine trust. We optimize for the alert that matters.

## Go-to-Market

### Phase 1: Direct-to-Family (DTC)
- Position as a gift: "Give your parent a daily thinking practice"
- Annual subscription, individual account
- Care partner dashboard (with consent) showing trajectory indicators
- Channel: Facebook/Instagram targeting adults 45-65 with aging parents, Google search ads for "cognitive decline early detection," "aging parent worry," partnerships with AARP and aging-in-place advocacy organizations

### Phase 2: Clinical Integration
- Geriatric practice partnerships: Alice as a prescribed cognitive monitoring tool
- EHR-integrated trajectory reports (FHIR)
- CPT code evaluation for remote cognitive monitoring (RPM codes may apply)
- Target: geriatric practices, memory clinics, neurology practices

### Phase 3: Senior Living / Community Deployment
- Per-resident licensing for senior living communities
- Community-level cognitive health dashboard for clinical staff
- Marketing to families during community selection ("We monitor cognitive health daily, not annually")
- Integrate with existing community health platforms

### Phase 4: Longevity / Concierge Medicine
- Premium cognitive assessment product for longevity clinics
- Quarterly cognitive trajectory reports alongside biomarker panels
- White-label option for concierge medicine practices

### Pricing
- **Individual / Family**: Annual subscription (consumer pricing)
- **Clinical**: Per-patient annual license + EHR integration setup
- **Senior Living**: Per-resident monthly license (volume discounts by community size)
- **Longevity / Concierge**: Premium annual license with quarterly clinician-facing reports
