with seed_people as (
    select *
    from (values
        ('settlement_poster', 'ChickenLickin'),
        ('hunter_poster', 'ChickenLickin'),
        ('trader_poster', 'ChickenLickin'),
        ('guide_poster', 'ChickenLickin'),
        ('event_poster', 'ChickenLickin')
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
            'herbalist-restock',
            'settlement_poster',
            'help_wanted',
            'Player Contracts: Settlement Work',
            'Emergency Medicinal Herb Restock',
            'The infirmary is running low on basic poultice ingredients.',
            'A recent influx of injured travelers has depleted our stocks of Wild Sage and Marigold. We need gatherers to scour the foothills and bring fresh bundles to the herbalist.',
            'Small coin reward and two healing potions.',
            'self_complete',
            5,
            false,
            true,
            'Leave the herbs in the drying rack behind the infirmary.',
            3
        ),
        (
            'corrupted-bear-hunt',
            'hunter_poster',
            'contract',
            'Player Contracts: Hunts & Expeditions',
            'Bounty: The Scarred Greatbear',
            'A massive, corrupted bear is terrorizing the eastern logging camp.',
            'This beast has survived several arrows and has become increasingly aggressive. We need a skilled hunter or a small team to track it to its lair and put it down before the loggers refuse to work.',
            'High coin bounty and the bears unique pelt.',
            'external_proof_note',
            3,
            true,
            false,
            'Bring the bears claw to the camp master as proof of the deed.',
            5
        ),
        (
            'silk-road-protection',
            'trader_poster',
            'quest_call',
            'Player Contracts: Trade & Delivery',
            'Caravan Guards For Silk Shipment',
            'Looking for heavy armor to protect a valuable textile shipment.',
            'I am moving three wagons of fine silk to the capital. Rumors of bandit activity near the pass have me concerned. I need reliable fighters to walk the line.',
            'Significant gold and a set of silk-lined gloves.',
            'submit_for_confirmation',
            4,
            true,
            false,
            'Meet at the South Gate stables at dawn.',
            2
        ),
        (
            'shrine-mapping-expedition',
            'guide_poster',
            'delivery',
            'Player Contracts: Requests & Help',
            'Update Topography Maps: Sunken Shrine',
            'Looking for an agile scout to verify the water levels at the Sunken Shrine.',
            'The landscape has shifted after the rains. We need someone to reach the shrine, mark the new shoreline on this map, and return it to the archives.',
            'Cartographer kit and travel rations.',
            'submit_for_confirmation',
            1,
            true,
            false,
            'The map is delicate; do not get it wet during the swim.',
            7
        ),
        (
            'festival-firework-prep',
            'event_poster',
            'settlement_task',
            'Player Contracts: Events & Gatherings',
            'Gathering Ingredients For Festival Rockets',
            'The alchemist needs raw materials for the closing ceremony display.',
            'Help us make this years festival memorable. We need sulfur and charcoal in bulk to prepare the firework display for the final night.',
            'VIP seating for the show and a commemorative sparkler.',
            'self_complete',
            10,
            false,
            true,
            'Drop materials in the sand-lined crates near the alchemists tent.',
            4
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
        ('Emergency Medicinal Herb Restock', 0, 'counter', 'Gather Wild Sage', 15, 'stems'),
        ('Emergency Medicinal Herb Restock', 1, 'counter', 'Gather Marigolds', 10, 'blooms'),
        ('Bounty: The Scarred Greatbear', 0, 'checkbox', 'Locate the Greatbears lair in the east', null, null),
        ('Bounty: The Scarred Greatbear', 1, 'checkbox', 'Slay the Scarred Greatbear', null, null),
        ('Caravan Guards For Silk Shipment', 0, 'checkbox', 'Defend the wagons through the pass', null, null),
        ('Caravan Guards For Silk Shipment', 1, 'checkbox', 'Ensure all three wagons reach the capital', null, null),
        ('Update Topography Maps: Sunken Shrine', 0, 'checkbox', 'Reach the Sunken Shrine inner sanctum', null, null),
        ('Update Topography Maps: Sunken Shrine', 1, 'checkbox', 'Return the marked map to the archives', null, null),
        ('Gathering Ingredients For Festival Rockets', 0, 'counter', 'Collect Sulfur', 5, 'kilograms'),
        ('Gathering Ingredients For Festival Rockets', 1, 'counter', 'Collect Charcoal', 20, 'lumps')
) as g(title, sort_order, type, label, target, unit)
  on g.title = ip.title;




with seed_people as (
    select *
    from (values
        ('settlement_poster', 'ChickenLickin'),
        ('hunter_poster', 'ChickenLickin'),
        ('trader_poster', 'ChickenLickin'),
        ('guide_poster', 'ChickenLickin'),
        ('event_poster', 'ChickenLickin')
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
            'bridge-repair-stone',
            'settlement_poster',
            'settlement_task',
            'Player Contracts: Settlement Work',
            'Stone Haul For North Bridge Repair',
            'The main trade route north is crumbling; we need masonry-grade stone.',
            'The winter frost has cracked the support pillars of the North Bridge. We need heavy stone blocks delivered to the construction site. This is hard work, but essential for the settlement commerce.',
            'Draft animal rental voucher and a sack of coins.',
            'submit_for_confirmation',
            3,
            false,
            false,
            'Speak to the foreman near the scaffolding at the river crossing.',
            10
        ),
        (
            'rare-reagent-collection',
            'hunter_poster',
            'quest_call',
            'Player Contracts: Hunts & Expeditions',
            'Glow-Moss Extraction: Deep Caverns',
            'The alchemists need fresh glow-moss from the dangerous lower levels.',
            'Glow-moss loses its potency quickly once harvested. We need an expedition to the Deep Caverns to retrieve fresh samples. Beware the cave spiders; they are active this time of year.',
            'Choice of one enchanted oil and gold.',
            'submit_for_confirmation',
            2,
            true,
            false,
            'Bring a dampened container to keep the moss alive during transport.',
            5
        ),
        (
            'stolen-goods-recovery',
            'trader_poster',
            'contract',
            'Player Contracts: Trade & Delivery',
            'Recover Stolen Spice Crate',
            'A bandit group intercepted a high-value shipment near the crossroads.',
            'My latest shipment of southern spices was taken by a small band of thieves. I dont care what you do with the thieves, but I want my crate back with the seal unbroken.',
            'Ten percent of the crates value in gold.',
            'external_proof_note',
            1,
            true,
            false,
            'Check the ruins east of the crossroads; that is where they usually hide.',
            4
        ),
        (
            'lost-scout-search',
            'guide_poster',
            'help_wanted',
            'Player Contracts: Requests & Help',
            'Search Party: Missing Scout In The Mist',
            'One of our pathfinders failed to check in at the misty overlook.',
            'A scout went out to survey the fog patterns and hasn''t returned. We need someone to sweep the overlook area and find any sign of them—or lead them home if they are lost.',
            'Official Pathfinder badge (honorary) and survival gear.',
            'self_complete',
            2,
            true,
            false,
            'Look for the blue signal flares if you get turned around.',
            3
        ),
        (
            'shrine-festival-cleaning',
            'event_poster',
            'help_wanted',
            'Player Contracts: Events & Gatherings',
            'Great Shrine Spring Cleaning',
            'The Great Shrine needs to be pristine for the upcoming Spring Equinox.',
            'We need volunteers to clear the overgrown vines, polish the bronze offerings, and ensure the ritual paths are swept clear of debris. It is a long day of labor for the faithful.',
            'Blessing of the Elders and a feast at the end of the day.',
            'self_complete',
            8,
            false,
            true,
            'Tools are provided at the shrine entrance.',
            6
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
        ('Stone Haul For North Bridge Repair', 0, 'counter', 'Deliver masonry stone blocks', 8, 'blocks'),
        ('Stone Haul For North Bridge Repair', 1, 'checkbox', 'Sign the work log with the foreman', null, null),
        ('Glow-Moss Extraction: Deep Caverns', 0, 'counter', 'Harvest fresh glow-moss', 12, 'clumps'),
        ('Glow-Moss Extraction: Deep Caverns', 1, 'checkbox', 'Avoid taking spider venom damage during harvest', null, null),
        ('Recover Stolen Spice Crate', 0, 'checkbox', 'Find the bandit camp in the ruins', null, null),
        ('Recover Stolen Spice Crate', 1, 'checkbox', 'Retrieve the sealed spice crate', null, null),
        ('Search Party: Missing Scout In The Mist', 0, 'checkbox', 'Locate the scouts last known campsite', null, null),
        ('Search Party: Missing Scout In The Mist', 1, 'checkbox', 'Escort the scout back to the pathfinder post', null, null),
        ('Great Shrine Spring Cleaning', 0, 'counter', 'Clear overgrown vines from the pillars', 20, 'vines'),
        ('Great Shrine Spring Cleaning', 1, 'checkbox', 'Polish the central bronze sun-disk', null, null)
) as g(title, sort_order, type, label, target, unit)
  on g.title = ip.title;