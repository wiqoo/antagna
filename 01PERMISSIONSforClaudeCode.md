<div dir="rtl">

# Antagna — Permissions Architecture
## نموذج الصلاحيات الكامل لـ Volt Production

> **For:** Claude Code instance
> **Owner:** Mohammed (System Admin)
> **Approach:** Strict entity access + Field-level masking
> **Date:** 2026-05-28

---

## 📌 الفلسفة الأساسية

**القاعدة الذهبية:** كل واحد يشوف **بس** اللي يخصه. ولو شاف entity، مش بالضرورة يشوف كل حقولها.

طبقتين من الـ access control:

```
طبقة 1: Entity-Level Access (هل تقدر تشوف ده أصلاً؟)
   ↓
طبقة 2: Field-Level Masking (لو تقدر، تشوف أي حقول منه؟)
```

</div>

---

## Part 1: Position-to-Capability Mapping

<div dir="rtl">

كل position يـ inherit مجموعة capabilities. الـ capabilities هي اللي بتحدد الـ permissions الفعلية.

</div>

### Capabilities Catalog (Permission Codes)

```yaml
# Read capabilities
projects.read.all:        # شوف كل المشاريع
projects.read.assigned:   # شوف بس المشاريع المسؤول عنها
projects.read.financial:  # شوف الحقول المالية للمشروع
projects.read.client_contacts:  # شوف client contacts للمشروع
projects.read.internal_notes:   # شوف الـ AI notes + post-mortem

clients.read.all:
clients.read.own:         # العملاء اللي بـ assigned ليه
clients.read.contacts:    # تفاصيل جهات الاتصال
clients.read.financial:   # CR, VAT, payment terms

email_threads.read.all:
email_threads.read.assigned:
email_threads.read.client_emails:

equipment.read.all:
equipment.read.financial:  # purchase price, insurance value

financials.read:
financials.read.team:      # رواتب الفريق
financials.read.own:       # المرتب الخاص

ai_suggestions.read:
ai_suggestions.act:        # approve/reject

team.read:
team.read.salaries:

# Write capabilities
projects.write.create:
projects.write.update.assigned:
projects.write.stage_transition:
projects.write.delete:

tasks.write.own:
tasks.write.assigned:
tasks.write.delegate:

equipment.write.checkout:
equipment.write.maintenance:
equipment.write.create:

clients.write.create:
clients.write.update:

email.send:
whatsapp.send:

approval.creative:         # المخرج يعتمد creative
approval.financial:        # المالي يعتمد financials
approval.strategic:        # المدير العام يعتمد strategic

# Admin capabilities
system.admin:
permissions.manage:
integrations.manage:
automation.manage:
users.invite:
```

### Position → Capabilities Matrix

<div dir="rtl">

كل position له قائمة capabilities. ده اللي Claude Code يحوّله لـ rows في `position_capabilities`.

</div>

#### 1. `position:general_manager` (أبو لوكا)
```yaml
inherits: [creative_director, executive]
capabilities:
  - "*"  # كل حاجة
  - financials.read.team
  - approval.strategic
```

#### 2. `position:creative_director` (أبو لوكا — قبعة ثانية)
```yaml
capabilities:
  - projects.read.all
  - projects.read.financial
  - projects.read.client_contacts
  - projects.read.internal_notes
  - approval.creative
  - clients.read.all
  - email_threads.read.all
  - team.read
  - ai_suggestions.read
  - ai_suggestions.act
  - tasks.write.delegate
```

#### 3. `position:production_director` (غريب)
```yaml
capabilities:
  - projects.read.all
  - projects.read.internal_notes
  - projects.write.create
  - projects.write.update.assigned
  - projects.write.stage_transition
  - equipment.read.all
  - equipment.write.checkout
  - equipment.write.maintenance
  - team.read
  - ai_suggestions.read
  - ai_suggestions.act
  - system.admin            # علشان هو System Admin برضو
  - integrations.manage
  - automation.manage
  - tasks.write.delegate
# NOT included:
  - financials.read         # متشوفش financial data كاملة
  - projects.read.financial # متشوفش contracted_value
  - clients.read.financial  # متشوف CR/VAT
```

#### 4. `position:project_manager` (خالد)
```yaml
capabilities:
  - projects.read.assigned     # بس مشاريعه
  - projects.read.client_contacts  # عمدلاء مشاريعه
  - projects.write.update.assigned
  - projects.write.stage_transition
  - clients.read.own           # بس عملاءه
  - clients.read.contacts
  - clients.write.create
  - clients.write.update
  - email_threads.read.assigned
  - email.send
  - equipment.read.all
  - tasks.write.delegate
  - ai_suggestions.read         # للـ his clients only
  - ai_suggestions.act
# NOT included:
  - projects.read.all          # ميشوفش مشاريع منصوري
  - projects.read.financial    # ميشوفش الـ margin internal
  - projects.read.internal_notes  # ميشوفش AI internal thinking
  - financials.read
```

