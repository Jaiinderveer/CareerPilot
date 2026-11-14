-- CareerPilot hackathon demo seed: Frontend Developer interview questions.
-- Standalone idempotent seed; this is intentionally NOT a schema migration.
-- All content is CareerPilot-authored demo material, not recruiter or company data.
-- Safe to run repeatedly: stable UUIDs plus ON CONFLICT updates prevent duplicates.

BEGIN;

INSERT INTO skills (id, name, topic_area, description) VALUES
  ('a2000000-0000-4000-8000-000000000001', 'Frontend Development', 'Development',
   'Browser-based application development with semantic HTML, CSS, JavaScript, accessibility, performance, and component architecture.')
ON CONFLICT (name) DO UPDATE SET
  topic_area = EXCLUDED.topic_area,
  description = EXCLUDED.description;

-- Question and criterion inserts resolve by the unique skill name, so an
-- existing Frontend Development skill with a different UUID is reused.
INSERT INTO question_bank (
  id, company_id, role, round, skill_id, difficulty, question_text,
  source, provenance, review_status, rubric_version
) VALUES
  ('b2000000-0000-4000-8000-000000000001', NULL, 'Frontend Developer', 'Technical',
   (SELECT id FROM skills WHERE name = 'Frontend Development'), 1,
   'What is semantic HTML, and how does it improve accessibility and maintainability?',
   'CareerPilot hackathon demo seed', 'curated', 'reviewed', 1),
  ('b2000000-0000-4000-8000-000000000002', NULL, 'Frontend Developer', 'Technical',
   (SELECT id FROM skills WHERE name = 'Frontend Development'), 2,
   'Explain the CSS box model and how box-sizing: border-box changes layout calculations.',
   'CareerPilot hackathon demo seed', 'curated', 'reviewed', 1),
  ('b2000000-0000-4000-8000-000000000003', NULL, 'Frontend Developer', 'Technical',
   (SELECT id FROM skills WHERE name = 'Frontend Development'), 2,
   'How does JavaScript event delegation work, and when is it useful?',
   'CareerPilot hackathon demo seed', 'curated', 'reviewed', 1),
  ('b2000000-0000-4000-8000-000000000004', NULL, 'Frontend Developer', 'Technical',
   (SELECT id FROM skills WHERE name = 'Frontend Development'), 3,
   'In React, what causes a component to re-render, and how would you investigate unnecessary re-renders?',
   'CareerPilot hackathon demo seed', 'curated', 'reviewed', 1),
  ('b2000000-0000-4000-8000-000000000005', NULL, 'Frontend Developer', 'Technical',
   (SELECT id FROM skills WHERE name = 'Frontend Development'), 3,
   'How would you improve the loading performance of a frontend application?',
   'CareerPilot hackathon demo seed', 'curated', 'reviewed', 1)
ON CONFLICT (id) DO UPDATE SET
  company_id = EXCLUDED.company_id,
  role = EXCLUDED.role,
  round = EXCLUDED.round,
  skill_id = EXCLUDED.skill_id,
  difficulty = EXCLUDED.difficulty,
  question_text = EXCLUDED.question_text,
  source = EXCLUDED.source,
  provenance = EXCLUDED.provenance,
  review_status = EXCLUDED.review_status,
  rubric_version = EXCLUDED.rubric_version;

