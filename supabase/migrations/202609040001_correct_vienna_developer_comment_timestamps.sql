-- Discord snowflake IDs contain the authoritative UTC creation time. These
-- comments were added while the admin browser was in Vienna but their pasted
-- clock times were interpreted using the usual home timezone, shifting them
-- seven hours early and placing them out of chronological order.
update developer_comments
set comment_date = '2026-09-04T07:21:00Z'
where id = '5ca0e635-cf37-4ffe-8fa6-e3d567aa335e'
  and comment_date = '2026-09-04T00:21:00Z';

update developer_comments
set comment_date = '2026-09-04T07:24:00Z'
where id = '356639eb-8c47-43cc-90de-b4d7b7164917'
  and comment_date = '2026-09-04T00:24:00Z';

update developer_comments
set comment_date = '2026-09-04T07:26:00Z'
where id = '17d47482-5912-41ce-bad9-6ccba18586b1'
  and comment_date = '2026-09-04T00:26:00Z';
