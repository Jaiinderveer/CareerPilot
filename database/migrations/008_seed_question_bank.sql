-- Migration: 008_seed_question_bank.sql
-- Description: Seed reviewed question bank with stable deterministic UUIDs
-- All seeds use ON CONFLICT DO NOTHING for idempotent re-runs
-- Provenance is 'curated' — these are hand-written educational questions, not company-reported

-- ============================================================================
-- SKILLS (5 core MVP topics)
-- ============================================================================
INSERT INTO skills (id, name, topic_area, description) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'DBMS', 'Core CS', 'Database management systems fundamentals including indexing, normalization, transactions, and query optimization.'),
  ('a1000000-0000-4000-8000-000000000002', 'Operating Systems', 'Core CS', 'Operating system concepts including processes, memory management, scheduling, and concurrency.'),
  ('a1000000-0000-4000-8000-000000000003', 'Data Structures and Algorithms', 'Core CS', 'Core data structures (arrays, trees, graphs, hash tables) and algorithmic problem solving.'),
  ('a1000000-0000-4000-8000-000000000004', 'Object-Oriented Programming', 'Core CS', 'Object-oriented design principles, patterns, encapsulation, inheritance, and polymorphism.'),
  ('a1000000-0000-4000-8000-000000000005', 'Backend Development', 'Development', 'Server-side development including APIs, databases, authentication, and system design basics.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- QUESTION BANK (5 curated questions, one per skill)
-- ============================================================================
INSERT INTO question_bank (id, skill_id, difficulty, question_text, provenance, review_status, rubric_version) VALUES
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 2,
   'What is a database index, and how does it improve query performance?',
   'curated', 'reviewed', 1),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 3,
   'Explain the difference between a process and a thread, and when you would use each.',
   'curated', 'reviewed', 1),
  ('b1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', 2,
   'What is the time complexity of binary search, and when would you use it over linear search?',
   'curated', 'reviewed', 1),
  ('b1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000004', 2,
   'Explain the difference between abstraction and encapsulation in object-oriented programming.',
   'curated', 'reviewed', 1),
  ('b1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000005', 3,
   'How would you design a REST API endpoint for creating and retrieving user profiles?',
   'curated', 'reviewed', 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- QUESTION RUBRICS (one rubric per question, version 1)
-- ============================================================================
INSERT INTO question_rubrics (id, question_id, version, expected_concepts, scoring_guidance, reviewed_at, reviewed_by) VALUES
  ('c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 1,
   '{"critical": ["index_purpose", "query_performance"], "required": ["btree_structure"], "optional": ["hash_index_comparison"]}',
   'Score based on clarity of index purpose explanation and ability to name at least one query optimization scenario.',
   now(), 'p2-seed'),

  ('c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 1,
   '{"critical": ["process_vs_thread", "concurrency_context"], "required": ["memory_isolation"], "optional": ["scheduling_basics"]}',
   'Score based on accurate distinction between process and thread, and awareness of when each is appropriate.',
   now(), 'p2-seed'),

  ('c1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000003', 1,
   '{"critical": ["binary_search_complexity", "precondition_sorted"], "required": ["comparison_with_linear"], "optional": ["space_complexity"]}',
   'Score based on correct O(log n) complexity and mention of sorted precondition.',
   now(), 'p2-seed'),

  ('c1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000004', 1,
   '{"critical": ["abstraction_definition", "encapsulation_definition"], "required": ["access_modifiers"], "optional": ["real_world_example"]}',
   'Score based on clear distinction between abstraction (hide complexity) and encapsulation (bundle data and methods).',
   now(), 'p2-seed'),

  ('c1000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000005', 1,
   '{"critical": ["rest_verb_usage", "status_codes"], "required": ["data_validation"], "optional": ["authentication_note"]}',
   'Score based on correct HTTP verbs (POST/GET), appropriate status codes, and basic validation awareness.',
   now(), 'p2-seed')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- RUBRIC CRITERIA (3 criteria per rubric, weights sum to 1.00)
-- ============================================================================

-- Q1: DBMS — What is a database index?
INSERT INTO rubric_criteria (id, rubric_id, criterion_id, description, importance, weight, skill_id) VALUES
  ('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'index_purpose',
   'Explains that an index speeds up data retrieval operations by avoiding full table scans.',
   'critical', 0.40, 'a1000000-0000-4000-8000-000000000001'),
  ('d1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'query_performance',
   'Describes how indexes reduce disk I/O or improve query execution plans.',
   'critical', 0.35, 'a1000000-0000-4000-8000-000000000001'),
  ('d1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 'btree_structure',
   'Mentions B-tree or similar data structure used in common database indexes.',
   'required', 0.25, 'a1000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Q2: OS — Process vs Thread
INSERT INTO rubric_criteria (id, rubric_id, criterion_id, description, importance, weight, skill_id) VALUES
  ('d1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000002', 'process_vs_thread',
   'Clearly distinguishes process (isolated memory space) from thread (shared memory within a process).',
   'critical', 0.40, 'a1000000-0000-4000-8000-000000000002'),
  ('d1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000002', 'concurrency_context',
   'Explains when threads are preferred (I/O-bound, shared state) vs processes (isolation, safety).',
   'critical', 0.35, 'a1000000-0000-4000-8000-000000000002'),
  ('d1000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000002', 'memory_isolation',
   'Notes that processes have separate memory spaces while threads share heap memory.',
   'required', 0.25, 'a1000000-0000-4000-8000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- Q3: DSA — Binary Search complexity
INSERT INTO rubric_criteria (id, rubric_id, criterion_id, description, importance, weight, skill_id) VALUES
  ('d1000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000003', 'binary_search_complexity',
   'States O(log n) time complexity for binary search.',
   'critical', 0.40, 'a1000000-0000-4000-8000-000000000003'),
  ('d1000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000003', 'precondition_sorted',
   'Notes that binary search requires the input to be sorted first.',
   'critical', 0.35, 'a1000000-0000-4000-8000-000000000003'),
  ('d1000000-0000-4000-8000-000000000009', 'c1000000-0000-4000-8000-000000000003', 'comparison_with_linear',
   'Compares binary search O(log n) favorably to linear search O(n) for large datasets.',
   'required', 0.25, 'a1000000-0000-4000-8000-000000000003')
ON CONFLICT (id) DO NOTHING;

-- Q4: OOP — Abstraction vs Encapsulation
INSERT INTO rubric_criteria (id, rubric_id, criterion_id, description, importance, weight, skill_id) VALUES
  ('d1000000-0000-4000-8000-000000000010', 'c1000000-0000-4000-8000-000000000004', 'abstraction_definition',
   'Defines abstraction as hiding complex implementation details and showing only essential features.',
   'critical', 0.40, 'a1000000-0000-4000-8000-000000000004'),
  ('d1000000-0000-4000-8000-000000000011', 'c1000000-0000-4000-8000-000000000004', 'encapsulation_definition',
   'Defines encapsulation as bundling data and methods together and restricting direct access.',
   'critical', 0.35, 'a1000000-0000-4000-8000-000000000004'),
  ('d1000000-0000-4000-8000-000000000012', 'c1000000-0000-4000-8000-000000000004', 'access_modifiers',
   'Mentions access modifiers (private, protected, public) as a mechanism for encapsulation.',
   'required', 0.25, 'a1000000-0000-4000-8000-000000000004')
ON CONFLICT (id) DO NOTHING;

-- Q5: Backend — REST API design
INSERT INTO rubric_criteria (id, rubric_id, criterion_id, description, importance, weight, skill_id) VALUES
  ('d1000000-0000-4000-8000-000000000013', 'c1000000-0000-4000-8000-000000000005', 'rest_verb_usage',
   'Uses POST for creating resources and GET for retrieving resources.',
   'critical', 0.40, 'a1000000-0000-4000-8000-000000000005'),
  ('d1000000-0000-4000-8000-000000000014', 'c1000000-0000-4000-8000-000000000005', 'status_codes',
   'Identifies appropriate HTTP status codes (201 Created, 200 OK, 400 Bad Request, 404 Not Found).',
   'critical', 0.35, 'a1000000-0000-4000-8000-000000000005'),
  ('d1000000-0000-4000-8000-000000000015', 'c1000000-0000-4000-8000-000000000005', 'data_validation',
   'Mentions validating request body before persisting data to the database.',
   'required', 0.25, 'a1000000-0000-4000-8000-000000000005')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SEED INTEGRITY SUMMARY
-- ============================================================================
-- Skills:     5 (DBMS, OS, DSA, OOP, Backend Development)
-- Questions:  5 (one per skill, difficulty 2-3, review_status='reviewed')
-- Rubrics:    5 (one per question, version=1)
-- Criteria:  15 (3 per rubric; weights 0.40+0.35+0.25=1.00)
-- Provenance: All 'curated' (hand-written educational questions)
-- All UUIDs are deterministic and ON CONFLICT safe