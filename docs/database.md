# Database setup

This project uses PostgreSQL through Prisma. The database schema is defined in
`prisma/schema.prisma` and its initial migration is in `prisma/migrations`.

## Commands

```powershell
npm run db:generate  # Regenerate Prisma Client after schema changes
npm run db:migrate   # Create and apply a development migration
npm run db:deploy    # Apply committed migrations in deployment environments
npm run db:seed      # Add the default timezone and, optionally, an administrator
npm run db:studio    # Browse the database in Prisma Studio
```

`DATABASE_URL` must contain the PostgreSQL connection string. Keep it in `.env`
and never commit that file.

To seed the initial administrator, set a strong password only for the command
being run:

```powershell
$env:SEED_ADMIN_PASSWORD = 'use-a-strong-unique-password'
npm run db:seed
Remove-Item Env:SEED_ADMIN_PASSWORD
```

The administrator is created at `admin@zambiatransport.local`. Without
`SEED_ADMIN_PASSWORD`, the seed script only creates the `application.timezone`
setting (`Africa/Lusaka`).

## Application-enforced rules

Foreign keys, unique values, indexes, and route-stop sequence uniqueness are
enforced by the database. The API/service layer must enforce rules that depend
on other rows or current time: the driver role for driver profiles and trips,
non-overlapping active trips/assignments, vehicle availability, at least two
stops per route, and valid trip status transitions.
