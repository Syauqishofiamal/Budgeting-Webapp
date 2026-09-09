-- Quest titles are stored as text when generated, so rows created before the
-- currency prefix was added still read "Keep transport under 29". Rewrite them
-- in place; new rows already include the currency.
UPDATE quests q
SET title = 'Keep transport under ' || COALESCE(s.currency, 'MYR') || ' ' ||
            TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM q.target::text))
FROM settings s
WHERE s.user_id = q.user_id
  AND q.slug = 'transport'
  AND q.title NOT LIKE '%' || COALESCE(s.currency, 'MYR') || '%';
