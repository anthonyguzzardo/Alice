/*
# FILE HEADER — READ BEFORE PROCEEDING

## Purpose
This content is provided **solely to teach API and schema design patterns**.
It is not sample data and not optional context.

## Mandatory Instructions
- **You must infer how to design the APIs from the schema and comments below.**
- **You must determine how to integrate this schema into the application.**

## Design Objective
- Figure out how to build a **simple location-based application**
- Derive API behavior, data flow, and constraints directly from this file
*/
-- ** THIS DOCUMENT DOES NOT CONTAIN LOOKUP INSERTS OR TABLE INSERTS **
-- ** NOTE THAT INDEXES AND TRIGGERS ARE IN SEPARATE FILES **
-- ** NOTE THAT STORED PROCEDURES, VIEWS, and OTHER FUNCTIONS ARE 
-- ... IN SEPARATE FILES TOO **
-- Standards:
-- - te_ = enumeration tables
-- - td_ = dictionary tables  
-- - tb_ = normal tables
-- - tm_ = matrix tables
-- - th_ = history tables
-- - Surrogate keys: table_name_id (NEVER just "id")
-- - Logical foreign keys (no physical [@CONSTRAINTS:])
-- - Sentinel row: ID=0 with NULL_VALUES
-- - Bracketed logging: [TRCE] [DEBG] [@INFO]: [WARN] [ERRO] [FATL] [AUDT]
-- ** DO NOT HARD CODE PROPER NOUNS INTO COLUM NAMES LIKE 
-- ** STRIPE FOR EXAMPLE STRIPE... THERE SHOULD BE A COLUMN NAME CALLED
-- ** THERE ARE REFERENCES TO HISTORY TABLES THAT EXIST IN ANOTHER FILE 
-- ... DONT BOTHER SEARCH FOR OR ASKING ABOUT THE HISTORY FILES ** 
-- ============================================================================
-- MYDAILYDEALS AI INTEGRATION
-- ============================================================================
-- Purpose: Add comprehensive AI functionality for marketplace intelligence
-- Features: 
--   1. Deal Creation Assistant (retailer onboarding)
--   2. Dynamic Pricing Advisor (algorithmic pricing intelligence)
--   3. Consumer Deal Discovery (personalized recommendations)
--   4. Education/Sales Bot (conversion & retention)
-- 
-- Design Principles:
--   - Track every AI interaction for cost management
--   - Learn from outcomes to improve recommendations
--   - Gate features by subscription tier
--   - Support both single-turn and multi-turn conversations
--   - Personalize based on retailer/consumer history
-- ** DO NOT WRITE ALTER TABLES OR UPDATE TABLES YOU MUST
-- .. RE-WRITE THE CREATE TABLE **
-- Enable required extensions

-- # STEP 2 Create Schema
CREATE SCHEMA IF NOT EXISTS mdd;
-- ============================================================================
-- ENUMERATION TABLES (te_) - All STATIC
-- ============================================================================
-- Static = Values set at deployment, change only with code releases
-- Footer: None (no audit columns needed)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- te_user_role
-- ----------------------------------------------------------------------------
-- PURPOSE: Define the three core user roles in the system
-- USE CASE: "Is this user a customer, retailer, or admin?"
-- MUTABILITY: Static - Values fixed at deployment
-- VALUES: customer (1), retailer (2), admin (3)
-- REFERENCED BY:
--   tb_users.user_role_id
--   tb_audit_logs.user_role_id
-- FOOTER: None
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mdd.te_user_role
(
     user_role_id        INT2                       PRIMARY KEY
    ,enum_code           VARCHAR(20)    UNIQUE      NOT NULL
    ,name                VARCHAR(50)                NOT NULL
);


-- ----------------------------------------------------------------------------
-- te_deal_status
-- ----------------------------------------------------------------------------
-- PURPOSE: Define all possible states a deal can be in throughout its lifecycle
-- USE CASE: "Is this deal/deal pack live, expired, or sold out?" ~
-- MUTABILITY: Static - Values fixed at deployment
-- VALUES: draft (1), scheduled (2), active (3), paused (4), completed (5),
-- cancelled (6), sold_out (7)
-- LIFECYCLE: draft → scheduled → active → [paused →] completed/cancelled/sold_out
-- REFERENCED BY:
--   tb_deals.deal_status_id
-- FOOTER: None
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mdd.te_deal_status
(
     deal_status_id     INT2                    PRIMARY KEY
    ,enum_code          VARCHAR(20) UNIQUE      NOT NULL
    ,name               VARCHAR(50)             NOT NULL
);

-- ----------------------------------------------------------------------------
-- te_pricing_mode
-- ----------------------------------------------------------------------------
-- PURPOSE: Define how deal prices are set and adjusted (manual vs algorithmic)
-- USE CASE: "What pricing strategy is this retailer using?"
-- MUTABILITY: Static - Values fixed at deployment
-- VALUES: manual (1), auto_clearance (2), velocity_based (3), full_dynamic (4)
-- TIER GATING: manual=Free, auto_clearance=Smart, velocity/dynamic=Pro+
-- REFERENCED BY:
--   tb_deals.pricing_mode_id
--   th_ai_education_conversions.pricing_mode_before (VARCHAR but validates against enum)
-- FOOTER: None
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.te_pricing_mode
(
     pricing_mode_id                 INT2                       PRIMARY KEY
    ,enum_code                       VARCHAR(20)    UNIQUE      NOT NULL
    ,name                            VARCHAR(50)                NOT NULL
);

-- ============================================================================
-- NOTIFICATION ENUMS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- te_notification_type
-- ----------------------------------------------------------------------------
-- PURPOSE: Define types of notifications the system can send
-- USE CASE: "What notification types exist? What triggers them?"
-- MUTABILITY: Static - Values fixed at deployment
-- VALUES: price_drop, new_deal, ending_soon, redemption_confirmed, etc.
-- REFERENCED BY:
--   tb_notification_queue.notification_type_id
-- FOOTER: None
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.te_notification_type
(
     notification_type_id    INT2                   PRIMARY KEY
    ,enum_code               VARCHAR(50)    UNIQUE  NOT NULL
    ,name                    VARCHAR(100)           NOT NULL
);


-- ----------------------------------------------------------------------------
-- te_notification_status
-- ----------------------------------------------------------------------------
-- PURPOSE: Track delivery status of queued notifications
-- USE CASE: "Has this notification been sent? Did it fail?"
-- MUTABILITY: Static - Values fixed at deployment
-- VALUES: pending (1), sent (2), failed (3), cancelled (4)
-- LIFECYCLE: pending → sent OR pending → failed (with retry) OR pending → cancelled
-- REFERENCED BY:
--   tb_notification_queue.notification_status_id
-- FOOTER: None
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.te_notification_status
(
     notification_status_id  INT2                   PRIMARY KEY
    ,enum_code               VARCHAR(20)    UNIQUE  NOT NULL
    ,name                    VARCHAR(50)            NOT NULL
);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- te_audit_action_type
-- ----------------------------------------------------------------------------
-- PURPOSE: Define types of actions that can be audited
-- USE CASE: "What kind of action was performed?"
-- MUTABILITY: Static - Values fixed at deployment
-- VALUES: deal_created, price_changed, user_registered, purchase_completed, etc.
-- REFERENCED BY:
--   tb_audit_logs.audit_action_type_id
-- FOOTER: None
-- ----------------------------------------------------------------------------
CREATE TABLE mdd.te_audit_action_type
(
     audit_action_type_id    INT2                   PRIMARY KEY
    ,enum_code               VARCHAR(50)    UNIQUE  NOT NULL
    ,name                    VARCHAR(100)           NOT NULL
    ,description             TEXT                   NOT NULL DEFAULT ''
);

-- ----------------------------------------------------------------------------
-- te_audit_entity_type
-- ----------------------------------------------------------------------------
-- PURPOSE: Define types of entities that can be audited
-- USE CASE: "What kind of entity was affected?"
-- MUTABILITY: Static - Values fixed at deployment
-- VALUES: deal, purchase, user, retailer_profile, etc.
-- REFERENCED BY:
--   tb_audit_logs.audit_entity_type_id
-- FOOTER: None
-- ----------------------------------------------------------------------------
CREATE TABLE mdd.te_audit_entity_type
(
     audit_entity_type_id    INT2                   PRIMARY KEY
    ,enum_code               VARCHAR(50)    UNIQUE  NOT NULL
    ,name                    VARCHAR(100)           NOT NULL
);


-- ----------------------------------------------------------------------------
-- te_deal_pack_price
-- ----------------------------------------------------------------------------
-- PURPOSE: Define allowed deal pack price tiers (fixed pricing for consistency)
-- USE CASE: "What price tier is this deal pack?"
-- MUTABILITY: Static - Values fixed at deployment
-- VALUES: $50 (50), $100 (100), $150 (150)
-- BUSINESS RULE: Deal packs can only be priced at these fixed tiers
-- REFERENCED BY:
--   tb_deal_packs.deal_pack_price (validated against these values)
-- FOOTER: None
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.te_deal_pack_price
(
     deal_pack_price_id    INT2                    PRIMARY KEY
    ,price_value        DECIMAL(10, 2) UNIQUE   NOT NULL
    ,name               VARCHAR(50)             NOT NULL
);

-- ----------------------------------------------------------------------------
-- te_deal_pack_progress_status
-- ----------------------------------------------------------------------------
-- PURPOSE: Define customer progress states within a deal pack
-- USE CASE: "Where is this customer in their deal pack journey?"
-- MUTABILITY: Static - Values fixed at deployment
-- VALUES: enrolled (1), in_progress (2), completed (3), expired (4), cancelled (5)
-- LIFECYCLE: enrolled -> in_progress -> completed
--                                    -> expired / cancelled
-- REFERENCED BY:
--   tb_customer_deal_pack_progress.progress_status_id
-- FOOTER: None
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.te_deal_pack_progress_status
(
     progress_status_id INT2                    PRIMARY KEY
    ,enum_code          VARCHAR(20) UNIQUE      NOT NULL
    ,name               VARCHAR(50)             NOT NULL
);

-- ============================================================================
-- te_review_status
-- ============================================================================
-- Moderation status for consumer reviews.
-- LIFECYCLE: active -> flagged -> removed
-- ============================================================================

