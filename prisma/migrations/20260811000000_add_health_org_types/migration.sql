-- Health / medical business types (surgical distributors, dental, lab, veterinary).
-- Idempotent: ADD VALUE IF NOT EXISTS. Safe to run against production.

ALTER TYPE "OrganizationType" ADD VALUE IF NOT EXISTS 'SURGICAL_STORE';
ALTER TYPE "OrganizationType" ADD VALUE IF NOT EXISTS 'DENTAL_STORE';
ALTER TYPE "OrganizationType" ADD VALUE IF NOT EXISTS 'LAB_SUPPLIES';
ALTER TYPE "OrganizationType" ADD VALUE IF NOT EXISTS 'VETERINARY_STORE';