INSERT INTO question_rubrics (
  id, question_id, version, expected_concepts, scoring_guidance, reviewed_at, reviewed_by
) VALUES
  ('c2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 1,
   '{"critical":["semantic_elements","accessibility"],"required":["maintainability"],"optional":["seo"]}',
   'Look for correct semantic element examples, assistive-technology impact, and maintainability benefits.',
   now(), 'careerpilot-demo-seed'),
  ('c2000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 1,
   '{"critical":["box_model_parts","border_box_behavior"],"required":["layout_calculation"],"optional":["global_reset"]}',
   'Look for content, padding, border, margin, and an accurate comparison of content-box with border-box.',
   now(), 'careerpilot-demo-seed'),
  ('c2000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000003', 1,
   '{"critical":["event_bubbling","ancestor_handler"],"required":["dynamic_elements"],"optional":["target_filtering"]}',
   'Look for event bubbling, a shared ancestor listener, target matching, and an appropriate use case.',
   now(), 'careerpilot-demo-seed'),
  ('c2000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000004', 1,
   '{"critical":["render_triggers","profiling"],"required":["optimization_tradeoffs"],"optional":["memoization"]}',
   'Look for state, props, and context updates; React DevTools profiling; and measured rather than premature optimization.',
   now(), 'careerpilot-demo-seed'),
  ('c2000000-0000-4000-8000-000000000005', 'b2000000-0000-4000-8000-000000000005', 1,
   '{"critical":["measurement","resource_optimization"],"required":["delivery_strategy"],"optional":["web_vitals"]}',
   'Look for measurement first, smaller/fewer resources, caching or CDN delivery, and code or asset loading strategy.',
   now(), 'careerpilot-demo-seed')
ON CONFLICT (question_id, version) DO UPDATE SET
  expected_concepts = EXCLUDED.expected_concepts,
  scoring_guidance = EXCLUDED.scoring_guidance,
  reviewed_at = EXCLUDED.reviewed_at,
  reviewed_by = EXCLUDED.reviewed_by;

INSERT INTO rubric_criteria (
  id, rubric_id, criterion_id, description, importance, weight, skill_id
) VALUES
  ('d2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'semantic_elements',
   'Explains that semantic elements communicate document structure and gives an appropriate example.', 'critical', 0.40, (SELECT id FROM skills WHERE name = 'Frontend Development')),
  ('d2000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000001', 'accessibility',
   'Connects meaningful structure to screen-reader navigation or other assistive technology.', 'critical', 0.35, (SELECT id FROM skills WHERE name = 'Frontend Development')),
  ('d2000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000001', 'maintainability',
   'Explains how meaningful markup makes the code easier to understand and maintain.', 'required', 0.25, (SELECT id FROM skills WHERE name = 'Frontend Development')),

  ('d2000000-0000-4000-8000-000000000004', 'c2000000-0000-4000-8000-000000000002', 'box_model_parts',
   'Identifies content, padding, border, and margin as the CSS box model layers.', 'critical', 0.40, (SELECT id FROM skills WHERE name = 'Frontend Development')),
  ('d2000000-0000-4000-8000-000000000005', 'c2000000-0000-4000-8000-000000000002', 'border_box_behavior',
   'Explains that border-box includes padding and border inside the declared width and height.', 'critical', 0.35, (SELECT id FROM skills WHERE name = 'Frontend Development')),
  ('d2000000-0000-4000-8000-000000000006', 'c2000000-0000-4000-8000-000000000002', 'layout_calculation',
   'Accurately compares total rendered size under content-box and border-box.', 'required', 0.25, (SELECT id FROM skills WHERE name = 'Frontend Development')),

  ('d2000000-0000-4000-8000-000000000007', 'c2000000-0000-4000-8000-000000000003', 'event_bubbling',
   'Explains that events bubble from the originating element through its ancestors.', 'critical', 0.40, (SELECT id FROM skills WHERE name = 'Frontend Development')),
  ('d2000000-0000-4000-8000-000000000008', 'c2000000-0000-4000-8000-000000000003', 'ancestor_handler',
   'Describes attaching one handler to a common ancestor and inspecting the event target.', 'critical', 0.35, (SELECT id FROM skills WHERE name = 'Frontend Development')),
  ('d2000000-0000-4000-8000-000000000009', 'c2000000-0000-4000-8000-000000000003', 'dynamic_elements',
   'Identifies dynamic or repeated child elements as a useful delegation scenario.', 'required', 0.25, (SELECT id FROM skills WHERE name = 'Frontend Development')),

  ('d2000000-0000-4000-8000-000000000010', 'c2000000-0000-4000-8000-000000000004', 'render_triggers',
   'Identifies state, parent-provided props, and consumed context changes as common render triggers.', 'critical', 0.40, (SELECT id FROM skills WHERE name = 'Frontend Development')),
  ('d2000000-0000-4000-8000-000000000011', 'c2000000-0000-4000-8000-000000000004', 'profiling',
   'Uses React DevTools Profiler or equivalent measurement to locate unnecessary work.', 'critical', 0.35, (SELECT id FROM skills WHERE name = 'Frontend Development')),
  ('d2000000-0000-4000-8000-000000000012', 'c2000000-0000-4000-8000-000000000004', 'optimization_tradeoffs',
   'Explains a measured optimization such as component isolation or memoization and its tradeoffs.', 'required', 0.25, (SELECT id FROM skills WHERE name = 'Frontend Development')),

  ('d2000000-0000-4000-8000-000000000013', 'c2000000-0000-4000-8000-000000000005', 'measurement',
   'Starts with browser profiling, network analysis, or Core Web Vitals rather than guessing.', 'critical', 0.40, (SELECT id FROM skills WHERE name = 'Frontend Development')),
  ('d2000000-0000-4000-8000-000000000014', 'c2000000-0000-4000-8000-000000000005', 'resource_optimization',
   'Discusses reducing or compressing JavaScript, CSS, images, fonts, or other critical resources.', 'critical', 0.35, (SELECT id FROM skills WHERE name = 'Frontend Development')),
  ('d2000000-0000-4000-8000-000000000015', 'c2000000-0000-4000-8000-000000000005', 'delivery_strategy',
   'Describes lazy loading, code splitting, caching, CDN use, or another suitable delivery strategy.', 'required', 0.25, (SELECT id FROM skills WHERE name = 'Frontend Development'))