CREATE TABLE IF NOT EXISTS mdd.te_review_status
(
     review_status_id    INT2                    PRIMARY KEY
    ,enum_code           VARCHAR(20) UNIQUE      NOT NULL
    ,name                VARCHAR(50)             NOT NULL
);

-- ============================================================================
-- END ENUMERATION TABLES (te_)
-- ============================================================================
    

















    

-- ============================================================================
-- DICTIONARY TABLES (td_) - Mostly MUTABLE
-- ============================================================================
-- Mutable = Admin-configurable, changes via admin panel without code deploy
-- Footer: Full (dttm_created_utc, created_by, dttm_modified_utc, modified_by)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- td_subscription_tier
-- ----------------------------------------------------------------------------
-- PURPOSE: Define retailer subscription tiers with pricing and feature gates
-- USE CASE: "What premium features does this retailer's subscription unlock?"
-- MUTABILITY: Mutable - Pricing and feature limits adjustable by admin
--   WHAT CHANGES: monthly_price, soft_limit_deals_per_day, soft_limit_ai_calls_per_day, features JSONB
-- VALUES: Free ($0), Smart ($49), Pro ($149), Enterprise ($399)
-- BUSINESS MODEL: 10% commission on sales; subscriptions unlock time-saving features
-- REFERENCED BY:
--   tb_retailer_profiles.subscription_tier_id
--   td_ai_feature_type.min_subscription_tier_id
--   tm_tier_feature_permissions.subscription_tier_id
--   th_ai_education_conversions.subscription_tier_before
--   th_ai_education_conversions.subscription_tier_after
-- FOOTER: Full
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.td_subscription_tier
(
     subscription_tier_id        INT2           PRIMARY KEY
    ,name                        VARCHAR(50)    NOT NULL UNIQUE
    ,monthly_price               DECIMAL(10, 2) NOT NULL DEFAULT 0  
                                                CHECK (monthly_price >= 0)
    -- ALL TIERS GET UNLIMITED DEALS
    -- We removed monthly_deal_limit entirely - this is a marketplace, not SaaS
    -- Revenue comes from commission on sales, not artificial scarcity
    
    ,features                    JSONB          NOT NULL DEFAULT '[]'::jsonb
    
    -- [@INFO] Soft Limits are probaly a logical must so people are not spamming deals
    -- Optional: Soft limits for abuse prevention (not enforced in tier logic)
    ,soft_limit_deals_per_day    INTEGER        NULL -- For rate limiting only
    ,soft_limit_ai_calls_per_day INTEGER        NULL -- Prevent API abuse
                                                
    --  FOOTERS 
    ,dttm_created_utc            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    ,created_by                  VARCHAR(50)    NOT NULL DEFAULT CURRENT_USER
    ,dttm_modified_utc           TIMESTAMPTZ    NULL
    ,modified_by                 VARCHAR(50)    NULL
);


-- ----------------------------------------------------------------------------
-- SUPPORTING TABLE: Tier Feature Permissions Matrix
-- ----------------------------------------------------------------------------
-- NOTE: This table (tm_tier_feature_permissions) provides granular control
-- over specific features. The JSONB 'features' column above is for display/documentation.
-- The matrix table is what application code checks for permission enforcement.
-- See: tm_tier_feature_permissions table definition
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- APPLICATION LOGIC EXAMPLE
-- ----------------------------------------------------------------------------
-- When checking if retailer can use a feature:
-- 
-- 1. Get their subscription_tier_id from tb_retailer_profiles
-- 2. Check tm_tier_feature_permissions:
--    SELECT is_enabled 
--    FROM tm_tier_feature_permissions
--    WHERE subscription_tier_id = ? 
--      AND feature_category = 'ai_feature'
--      AND feature_value = 'deal_creator'
-- 
-- 3. If enabled, allow feature use
-- 4. If not enabled, show upgrade prompt:
--    "Upgrade to Smart ($49/mo) to use AI Deal Creator"
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- RATE LIMITING APPLICATION
-- ----------------------------------------------------------------------------
-- The soft_limit_* columns are for abuse prevention ONLY, not monetization:
-- 
-- IF (deals_posted_today > tier.soft_limit_deals_per_day AND limit IS NOT NULL) THEN
--   RAISE NOTICE 'Rate limit reached. Please contact support.'
--   -- This catches spam/abuse, not normal usage
-- END IF;
-- 
-- These limits should be set HIGH ENOUGH that normal retailers never hit them.
-- If a free tier retailer posts 20 deals in one day, that's suspicious, not business.
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- td_stripe_tax_code
-- ----------------------------------------------------------------------------
-- PURPOSE: Map Stripe Tax product codes to deal categories for tax calculation
-- USE CASE: "What tax code applies to this deal? Is it Prepared Food, General Goods, etc.?"
-- MUTABILITY: Mutable (rarely) - New codes can be added as Stripe updates their tax code directory
--   WHAT CHANGES: is_active, description
-- VALUES: General Tangible Goods, Prepared Food, Health & Beauty, General Services, Entertainment Admission
-- REFERENCED BY:
--   td_deal_category.stripe_tax_code_id (default tax code per category)
--   tb_deals.stripe_tax_code_id (nullable override per deal)
--   tb_deal_templates.stripe_tax_code_id (nullable override per template)
-- FOOTER: Full
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.td_stripe_tax_code
(
     stripe_tax_code_id          SERIAL         PRIMARY KEY
    ,code                        VARCHAR(30)    UNIQUE NOT NULL  -- e.g. 'txcd_40060003'
    ,name                        VARCHAR(100)   NOT NULL         -- e.g. 'Prepared Food'
    ,description                 TEXT           NOT NULL DEFAULT ''
    ,is_active                   BOOLEAN        NOT NULL DEFAULT true

    ,dttm_created_utc            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    ,created_by                  VARCHAR(50)    NOT NULL DEFAULT CURRENT_USER
    ,dttm_modified_utc           TIMESTAMPTZ    NULL
    ,modified_by                 VARCHAR(50)    NULL
);


-- ----------------------------------------------------------------------------
-- td_nc_tax_rate
-- ----------------------------------------------------------------------------
-- PURPOSE: NC county-to-rate tax lookup for DIY sales tax calculation
-- USE CASE: "What combined sales tax rate applies to this retailer's county?"
-- MUTABILITY: Mutable (rarely) - Updated when NC DOR changes county rates
--   WHAT CHANGES: county_rate, combined_rate, is_active
-- VALUES: 100 NC counties with state + county rates
-- TAX JURISDICTION: Retailer's physical location (POS transaction)
-- REFERENCED BY:
--   create-payment-intent edge function (lookupTaxRate)
--   tb_retailer_profiles.county (logical FK)
-- FOOTER: Minimal (no audit columns needed for static reference data)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS mdd.td_nc_tax_rate;
CREATE TABLE IF NOT EXISTS mdd.td_nc_tax_rate
(
     county_name     VARCHAR(50)    PRIMARY KEY
    ,state_rate      DECIMAL(5,4)   NOT NULL DEFAULT 0.0475
    ,county_rate     DECIMAL(5,4)   NOT NULL
    ,combined_rate   DECIMAL(5,4)   NOT NULL
    ,is_active       BOOLEAN        NOT NULL DEFAULT true
);


-- ----------------------------------------------------------------------------
-- td_deal_category
-- ----------------------------------------------------------------------------
-- PURPOSE: Classify deals by type with ML default parameters for dynamic pricing
-- USE CASE: "What category is this deal? What's the expected demand elasticity?"
-- MUTABILITY: Mutable - Categories can be added/deactivated, ML defaults tuned
--   WHAT CHANGES: default_price_elasticity, default_time_decay_rate, default_distance_decay_km, is_active
-- VALUES: Bakery, Restaurant, Coffee, Salon, Automotive, Fitness, Electronics, etc.
-- ML DEFAULTS: Perishables (bakery) have high time decay; services have low distance decay
-- REFERENCED BY:
--   tb_deals.deal_category_id
--   tb_retailer_profiles.deal_category_id
--   tb_category_market_stats.deal_category_id
--   th_category_demand_snapshots.deal_category_id
-- FOOTER: Full
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.td_deal_category
(
     deal_category_id            SERIAL         PRIMARY KEY
    ,name                        VARCHAR(50)    NOT NULL

    -- [@INFO] description could potentially be displayed client side so empty string is valid
    ,description                 TEXT           NOT NULL DEFAULT ''

    -- [@INFO] NULL = parent category, populated = subcategory
    ,parent_category_id          INTEGER        NULL

    -- [@INFO] logically the icon_url is absent and may be used for UI
    ,icon_url                    TEXT           NULL

    ,default_price_elasticity    DECIMAL(5, 2)  NOT NULL DEFAULT 2.5

    -- [@INFO]: How fast value drops over time
    ,default_time_decay_rate     DECIMAL(5, 4)  NOT NULL DEFAULT 0.15 

    -- [@INFO]: Distance sensitivity
    ,default_distance_decay_km   DECIMAL(5, 2)  NOT NULL DEFAULT 5.0
    ,is_active                   BOOLEAN        NOT NULL DEFAULT false

    -- [@INFO] Logical FK to td_stripe_tax_code. Default tax classification for deals in this category.
    ,stripe_tax_code_id          INTEGER        NOT NULL DEFAULT 1

    ,dttm_created_utc            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    ,created_by                  VARCHAR(50)    NOT NULL DEFAULT CURRENT_USER
    ,dttm_modified_utc           TIMESTAMPTZ    NULL
    ,modified_by                 VARCHAR(50)    NULL
);

-- ----------------------------------------------------------------------------
-- td_price_change_trigger
-- ----------------------------------------------------------------------------
-- PURPOSE: Categorize reasons why deal prices change for audit and analytics
-- USE CASE: "Why did this price drop? Was it manual or algorithmic?"
-- MUTABILITY: Mutable (rarely) - New triggers can be added, existing deactivated
--   WHAT CHANGES: is_active, description
-- VALUES: Manual (1), Auto-Clearance (2), Velocity Too Low (3), 
-- Velocity Too High (4), etc.
-- REFERENCED BY:
--   th_deal_price_changes.price_change_trigger_id
-- FOOTER: Full (but rarely used)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.td_price_change_trigger
(
     price_change_trigger_id INT2                PRIMARY KEY
    ,name                    VARCHAR(50)         NOT NULL
    ,description             TEXT                NOT NULL DEFAULT ''
    ,is_active               BOOLEAN             NOT NULL DEFAULT TRUE

 --  FOOTERS   
    ,dttm_created_utc        TIMESTAMPTZ         NOT NULL DEFAULT NOW()
    ,created_by              VARCHAR(50)         NOT NULL DEFAULT CURRENT_USER
    ,dttm_modified_utc       TIMESTAMPTZ         NULL
    ,modified_by             VARCHAR(50)         NULL
);

