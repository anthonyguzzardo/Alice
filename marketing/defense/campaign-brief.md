# Defense and Intelligence Campaign Brief

## Market Context

Military human performance programs spend billions annually on operator readiness. The current toolkit is physiological: WHOOP bands on SOF operators, Oura rings on pilots, actigraphy for sleep monitoring, and periodic neuropsychological screening (ANAM, DANA) for TBI and fitness-for-duty evaluations.

The gap is cognitive readiness. Heart rate variability tells you the body is recovered. It does not tell you the operator's decision-making is intact. Processing speed tests (ANAM) are periodic snapshots with known practice effects that operators learn to pass. Self-report (PHQ-9, PCL-5) has documented underreporting in military populations where admitting difficulty has career consequences.

The intelligence community faces a parallel problem: analyst cognitive fatigue. High-volume information processing over sustained periods degrades judgment quality. The degradation is invisible to the analyst and their supervisor until an assessment error surfaces.

Both communities need continuous, implicit cognitive readiness measurement that operators cannot fake and supervisors cannot use punitively.

## Target Personas

### Human Performance Program Director (SOF / Aviation)
- Manages physical and cognitive readiness across operational units
- Has wearable physiological monitoring already deployed
- Knows physiological readiness is necessary but insufficient
- Needs cognitive readiness data that operators trust and leadership can use responsibly
- Accountable for fitness-for-duty decisions

### DARPA / Service Research Lab Program Manager
- Funding next-generation human performance and cognitive augmentation research
- Interested in novel biomarkers, ecological measurement, and AI applications
- Evaluates proposals on scientific rigor, operational relevance, and scalability
- Comfortable with TRL 3-5 technologies that demonstrate proof of concept

### Intelligence Community Analyst Wellness Program
- Managing cognitive load in SIGINT, IMINT, and all-source analysts
- Concerned about burnout, analytic error, and retention
- Needs population-level cognitive health monitoring without creating surveillance culture
- Operates in classified environments with strict data handling requirements

### Military Psychologist / Neuropsychologist
- Administers cognitive screening (ANAM, MACE-2, RBANS) for TBI, fitness-for-duty
- Knows the limitations of periodic explicit testing
- Wants continuous cognitive monitoring between formal assessments
- Interested in return-to-duty cognitive trajectory after TBI/concussion

## Value Proposition

Continuous cognitive readiness assessment through daily implicit measurement. Operators experience a single daily journal question. The signal engine extracts cognitive process markers (processing speed, lexical retrieval, executive function, motor planning) from writing behavior. Commanders receive unit-level readiness indicators. Individual data remains clinically privileged.

## Operational Scenarios

### Pre-Deployment Baseline
Operator begins daily Alice practice 90 days before deployment. Signal engine establishes individual cognitive baseline across all signal families: keystroke dynamics, lexical diversity, semantic coherence, pause architecture, revision behavior. This baseline is the operator's cognitive fingerprint under normal conditions.

### Deployment Monitoring
During deployment, daily question continues. Signal deviations from baseline are computed automatically. Significant deviations (increased IKI variance, decreased lexical diversity, elevated hedging, fragmented pause architecture) indicate cognitive degradation before self-report.

Unit-level aggregate signals (not individual) are available to the unit psychologist or human performance team. Individual-level signals are clinically privileged (accessible only to the medical provider with operator consent).

### Post-Deployment / Transition
Return to baseline tracking. The signal trajectory during reintegration provides objective cognitive recovery data. For TBI cases, daily signal data supplements periodic ANAM/MACE-2 screening with continuous trajectory information.

### Analyst Cognitive Load Monitoring
Intelligence analysts complete daily Alice practice. Population-level cognitive health signals (hedging density, semantic coherence, response depth) provide leadership with an organizational cognitive health dashboard. Individual signals remain private. Elevated organizational hedging density may indicate analytical risk aversion, uncertainty overload, or decision fatigue across the analytic workforce.

## Signal Relevance to Military Cognitive Constructs

| Alice Signal | Cognitive Construct | Operational Relevance |
|---|---|---|
| IKI variance increase | Processing speed degradation | Slowed tactical decision-making |
| Pause architecture fragmentation | Working memory load | Impaired multi-factor situation assessment |
| Lexical diversity decline (MATTR) | Word-finding difficulty, semantic access | Communication degradation under stress |
| Semantic coherence decrease | Discourse disorganization | Impaired briefing/reporting quality |
| Hedging density increase | Epistemic uncertainty | Decision paralysis, risk aversion |
| P-burst shortening | Language production fluency decrease | Reduced cognitive throughput |
| Revision ratio increase | Error monitoring overload | Perfectionism under stress, cognitive doubt |
| Response latency increase | Processing speed, engagement | Fatigue, motivational withdrawal |

## Key Differentiators

