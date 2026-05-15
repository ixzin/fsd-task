# Airtable Integration

## 1. Prepare Airtable Account

Create an Airtable account and prepare the following tables:

* `Tickets`
* `Users` (the name must be exactly `Users` for the users endpoint)

Your Airtable account should:

* use email/password authentication
* have MFA enabled

It is recommended to create at least 200 records and update Status/Assignee fields multiple times to generate revision history.

---

## 2. Environment Configuration

Go to the backend folder and copy:

```bash
.env.example -> .env
```

Configure all required environment variables.

The Airtable OAuth redirect URI should be:

```bash
http://localhost:3000/airtable/oauth/callback
```

---

## 3. Docker Configuration

Copy:

```bash
docker-compose.example.yml -> docker-compose.yml
```

Configure the required variables if needed.

---

## 4. Start MongoDB

Open terminal in the backend folder and run:

```bash
docker compose up -d
```

---

## 5. Install Dependencies

Go to the project root and run:

```bash
npm run install:all
```

---

## 6. Install Puppeteer Chromium

Run:

```bash
npm --prefix backend exec puppeteer browsers install chrome
```

---

## 7. Start the Project

Run:

```bash
npm run dev
```

Frontend:

* http://localhost:4200

Backend:

* http://localhost:3000

---

# Application Flow

Select:

* Base
* Entity (`Tickets` or `Users`)

Available actions:

### OAuth Connect

Authenticates with Airtable using OAuth flow.

### Sync Pages

Synchronizes Airtable records with MongoDB.

### Load Revisions

Loads already stored revision history records from MongoDB.

### Sync Revisions

Fetches Airtable revision history from the internal revision endpoint, parses Status/Assignee changes, and stores them in MongoDB.

### Connect Revision History

Creates authenticated Airtable session cookies required for revision history requests.

---

# Important Notes

Airtable uses anti-bot protection for login and revision history endpoints.

Because of this, Puppeteer runs in `headless: false` mode for authenticated revision history sessions.