-- ============================================================================
-- SERVICE AREA ZIPCODES (td_service_area_zipcode)
-- ============================================================================
-- This is NOT "marketing ZIP codes" and NOT retailer ZIP codes.
--
-- PURPOSE:
--   This dictionary defines the ZIP codes that MyDailyDeals officially serves.
--   It is used for:
--      - Service-area whitelisting (“We operate in these ZIPs”)
--      - Coarse-grained geolocation when exact GPS isn't provided
--      - ZIP-based analytics (heatmaps, supply/demand by ZIP)
--      - Fallback geofencing if lat/lon cannot be captured
--      - Region-based feature gating (e.g., promotions only in certain ZIPs)
--
-- WHY IT MATTERS:
--   - Retailers may sign up using addresses → ZIP anchors their location.
--   - Consumers without GPS can still be mapped to a service area.
--   - Future ops: delivery [@CONSTRAINTS:], pickup radius, ZIP clustering.
--
-- This is intentionally a SMALL dictionary table — *not* a log table — with
-- one row per ZIP code MyDailyDeals considers “in-scope” for the marketplace.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- td_service_area_zipcode
-- ----------------------------------------------------------------------------
-- PURPOSE: Define ZIP codes where MyDailyDeals officially operates
-- USE CASE: "Do we serve this ZIP code? What's the lat/lon centroid for geofencing?"
-- MUTABILITY: Mutable - ZIPs added/removed as service area expands/contracts
--   WHAT CHANGES: is_active (market launches/shutdowns)
-- EXPANSION: Add ZIPs as you launch new markets (Chicago → SF → NYC)
-- FALLBACK: When GPS unavailable, use ZIP centroid for distance calculations
-- REFERENCED BY:
--   tb_retailer_profiles.service_area_zipcode_id
--   th_category_demand_snapshots.service_area_zipcode_id
-- FOOTER: Full
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.td_service_area_zipcode
(
     service_area_zipcode_id  SERIAL                         PRIMARY KEY
    
    -- 5 or 9 digit ZIP code. Logical service-area boundary.
    ,zipcode                  VARCHAR(10)            UNIQUE  NOT NULL

    -- City label for UI / analytics dashboards.
    ,city                     VARCHAR(100)                   NOT NULL

    -- 2-letter state code (IL, CA, etc.) for filtering & region ops.
    ,state_code               CHAR(2)                        NOT NULL
        CHECK (state_code ~ '^[A-Z]{2}$')
    -- Ensures uppercase 2-letter codes

    -- Latitude/longitude (centroid of ZIP) used for geofencing
    -- and fallback distance calculations when exact GPS is missing.
    -- [@INFO] We need the coordinate as it's a core feature
    -- ... Every added zip code becomes production ready.
    ,location                 GEOGRAPHY(POINT, 4326)         NOT NULL

     -- [@INFO] Soft-enable/disable ZIP from the service footprint.
     -- New 
    ,is_active                BOOLEAN                        NOT NULL DEFAULT TRUE
       

    -- FOOTERS
    ,dttm_created_utc         TIMESTAMPTZ                    NOT NULL DEFAULT NOW()
    ,created_by               VARCHAR(50)                    NOT NULL DEFAULT CURRENT_USER
    ,dttm_modified_utc        TIMESTAMPTZ                    NULL
    ,modified_by              VARCHAR(50)                    NULL
);



-- ----------------------------------------------------------------------------
-- tb_service_area_waitlist
-- ----------------------------------------------------------------------------
-- PURPOSE: Capture all business-side interest (waitlist signups + contact form inquiries)
-- USE CASE: "Which businesses want us to expand to their area? Who reached out via contact form?"
-- MUTABILITY: Mutable - status updates when we launch in their area
--   WHAT CHANGES: is_notified, dttm_notified_utc
-- EXPANSION SIGNAL: COUNT(*) GROUP BY requested_zipcode shows demand by area
-- REFERENCES: td_link_slots.link_slot_id (channel attribution)
-- REFERENCED BY: None (leaf table)
-- FOOTER: Full
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.tb_service_area_waitlist
(
     service_area_waitlist_id    BIGSERIAL              PRIMARY KEY

    -- CONTACT INFO
    ,email                       VARCHAR(255)           NOT NULL
    ,business_name               VARCHAR(255)           NOT NULL DEFAULT ''
    ,contact_name                VARCHAR(100)           NULL
    ,message                     TEXT                   NULL

    -- SOURCE TRACKING
    -- [@INFO] 'waitlist' = from /join/business form, 'contact_form' = from /business contact form
    ,inquiry_source              VARCHAR(20)            NOT NULL DEFAULT 'waitlist'

    -- REQUESTED LOCATION
    -- [@INFO] Stored as VARCHAR since this zipcode is NOT in td_service_area_zipcode yet
    -- [@INFO] May be empty for contact_form inquiries that don't collect zipcode
    ,requested_zipcode           VARCHAR(10)            NOT NULL DEFAULT ''

    -- CHANNEL ATTRIBUTION
    -- [@INFO] Which link slot (QR/campaign) brought this business inquiry
    ,link_slot_id                INT                    NULL        -- Logical FK to td_link_slots

    -- NOTIFICATION TRACKING
    ,is_notified                 BOOLEAN                NOT NULL DEFAULT false
    ,dttm_notified_utc           TIMESTAMPTZ            NULL

    -- FOOTERS
    ,dttm_created_utc            TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,created_by                  VARCHAR(50)            NOT NULL DEFAULT CURRENT_USER
    ,dttm_modified_utc           TIMESTAMPTZ            NULL
    ,modified_by                 VARCHAR(50)            NULL

    -- CONSTRAINTS
    ,CONSTRAINT chk_waitlist_email_format
        CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
    ,CONSTRAINT chk_inquiry_source_valid
        CHECK (inquiry_source IN ('waitlist', 'contact_form'))
);


-- ----------------------------------------------------------------------------
-- td_ai_feature_type
-- ----------------------------------------------------------------------------
-- PURPOSE: Define types of AI features with tier gating and rate limits
-- USE CASE: "What AI feature is this? What tier is required? What are the limits?"
-- MUTABILITY: Mutable - Tier requirements and limits adjustable
--   WHAT CHANGES: min_subscription_tier_id, free_tier_monthly_limit, is_active
-- VALUES: Deal Creator, Pricing Advisor, Discovery Assistant, Education Bot
-- REFERENCED BY:
--   tb_ai_conversations.ai_feature_type_id
--   tb_ai_interactions.ai_feature_type_id
--   tb_ai_prompt_versions.ai_feature_type_id
--   th_ai_education_conversions.education_feature_type_id
-- FOOTER: Full
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.td_ai_feature_type
(
     ai_feature_type_id             SERIAL                  PRIMARY KEY
    ,name                           VARCHAR(100)    UNIQUE  NOT NULL
    
    -- Description for UI
    ,description                    TEXT                    NOT NULL DEFAULT ''
    
    -- Minimum tier required (NO DEFAULT - force explicit)
    ,min_subscription_tier_id INTEGER NOT NULL
        CHECK (
                   ai_feature_type_id = 0  -- Sentinel row
                OR min_subscription_tier_id BETWEEN 1 AND 4
            )
    
    -- Optional: If you want freemium limits
    ,free_tier_monthly_limit        INTEGER                 NULL
    -- NULL = unlimited for free tier
    -- 0 = completely blocked for free tier
    -- 5 = 5 uses per month for free tier
    
    -- Active flag
    ,is_active                      BOOLEAN                 NOT NULL DEFAULT true
    
    -- FOOTERS
    ,dttm_created_utc               TIMESTAMPTZ             NOT NULL DEFAULT NOW()
    ,created_by                     VARCHAR(50)             NOT NULL DEFAULT CURRENT_USER
    ,dttm_modified_utc              TIMESTAMPTZ             NULL
    ,modified_by                    VARCHAR(50)             NULL
);




-- ----------------------------------------------------------------------------
-- td_llm_model
-- ----------------------------------------------------------------------------
-- PURPOSE: Configure available LLM models with capabilities and cost structure
-- USE CASE: "Which AI model should we use? What will it cost?"
-- MUTABILITY: Mutable - Prices change, models deprecated, stats updated
--   WHAT CHANGES: cost_per_1k_*, avg_latency_ms, avg_quality_score, is_active,
--   is_default
-- VALUES: claude-sonnet-4-5-20250929, gpt-4-turbo, etc.
-- REFERENCED BY:
--   tb_ai_interactions.llm_model_id (if tracking model per interaction)
-- FOOTER: Full
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.td_llm_model
(
     llm_model_id               SERIAL                  PRIMARY KEY
    ,provider                   VARCHAR(50)             NOT NULL
    ,model_name                 VARCHAR(100)    UNIQUE  NOT NULL 
    
    -- [@INFO] Every LLM API costs money no free tier for production use
    -- [@INFO] Every major AI provider uses cost per 1,000 tokens (or "cost per 1K tokens")
    ,cost_per_1k_input_tokens  DECIMAL(10, 6) NOT NULL
                                            CHECK (cost_per_1k_input_tokens >= 0)
    ,cost_per_1k_output_tokens DECIMAL(10, 6) NOT NULL
                                            CHECK (cost_per_1k_output_tokens >= 0)
    
    -- [@INFO] Model capabilities are crtiical info
    ,supports_json_mode        BOOLEAN NOT NULL
    ,supports_function_calling BOOLEAN NOT NULL

    -- [@INFO] Model limits are also critical info and needed for request validation
    ,max_context_tokens        INTEGER NOT NULL
                                CHECK (max_context_tokens > 0)
    ,max_output_tokens         INTEGER NOT NULL
                                CHECK (max_output_tokens > 0)
        
    -- Performance benchmarks
    ,avg_latency_ms             INTEGER                 NULL
    ,avg_quality_score          DECIMAL(3, 2)           NULL -- 0-5 scale
    
    -- [@INFO] New models should be active as we are explicitly adding them
    -- [@DEBG] Determine if we want to have multiple models active at the same
    -- ... time
    ,is_active                  BOOLEAN                 NOT NULL    DEFAULT true
    ,is_default                 BOOLEAN                 NOT NULL    DEFAULT false
    
    ,dttm_created_utc           TIMESTAMPTZ             NOT NULL    DEFAULT NOW()
    ,created_by                 VARCHAR(50)             NOT NULL    DEFAULT CURRENT_USER
    ,dttm_modified_utc          TIMESTAMPTZ             NULL
    ,modified_by                VARCHAR(50)             NULL 
);

