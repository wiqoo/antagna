/**
 * LOCAL-DEV ONLY. NOT run in production.
 *
 * Pre-fills profiles from config/roles.yaml so a developer testing against a
 * local or throwaway Supabase project has the team roster available for
 * UI/permission work.
 *
 * For the actual production database:
 *   - new users get a profile auto-created on first Google SSO sign-in (see
 *     supabase/migrations/00000000000006_auth_user_to_profile.sql)
 *   - the team's REAL profile data merges in from the legacy Volt OS DB at the
 *     end of Pillar 15 (Migration & Launch).
 *
 * To prevent accidental seeds against prod/staging, this script requires the
 * env var ANTAGNA_ALLOW_SEED=1 to be set.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { db, schema } from './index';

const __dirname = dirname(fileURLToPath(import.meta.url));

type TeamMember = {
  id: number;
  name_ar: string;
  name_en: string;
  legal_name?: string;
  role: string;
  email: string | null;
  active?: boolean;
};

type RolesFile = { team: TeamMember[] };

async function main() {
  if (process.env.ANTAGNA_ALLOW_SEED !== '1') {
    console.error(
      'Refusing to seed: set ANTAGNA_ALLOW_SEED=1 to confirm this is a local-dev database.',
    );
    console.error(
      'See the file header for why: production profiles come from auth-trigger + Pillar 15 merge.',
    );
    process.exit(2);
  }

  const rolesPath = join(__dirname, '../../../config/roles.yaml');
  const roles = parseYaml(readFileSync(rolesPath, 'utf8')) as RolesFile;

  console.log(`Seeding ${roles.team.length} profiles from config/roles.yaml…`);

  for (const member of roles.team) {
    if (!member.email) {
      console.log(`  ↷ skipping #${member.id} (${member.name_en}): no email yet`);
      continue;
    }

    await db
      .insert(schema.profiles)
      .values({
        email: member.email,
        displayName: member.name_ar,
        displayNameEn: member.name_en,
        legalName: member.legal_name ?? null,
        role: member.role,
        status: member.active === false ? 'inactive' : 'active',
      })
      .onConflictDoNothing({ target: schema.profiles.email });

    console.log(`  ✓ ${member.name_en} (${member.email}) → role=${member.role}`);
  }

  console.log('Seed complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
