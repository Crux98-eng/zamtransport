-- PostgreSQL requires enum values to be committed before they are used.
ALTER TYPE "UserStatus" ADD VALUE 'PENDING';
ALTER TYPE "UserStatus" ADD VALUE 'REJECTED';
