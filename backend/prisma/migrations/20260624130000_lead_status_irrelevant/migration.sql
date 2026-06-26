-- Add a "לא רלוונטי" (Not Relevant) pipeline column.
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'IRRELEVANT';