ON CONFLICT (rubric_id, criterion_id) DO UPDATE SET
  description = EXCLUDED.description,
  importance = EXCLUDED.importance,
  weight = EXCLUDED.weight,
  skill_id = EXCLUDED.skill_id;

DO $$
DECLARE
  question_count INTEGER;
  rubric_count INTEGER;
  criterion_count INTEGER;
  invalid_weight_count INTEGER;
BEGIN
  SELECT count(*) INTO question_count
  FROM question_bank
  WHERE id::text LIKE 'b2000000-0000-4000-8000-%'
    AND role = 'Frontend Developer'
    AND round = 'Technical'
    AND review_status = 'reviewed';

  SELECT count(*) INTO rubric_count
  FROM question_rubrics
  WHERE question_id::text LIKE 'b2000000-0000-4000-8000-%'
    AND version = 1;

  SELECT count(*) INTO criterion_count
  FROM rubric_criteria criteria
  JOIN question_rubrics rubrics ON rubrics.id = criteria.rubric_id
  WHERE rubrics.question_id::text LIKE 'b2000000-0000-4000-8000-%';

  SELECT count(*) INTO invalid_weight_count
  FROM (
    SELECT rubrics.question_id
    FROM question_rubrics rubrics
    JOIN rubric_criteria criteria ON criteria.rubric_id = rubrics.id
    WHERE rubrics.question_id::text LIKE 'b2000000-0000-4000-8000-%'
    GROUP BY rubrics.question_id
    HAVING count(*) <> 3 OR abs(sum(criteria.weight) - 1.00) > 0.001
  ) invalid_rubrics;

  IF question_count <> 5 OR rubric_count <> 5 OR criterion_count <> 15 OR invalid_weight_count <> 0 THEN
    RAISE EXCEPTION
      'Frontend demo seed integrity failed: questions=%, rubrics=%, criteria=%, invalid_weights=%',
      question_count, rubric_count, criterion_count, invalid_weight_count;
  END IF;
END $$;

COMMIT;

-- Expected integrity after execution:
-- 1 Frontend Development skill, 5 reviewed Frontend Developer/Technical questions,
-- 5 version-1 rubrics, and 15 rubric criteria (3 per rubric, weights sum to 1.00).
