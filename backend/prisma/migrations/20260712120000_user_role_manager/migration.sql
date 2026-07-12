-- New MANAGER role (between AGENT and ADMIN): sees all agents, manages agents /
-- templates / WhatsApp, but not company profile/plan or admin users.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MANAGER';