#### 5. `position:account_manager` (منصوري)
```yaml
inherits: [project_manager]    # نفس الـ pattern
capabilities:
  - projects.read.assigned
  - projects.read.client_contacts  # بس لـ his accounts
  - clients.read.own
  - clients.read.contacts
  - clients.write.update
  - email_threads.read.assigned
  - email.send
  - tasks.write.delegate
  - ai_suggestions.read
  - ai_suggestions.act
```

#### 6. `position:videographer` (حمادة، محسن)
```yaml
capabilities:
  - projects.read.assigned       # بس المشاريع المعيّن عليها
  - equipment.read.all           # كل المعدات (operational)
  - equipment.write.checkout
  - tasks.write.own
  - tasks.write.assigned
# NOT included:
  - projects.read.financial      # ميشوفش الـ budget
  - projects.read.client_contacts  # ميشوفش بيانات العميل
  - projects.read.internal_notes
  - clients.read                 # ميشوف العملاء أصلاً
  - email_threads.read           # ميدخلش الـ inbox
  - financials.read
```

#### 7. `position:video_editor` (حمادة، محسن)
```yaml
inherits: [videographer]
capabilities:
  - tasks.write.assigned
# Same restrictions as videographer
```

#### 8. `position:photo_editor` (لو في الفريق)
```yaml
inherits: [videographer]  # نفس النمط
```

#### 9. `position:equipment_technician` (مساعد)
```yaml
capabilities:
  - projects.read.assigned          # بس المشاريع اللي بيدعمها
  - equipment.read.all
  - equipment.read.financial        # هو يحتاج يعرف الـ value (insurance)
  - equipment.write.checkout
  - equipment.write.maintenance
  - equipment.write.create
  - tasks.write.own
# NOT included:
  - projects.read.financial
  - projects.read.client_contacts
  - clients.read
  - email_threads.read
```

#### 10. `position:procurement` (كبسي)
```yaml
capabilities:
  - equipment.read.all
  - equipment.read.financial         # يحتاج يعرف الـ prices
  - equipment.write.create
  - clients.read.own                 # vendors فقط (لو vendors = clients type)
  - tasks.write.own
# NOT included:
  - projects.read                    # ميدخلش مشاريع production
  - email_threads.read
  - financials.read
```

#### 11. `position:financial_manager` (حسين)
```yaml
capabilities:
  - projects.read.all
  - projects.read.financial          # شوف الـ margins
  - clients.read.all
  - clients.read.financial           # CR/VAT/payment terms
  - financials.read
  - financials.read.team             # الرواتب
  - equipment.read.all
  - equipment.read.financial
  - approval.financial
  - tasks.write.own
# NOT included:
  - projects.read.internal_notes     # AI thinking مش شغله
  - email_threads.read.all           # بس اللي مالي
  - system.admin
```

#### 12. `position:accountant` (حازم)
```yaml
inherits: [financial_manager]
capabilities:
  - projects.read.all
  - projects.read.financial
  - clients.read.all
  - clients.read.financial
  - financials.read                  # المعاملات اليومية
  - equipment.read.financial
  - tasks.write.own
# NOT included:
  - financials.read.team             # ميشوفش رواتب الزملاء
  - approval.financial               # لا يعتمد، بينفذ
```

#### 13. `position:hr_manager` (تركي)
```yaml
capabilities:
  - team.read
  - team.read.salaries
  - financials.read.team             # للـ payroll
  - users.invite
  - tasks.write.own
# NOT included:
  - projects.read.all                # شوف فقط للـ assignment context
  - projects.read.financial
  - clients.read
  - email_threads.read
```

#### 14. `position:system_admin` (غريب — قبعة ثالثة، أو الـ hire الجديد)
```yaml
inherits: [production_director]
capabilities:
  - system.admin
  - integrations.manage
  - automation.manage
  - permissions.manage
  - users.invite
  - ai_suggestions.act               # full access
# Note: تظل bound بالـ data restrictions (مش هيشوف financial data)
```

#### 15. `position:trainee` (أحمد)
```yaml
capabilities:
  - projects.read.assigned           # بس المسؤول عنها كـ assistant
  - equipment.read.all
  - tasks.write.own
# Very limited
```