-- ----------------------------------------------------------------------------
-- td_retailer_deal_pack_credit
-- ----------------------------------------------------------------------------
-- PURPOSE: Track retailer deal pack credit for posting deal packs
-- USE CASE: "How much credit does this retailer have? How much is reserved?"
-- MUTABILITY: Mutable - Credit reserved/released as deal packs posted/completed
--   WHAT CHANGES: reserved_credit, available_credit, active_deal_pack_count,
--     trial_deal_packs_created, dttm_trial_period_start_utc
-- BUSINESS RULES:
--   - Default credit limit: $1,000
--   - Credit reserved when deal pack posted, returned when purchased/expired
--   - Trial period: 90 days, max 4 deal packs, $100 price cap
-- REFERENCES:
--   tb_retailer_profiles.retailer_profile_id (via retailer_profile_id, 1:1)
-- REFERENCED BY:
--   th_deal_pack_credit_transactions.retailer_profile_id
-- FOOTER: Full
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.td_retailer_deal_pack_credit
(
     retailer_deal_pack_credit_id   BIGSERIAL              PRIMARY KEY
    ,retailer_profile_id         BIGINT         UNIQUE  NOT NULL  -- Logical FK, 1:1

    -- CREDIT LIMITS
    ,total_credit_limit          DECIMAL(10, 2)         NOT NULL DEFAULT 1000.00
        CHECK (total_credit_limit >= 0)
    ,reserved_credit             DECIMAL(10, 2)         NOT NULL DEFAULT 0
        CHECK (reserved_credit >= 0)

    -- COMPUTED (maintained by triggers/application)
    -- available_credit = total_credit_limit - reserved_credit
    ,available_credit            DECIMAL(10, 2)         NOT NULL DEFAULT 1000.00
        CHECK (available_credit >= 0)
    ,active_deal_pack_count         INTEGER                NOT NULL DEFAULT 0
        CHECK (active_deal_pack_count >= 0)

    -- TRIAL TRACKING
    ,is_trial                    BOOLEAN                NOT NULL DEFAULT true
    ,dttm_trial_period_start_utc TIMESTAMPTZ            NULL
    ,trial_deal_packs_created       INTEGER                NOT NULL DEFAULT 0
        CHECK (trial_deal_packs_created >= 0)
    ,trial_deal_pack_allowance      INTEGER                NOT NULL DEFAULT 4
        CHECK (trial_deal_pack_allowance > 0)

    -- SUBSCRIPTION (post-trial)
    ,has_deal_pack_subscription     BOOLEAN                NOT NULL DEFAULT false
    ,dttm_subscription_start_utc TIMESTAMPTZ            NULL
    ,dttm_subscription_end_utc   TIMESTAMPTZ            NULL

    -- FOOTERS
    ,dttm_created_utc            TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,created_by                  VARCHAR(50)            NOT NULL DEFAULT CURRENT_USER
    ,dttm_modified_utc           TIMESTAMPTZ            NULL
    ,modified_by                 VARCHAR(50)            NULL

    -- CONSTRAINTS
    ,CONSTRAINT chk_available_credit_calc
        CHECK (ABS(available_credit - (total_credit_limit - reserved_credit)) < 0.01)
    ,CONSTRAINT chk_reserved_lte_total
        CHECK (reserved_credit <= total_credit_limit)
);

-- ============================================================================
-- END DICTIONARY TABLES (td_)
-- ============================================================================



















-- ============================================================================
-- MATRIX TABLES (tm_)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- tm_tier_feature_permissions
-- ----------------------------------------------------------------------------
-- PURPOSE: Define which subscription tiers can access which features
-- USE CASE: "Can this retailer use velocity pricing? How many AI requests per month?"
-- MUTABILITY: Mutable - Permissions adjustable without code deploy
--   WHAT CHANGES: is_enabled, usage_limit_per_month
-- ENFORCEMENT: Centralized matrix prevents scattered tier checks across codebase
-- REFERENCES:
--   td_subscription_tier.subscription_tier_id (via subscription_tier_id)
-- REFERENCED BY: Application logic (no direct FKs, used via queries)
-- FOOTER: dttm_created_utc, dttm_modified_utc (no created_by/modified_by)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.tm_tier_feature_permissions
(
     permission_id              SERIAL          PRIMARY KEY
    
    -- Which subscription tier?
    ,subscription_tier_id       INT2            NOT NULL  -- Logical FK to td_subscription_tier
                                                          CHECK (
                                                            permission_id = 0 
                                                            OR subscription_tier_id BETWEEN 1 AND 4
                                                          )
    
    -- What type of feature?
    ,feature_category           VARCHAR(50)     NOT NULL
                                                          CHECK (
                                                            permission_id = 0
                                                            OR feature_category IN (
                                                              'pricing_mode', 'ai_feature', 
                                                              'api_limit', 'report_access', 
                                                              'support_level'
                                                            )
                                                          )
    
    -- Which specific feature?
    ,feature_value              VARCHAR(50)     NOT NULL
    
    -- Is it enabled? (NO DEFAULT - force explicit)
    ,is_enabled                 BOOLEAN         NOT NULL
    
    -- Usage limit (NULL = unlimited)
    ,usage_limit_per_month      INTEGER         NULL
                                                          CHECK (
                                                            usage_limit_per_month > 0 
                                                            OR usage_limit_per_month IS NULL
                                                          )
    
    -- FOOTERS
    ,dttm_created_utc           TIMESTAMPTZ     NOT NULL  DEFAULT NOW()
    ,dttm_modified_utc          TIMESTAMPTZ     NULL
    
    -- CONSTRAINTS
    ,CONSTRAINT unq_tier_feature 
        UNIQUE(subscription_tier_id, feature_category, feature_value)
);

-- ============================================================================
-- END MATRIX TABLES (tm_)
-- ============================================================================




















-- ============================================================================
-- NORMAL TABLES (tb_)
-- ============================================================================

-- ============================================================================
-- CORE USERS TABLES - Auth + Core Identity for All Users
-- ============================================================================

-- ----------------------------------------------------------------------------
-- tb_users
-- ----------------------------------------------------------------------------
-- PURPOSE: Core authentication and identity for all users
-- USE CASE: "Can this user log in? What role are they?"
-- MUTABILITY: Mutable - Login timestamps, verification status, security flags change
--   WHAT CHANGES: email_verified, dttm_email_verified_utc, dttm_last_login_utc, 
--     failed_login_attempts, dttm_locked_until_utc, is_active, dttm_deleted_utc
-- REFERENCES:
--   te_user_role.user_role_id (via user_role_id)
-- REFERENCED BY:
--   tb_user_profiles.user_id (1:1)
--   tb_customer_profiles.user_id (1:1, role=1)
--   tb_retailer_profiles.user_id (1:1, role=2)
--   tb_purchases.customer_user_id
--   tb_purchases.redeemed_by_user_id
--   tb_notification_queue.user_id
--   tb_audit_logs.user_id
--   tb_ai_conversations.user_id
--   tb_ai_interactions.user_id
--   th_deal_views.user_id
-- FOOTER: dttm_created_utc, dttm_modified_utc
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.tb_users
(
     user_id                     BIGSERIAL              PRIMARY KEY
    ,user_uuid                   UUID           UNIQUE  NOT NULL DEFAULT uuid_generate_v4()
    
    -- [@INFO]  1 -- FK to te_user_role
    ,user_role_id                INT2                   NOT NULL DEFAULT 1
    
    -- AUTH
    ,email                       VARCHAR(255)   UNIQUE  NOT NULL
    ,auth_provider               VARCHAR(50)            NOT NULL DEFAULT 'cognito'
    -- [@INFO] NULLABLE is allowed if Admin creates account
    ,auth_provider_user_id VARCHAR(255) NULL
    
    -- [@INFO] FOR VERIFICATION (email only - phone moved to profile)
    ,email_verified              BOOLEAN                NOT NULL DEFAULT false
    ,dttm_email_verified_utc     TIMESTAMPTZ            NULL
    
    -- SECURITY
    ,is_active                   BOOLEAN                NOT NULL DEFAULT true
    ,dttm_last_login_utc         TIMESTAMPTZ            NULL
    ,failed_login_attempts       INTEGER                NOT NULL DEFAULT 0
    ,dttm_locked_until_utc       TIMESTAMPTZ            NULL
    ,dttm_deleted_utc            TIMESTAMPTZ            NULL
    
    -- FOOTERS
    ,dttm_created_utc            TIMESTAMPTZ            NOT NULL DEFAULT NOW()

    -- [@INFO] created_by is only useful if a user is manually created
    ,created_by                  VARCHAR(50)            NULL
    ,dttm_modified_utc           TIMESTAMPTZ            NULL
    -- [@INFO] modified_by is also an internal column if we need to update 
    -- ... user on behalf of them (login, verification, locks)
    ,modified_by                 VARCHAR(50)            NULL
    
    -- [@CONSTRAINTS:]
    ,CONSTRAINT chk_email_format
        CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);


-- ----------------------------------------------------------------------------
-- tb_user_roles
-- ----------------------------------------------------------------------------
-- PURPOSE: Junction table enabling multi-role users (same email, multiple roles)
-- USE CASE: "Can a retailer also be a consumer?" Yes - check this table
-- MUTABILITY: Mutable - Roles can be added (rarely removed)
--   WHAT CHANGES: is_primary (if user changes primary role)
-- REFERENCES:
--   tb_users.user_id (via user_id)
--   te_user_role.user_role_id (via user_role_id)
-- REFERENCED BY: None (used by RPC functions)
-- FOOTER: dttm_created_utc only (append-mostly)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.tb_user_roles
(
     user_id              BIGINT         NOT NULL   -- Logical FK to tb_users
    ,user_role_id         INT2           NOT NULL   -- Logical FK to te_user_role
    ,is_primary           BOOLEAN        NOT NULL   DEFAULT false
    ,dttm_created_utc     TIMESTAMPTZ    NOT NULL   DEFAULT NOW()

    ,PRIMARY KEY (user_id, user_role_id)
);

