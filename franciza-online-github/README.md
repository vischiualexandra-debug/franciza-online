# Franciza Online Panda Tour — site cu cereri + panou admin + Telegram

- **Site public** (`/`) în RO / RU / EN: cui i se potrivește, ce primește francizatul, cum câștigă,
  Panda Tour în cifre, pașii, întrebări frecvente și **formularul de aplicare** — aceleași întrebări ca în
  formularul Google (nume, telefon, email, oraș, vârstă, ore pe zi, experiență în turism / vânzări,
  experiența profesională, ce l-a atras, buget, sursa bugetului, când poate începe) + comentariu opțional
  și acord GDPR. Câmpurile goale sau greșite nu se pot trimite (verificare în browser **și** pe server).
  După trimitere omul vede confirmarea.
- **Baza de date**: Supabase, tabelul `leads` (data creării + status `new` / `in_progress` / `closed` =
  «новая» / «в работе» / «закрыта»).
- **Panou admin** (`/admin`): intrare cu parolă; listă, cele noi sus; filtru după status; căutare;
  la click se deschide cererea cu toate răspunsurile și se schimbă statusul. Fără login nu se vede nimic
  (paginile și API-ul răspund 401).
- **Telegram**: la fiecare cerere nouă botul trimite toate răspunsurile.
- **franciza-crm** (opțional): cererea apare automat și în coloana *Cereri* din CRM.
- **Securitate**: toate cheile stau doar în variabilele de mediu Vercel. În Supabase RLS e pornit fără politici,
  deci cheile publice nu pot citi nimic; doar serverul cu cheia secretă are acces.

**Unde se schimbă conținutul:**
- contacte, cifre (filiale, francize), rețele sociale, link-ul politicii de confidențialitate — [`lib/site.js`](lib/site.js);
- toate textele în cele 3 limbi, inclusiv întrebările frecvente — [`lib/i18n.js`](lib/i18n.js);
- **recenzii**: lista `TESTIMONIALS` din [`lib/site.js`](lib/site.js). Secțiunea apare pe site doar când adaugi
  recenzii reale (cu acordul francizaților);
- poze și logo — [`public/img/`](public/img/) (preluate de pe pandatur.md).

---

## Conturile echipei

- **Prima intrare:** pe `/admin/login` scrii emailul tău și parola din `ADMIN_PASSWORD` (Vercel).
  Cât timp nu există niciun administrator, așa se creează contul tău de **administrator principal**.
  După asta, `ADMIN_PASSWORD` nu mai deschide nimic. Intri cu emailul tău și aceeași parolă,
  pe care o poți schimba din „Contul meu”.
- **Colegii** apasă „Cere acces” pe pagina de logare. Contul rămâne **în așteptare** și nu vede nimic,
  iar administratorul primește mesaj în Telegram. Aprobarea se face în panou → **Echipa**.
- În **Echipa**, administratorul aprobă sau respinge cereri, schimbă rolul (Administrator / Membru),
  dezactivează (accesul se taie imediat), setează o parolă nouă (🔑), șterge sau adaugă direct un cont.
- **Membrii** văd și lucrează doar cu cererile. La fiecare schimbare de status se salvează cine a făcut-o.
- Parolele se păstrează doar ca hash (scrypt), în tabelul `admin_users` din Supabase
  (vezi [`supabase/003_users.sql`](supabase/003_users.sql)).

## De unde vin candidații (sursa cererii)

Site-ul recunoaște singur Facebook, Instagram, TikTok, Google, Telegram, Viber, YouTube, alte site-uri sau intrare directă.
Sursa apare în admin (cu filtru), în mesajul Telegram și în CRM.

Ca să știi exact **ce reclamă** a adus omul, pune în reclamă linkul cu etichete (UTM):

```
https://franciza-online.vercel.app/?utm_source=facebook&utm_medium=paid&utm_campaign=numele_campaniei
```

- `utm_source` — rețeaua: `facebook`, `instagram`, `tiktok`, `google`, `telegram`…
- `utm_medium` — `paid` pentru reclamă plătită, `post` / `bio` / `story` pentru postări gratuite
- `utm_campaign` — numele campaniei, fără spații (ex. `toamna2026_video1`)

Exemple: linkul din bio Instagram → `?utm_source=instagram&utm_medium=bio`;
postare în grupul de Telegram → `?utm_source=telegram&utm_medium=post&utm_campaign=grup_turism`.

Butoanele de chat (Telegram / Viber) se schimbă în [`lib/site.js`](lib/site.js) → `chat`.
Dacă tabelul `leads` a fost creat înainte de 11.11.2026, rulează o dată [`supabase/002_source.sql`](supabase/002_source.sql).

## Pasul 1. Supabase (baza de date)