#### 16. `position:freelancer` (Freelancers)
```yaml
capabilities:
  - projects.read.assigned           # المشاريع المسؤول عنها فقط
  - tasks.write.assigned
# NOT included:
  - projects.read.financial
  - projects.read.client_contacts    # ⚠️ Critical: ما يشوفش بيانات العميل
  - projects.read.internal_notes
  - clients.read
  - email_threads.read
  - equipment.read.all               # يشوف فقط المعدات المخصصة للـ shoot المعيّن عليه
```

---

## Part 2: Field-Level Masking Matrix

<div dir="rtl">

ده الجزء الأكثر أهمية. حتى لو شخص يـ visible له المشروع، فيه حقول بتـ mask له.

</div>

### جدول `projects` — Field Visibility

| Field | GM | Director | غريب | خالد(PM) | منصوري(AM) | حمادة | محسن | مساعد | كبسي | حسين | حازم | تركي | متدرب | Freelancer |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `code` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ❌ | ✓ | ✓ | ❌ | ✓ | ✓ |
| `title`, `title_ar` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ❌ | ✓ | ✓ | ❌ | ✓ | ✓ |
| `project_type` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ❌ | ✓ | ✓ | ❌ | ✓ | ✓ |
| `stage` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ❌ | ✓ | ✓ | ❌ | ✓ | ✓ |
| `client_id` (FK) | ✓ | ✓ | ✓ | ✓* | ✓* | ❌** | ❌** | ❌ | ❌ | ✓ | ✓ | ❌ | ❌ | ❌ |
| `agency_id`, `agency_contact_id` | ✓ | ✓ | ✓ | ✓* | ✓* | ❌ | ❌ | ❌ | ❌ | ✓ | ✓ | ❌ | ❌ | ❌ |
| `primary_contact_id` | ✓ | ✓ | ✓ | ✓* | ✓* | ❌ | ❌ | ❌ | ❌ | ✓ | ✓ | ❌ | ❌ | ❌ |
| Dates (shoot/delivery) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ❌ | ✓ | ✓ | ❌ | ✓ | ✓ |
| `contracted_value_sar` 💰 | ✓ | ✓ | ❌ | ✓* | ✓* | ❌ | ❌ | ❌ | ❌ | ✓ | ✓ | ❌ | ❌ | ❌ |
| `ai_status_paragraph` | ✓ | ✓ | ✓ | ✓ | ✓ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `ai_risk_level` | ✓ | ✓ | ✓ | ✓ | ✓ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `ai_next_action` | ✓ | ✓ | ✓ | ✓ | ✓ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `drive_folder_url` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ❌ | ❌ | ❌ | ❌ | ✓ | ✓ |
| `dafterah_*` (financial refs) | ✓ | ✓ | ❌ | ✓* | ✓* | ❌ | ❌ | ❌ | ❌ | ✓ | ✓ | ❌ | ❌ | ❌ |
| `notes` (internal) | ✓ | ✓ | ✓ | ✓ | ✓ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `post_mortem_notes` | ✓ | ✓ | ✓ | ✓ | ✓ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `default_approval_flow` | ✓ | ✓ | ✓ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Legend:**
- ✓ = Visible
- ❌ = Hidden / masked as "—"
- ✓* = Visible only for projects he's assigned to (الـ assignment context)
- ❌** = Visible only as "Abu Luka content" generic label (لحمادة + محسن في حالة محتوى أبو لوكا)

### جدول `clients` — Field Visibility

| Field | GM | Director | غريب | خالد | منصوري | الفريق الفني | الباقي |
|---|---|---|---|---|---|---|---|
| `code` | ✓ | ✓ | ✓ | ✓* | ✓* | ❌ | ❌ |
| `name_ar`, `name_en` | ✓ | ✓ | ✓ | ✓* | ✓* | ❌ | ❌ |
| `type` (brand/agency) | ✓ | ✓ | ✓ | ✓* | ✓* | ❌ | ❌ |
| `industry` | ✓ | ✓ | ✓ | ✓* | ✓* | ❌ | ❌ |
| `legal_name` | ✓ | ✓ | ❌ | ✓* | ✓* | ❌ | ❌ |
| `cr_number` 💰 | ✓ | ❌ | ❌ | ❌ | ❌ | ❌ | حسين/حازم فقط |
| `vat_number` 💰 | ✓ | ❌ | ❌ | ❌ | ❌ | ❌ | حسين/حازم فقط |
| `website` | ✓ | ✓ | ✓ | ✓* | ✓* | ❌ | ❌ |
| `address` | ✓ | ✓ | ✓ | ✓* | ✓* | ❌ | ❌ |

✓* = فقط لو هو الـ AM/PM للعميل

### جدول `contacts` — Field Visibility

<div dir="rtl">

**Rule:** Contact يظهر فقط لمن يحتاج التواصل المباشر.

</div>