-- Index for quick "what roles does this user have?" lookups
CREATE INDEX IF NOT EXISTS idx_tb_user_roles_user_id
    ON mdd.tb_user_roles(user_id);

-- Index for "find all users with this role" queries (admin dashboards)
CREATE INDEX IF NOT EXISTS idx_tb_user_roles_role_id
    ON mdd.tb_user_roles(user_role_id);


-- ----------------------------------------------------------------------------
-- tb_user_profiles
-- ----------------------------------------------------------------------------
-- PURPOSE: Basic profile information shared by all user types (name, phone, image)
-- USE CASE: "What's this user's name? Profile picture? Phone number?"
-- MUTABILITY: Mutable - Users edit their profile info
--   WHAT CHANGES: first_name, last_name, phone, profile_image_url, phone_verified, 
--     dttm_phone_verified_utc, onboarding_completed, onboarding_step
-- REFERENCES:
--   tb_users.user_id (via user_id, 1:1)
-- REFERENCED BY: None (leaf table)
-- FOOTER: dttm_created_utc, dttm_modified_utc
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.tb_user_profiles
(
    -- [@INFO] 1:1 FK to tb_users
     user_id                     BIGINT                 PRIMARY KEY
    
    -- BASIC 
    ,first_name                  VARCHAR(50)           NOT NULL DEFAULT ''
    ,last_name                   VARCHAR(50)           NOT NULL DEFAULT ''
    ,phone                       VARCHAR(20)           NULL
        CHECK (phone IS NULL OR phone ~* '^\+?[1-9]\d{1,14}$')

    ,profile_image_url           TEXT                   NULL
    
    -- PHONE VERIFICATION
    ,phone_verified              BOOLEAN                NOT NULL DEFAULT false
    ,dttm_phone_verified_utc     TIMESTAMPTZ            NULL
    
    -- ONBOARDING TRACKING
    ,onboarding_completed        BOOLEAN                NOT NULL DEFAULT false
    ,onboarding_step             VARCHAR(50)            NOT NULL DEFAULT 'profile_created'
    
    -- FOOTERS
    ,dttm_created_utc            TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,dttm_modified_utc           TIMESTAMPTZ            NULL
    
    -- [@CONSTRAINTS:]
);

-- ----------------------------------------------------------------------------
-- tb_customer_profiles
-- ----------------------------------------------------------------------------
-- PURPOSE: Customer-specific profile data and preferences
-- USE CASE: "What are this customer's notification preferences? Favorite categories?"
-- MUTABILITY: Mutable - Customers update preferences and location
--   WHAT CHANGES: date_of_birth, location, address_*, notification_preferences, preferred_categories
-- REFERENCES:
--   tb_users.user_id (via user_id, 1:1, user_role_id=1)
-- REFERENCED BY: None (leaf table)
-- TRIGGER: trg_validate_customer_role ensures user_role_id = 1
-- FOOTER: dttm_created_utc, dttm_modified_utc
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.tb_customer_profiles
(
     -- [@INFO] 1:1 FK to tb_users
     user_id                     BIGINT                 PRIMARY KEY
    
     -- CUSTOMER [@INFO]
    ,date_of_birth               DATE                   NULL
    
     -- LOCATION (optional for customers - used for deal discovery)
    ,location                    GEOGRAPHY(POINT, 4326) NULL
    ,address_street              VARCHAR(255)           NULL
    ,address_city                VARCHAR(100)           NULL
    ,address_state               VARCHAR(50)            NULL
    ,address_zip                 VARCHAR(20)            NULL
    
     -- PREFERENCES
    ,notification_preferences    JSONB                  NOT NULL
        DEFAULT '{"push": true, "email": true, "sms": false}'::jsonb

    ,preferred_categories        INTEGER[]              NOT NULL DEFAULT '{}'

    -- [@INFO] Deal discovery radius in miles (1, 5, 10, 25, 50)
    ,search_radius_miles         INTEGER                NOT NULL DEFAULT 10

    -- [@INFO] Notification price zone filters (NULL = no filter / all prices)
    ,notification_price_min      DECIMAL(10,2)          NULL
    ,notification_price_max      DECIMAL(10,2)          NULL

    -- [@INFO] Notification time window (NULL = anytime)
    -- Stored as TIME, e.g. '08:00', '21:00'
    ,notification_time_start     TIME                   NULL
    ,notification_time_end       TIME                   NULL

     -- FOOTERS
    ,dttm_created_utc            TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,dttm_modified_utc           TIMESTAMPTZ            NULL
);

-- ----------------------------------------------------------------------------
-- tb_retailer_profiles
-- ----------------------------------------------------------------------------
-- PURPOSE: Retailer business information, subscription, payment integration, cached stats
-- USE CASE: "What's this retailer's subscription? Business hours? Payout account?"
-- MUTABILITY: Heavily Mutable - Subscription changes, stats updated, business info edited
--   WHAT CHANGES: business_*, location, subscription_tier_id, dt_subscription_*, 
--     payment_*, payout_*, dttm_business_verified_utc, cached stats (total_deals, 
--     total_revenue, avg_sellthrough_rate, retailer_avg_discount_pct, customer_rating)
-- REFERENCES:
--   tb_users.user_id (via user_id, 1:1, user_role_id=2)
--   td_deal_category.deal_category_id (via deal_category_id)
--   td_subscription_tier.subscription_tier_id (via subscription_tier_id)
--   td_service_area_zipcode.service_area_zipcode_id (via service_area_zipcode_id)
-- REFERENCED BY:
--   tb_deals.retailer_profile_id
--   tb_purchases.retailer_profile_id
--   tb_ai_conversations.retailer_profile_id
--   tb_ai_interactions.retailer_profile_id
--   th_ai_education_conversions.retailer_profile_id
-- TRIGGER: trg_validate_retailer_role ensures user_role_id = 2
-- FOOTER: dttm_created_utc, dttm_modified_utc
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.tb_retailer_profiles
(
     retailer_profile_id         BIGSERIAL              PRIMARY KEY
    ,user_id                     BIGINT         UNIQUE  NOT NULL
    
    -- BUSINESS IDENTITY
    ,business_name               VARCHAR(255)           NOT NULL

    -- [@INFO] Force explicit setting, Logical FK to td_deal_category 
    ,deal_category_id            INTEGER                NOT NULL
    ,business_description        TEXT                   NOT NULL DEFAULT ''
    ,website                     VARCHAR(255)           NOT NULL DEFAULT ''
    ,logo_url                    TEXT                   NULL
    ,cover_image_url             TEXT                   NULL
    ,business_hours              JSONB                  NOT NULL DEFAULT '{}'::jsonb
    
    -- [@INFO] LOCATION (for precise geofencing)
    ,location                    GEOGRAPHY(POINT, 4326) NOT NULL
    
    -- [@INFO] ADDRESS (for display & verification)
    ,street_address              VARCHAR(255)           NOT NULL
    ,city                        VARCHAR(100)           NOT NULL
    ,state_code                  CHAR(2)                NOT NULL
    ,business_zipcode            VARCHAR(10)            NOT NULL
    ,county                      VARCHAR(50)            NULL      -- Logical FK to td_nc_tax_rate, set via reverse geocode at onboarding

    -- [@INFO] SERVICE AREA VALIDATION
    ,service_area_zipcode_id    INTEGER       NULL  -- Logical FK

    -- [@INFO] TODO: determine if this 10 mile is the correct default
    ,default_service_radius_km  DECIMAL(5,2)  NOT NULL DEFAULT 10.0
        CHECK (default_service_radius_km > 0 AND default_service_radius_km <= 100)
    
    -- TAX/LEGAL
    ,tax_id                      VARCHAR(50)            NOT NULL DEFAULT ''
    
    -- SUBSCRIPTION
    ,subscription_tier_id        INT2                   NOT NULL DEFAULT 1
    ,dt_subscription_start       DATE                   NULL
    ,dt_subscription_end         DATE                   NULL
    
    -- PAYMENT INTEGRATION
    ,subscription_payment_customer_id   VARCHAR(255)   NOT NULL DEFAULT ''
    ,connected_account_id               VARCHAR(255)   NOT NULL DEFAULT ''
    
    -- BUSINESS VERIFICATION
    ,dttm_business_verified_utc  TIMESTAMPTZ            NULL
    ,verification_documents      JSONB                  NOT NULL DEFAULT '[]'::jsonb
    
    -- CACHED STATS
    ,total_deals                 INTEGER                NOT NULL DEFAULT 0
    ,total_revenue               DECIMAL(12, 2)         NOT NULL DEFAULT 0
    ,avg_sellthrough_rate        DECIMAL(5, 4)          NOT NULL DEFAULT 0
    ,retailer_avg_discount_pct   DECIMAL(5, 2)          NOT NULL DEFAULT 0
    ,customer_rating             DECIMAL(3, 2)          NOT NULL DEFAULT 0
    ,review_count                INTEGER                NOT NULL DEFAULT 0

    -- Deal Packs
    ,deal_pack_credit_limit         DECIMAL(10,2)          NOT NULL DEFAULT 1000.00

    -- NOTIFICATION PREFERENCES
    ,notification_preferences    JSONB                  NOT NULL DEFAULT '{"push": true, "email": true, "sms": false}'::jsonb

    -- FOOTERS
    ,dttm_created_utc            TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,dttm_modified_utc           TIMESTAMPTZ            NULL

    -- CONSTRAINTS
    ,CONSTRAINT chk_business_name_not_empty
        CHECK (business_name != '')

    ,CONSTRAINT chk_customer_rating_range
        CHECK (customer_rating >= 0 AND customer_rating <= 5)

    ,CONSTRAINT chk_review_count_non_negative
        CHECK (review_count >= 0)

    ,CONSTRAINT chk_state_code_valid
        CHECK (state_code ~ '^[A-Z]{2}$')
);

