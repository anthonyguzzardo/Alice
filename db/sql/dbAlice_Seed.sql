-- ============================================================================
-- Alice PostgreSQL Schema — Seed Data
-- ============================================================================
-- Enum table seed values. Safe to re-run (ON CONFLICT DO NOTHING).
-- Requires: dbAlice_Tables.sql executed first.
-- ============================================================================

SET search_path TO alice, public;

-- te_question_source
INSERT INTO te_question_source (question_source_id, enum_code, name) VALUES
   (1, 'seed',        'Seed')
  ,(2, 'generated',   'Generated')
  ,(3, 'calibration', 'Calibration')
  ,(4, 'corpus',      'Corpus')
ON CONFLICT DO NOTHING;

-- te_reflection_type
INSERT INTO te_reflection_type (reflection_type_id, enum_code, name) VALUES
   (1, 'weekly',  'Weekly')
  ,(2, 'monthly', 'Monthly')
ON CONFLICT DO NOTHING;

-- te_interaction_event_type
INSERT INTO te_interaction_event_type (interaction_event_type_id, enum_code, name) VALUES
   (1, 'page_open',       'Page Open')
  ,(2, 'first_keystroke', 'First Keystroke')
  ,(3, 'pause',           'Pause')
  ,(4, 'resume',          'Resume')
  ,(5, 'submit',          'Submit')
  ,(6, 'revisit',         'Revisit')
  ,(7, 'tab_blur',        'Tab Blur')
  ,(8, 'tab_focus',       'Tab Focus')
  ,(9, 'deletion',        'Deletion')
ON CONFLICT DO NOTHING;

-- te_prompt_trace_type
INSERT INTO te_prompt_trace_type (prompt_trace_type_id, enum_code, name) VALUES
   (1, 'generation',  'Generation')
  ,(2, 'observation', 'Observation')
  ,(3, 'reflection',  'Reflection')
ON CONFLICT DO NOTHING;

-- te_embedding_source
INSERT INTO te_embedding_source (embedding_source_id, enum_code, name) VALUES
   (1, 'response',    'Response')
  ,(2, 'observation', 'Observation')
  ,(3, 'reflection',  'Reflection')
ON CONFLICT DO NOTHING;

-- te_context_dimension
INSERT INTO te_context_dimension (context_dimension_id, enum_code, name) VALUES
   (1, 'sleep',           'Sleep')
  ,(2, 'physical_state',  'Physical State')
  ,(3, 'emotional_event', 'Emotional Event')
  ,(4, 'social_quality',  'Social Quality')
  ,(5, 'stress',          'Stress')
  ,(6, 'exercise',        'Exercise')
  ,(7, 'routine',         'Routine')
ON CONFLICT DO NOTHING;