| Visible to | Conditions |
|---|---|
| GM, Director, Production Director | كل الـ contacts |
| AM/PM | بس contacts عملاءه |
| Financial | كل الـ contacts (للـ billing) |
| الفريق الفني | ❌ (يظهر "العميل" كـ generic) |
| Freelancers | ❌ بالكامل |

### جدول `email_threads` + `email_messages`

<div dir="rtl">

**القاعدة:** الـ inbox يبقى صارم جداً.

</div>

| Position | Inbox Access |
|---|---|
| GM, Director | كل الـ threads |
| خالد (PM) | بس threads لـ projects/clients اللي بيمسكها |
| منصوري (AM) | بس threads لـ brand deals اللي بيمسكها |
| غريب (Prod Mgr) | threads operational + AI suggestions feedback |
| حسين (CFO) | بس threads مالي (invoices, payments) |
| حازم (Accountant) | نفس حسين |
| الفريق الفني | ❌ بالكامل |
| Freelancers | ❌ بالكامل |
| تركي (HR) | ❌ من الـ project inbox |

### جدول `whatsapp_messages`

<div dir="rtl">

Same logic: per-thread access based on participants.

</div>

### جدول `quotes`, `invoices`, `payments`

<div dir="rtl">

**القاعدة:** Financial data = strict.

</div>

| Position | Access |
|---|---|
| GM | ✓ كامل |
| حسين, حازم | ✓ كامل |
| خالد, منصوري | ✓ فقط للـ projects/clients اللي بيمسكوها (no detailed line items) |
| Director | ✓ aggregates only (total revenue, no per-project details) |
| الباقي | ❌ |

### جدول `equipment`

<div dir="rtl">

**القاعدة:** Equipment operational data مفتوحة، financial data مقفولة.

</div>

| Field | All Production Team | Equipment Tech (مساعد) | Procurement (كبسي) | Financial |
|---|---|---|---|---|
| `code`, `category`, `brand`, `model` | ✓ | ✓ | ✓ | ✓ |
| `current_location_id` | ✓ | ✓ | ✓ | ✓ |
| `status` (available/in_use/repair) | ✓ | ✓ | ✓ | ✓ |
| `serial_number` | ❌ | ✓ | ✓ | ✓ |
| `purchase_price_sar` 💰 | ❌ | ✓ | ✓ | ✓ |
| `insurance_value_sar` 💰 | ❌ | ✓ | ❌ | ✓ |
| `purchase_date` | ❌ | ✓ | ✓ | ✓ |

### جدول `team` / `profiles`

| Field | About Self | About Others (same dept) | About Others (different dept) | HR | GM |
|---|---|---|---|---|---|
| Name, Role, Photo | ✓ | ✓ | ✓ | ✓ | ✓ |
| Email, Phone | ✓ | ✓ | ❌ | ✓ | ✓ |
| Department, Position | ✓ | ✓ | ✓ | ✓ | ✓ |
| Skills, Capabilities | ✓ | ✓ | ✓ | ✓ | ✓ |
| Salary 💰 | ✓ | ❌ | ❌ | ✓ | ✓ |
| Performance reviews | ✓ | ❌ | ❌ | ✓ | ✓ |
| Attendance records | ✓ | ❌ (only their own dept) | ❌ | ✓ | ✓ |

### جدول `ai_suggestions`

<div dir="rtl">

**القاعدة:** الـ suggestion يـ visible فقط للـ owner role:

</div>

| Suggestion Type | Visible to |
|---|---|
| `new_client`, `new_lead` | الـ AM المسؤول + غريب + GM |
| `new_project` | الـ PM المسؤول + غريب + GM |
| `follow_up` | الـ AM/PM المسؤول |
| `escalate_to_human` | غريب + GM |
| `project_risk` | الـ PM المسؤول + غريب + GM |

### جدول `daily_briefs`

<div dir="rtl">

**القاعدة:** كل واحد يشوف الـ daily brief الخاص بيه فقط.

</div>

| Brief Scope | Visible to |
|---|---|
| `scope='person'` | الـ profile_id المعني فقط |
| `scope='project'` | الـ assignees + PM + Director |
| `scope='company'` | GM + Director + غريب |

---

## Part 3: Implementation في Antagna — Postgres RLS

### Approach

<div dir="rtl">

استخدم Postgres Row Level Security (RLS) عشان enforce الـ entity-level access في الـ database layer. الـ field-level masking في view layer + application code.

</div>

### Schema additions needed