-- ----------------------------------------------------------------------------
-- tb_ai_interactions
-- ----------------------------------------------------------------------------
-- PURPOSE: Individual AI request/response pairs (single turn in a conversation)
-- USE CASE: "What did the user ask? What did AI respond? How many tokens? Did it succeed?"
-- MUTABILITY: Immutable (mostly) - Once AI responds, record is complete
--   WHAT CHANGES: user_accepted_suggestion (may update after creation)
-- GRANULAR: One row per message exchange (user → AI → user → AI)
-- THREADING: ai_conversation_id + conversation_turn links turns together
-- REFERENCES:
--   tb_ai_conversations.ai_conversation_id (via ai_conversation_id)
--   tb_users.user_id (via user_id, XOR with retailer_profile_id)
--   tb_retailer_profiles.retailer_profile_id (via retailer_profile_id, XOR with user_id)
--   td_ai_feature_type.ai_feature_type_id (via ai_feature_type_id)
--   tb_ai_prompt_versions.prompt_version_id (via prompt_version_id)
--   tb_deals.deal_id (via context_deal_id)
-- REFERENCED BY:
--   th_deal_price_changes.ai_interaction_id
--   th_ai_pricing_outcomes.ai_interaction_id
-- FOOTER: dttm_created_utc only (immutable after AI response)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.tb_ai_interactions
(
     ai_interaction_id          BIGSERIAL              PRIMARY KEY
    ,ai_conversation_id         BIGINT                 NULL
    
    -- User identification (mutually exclusive)
    ,user_id                    BIGINT                 NULL  -- Consumer
    ,retailer_profile_id        BIGINT                 NULL  -- Retailer
    
    -- [@INFO] Alwasy force explicit AI Feature Type
    ,ai_feature_type_id         INT2                   NOT NULL
    
    -- [@INFO] NULL = didn't use versioned prompt (OK)
    ,prompt_version_id          INTEGER                 NULL  
    
    -- REQUEST DETAILS
    ,user_input                 TEXT                   NOT NULL
    ,context_deal_id            BIGINT                 NULL

    -- [@DEBG] Would it be better to do the contrains check here or as a cosntraint?
    -- ...
    ,conversation_turn          INTEGER                NOT NULL DEFAULT 1 
                                                       CHECK (conversation_turn > 0)
    
    -- RESPONSE DETAILS
    ,ai_response                TEXT                   NULL
    ,ai_suggestions             JSONB                  NOT NULL DEFAULT '[]'::jsonb
    ,user_accepted_suggestion   BOOLEAN                NULL
    
    -- TECHNICAL METRICS
    -- [@INFO] May be null if request validation fails, a rate limit has been hit,
    -- ... network timeout, or someother unexpected failure
    ,tokens_used                INTEGER                NULL
    ,response_time_ms           INTEGER                NULL
    
    -- STATUS
    ,status                     VARCHAR(20)            NOT NULL DEFAULT 'pending'
                                                       CHECK (status IN (
                                                         'pending', 'success', 'error', 
                                                         'rate_limited', 'timeout'
                                                       ))

    ,error_message              TEXT                   NULL
    
    -- FOOTERS
    ,dttm_created_utc           TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    
    -- [@CONSTRAINTS:tb_ai_interactions]
    -- XOR: Exactly one participant
    ,CONSTRAINT chk_user_or_retailer_not_both
        CHECK (
          (user_id IS NOT NULL AND retailer_profile_id IS NULL) OR
          (user_id IS NULL AND retailer_profile_id IS NOT NULL)
        )
    
    -- Success requires response
    ,CONSTRAINT chk_success_requires_response 
        CHECK (status != 'success' OR ai_response IS NOT NULL)
    
    -- Success requires metrics
    ,CONSTRAINT chk_success_requires_metrics
        CHECK (status != 'success' OR (tokens_used IS NOT NULL AND response_time_ms IS NOT NULL))
    
    -- Turn 2+ requires conversation
    ,CONSTRAINT chk_conversation_turn_requires_conversation
        CHECK (conversation_turn = 1 OR ai_conversation_id IS NOT NULL)
    
    -- Error/timeout requires message
    ,CONSTRAINT chk_error_requires_message
        CHECK (status NOT IN ('error', 'timeout') OR error_message IS NOT NULL)
);

-- ============================================================================
-- tb_customer_deal_saves
-- ============================================================================
-- INTENT: Track which deals consumers have saved/favorited for later
-- LOGICAL FK REFS:
--   tb_customer_deal_saves.customer_user_id -> tb_users.user_id
--   tb_customer_deal_saves.deal_id -> tb_deals.deal_id
-- FOOTER: dttm_saved_utc only (immutable after save)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mdd.tb_customer_deal_saves
(
     customer_deal_save_id   BIGSERIAL              PRIMARY KEY
    ,customer_user_id        BIGINT                 NOT NULL  -- Logical FK to tb_users
    ,deal_id                 BIGINT                 NOT NULL  -- Logical FK to tb_deals
    ,dttm_saved_utc          TIMESTAMPTZ            NOT NULL DEFAULT NOW()

    ,CONSTRAINT unq_customer_deal_save
        UNIQUE(customer_user_id, deal_id)
);

-- ============================================================================
-- tb_reviews
-- ============================================================================
-- Two-way reviews: consumers rate businesses (public) and businesses rate
-- consumers (private). One table with review_direction discriminator.
--
-- MUTABILITY: Mutable - review text/rating can be edited, status changes for moderation
--   WHAT CHANGES: rating, review_text, review_status_id, flag columns,
--     business_response_text, dttm_business_responded_utc
-- REFERENCES:
--   tb_purchases.purchase_id (via purchase_id)
--   tb_users.user_id (via reviewer_user_id, customer_user_id)
--   tb_deals.deal_id (via deal_id)
--   tb_retailer_profiles.retailer_profile_id (via retailer_profile_id)
--   te_review_status.review_status_id (via review_status_id)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mdd.tb_reviews
(
     review_id                   BIGSERIAL              PRIMARY KEY
    ,review_uuid                 UUID                   NOT NULL DEFAULT gen_random_uuid()
    ,review_direction            VARCHAR(30)            NOT NULL  -- 'consumer_to_business' | 'business_to_consumer'

    -- Denormalized references (logical FKs)
    ,purchase_id                 BIGINT                 NULL      -- Logical FK to tb_purchases (NULL for deal pack reviews)
    ,customer_deal_pack_progress_id BIGINT              NULL      -- Logical FK to tb_customer_deal_pack_progress (NULL for purchase reviews)
    ,reviewer_user_id            BIGINT                 NOT NULL  -- Logical FK to tb_users (who wrote the review)
    ,deal_id                     BIGINT                 NOT NULL  -- Logical FK to tb_deals
    ,retailer_profile_id         BIGINT                 NOT NULL  -- Logical FK to tb_retailer_profiles
    ,customer_user_id            BIGINT                 NOT NULL  -- Logical FK to tb_users (the consumer)

    -- Review content
    ,rating                      INT2                   NOT NULL
    ,review_text                 TEXT                   NOT NULL DEFAULT ''
    ,business_response_text      TEXT                   NULL
    ,dttm_business_responded_utc TIMESTAMPTZ            NULL

    -- Moderation
    ,review_status_id            INT2                   NOT NULL DEFAULT 1  -- Logical FK to te_review_status (1=active)
    ,flagged_by_user_id          BIGINT                 NULL     -- Logical FK to tb_users (who flagged)
    ,flag_reason                 TEXT                   NULL

    -- Timestamps
    ,dttm_created_utc            TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,dttm_modified_utc           TIMESTAMPTZ            NOT NULL DEFAULT NOW()

    -- Constraints
    ,CONSTRAINT unq_review_per_purchase_direction
        UNIQUE(purchase_id, review_direction)

    ,CONSTRAINT unq_review_per_enrollment_direction
        UNIQUE(customer_deal_pack_progress_id, review_direction)

    ,CONSTRAINT chk_review_direction_valid
        CHECK (review_direction IN ('consumer_to_business', 'business_to_consumer'))

    ,CONSTRAINT chk_rating_range
        CHECK (rating >= 1 AND rating <= 5)

    ,CONSTRAINT chk_review_source_xor
        CHECK (
            (purchase_id IS NOT NULL AND customer_deal_pack_progress_id IS NULL)
            OR (purchase_id IS NULL AND customer_deal_pack_progress_id IS NOT NULL)
        )
);

-- ============================================================================
-- TOS Acceptances (immutable audit trail)
-- ============================================================================

DROP TABLE IF EXISTS mdd.tb_tos_acceptances;
CREATE TABLE IF NOT EXISTS mdd.tb_tos_acceptances (
    tos_acceptance_id   BIGSERIAL       PRIMARY KEY
    ,user_id            BIGINT          NOT NULL
    ,app                VARCHAR(50)     NOT NULL
    ,tos_version        VARCHAR(20)     NOT NULL
    ,accepted_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
    ,dttm_created_utc   TIMESTAMPTZ     NOT NULL DEFAULT NOW()

    ,CONSTRAINT chk_tos_app_value CHECK (app IN ('consumer', 'business'))
    ,CONSTRAINT unq_user_app_version UNIQUE(user_id, app, tos_version)
);

-- ============================================================================
-- AMBASSADOR / LINK SLOT SYSTEM
-- ============================================================================
-- SHARED/CROSSOVER -- Slot system used by website now, mobile apps later
-- PURPOSE: Universal link routing system. QR codes/URLs point to permanent
--          slots. Ambassadors (and later retailers, users) are assigned/
--          unassigned from slots without reprinting. Powers pre-launch
--          ambassador referral program and future retailer sticker links.
-- ============================================================================

-- ============================================================================
-- te_link_slot_type
-- ============================================================================
-- PURPOSE: Types of link slots in the universal routing system
-- USE CASE: Distinguish ambassador referral links from retailer stickers,
--           user referral links, and campaign channels
-- MUTABILITY: Static - Values fixed at deployment
-- VALUES: id=1 (ambassador), id=2 (retailer), id=3 (user_referral),
--         id=5 (campaign)
-- REFERENCED BY: td_link_slots.link_slot_type_id
-- FOOTER: None

