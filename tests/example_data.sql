INSERT INTO experiments (experiment, created_at, description, media_used, organism_used) VALUES
('exp0', '2023-09-01T12:00:00Z', 'Demo experiment', '', ''),
('exp1', '2023-10-01T12:00:00Z', 'First experiment', 'LB broth', 'E. coli'),
('exp2', '2023-10-02T15:00:00Z', 'Second experiment', 'Minimal media', 'Yeast'),
('exp3', '2023-10-03T09:00:00Z', 'Third experiment', 'Rich media', 'Bacteria');

INSERT INTO workers (pioreactor_unit, added_at, is_active) VALUES
('unit1', '2023-10-01T10:00:00Z', 1),
('unit2', '2023-10-01T11:00:00Z', 1),
('unit3', '2023-10-02T10:00:00Z', 1),
('unit4', '2023-10-03T08:00:00Z', 0);

INSERT INTO experiment_worker_assignments (pioreactor_unit, experiment, assigned_at) VALUES
('unit1', 'exp1', '2023-10-01T12:00:00Z'),
('unit2', 'exp1', '2023-10-01T13:00:00Z'),
('unit3', 'exp2', '2023-10-02T15:30:00Z'),
('unit4', 'exp3', '2023-10-03T09:30:00Z');

INSERT INTO pioreactor_unit_labels (experiment, pioreactor_unit, label, created_at) VALUES
('exp1', 'unit1', 'Reactor 1', '2023-10-01T12:00:00Z'),
('exp1', 'unit2', 'Reactor 2', '2023-10-01T12:00:00Z'),
('exp2', 'unit3', 'Reactor 3', '2023-10-02T15:00:00Z'),
('exp3', 'unit4', 'Reactor 4', '2023-10-03T09:00:00Z');

INSERT INTO logs (experiment, pioreactor_unit, timestamp, message, source, level, task) VALUES
('exp1', 'unit1', '2023-10-01T12:10:00Z', 'Started mixing', 'mixer', 'INFO', 'mixing_task'),
('exp1', 'unit2', '2023-10-01T12:15:00Z', 'OD reading taken', 'sensor', 'INFO', 'od_reading_task'),
('exp2', 'unit3', '2023-10-02T15:45:00Z', 'Temperature set', 'heater', 'INFO', 'temperature_task'),
('exp3', 'unit4', '2023-10-03T09:45:00Z', 'Experiment started', 'system', 'INFO', 'startup_task');

INSERT INTO dosing_events (experiment, pioreactor_unit, timestamp, event, volume_change_ml, source_of_event) VALUES
('exp1', 'unit1', '2023-10-01T12:20:00Z', 'Add media', 5.0, 'automated'),
('exp1', 'unit2', '2023-10-01T12:25:00Z', 'Remove waste', -5.0, 'automated'),
('exp2', 'unit3', '2023-10-02T16:00:00Z', 'Add media', 4.5, 'manual'),
('exp3', 'unit4', '2023-10-03T10:00:00Z', 'Add media', 6.0, 'automated');

INSERT INTO od_readings (experiment, pioreactor_unit, timestamp, od_reading, angle, channel) VALUES
('exp1', 'unit1', '2023-10-01T12:15:00Z', 0.5, 180, 1),
('exp1', 'unit2', '2023-10-01T12:15:00Z', 0.6, 180, 1),
('exp2', 'unit3', '2023-10-02T15:50:00Z', 0.4, 180, 1),
('exp3', 'unit4', '2023-10-03T09:50:00Z', 0.7, 180, 1);

INSERT INTO growth_rates (experiment, pioreactor_unit, timestamp, rate) VALUES
('exp1', 'unit1', '2023-10-01T13:00:00Z', 0.02),
('exp1', 'unit2', '2023-10-01T13:00:00Z', 0.025),
('exp2', 'unit3', '2023-10-02T16:00:00Z', 0.018),
('exp3', 'unit4', '2023-10-03T10:30:00Z', 0.03);