```sql
-- 1. Position-Capability mapping
CREATE TABLE position_capabilities (
  position_key TEXT NOT NULL REFERENCES positions(key),
  capability_code TEXT NOT NULL,  -- e.g., "projects.read.assigned"
  granted_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (position_key, capability_code)
);

-- 2. Helper: check if profile has capability
CREATE FUNCTION user_has_capability(p_capability TEXT) RETURNS BOOLEAN AS $$
DECLARE
  v_profile_id UUID := current_setting('app.current_profile_id', true)::UUID;
  v_position_key TEXT;
BEGIN
  IF v_profile_id IS NULL THEN RETURN FALSE; END IF;
  
  SELECT position_key INTO v_position_key
  FROM profiles WHERE id = v_profile_id;
  
  RETURN EXISTS (
    SELECT 1 FROM position_capabilities
    WHERE position_key = v_position_key
    AND (capability_code = p_capability OR capability_code = '*')
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Helper: check if user is assigned to project
CREATE FUNCTION user_assigned_to_project(p_project_id UUID) RETURNS BOOLEAN AS $$
DECLARE
  v_profile_id UUID := current_setting('app.current_profile_id', true)::UUID;
BEGIN
  IF v_profile_id IS NULL THEN RETURN FALSE; END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM project_assignments
    WHERE project_id = p_project_id AND profile_id = v_profile_id
  ) OR EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id 
    AND (project_manager_id = v_profile_id 
         OR account_manager_id = v_profile_id
         OR production_manager_id = v_profile_id)
  );
END;
$$ LANGUAGE plpgsql STABLE;
```

### RLS Policies — Projects

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Read policy
CREATE POLICY projects_read ON projects FOR SELECT USING (
  user_has_capability('projects.read.all')
  OR (
    user_has_capability('projects.read.assigned')
    AND user_assigned_to_project(id)
  )
);

-- Write policy
CREATE POLICY projects_update ON projects FOR UPDATE USING (
  user_has_capability('projects.write.update.all')
  OR (
    user_has_capability('projects.write.update.assigned')
    AND user_assigned_to_project(id)
  )
);
```

### RLS Policies — Clients

```sql
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY clients_read ON clients FOR SELECT USING (
  user_has_capability('clients.read.all')
  OR (
    user_has_capability('clients.read.own')
    AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.client_id = clients.id
      AND user_assigned_to_project(p.id)
    )
  )
);
```

### Field-Level Masking — Views Pattern

<div dir="rtl">

أنشئ view لكل entity فيه masking على الحقول الحساسة.

</div>

```sql
CREATE OR REPLACE VIEW v_projects_safe AS
SELECT
  id, code, title, title_ar, description,
  project_type, stage,
  
  -- Client ID — visible only if user can see client
  CASE 
    WHEN user_has_capability('projects.read.client_contacts') THEN client_id
    ELSE NULL
  END AS client_id,
  
  -- Agency
  CASE 
    WHEN user_has_capability('projects.read.client_contacts') THEN agency_id
    ELSE NULL
  END AS agency_id,
  
  -- Dates (مفتوحة)
  shoot_starts_at, shoot_ends_at, delivery_due_at,
  
  -- Financial (مقفولة)
  CASE
    WHEN user_has_capability('projects.read.financial') THEN contracted_value_sar
    ELSE NULL
  END AS contracted_value_sar,
  
  CASE
    WHEN user_has_capability('projects.read.financial') THEN dafterah_quote_number
    ELSE NULL
  END AS dafterah_quote_number,
  
  -- AI thinking (مقفولة للـ crew)
  CASE
    WHEN user_has_capability('projects.read.internal_notes') THEN ai_status_paragraph
    ELSE NULL
  END AS ai_status_paragraph,
  
  CASE
    WHEN user_has_capability('projects.read.internal_notes') THEN ai_risk_level
    ELSE NULL
  END AS ai_risk_level,
  
  -- Notes (مقفولة)
  CASE
    WHEN user_has_capability('projects.read.internal_notes') THEN notes
    ELSE NULL
  END AS notes,
  
  drive_folder_url,
  created_at, updated_at
FROM projects;

-- Application reads from v_projects_safe instead of projects
```

### Same pattern for clients

```sql
CREATE OR REPLACE VIEW v_clients_safe AS
SELECT
  id, code, name_ar, name_en, type, industry,
  
  CASE
    WHEN user_has_capability('clients.read.financial') THEN legal_name
    ELSE NULL
  END AS legal_name,
  
  CASE
    WHEN user_has_capability('clients.read.financial') THEN cr_number
    ELSE NULL
  END AS cr_number,
  
  CASE
    WHEN user_has_capability('clients.read.financial') THEN vat_number
    ELSE NULL
  END AS vat_number,
  
  website,
  
  CASE
    WHEN user_has_capability('clients.read.contacts') THEN address
    ELSE NULL
  END AS address,
  
  country_code,
  created_at