CREATE TABLE IF NOT EXISTS mdd.te_link_slot_type
(
     link_slot_type_id   INT2                       PRIMARY KEY
    ,enum_code           VARCHAR(20)    UNIQUE      NOT NULL
    ,name                VARCHAR(50)                NOT NULL
);

-- ============================================================================
-- te_slot_assignment_status
-- ============================================================================
-- PURPOSE: Lifecycle states for slot assignments
-- USE CASE: Track whether an ambassador/retailer/user is currently active,
--           has ended, or is suspended on a given slot
-- MUTABILITY: Static - Values fixed at deployment
-- VALUES: id=1 (active), id=2 (ended), id=3 (suspended)
-- REFERENCED BY: tb_link_slot_assignments.status_id
-- FOOTER: None

CREATE TABLE IF NOT EXISTS mdd.te_slot_assignment_status
(
     slot_assignment_status_id   INT2                       PRIMARY KEY
    ,enum_code                   VARCHAR(20)    UNIQUE      NOT NULL
    ,name                        VARCHAR(50)                NOT NULL
);

-- ============================================================================
-- te_signup_verification_status
-- ============================================================================
-- WEBSITE-ONLY
-- PURPOSE: Email verification lifecycle for waitlist signups
-- USE CASE: Track whether a signup email has been verified, expired, or bounced
-- MUTABILITY: Static - Values fixed at deployment
-- VALUES: id=1 (pending), id=2 (verified), id=3 (expired), id=4 (bounced)
-- REFERENCED BY: tb_waitlist_signups.verification_status_id
-- FOOTER: None

CREATE TABLE IF NOT EXISTS mdd.te_signup_verification_status
(
     signup_verification_status_id   INT2                       PRIMARY KEY
    ,enum_code                       VARCHAR(20)    UNIQUE      NOT NULL
    ,name                            VARCHAR(50)                NOT NULL
);

-- ============================================================================
-- td_link_slots
-- ============================================================================
-- SHARED/CROSSOVER -- Used by website now, mobile apps later
-- PURPOSE: Universal slot registry. Each slot is a permanent URL/QR code
--          target. Ambassadors, retailers, or users are assigned to slots.
--          Reassigning a slot does not change the URL/QR code.
-- MUTABILITY: Mutable (admin-configurable)
-- REFERENCED BY: tb_link_slot_assignments.link_slot_id,
--                tb_waitlist_signups.link_slot_id
-- FOOTER: Full (created + modified)

CREATE TABLE IF NOT EXISTS mdd.td_link_slots
(
     link_slot_id                INT             PRIMARY KEY GENERATED ALWAYS AS IDENTITY
    ,code                        VARCHAR(20)     UNIQUE      NOT NULL
    ,link_slot_type_id           INT2                        NOT NULL DEFAULT 1
    ,is_active                   BOOLEAN                     NOT NULL DEFAULT true
    ,label                       VARCHAR(100)                NULL
    ,description                 TEXT                        NULL
    ,daily_signup_cap            INTEGER                     NULL
                                                  CHECK (daily_signup_cap IS NULL OR daily_signup_cap > 0)

    -- FOOTERS
    ,dttm_created_utc            TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
    ,created_by                  VARCHAR(50)                 NOT NULL DEFAULT CURRENT_USER
    ,dttm_modified_utc           TIMESTAMPTZ                 NULL
    ,modified_by                 VARCHAR(50)                 NULL
);

-- ============================================================================
-- td_ambassador_program_config
-- ============================================================================
-- WEBSITE-ONLY
-- PURPOSE: Single-row configuration table for ambassador program parameters.
--          All caps, payout amounts, geo-fence settings live here so they
--          can be adjusted without code deploys.
-- MUTABILITY: Mutable (admin-configurable, single row)
-- REFERENCED BY: RPC functions (create_waitlist_signup, get_ambassador_dashboard)
-- FOOTER: Full (created + modified)

CREATE TABLE IF NOT EXISTS mdd.td_ambassador_program_config
(
     config_id                   INT             PRIMARY KEY DEFAULT 1
    ,payout_cap                  DECIMAL(10, 2)              NOT NULL DEFAULT 400.00
                                                 CHECK (payout_cap > 0)
    ,per_signup_amount           DECIMAL(10, 2)              NOT NULL DEFAULT 5.00
                                                 CHECK (per_signup_amount > 0)
    ,daily_signup_cap            INTEGER                     NOT NULL DEFAULT 50
                                                 CHECK (daily_signup_cap > 0)
    ,geo_center_lat              DECIMAL(9, 6)               NOT NULL DEFAULT 35.227100
    ,geo_center_lng              DECIMAL(9, 6)               NOT NULL DEFAULT -80.843100
    ,geo_radius_meters           INTEGER                     NOT NULL DEFAULT 48280
                                                 CHECK (geo_radius_meters > 0)
    ,token_ttl_hours             INTEGER                     NOT NULL DEFAULT 48
                                                 CHECK (token_ttl_hours > 0)

    -- FOOTERS
    ,dttm_created_utc            TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
    ,created_by                  VARCHAR(50)                 NOT NULL DEFAULT CURRENT_USER
    ,dttm_modified_utc           TIMESTAMPTZ                 NULL
    ,modified_by                 VARCHAR(50)                 NULL

    -- Single-row constraint
    ,CONSTRAINT chk_single_config_row CHECK (config_id = 1)
);

-- ============================================================================
-- tb_link_slot_assignments
-- ============================================================================
-- SHARED/CROSSOVER -- Used by website now, mobile apps later
-- PURPOSE: Tracks who holds which slot, with date ranges. One active
--          assignment per slot (enforced by partial unique index).
--          Historical assignments are preserved for attribution.
-- [@INFO] assignee_user_id is NULL for non-app-users (ambassadors).
--         If an ambassador later creates an app account, this gets populated.
-- MUTABILITY: Mutable (application-driven)
-- REFERENCED BY: tb_waitlist_signups.link_slot_assignment_id
-- FOOTER: Full (created + modified)

