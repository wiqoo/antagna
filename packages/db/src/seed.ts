import 'dotenv/config';
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
  const rolesPath = join(__dirname, '../../../config/roles.yaml');
  const roles = parseYaml(readFileSync(rolesPath, 'utf8')) as RolesFile;

  console.log(`Seeding ${roles.team.length} profiles from config/roles.yaml…`);

  for (const member of roles.team) {
    if (!member.email) {
      console.log(`  ↷ skipping #${member.id} (${member.name_en}): no email yet`);
      continue;
    }

    const fullName = member.legal_name ?? member.name_en;

    await db
      .insert(schema.profiles)
      .values({
        email: member.email,
        fullName,
        fullNameAr: member.name_ar,
        role: member.role,
        active: member.active ?? true,
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