FROM clients
WHERE user_has_capability('clients.read.all')
   OR (user_has_capability('clients.read.own') AND id IN (
     SELECT client_id FROM projects WHERE user_assigned_to_project(id)
   ));
```

### Application-side Helper

```typescript
// packages/db/src/auth-context.ts
export async function withProfileContext<T>(
  profileId: string,
  fn: () => Promise<T>
): Promise<T> {
  // Set the profile_id in session context
  await db.execute(sql`SET LOCAL app.current_profile_id = ${profileId}`);
  return fn();
}

// Usage in server actions:
export async function listProjects(profileId: string) {
  return withProfileContext(profileId, async () => {
    return db.select().from(v_projects_safe);
    // Returns automatically filtered + masked rows
  });
}
```

---

## Part 4: Per-Person Permission Mapping (الفريق الحالي)

<div dir="rtl">

ده الـ seed data لـ Claude Code.

</div>

```sql
-- Assuming positions are seeded, now map people:

UPDATE profiles SET position_key = 'general_manager' 
WHERE display_name = 'أبو لوكا';

-- أبو لوكا يلبس 3 hats — قبعة GM هي الـ primary
INSERT INTO profile_capabilities (profile_id, capability_key, proficiency, primary)
SELECT id, 'creative_direction', 'lead', false
FROM profiles WHERE display_name = 'أبو لوكا';

INSERT INTO profile_capabilities (profile_id, capability_key, proficiency, primary)
SELECT id, 'talent_personality', 'lead', false
FROM profiles WHERE display_name = 'أبو لوكا';

-- غريب (Mohammed) - production director primary
UPDATE profiles SET position_key = 'production_director'
WHERE display_name = 'Mohammed Ghareib';

INSERT INTO profile_capabilities (profile_id, capability_key, proficiency, primary)
SELECT id, 'production_leadership', 'senior', true
FROM profiles WHERE display_name = 'Mohammed Ghareib';

INSERT INTO profile_capabilities (profile_id, capability_key, proficiency, primary)
SELECT id, 'photographer', 'proficient', false
FROM profiles WHERE display_name = 'Mohammed Ghareib';

INSERT INTO profile_capabilities (profile_id, capability_key, proficiency, primary)
SELECT id, 'systems_administration', 'lead', false
FROM profiles WHERE display_name = 'Mohammed Ghareib';

INSERT INTO profile_capabilities (profile_id, capability_key, proficiency, primary)
SELECT id, 'research_development', 'lead', false
FROM profiles WHERE display_name = 'Mohammed Ghareib';

-- خالد - PM primary, AM secondary
UPDATE profiles SET position_key = 'project_manager'
WHERE display_name = 'Khalid';

INSERT INTO profile_capabilities (profile_id, capability_key, proficiency, primary)
SELECT id, 'project_management', 'proficient', true
FROM profiles WHERE display_name = 'Khalid';

INSERT INTO profile_capabilities (profile_id, capability_key, proficiency, primary)
SELECT id, 'account_management', 'proficient', false
FROM profiles WHERE display_name = 'Khalid';

-- منصوري - AM
UPDATE profiles SET position_key = 'account_manager'
WHERE display_name = 'عبدالله منصوري';

-- حمادة - Videographer + Editor
UPDATE profiles SET position_key = 'videographer'
WHERE display_name = 'حمادة';

INSERT INTO profile_capabilities (profile_id, capability_key, proficiency, primary)
SELECT id, 'videographer', 'proficient', true
FROM profiles WHERE display_name = 'حمادة';

INSERT INTO profile_capabilities (profile_id, capability_key, proficiency, primary)
SELECT id, 'video_editor', 'proficient', false
FROM profiles WHERE display_name = 'حمادة';

-- مساعد - Equipment Tech
UPDATE profiles SET position_key = 'equipment_technician'
WHERE display_name = 'مساعد';

-- كبسي - Procurement
UPDATE profiles SET position_key = 'procurement'
WHERE display_name = 'كبسي';

-- حسين - Financial Manager (part-time)
UPDATE profiles SET position_key = 'financial_manager', expected_capacity_pct = 20
WHERE display_name = 'حسين';

-- حازم - Accountant (daily)
-- Add حازم to profiles if not exists, set position
-- UPDATE profiles SET position_key = 'accountant';

-- تركي - HR (part-time)
UPDATE profiles SET position_key = 'hr_manager', expected_capacity_pct = 20
WHERE display_name = 'تركي';

-- محسن - Junior Videographer + Editor
UPDATE profiles SET position_key = 'videographer'
WHERE display_name = 'محسن';

INSERT INTO profile_capabilities (profile_id, capability_key, proficiency, primary)
SELECT id, 'videographer', 'junior', true
FROM profiles WHERE display_name = 'محسن';

