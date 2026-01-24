-- Migration: Add feature flags and supplements dismissed state to users
-- These columns store JSON data for feature flag preferences and UI state

ALTER TABLE "users" ADD COLUMN "featureFlags" TEXT;
ALTER TABLE "users" ADD COLUMN "supplementsDismissedState" TEXT;
