-- Player quest board test notices
--
-- Before running:
-- 1. Replace the character names in seed_people with real character names from your database.
-- 2. Optionally tweak the region/shard/province/home_valley values to match those characters.
-- 3. Run this after the player quest board schema setup has already been applied.
--
-- This script is additive. It inserts sample board posts and their goals only.

with seed_people as (
    select *
    from (values
        ('settlement_poster', 'REPLACE_WITH_SETTLEMENT_POSTER'),
        ('hunter_poster', 'REPLACE_WITH_HUNTER_POSTER'),
        ('trader_poster', 'REPLACE_WITH_TRADER_POSTER'),
        ('guide_poster', 'REPLACE_WITH_GUIDE_POSTER'),
        ('event_poster', 'REPLACE_WITH_EVENT_POSTER')
    ) as v(seed_role, character_name)
),
resolved_people as (
    select
        sp.seed_role,
        c.character_id,
        c.character_name,
        c.user_id,
        c.region,
        c.shard,
        c.province,
        c.home_valley
    from seed_people sp
    join public.characters c
      on c.character_name = sp.character_name
),
seed_posts as (
    select *
    from (values
        (
            'wall-timber-run',
            'settlement_poster',
            'settlement_task',
            'Player Contracts: Settlement Work',
            'Timber For The West Palisade',
            'Our outer wall needs fresh beams before the next raid window.',
            'We need a clean timber run to finish repairs on the western palisade. Bring the load straight to the settlement storehouse and speak with the quartermaster on arrival.',
            'Payment in coin or crafted supplies on delivery.',
            'submit_for_confirmation',
            2,
            false,
            true,
            'Meet at the west storehouse and mention the repair order.',
            14
        ),
        (
            'clay-and-thatch',
            'settlement_poster',
            'help_wanted',
            'Player Contracts: Settlement Work',
            'Clay And Thatch Refill',
            'Short gathering contract for the builders working the riverside huts.',
            'The builders are short on fresh clay and roofing thatch. This is a simple support contract for anyone already gathering nearby.',
            'Builder bundle and a small coin tip.',
            'self_complete',
            3,
            false,
            false,
            'Drop the supplies in the riverside bins before sundown.',
            10
        ),
        (
            'wolf-cull',
            'hunter_poster',
            'contract',
            'Player Contracts: Hunts & Expeditions',
            'Wolf Cull Beyond The Birch Rise',
            'A hunting contract for a pack that keeps stalking the road crews.',
            'Several wolves have been shadowing the birch road and harassing gatherers returning home. Thin the pack and report back with a short note on where they were found.',
            'Coin and first choice of pelts.',
            'external_proof_note',
            2,
            true,
            false,
            'Include the location of the den in your proof note.',
            7
        ),
        (
            'ore-cave-escort',
            'hunter_poster',
            'quest_call',
            'Player Contracts: Hunts & Expeditions',
            'Escort Needed For Iron Cave Run',
            'Looking for blades willing to escort miners to and from a contested cave.',
            'The cave itself is manageable, but the route in has become dangerous at dusk. We need one or two escorts to secure the approach while the ore team works.',
            'Escort pay plus a share of the haul.',
            'submit_for_confirmation',
            2,
            true,
            false,
            'Meet at the shrine road marker before departure.',
            5
        ),
        (
            'bronze-ingot-delivery',
            'trader_poster',
            'delivery',
            'Player Contracts: Trade & Delivery',
            'Bronze Ingot Delivery To The Valley Forge',
            'Reliable hauler needed for a single bulk delivery run.',
            'Move a prepared crate of bronze ingots from the market stall to the valley forge. The load is packed and ready; we only need a dependable courier.',
            'Coin on delivery plus forge priority later this week.',
            'submit_for_confirmation',
            1,
            false,
            false,
            'Ask for the forge steward by name when you arrive.',
            6
        ),
        (
            'newcomer-route-guide',
            'guide_poster',
            'help_wanted',
            'Player Contracts: Requests & Help',
            'Guide Run For Two New Settlers',
            'Help two new arrivals learn the route between the shrine, market, and home valley.',
            'This is a small support contract for an experienced local. Walk two newcomers through the safe route, point out the dangerous stretch, and make sure they know where to restock.',
            'Goodwill, supplies, and a modest thank-you payment.',
            'self_complete',
            1,
            true,
            false,
            'Be patient. This is meant to be a welcoming contract.',
            4
        ),
        (
            'tavern-night-supplies',
            'event_poster',
            'contract',
            'Player Contracts: Events & Gatherings',
            'Tavern Night Supply Call',
            'We need food, drink, and a few extra hands before the gathering starts.',
            'The settlement is hosting an evening gathering and we are short on final supplies. Bring cooked food, ale, or simply help set the long tables before the doors open.',
            'Open tab for the night and public thanks from the host.',
            'self_complete',
            4,
            false,
            true,
            'Supplies can be dropped off remotely if clearly labeled.',
            3
        )
    ) as v(
        seed_key,
        seed_role,
        post_type,
        player_contract_category,
        title,
        summary,
        body_markdown,
        reward_note,
        proof_mode,
        capacity,
        travel_required,
        remote_delivery_allowed,
        contact_note,
        expires_in_days
    )
),
inserted_posts as (
    insert into public.board_quests (
        status,
        post_type,
        title,
        summary,
        body_markdown,
        reward_note,
        author_user_id,
        author_character_id,
        author_character_name,
        player_contract_category,
        capacity,
        expires_at,
        visibility_scope,
        posting_region,
        posting_shard,
        posting_province,
        posting_home_valley,
        destination_region,
        destination_shard,
        destination_province,
        destination_home_valley,
        travel_required,
        remote_delivery_allowed,
        proof_mode,
        contact_note,
        is_renewable
    )
    select
        'posted',
        sp.post_type,
        sp.title,
        sp.summary,
        sp.body_markdown,
        sp.reward_note,
        rp.user_id,
        rp.character_id,
        rp.character_name,
        sp.player_contract_category,
        sp.capacity,
        now() + make_interval(days => sp.expires_in_days),
        'public',
        rp.region,
        rp.shard,
        rp.province,
        rp.home_valley,
        rp.region,
        rp.shard,
        rp.province,
        rp.home_valley,
        sp.travel_required,
        sp.remote_delivery_allowed,
        sp.proof_mode,
        sp.contact_note,
        true
    from seed_posts sp
    join resolved_people rp
      on rp.seed_role = sp.seed_role
    returning id, title
)
insert into public.board_quest_goals (board_quest_id, sort_order, type, label, target, unit)
select ip.id, g.sort_order, g.type, g.label, g.target, g.unit
from inserted_posts ip
join (
    values
        ('Timber For The West Palisade', 0, 'counter', 'Deliver timber bundles to the west storehouse', 12, 'bundles'),
        ('Timber For The West Palisade', 1, 'checkbox', 'Check in with the quartermaster after delivery', null, null),
        ('Clay And Thatch Refill', 0, 'counter', 'Gather fresh clay', 40, 'clay'),
        ('Clay And Thatch Refill', 1, 'counter', 'Gather thatch bundles', 20, 'bundles'),
        ('Wolf Cull Beyond The Birch Rise', 0, 'counter', 'Cull wolves on the birch road', 8, 'wolves'),
        ('Wolf Cull Beyond The Birch Rise', 1, 'checkbox', 'Record the den location in your report', null, null),
        ('Escort Needed For Iron Cave Run', 0, 'checkbox', 'Escort the miners to the cave safely', null, null),
        ('Escort Needed For Iron Cave Run', 1, 'checkbox', 'Escort the miners back to the settlement', null, null),
        ('Bronze Ingot Delivery To The Valley Forge', 0, 'checkbox', 'Deliver the ingot crate to the forge steward', null, null),
        ('Bronze Ingot Delivery To The Valley Forge', 1, 'checkbox', 'Confirm the crate was accepted intact', null, null),
        ('Guide Run For Two New Settlers', 0, 'checkbox', 'Guide the new settlers through the route', null, null),
        ('Guide Run For Two New Settlers', 1, 'checkbox', 'Point out one dangerous stretch and one safe resupply stop', null, null),
        ('Tavern Night Supply Call', 0, 'counter', 'Bring event-ready food or ale', 6, 'bundles'),
        ('Tavern Night Supply Call', 1, 'checkbox', 'Help set the long tables before the gathering starts', null, null)
) as g(title, sort_order, type, label, target, unit)
  on g.title = ip.title;