INSERT INTO profile_capabilities (profile_id, capability_key, proficiency, primary)
SELECT id, 'video_editor', 'junior', false
FROM profiles WHERE display_name = 'محسن';

-- أحمد - Trainee
UPDATE profiles SET position_key = 'trainee'
WHERE display_name = 'أحمد';
```

---

## Part 5: Special Cases — Abu Luka Content

<div dir="rtl">

محتوى أبو لوكا الشخصي حساس. حسب قرارك (2B): الفريق الفني (videographers + editors) يقدروا يشوفوا، لكن **بمعلومات محدودة**.

</div>

### الـ Abu Luka projects

```sql
-- Add tag to projects related to Abu Luka content
ALTER TABLE projects ADD COLUMN is_abu_luka_content BOOLEAN DEFAULT false;

-- Special view for Abu Luka content visibility
CREATE OR REPLACE VIEW v_projects_abu_luka_safe AS
SELECT
  id, code, title, title_ar,
  project_type, stage,
  shoot_starts_at, delivery_due_at,
  drive_folder_url,
  
  -- Hide client_id for crew, show generic "Abu Luka Content"
  CASE
    WHEN user_has_capability('projects.read.client_contacts') THEN client_id
    ELSE NULL  -- crew sees nothing specific
  END AS client_id,
  
  -- Hide financial completely
  NULL AS contracted_value_sar,
  
  -- Hide AI thinking from crew
  CASE
    WHEN user_has_capability('projects.read.internal_notes') THEN ai_status_paragraph
    ELSE NULL
  END AS ai_status_paragraph
  
FROM projects
WHERE is_abu_luka_content = true;
```

### Brand deals linked to Abu Luka

<div dir="rtl">

**Rule:** Brand sponsorships على أبو لوكا = visible فقط للـ:
- أبو لوكا
- منصوري (AM المسؤول)
- حمادة (المنتج)
- غريب (Production oversight)
- حسين، حازم (Financial)

Other crew (محسن، مساعد) يشوفوا الـ project بس بدون brand sponsorship details.

</div>

---

## Part 6: Permission Audit Checklist

<div dir="rtl">

اختبارات يـ Claude Code يعملها بعد التنفيذ:

</div>

### Test Cases

```yaml
# Test 1: محسن (junior videographer) شفت project مالي
- login_as: محسن
- query: SELECT contracted_value_sar FROM v_projects_safe
- expected: NULL لكل الصفوف

# Test 2: خالد ميشوفش مشاريع منصوري
- login_as: خالد
- query: SELECT count(*) FROM v_projects_safe
- expected: COUNT < total projects (بس مشاريعه)

# Test 3: مساعد ميشوفش financials
- login_as: مساعد
- query: SELECT contracted_value_sar FROM v_projects_safe
- expected: NULL

# Test 4: مساعد يشوف purchase_price للمعدات (يحتاجها)
- login_as: مساعد
- query: SELECT purchase_price_sar FROM v_equipment_safe
- expected: numeric values

# Test 5: Freelancer ميشوفش contacts
- login_as: freelancer
- query: SELECT * FROM contacts WHERE client_id = ANY(my_project_clients)
- expected: empty

# Test 6: تركي (HR) ميشوفش financials
- login_as: تركي
- query: SELECT contracted_value_sar FROM v_projects_safe
- expected: NULL

# Test 7: حازم يشوف financials بس مش رواتب الفريق
- login_as: حازم
- query 1: SELECT contracted_value_sar FROM v_projects_safe → expected: values
- query 2: SELECT salary FROM team_salaries → expected: ERROR or NULL

# Test 8: أبو لوكا content مخفي عن خالد
- login_as: خالد
- query: SELECT * FROM v_projects_safe WHERE is_abu_luka_content = true
- expected: empty (خالد مش معنيّ بمحتوى أبو لوكا)

# Test 9: حمادة يشوف Abu Luka content بدون financials
- login_as: حمادة
- query: SELECT contracted_value_sar FROM v_projects_safe WHERE is_abu_luka_content = true
- expected: NULL

# Test 10: غريب (system admin) ميشوفش financials رغم system admin
- login_as: غريب
- query: SELECT contracted_value_sar FROM v_projects_safe
- expected: NULL (system admin ≠ financial access)
```

---

## Part 7: Daily Monitoring Per Position

<div dir="rtl">

كل position يحتاج daily view مخصص. ده اللي Claude Code يبني الـ dashboard cards عليه.

</div>

### الـ Dashboard Cards per Position

#### GM (أبو لوكا) Dashboard
```yaml
cards:
  - revenue_mtd:        # MTD revenue
  - approvals_pending:  # كل اللي يستنى موافقته
  - at_risk_projects:   # red projects
  - brand_health:       # Abu Luka social metrics
  - team_alerts:        # urgent HR issues
  - financial_summary:  # cash position