CREATE TABLE IF NOT EXISTS mdd.tb_link_slot_assignments
(
     link_slot_assignment_id     BIGSERIAL                   PRIMARY KEY
    ,link_slot_id                INT                         NOT NULL
    ,assignee_name               VARCHAR(100)                NOT NULL
    ,assignee_last_name          VARCHAR(100)                NULL
    ,assignee_email              VARCHAR(255)                NOT NULL
    ,assignee_user_id            BIGINT                      NULL
    ,is_payout_exempt            BOOLEAN                     NOT NULL DEFAULT false
    ,status_id                   INT2                        NOT NULL DEFAULT 1
    ,dttm_started_utc            TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
    ,dttm_ended_utc              TIMESTAMPTZ                 NULL

    -- FOOTERS
    ,dttm_created_utc            TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
    ,created_by                  VARCHAR(50)                 NULL
    ,dttm_modified_utc           TIMESTAMPTZ                 NULL
    ,modified_by                 VARCHAR(50)                 NULL

    -- CONSTRAINTS
    ,CONSTRAINT chk_assignment_email_format
        CHECK (assignee_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- One active assignment per slot
CREATE UNIQUE INDEX IF NOT EXISTS unq_one_active_assignment_per_slot
    ON mdd.tb_link_slot_assignments (link_slot_id)
    WHERE status_id = 1;

-- ============================================================================
-- td_channel_cost_model
-- ============================================================================
-- WEBSITE-ONLY
-- PURPOSE: Per-channel cost configuration for acquisition cost tracking.
--          Ambassador slots derive cost from td_ambassador_program_config
--          (variable payout). Merch and campaign slots define their own cost
--          structure here.
-- COST TYPES:
--   'fixed'    - Merch batch with known total cost (e.g. $200 for tote bags)
--   'per_unit' - Cost scales with units distributed. Since 2026-04-08 the actual
--                cost is computed from real spend entries (sum of qty*unit_cost
--                from tb_channel_spend_entries), same as 'spend'. The two types
--                differ only in label / intent.
--   'variable' - Ambassador: computed from signup payouts (no row needed here)
--   'spend'    - Campaign: cost = sum of linked tb_channel_spend_entries
-- MUTABILITY: Mutable (admin-configurable)
-- REFERENCED BY: RPC get_channels_dashboard, get_acquisition_summary
-- FOOTER: Full (created + modified)

CREATE TABLE IF NOT EXISTS mdd.td_channel_cost_model
(
     channel_cost_model_id       SERIAL          PRIMARY KEY
    ,link_slot_id                INT             NOT NULL UNIQUE
    ,cost_type                   VARCHAR(20)     NOT NULL DEFAULT 'fixed'
    ,fixed_total_cost            DECIMAL(10,2)   NULL
    ,unit_cost                   DECIMAL(10,2)   NULL
    -- units_distributed: legacy column. As of 2026-04-08, get_channels_dashboard
    -- ignores this and reads real spend from tb_channel_spend_entries. Kept for
    -- backwards compatibility with create_channel(); safe to drop in a follow-up.
    ,units_distributed           INTEGER         NULL DEFAULT 0
    ,notes                       TEXT            NULL

    -- FOOTERS
    ,dttm_created_utc            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
    ,created_by                  VARCHAR(50)     NOT NULL DEFAULT CURRENT_USER
    ,dttm_modified_utc           TIMESTAMPTZ     NULL
    ,modified_by                 VARCHAR(50)     NULL

    ,CONSTRAINT chk_cost_type_valid
        CHECK (cost_type IN ('fixed', 'per_unit', 'variable', 'spend'))
);

-- ============================================================================
-- tb_channel_spend_entries
-- ============================================================================
-- WEBSITE-ONLY
-- PURPOSE: Tracks operational spend with optional channel attribution.
--          Replaces localStorage-based spend tracking on the ops spend page.
--          Entries with a link_slot_id are attributed to that channel's cost.
--          Entries with NULL link_slot_id are unattributed operational spend.
-- MUTABILITY: Mutable (application-driven, soft-delete via dttm_deleted_utc)
-- REFERENCED BY: RPC get_channels_dashboard (LATERAL join for spend-type cost),
--                RPC get_spend_entries, get_acquisition_summary
-- FOOTER: Full (created + modified + deleted)

CREATE TABLE IF NOT EXISTS mdd.tb_channel_spend_entries
(
     channel_spend_entry_id      BIGSERIAL       PRIMARY KEY
    ,link_slot_id                INT             NULL
    ,item_name                   VARCHAR(200)    NOT NULL
    ,category                    VARCHAR(20)     NOT NULL DEFAULT 'merch'
    ,qty                         INTEGER         NOT NULL DEFAULT 1
    ,unit_cost                   DECIMAL(10,6)   NOT NULL DEFAULT 0
    ,spend_date                  DATE            NULL
    ,notes                       TEXT            NULL

    -- FOOTERS
    ,dttm_created_utc            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
    ,created_by                  VARCHAR(50)     NOT NULL DEFAULT CURRENT_USER
    ,dttm_modified_utc           TIMESTAMPTZ     NULL
    ,modified_by                 VARCHAR(50)     NULL
    ,dttm_deleted_utc            TIMESTAMPTZ     NULL

    ,CONSTRAINT chk_spend_category_valid
        CHECK (category IN ('merch', 'creative', 'labor', 'ads', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_channel_spend_slot
    ON mdd.tb_channel_spend_entries (link_slot_id)
    WHERE dttm_deleted_utc IS NULL;

-- ============================================================================
-- tb_retailer_qr_attributions
-- ============================================================================
-- PURPOSE: Consumer-to-retailer attribution via QR code scan (B2C program).
--          One attribution per consumer, permanent.
-- MUTABILITY: Mutable (qualifying_purchase_count increments)
-- FOOTER: Attributed timestamp only

CREATE TABLE IF NOT EXISTS mdd.tb_retailer_qr_attributions
(
     attribution_id              BIGSERIAL                   PRIMARY KEY
    ,consumer_user_id            BIGINT                      NOT NULL    -- Logical FK to tb_users
    ,retailer_profile_id         BIGINT                      NOT NULL    -- Logical FK to tb_retailer_profiles
    ,link_slot_id                INT                         NULL        -- Logical FK to td_link_slots (type=2)
    ,qualifying_purchase_count   INT                         NOT NULL DEFAULT 0
    ,dttm_attributed_utc         TIMESTAMPTZ                 NOT NULL DEFAULT NOW()

    ,CONSTRAINT unq_qr_attribution_consumer UNIQUE(consumer_user_id)
    ,CONSTRAINT chk_qr_purchase_count_non_negative CHECK (qualifying_purchase_count >= 0)
);

-- Index for retailer dashboard: count attributions per retailer
CREATE INDEX IF NOT EXISTS idx_qr_attributions_retailer
    ON mdd.tb_retailer_qr_attributions (retailer_profile_id);

-- ============================================================================
-- tb_pending_qr_attributions
-- ============================================================================
-- PURPOSE: Temporary storage for deferred deep linking fingerprints.
--          When a consumer scans a retailer QR code but doesn't have the app,
--          we store IP + user agent hash. On first app open, we match and
--          auto-attribute. Rows expire after 1 hour.
-- MUTABILITY: Mutable (is_consumed flag)
-- FOOTER: Created timestamp only

CREATE TABLE IF NOT EXISTS mdd.tb_pending_qr_attributions
(
     pending_id              BIGSERIAL       PRIMARY KEY
    ,retailer_profile_id     BIGINT          NOT NULL
    ,ip_address              INET            NOT NULL
    ,user_agent_hash         VARCHAR(64)     NOT NULL
    ,is_consumed             BOOLEAN         NOT NULL DEFAULT false
    ,dttm_created_utc        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_qr_fingerprint
    ON mdd.tb_pending_qr_attributions (ip_address, user_agent_hash)
    WHERE is_consumed = false;

-- ============================================================================
-- Column addition: tb_retailer_profiles.referred_by_user_id
-- ============================================================================
-- PURPOSE: Track which user referred this retailer (B2B program)
-- NOTE: Run as ALTER since tb_retailer_profiles already exists

ALTER TABLE mdd.tb_retailer_profiles
    ADD COLUMN IF NOT EXISTS referred_by_user_id BIGINT NULL;

-- ============================================================================
-- Column additions: tb_purchases refund tracking
-- ============================================================================
-- PURPOSE: Capture refund amount, timestamp, reason, and Stripe refund id so
--   the ops Transaction Detail page can render the refund panel with real
--   data instead of placeholders.
-- NOTE: Run as ALTER since tb_purchases already exists. Refund fields are all
--   NULLable and only populated when status = 'refunded'.

ALTER TABLE mdd.tb_purchases
    ADD COLUMN IF NOT EXISTS refund_amount        DECIMAL(10, 2) NULL CHECK (refund_amount IS NULL OR refund_amount >= 0);
ALTER TABLE mdd.tb_purchases
    ADD COLUMN IF NOT EXISTS refund_reason        TEXT           NULL;
ALTER TABLE mdd.tb_purchases
    ADD COLUMN IF NOT EXISTS refund_provider_id   VARCHAR(255)   NULL;
ALTER TABLE mdd.tb_purchases
    ADD COLUMN IF NOT EXISTS refunded_by_ops_user TEXT           NULL;
ALTER TABLE mdd.tb_purchases
    ADD COLUMN IF NOT EXISTS dttm_refunded_utc    TIMESTAMPTZ    NULL;

-- ============================================================================
-- END NORMAL TABLES (tb_)
-- ============================================================================

-- ============================================================================
-- MUTABILITY SUMMARY
-- ============================================================================
--
-- STATIC (no footer needed):
--   te_user_role, te_deal_status, te_pricing_mode, te_notification_type,
--   te_notification_status, te_review_status, te_audit_action_type, te_audit_entity_type,
--   te_link_slot_type, te_slot_assignment_status, te_signup_verification_status,
--
-- MUTABLE (full footer: created + modified):
--   td_subscription_tier, td_deal_category,
--   td_price_change_trigger, td_service_area_zipcode, td_ai_feature_type,
--   td_llm_model, tm_tier_feature_permissions, tb_users, tb_user_profiles,
--   tb_customer_profiles, tb_retailer_profiles, tb_purchases,
--   tb_deals, tb_deal_templates, tb_notification_queue,
--   tb_ai_conversations, tb_ai_prompt_versions, tb_customer_deal_saves,
--   tb_reviews, td_link_slots, td_ambassador_program_config,
--   tb_link_slot_assignments, tb_waitlist_signups, th_ambassador_daily_signups
--
-- IMMUTABLE (created only, no modified):
--   tb_category_market_stats, tb_tos_acceptances,
--   tb_audit_logs, tb_ai_interactions, tb_referral_codes
--
-- REFERRAL SYSTEM:
--   td_referral_program_config (admin-configurable)
--   tb_referral_codes (mutable - can deactivate)
--   tb_referrals (mutable - status changes, deal count increments)
--   tb_referral_rewards (mutable - sales_used increments, status changes)
--   tb_retailer_qr_attributions (mutable - purchase count increments)
--
-- ============================================================================


-- ============================================================================
-- OUTREACH CRM
-- ============================================================================
-- OPS-ONLY
-- PURPOSE: Lightweight CRM for tracking business outreach & onboarding pipeline.
--          Used by ops dashboard only (Anthony + Chris).
-- ============================================================================

-- ============================================================================
-- tb_outreach_leads
-- ============================================================================
-- PURPOSE: Businesses being tracked for outreach/onboarding
-- MUTABILITY: Mutable (frequent updates to pipeline_stage, notes)
-- FOOTER: Full (created + modified via trigger)

CREATE TABLE IF NOT EXISTS mdd.tb_outreach_leads
(
     outreach_lead_id            BIGSERIAL                   PRIMARY KEY

    -- BUSINESS INFO
    ,business_name               VARCHAR(255)                NOT NULL
    ,contact_name                VARCHAR(200)                NULL
    ,contact_email               VARCHAR(255)                NULL
    ,contact_phone               VARCHAR(20)                 NULL
    ,street_address              VARCHAR(255)                NULL
    ,city                        VARCHAR(100)                NULL
    ,state_code                  CHAR(2)                     NULL
    ,zip_code                    VARCHAR(10)                 NULL
    ,website                     VARCHAR(500)                NULL

    -- SOCIALS
    ,social_instagram            VARCHAR(255)                NULL
    ,social_facebook             VARCHAR(255)                NULL
    ,social_tiktok               VARCHAR(255)                NULL

    -- CLASSIFICATION
    ,category                    VARCHAR(50)                 NULL
        CHECK (category IS NULL OR category IN ('restaurant', 'salon', 'boutique', 'gym', 'bar', 'cafe', 'retail', 'spa', 'service', 'other'))
    ,priority_score              INT2                        NULL
        CHECK (priority_score IS NULL OR (priority_score >= 1 AND priority_score <= 5))

    -- PIPELINE
    ,pipeline_stage              VARCHAR(20)                 NOT NULL DEFAULT 'lead'
        CHECK (pipeline_stage IN ('lead', 'contacted', 'responded', 'meeting', 'onboarding', 'onboarded', 'lost'))
    ,source                      VARCHAR(20)                 NOT NULL DEFAULT 'cold'
        CHECK (source IN ('cold', 'referral', 'inbound', 'event', 'other'))
    ,last_contacted_utc          TIMESTAMPTZ                 NULL

    -- LINKED RETAILER (once onboarded)
    ,retailer_profile_id         BIGINT                      NULL

    -- NOTES
    ,notes                       TEXT                        NOT NULL DEFAULT ''

    -- WHO CREATED
    ,created_by                  VARCHAR(50)                 NOT NULL

    -- SOFT DELETE
    ,dttm_deleted_utc            TIMESTAMPTZ                 NULL

    -- FOOTERS
    ,dttm_created_utc            TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
    ,dttm_modified_utc           TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_leads_stage
    ON mdd.tb_outreach_leads (pipeline_stage);

CREATE INDEX IF NOT EXISTS idx_outreach_leads_created
    ON mdd.tb_outreach_leads (dttm_created_utc DESC);

-- Auto-update dttm_modified_utc on UPDATE
DROP FUNCTION IF EXISTS mdd.trg_outreach_lead_modified() CASCADE;
CREATE OR REPLACE FUNCTION mdd.trg_outreach_lead_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.dttm_modified_utc = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_outreach_lead_modified ON mdd.tb_outreach_leads;
CREATE TRIGGER trg_outreach_lead_modified
    BEFORE UPDATE ON mdd.tb_outreach_leads
    FOR EACH ROW
    EXECUTE FUNCTION mdd.trg_outreach_lead_modified();