1. Intră pe https://supabase.com → **New project**. Regiune: *Central EU (Frankfurt)*. Notează parola bazei.
2. În proiect: **SQL Editor** → **New query** → lipește tot din [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   În **Table Editor** trebuie să apară tabelul `leads`.
3. **Project Settings → API Keys** (sau butonul **Connect**). Copiază:
   - **Project URL** (`https://xxxx.supabase.co`) → va fi `SUPABASE_URL`
   - **Secret key** (cheia secretă; la proiectele vechi — cheia „service role”) → va fi `SUPABASE_SECRET_KEY`

⚠️ Cheia secretă nu o pune nicăieri în cod și nu o trimite nimănui.

## Pasul 2. Botul Telegram

1. În Telegram deschide **@BotFather** → `/newbot` → dă-i un nume și un username care se termină în `bot`.
   Primești **tokenul** (`123456789:AA…`) → va fi `TELEGRAM_BOT_TOKEN`.
2. Deschide botul tău (linkul de la BotFather) și apasă **Start** (altfel botul nu-ți poate scrie).
3. Află ID-ul chatului tău — în folderul proiectului rulează:

```bash
node scripts/telegram-chat-id.mjs TOKENUL_TAU
```

   Vezi `TELEGRAM_CHAT_ID = 123456789` → acesta e `TELEGRAM_CHAT_ID`.
   (Vrei mesajele într-un grup? Adaugă botul în grup, scrie ceva acolo și rulează din nou — ID-ul grupului începe cu `-`.)

## Pasul 3. Parola de admin și cheia sesiunii

- `ADMIN_PASSWORD` — parola cu care vei intra în `/admin` (lungă, inventată de tine).
- `AUTH_SECRET` — un șir aleator. Generează-l:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Pasul 4. Publicare pe Vercel

Din folderul `cereri-site`:

```bash
vercel login
```

```bash
vercel
```

Răspunsuri: *Set up and deploy?* → **Y**; scope → contul tău; *Link to existing project?* → **N**;
nume → `cereri-site`; directory → `./`; *Modify settings?* → **N**.

Apoi pe https://vercel.com → proiectul **cereri-site** → **Settings → Environment Variables** — adaugă cele 6 variabile
(bifează **Production** și **Preview**):

| Variabilă | Valoare |
|---|---|
| `SUPABASE_URL` | Project URL din Supabase |
| `SUPABASE_SECRET_KEY` | Secret key din Supabase |
| `TELEGRAM_BOT_TOKEN` | tokenul de la BotFather |
| `TELEGRAM_CHAT_ID` | ID-ul de la pasul 2 |
| `ADMIN_PASSWORD` | parola ta de admin |
| `AUTH_SECRET` | șirul aleator de la pasul 3 |
| `CRM_WEBHOOK_URL` | *(opțional)* `https://ADRESA-CRM.vercel.app/api/webhook/google-form` |
| `CRM_WEBHOOK_SECRET` | *(opțional)* aceeași valoare ca `WEBHOOK_SECRET` din proiectul franciza-crm pe Vercel |

Cu ultimele două, fiecare cerere de pe site apare și în coloana *Cereri* din franciza-crm (cu bifele
Turism / Vânzări, oraș, experiență și toate răspunsurile). Formularul Google poate rămâne în paralel.

Publică versiunea finală (variabilele se aplică doar la o publicare nouă):

```bash
vercel --prod
```

Linkul public e de forma `https://cereri-site.vercel.app` (îl vezi în terminal și pe Vercel).

## Pasul 5. Verificare și capturi de ecran pentru temă

1. Deschide `https://…vercel.app/admin` → intră cu `ADMIN_PASSWORD` → apasă **Test Telegram**.
   Trebuie să vină „✅ Test: botul … funcționează” în Telegram.
2. De pe **telefon** deschide site-ul și trimite o cerere de test (ex. numele tău).
3. Fă capturi:
   - mesajul din Telegram („🐼 Cerere nouă #…”, cu numele și ora);
   - aceeași cerere în `/admin` (numele și ora trebuie să coincidă).
4. Schimbă statusul cererii în „În lucru” și verifică filtrul — opțional, a treia captură.

## (Opțional) GitHub

Codul nu conține nicio cheie (`.env*` e în `.gitignore`), deci poate fi pus pe GitHub. Cel mai simplu:
instalează **GitHub Desktop** → *Add local repository* → alege folderul `cereri-site` → *Publish repository* (privat).
Apoi în Vercel → proiect → **Settings → Git** → *Connect* la repository și fiecare `push` se publică singur.

## Rulare locală

```bash
npm install
```

```bash
npm run dev
```

http://localhost:3000. Fără variabile de mediu, local cererile se salvează în `.data/leads.json`,
mesajele Telegram doar se scriu în terminal, iar parola de admin e `admin12345` (**doar local**; în producție
fără `ADMIN_PASSWORD` nu se poate intra). Pentru test cu Supabase/Telegram reali — copiază `.env.example` în
`.env.local` și completează.

## Structura

```
app/page.js                       landing-ul public
app/admin/                        panoul admin + pagina de login
app/api/leads/                    POST: cerere nouă → Supabase → Telegram → franciza-crm
app/api/admin/...                 listă, schimbare status, login/logout, test Telegram (doar admin)
components/                       Landing, LeadForm, AdminApp, AdminLogin, comutator de limbă
lib/form.js                       întrebările, variantele și validarea (comune browser + server)
lib/i18n.js                       textele RO / RU / EN
lib/site.js                       contacte, cifre, recenzii
lib/db.js                         lucrul cu Supabase
lib/telegram.js                   mesajul Telegram
lib/crm.js, lib/answers.js        trimiterea în franciza-crm
lib/auth.js                       sesiunea de admin (cookie semnat)
supabase/schema.sql               tabelul leads
```