```

#### Production Director (غريب) Dashboard
```yaml
cards:
  - capacity_heatmap:        # team load this week
  - upcoming_shoots:         # next 7 days
  - equipment_readiness:     # battery + maintenance status
  - active_projects:         # all in production
  - ai_suggestions_queue:    # pending review
  - system_health:           # uptime + integrations
# NOT in his dashboard:
  - revenue_mtd             # financial hidden
  - cash_position
```

#### Project Manager (خالد) Dashboard
```yaml
cards:
  - my_active_projects:      # 5 max
  - my_pipeline:             # deals being negotiated
  - my_client_responses:     # unreplied emails
  - this_week_milestones:    # deadlines
  - my_ai_suggestions:       # for his clients
```

#### Account Manager (منصوري) Dashboard
```yaml
cards:
  - my_abu_luka_deals:       # active brand deals
  - my_pipeline:             # leads
  - brand_responses:         # unreplied (< 2h target)
  - approvals_waiting:       # waiting on أبو لوكا
  - this_month_revenue:      # his portfolio
```

#### Videographer (حمادة، محسن) Dashboard
```yaml
cards:
  - my_shoots_today:
  - my_shoots_this_week:
  - my_editing_queue:
  - my_pending_tasks:
  - equipment_assigned_to_me:
```

#### Equipment Tech (مساعد) Dashboard
```yaml
cards:
  - shoots_today_equipment:  # what needs prep
  - returns_due:             # what's checked out
  - maintenance_due:         # schedule
  - battery_status:          # all batteries
  - new_equipment:           # arrivals to register
```

#### Procurement (كبسي) Dashboard
```yaml
cards:
  - pending_pos:             # in flight
  - deliveries_today:        # to receive
  - vendor_payments_due:
  - low_stock_alerts:        # office supplies
```

#### Financial Manager (حسين) Dashboard
```yaml
cards:
  - cash_position:
  - ar_aging:                # > 30d, > 60d, > 90d
  - upcoming_payments:       # vendor + payroll
  - project_margins_to_review:
  - month_closing_status:
  - zatca_status:
```

#### Accountant (حازم) Dashboard
```yaml
cards:
  - transactions_to_enter:
  - bank_reconciliation_status:
  - expense_reports_pending:
  - ar_calls_today:          # who to call for collection
  - petty_cash_balance:
```

#### HR (تركي) Dashboard
```yaml
cards:
  - attendance_this_week:    # team
  - leave_requests_pending:
  - active_recruitments:
  - upcoming_reviews:
  - compliance_alerts:       # iqama renewals, GOSI
```

---

## Part 8: Integration with Other Files

<div dir="rtl">

هذا الملف يعمل مع:

</div>

- `volt-team-mapping-REAL.md` — الفريق الفعلي
- `volt-roles-playbook-DETAILED.md` — الـ playbook الكامل
- `02-MANAGEMENT-REPORT.md` — تقرير الإدارة (للـ Abu Luka)
- `03-individual-jds/*` — الـ JDs الفردية

---

## Part 9: Order of Implementation للـ Claude Code

```
Phase A: Foundation (Week 1)
[ ] Create positions table
[ ] Create capabilities_catalog
[ ] Create position_capabilities mapping
[ ] Seed all positions + capabilities
[ ] Migrate الـ 12 profile current → assign positions

Phase B: Helper Functions (Week 1)
[ ] Create user_has_capability() function
[ ] Create user_assigned_to_project() function
[ ] Add app.current_profile_id session context
[ ] Update auth middleware to set context

Phase C: RLS Policies (Week 2)
[ ] Enable RLS on projects, clients, contacts
[ ] Enable RLS on email_threads, email_messages
[ ] Enable RLS on quotes, invoices, payments
[ ] Enable RLS on ai_suggestions, daily_briefs

Phase D: Safe Views (Week 2)
[ ] Create v_projects_safe with field masking
[ ] Create v_clients_safe
[ ] Create v_equipment_safe
[ ] Create v_team_safe
[ ] Update app to use views

Phase E: Per-Position Dashboards (Week 3)
[ ] Build dashboard cards per position
[ ] Wire to data sources
[ ] Test for each persona

Phase F: Audit (Week 4)
[ ] Run all 10 test cases
[ ] Document any exceptions
[ ] Train team on what they see/don't see
```

---

**End of permissions architecture.**

*Next files: `02-MANAGEMENT-REPORT.md`, `03-individual-jds/*`*
