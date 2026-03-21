-- FIX: Bucket practice_solved/perfect_day/streak_milestone/level_up into solo contribution types.
DROP FUNCTION IF EXISTS update_contributions() CASCADE;

CREATE OR REPLACE FUNCTION update_contributions()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO contributions (user_id, date, count, intensity, types)
  VALUES (
    NEW.user_id,
    NEW.date,
    NEW.delta,
    1,
    jsonb_build_object(
      'solo', CASE WHEN NEW.event_type IN
        ('solo_task', 'practice_solved', 'perfect_day',
         'streak_milestone', 'level_up')
        THEN NEW.delta ELSE 0 END,
      'room', CASE WHEN NEW.event_type = 'room_win'
        THEN NEW.delta ELSE 0 END,
      'quests', CASE WHEN NEW.event_type = 'quest_complete'
        THEN NEW.delta ELSE 0 END
    )
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    count = contributions.count + NEW.delta,
    intensity = CASE
      WHEN (contributions.count + NEW.delta) <= 0 THEN 0
      WHEN (contributions.count + NEW.delta) <= 2 THEN 1
      WHEN (contributions.count + NEW.delta) <= 4 THEN 2
      WHEN (contributions.count + NEW.delta) <= 7 THEN 3
      WHEN (contributions.count + NEW.delta) <= 9 THEN 4
      ELSE 5
    END,
    types = jsonb_set(
      jsonb_set(
        jsonb_set(
          contributions.types,
          '{solo}',
          to_jsonb(
            (contributions.types->>'solo')::numeric +
            CASE WHEN NEW.event_type IN
              ('solo_task', 'practice_solved', 'perfect_day',
               'streak_milestone', 'level_up')
              THEN NEW.delta ELSE 0 END
          )
        ),
        '{room}',
        to_jsonb(
          (contributions.types->>'room')::numeric +
          CASE WHEN NEW.event_type = 'room_win'
            THEN NEW.delta ELSE 0 END
        )
      ),
      '{quests}',
      to_jsonb(
        (contributions.types->>'quests')::numeric +
        CASE WHEN NEW.event_type = 'quest_complete'
          THEN NEW.delta ELSE 0 END
      )
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_contributions
  ON contribution_events;
CREATE TRIGGER trg_update_contributions
AFTER INSERT ON contribution_events
FOR EACH ROW EXECUTE FUNCTION update_contributions();