### vs. ANAM / DANA / MACE-2 (Military Cognitive Tests)
| Dimension | Military Cognitive Tests | Alice |
|---|---|---|
| Frequency | Periodic (post-TBI, annual screening) | Daily |
| Practice effects | Documented (operators learn the tests) | None (unique question daily) |
| Fakability | Operators can sandbag baseline to make post-injury look normal | Cannot game metrics you cannot see |
| Burden | 20-45 minutes, dedicated test session | 5 minutes, integrated into daily routine |
| Ecological validity | Low (test environment) | High (operator's own space) |
| Operator trust | Low (results go to command) | High (journal is private, only aggregates shared) |

### vs. WHOOP / Oura (Physiological Readiness)
| Dimension | Wearables | Alice |
|---|---|---|
| Signal domain | Heart, sleep, strain | Language, cognition, decision process |
| What it measures | Body readiness | Mind readiness |
| Complementarity | Does not detect cognitive degradation | Does not detect physical fatigue |
| Position | Alice + wearable = full-spectrum readiness |

### vs. Self-Report (PHQ-9, PCL-5, Resilience Scales)
| Dimension | Self-Report | Alice |
|---|---|---|
| Reporting bias | Severe in military (underreport to avoid career impact) | None (signals are implicit, not self-assessed) |
| Social desirability | High | None |
| Frequency | Periodic surveys | Daily implicit collection |
| Signal type | What operator says they feel | How operator actually processes |

## Key Messages

### For Human Performance Leadership
**"Cognitive readiness you can't fake."**
Operators learn to pass cognitive tests and underreport symptoms on self-assessments. Alice measures how they actually process language, daily, implicitly. The signals cannot be gamed because the operator does not know what is being measured.

### For DARPA / Research
**"Daily ecological cognitive biomarkers with 365x the temporal resolution of current military cognitive screening."**
Novel signal ensemble from naturalistic writing behavior. Deterministic signal computation (Rust). Complementary to physiological wearable data. Suitable for combined cognitive-physiological readiness models.

### For Commander / Unit Leadership
**"Unit cognitive health at a glance. No individual surveillance."**
Unit-level aggregate signals show cognitive readiness trends across the formation. Individual data stays with medical. Operators trust the system because it is a journal, not a test, and their answers are private.

### For Military Psychology
**"Continuous cognitive trajectory between formal assessments."**
ANAM gives you a snapshot. Alice gives you the trajectory between snapshots. For TBI return-to-duty, daily signal data shows the recovery curve, not just the endpoint.

## Objection Handling

**"Operators won't do it."**
The bar is one question, one answer, five minutes. No test. No score. No streak. The question is generated from their own history, making it personally relevant. Operators who would never fill out a wellness survey will answer a question about their thinking. The format matters.

**"Command will use it punitively."**
The privacy architecture makes this structurally impossible. Individual signals are clinically privileged by design. Command receives only unit-level aggregates above a minimum reporting threshold. This is the same privacy model as medical records: the unit psychologist has access, the commander does not. The architecture enforces this, not policy.

**"We already have WHOOP."**
WHOOP measures the body. Alice measures the mind. HRV tells you the operator slept well. It does not tell you their working memory is degraded from sustained cognitive load, their lexical retrieval has slowed, or their decision hedging has increased. These are different signal domains measuring different readiness constructs. They are complementary.

**"The signals haven't been validated in military populations."**
This is the research opportunity. Keystroke dynamics and computational linguistics have established research bases in cognitive science. Application to military cognitive readiness assessment is novel. We propose a phased validation: (1) establish signal psychometrics in garrison, (2) correlate with ANAM/MACE-2 in controlled conditions, (3) pilot in operational training environments, (4) field deployment with research oversight.

**"OPSEC: where does the data go?"**
Configurable deployment architecture. For classified environments: fully air-gapped, on-premises deployment. Signal computation runs locally (Rust, no cloud dependency). No data leaves the enclave. For unclassified use: standard encrypted cloud with data residency controls.

## Go-to-Market

### Phase 1: SBIR / Research Partnership
- DARPA or Service-lab SBIR/STTR proposal for cognitive readiness biomarker development
- Partner with military-affiliated research institution (WRAIR, NHRC, USAARL)
- 12-18 month Phase I/II demonstrating signal properties in military-relevant populations
- Deliverable: technical report + pilot dataset + peer-reviewed publication

### Phase 2: Operational Pilot
- Human Performance Program pilot at 1-2 SOF units or flight squadrons
- 6-month deployment alongside existing WHOOP/physiological monitoring
- Combined cognitive-physiological readiness model development
- IRB-approved research protocol

### Phase 3: Program of Record
- ACAT acquisition pathway for cognitive readiness monitoring capability
- Integration with existing human performance platforms
- Scaled deployment across SOF, aviation, intelligence analysis communities

### Security Considerations
- ITAR/EAR classification review for signal algorithms
- FedRAMP pathway for cloud deployment (if applicable)
- Air-gapped deployment option for classified environments
- Personnel security: cleared development team for sensitive deployments
