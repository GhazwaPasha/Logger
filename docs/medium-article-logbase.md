# I Built My Own Work Tracker Because Every Other One Felt Like a Dashboard Pretending to Be a Tool

*How LogBase went from "I just want to see who's doing what" to a web app, a NestJS API, and an Android app heading to the Play Store — built solo, with an AI pair programmer.*

---

Every team I've worked with ends up in the same place. Tasks live in one tool, conversations in another, deadlines in a calendar nobody opens, and "who's online right now?" is answered by pinging someone and waiting.

I didn't want another bloated project-management suite. I wanted something closer to a *logbook*: a calm, fast place where a team records what needs doing, who's doing it, and what just happened.

So I built **LogBase**.

This is the story of what it is, how it's put together, and what I learned shipping a real multi-platform product as one person.

## What LogBase is

LogBase is a team workspace for tracking work. The structure is deliberately simple, and it's the part I'm proudest of:

- **Workspace** — your organization.
- **Category** — a department (Engineering, Design, Ops…).
- **Channel** — a list inside a category, the way a Slack or Discord channel holds a topic.
- **Task** — the unit of work, with status, priority, assignees, subtasks, comments, attachments and dependencies.

Early on, the board had an "All Tasks" view: every task in the org, flat. I removed it. A flat list of everything doesn't scale and strips away the one thing that makes a task understandable — *where it lives*. Now the board always lands you in a real category and channel. It's a small decision, but it changed how the whole product feels.

Around that core sits everything a team actually needs:

- **My tasks**, **Calendar** and **Roadmap** views
- **Search** across the workspace
- **Time tracking** and **performance** reports
- **Comments and attachments** on every task
- **Task dependencies**
- **Discord integration** — send a task (and its files) to a Discord channel, with real upload progress and retry on failure
- **Push notifications** on mobile
- **Live presence** — a stack of avatars in the header showing who's connected *right now*

## The live touches

Presence was the feature that made the app feel alive. When a teammate opens the workspace, their avatar appears in the header; when they leave, it disappears. Under the hood it's a Socket.IO gateway on the API holding an in-memory presence map and broadcasting `presence_sync` / `presence_update` events to the workspace.

It has an honest limitation I'll admit to: presence lives in one server's memory, so it resets on restart and wouldn't be shared across multiple API instances. For a team-sized product that's the right trade for now. If LogBase grows, a Redis-backed store is the obvious next step.

The same realtime layer keeps boards in sync. Move a task to another column and it moves *instantly* on your screen — the UI updates optimistically, and the server catches up.

## The stack

One monorepo, three apps, shared packages:

| Layer | Tech |
|---|---|
| Web | Next.js 16, React 19 |
| API | NestJS 11, Drizzle ORM, Socket.IO |
| Mobile | Expo (React Native 0.86), Expo Router, React 19 |
| Shared | A contracts package (typed API shapes) and a DB package |

The shared `contracts` package is worth calling out. The web app, the mobile app and the API all import the same types, so when I change what a task looks like, TypeScript tells me every place that breaks. For a solo developer juggling three clients, that's the difference between shipping and firefighting.

The API also exposes an **MCP (Model Context Protocol) server** and API keys. That means an AI assistant can list tasks, create them, log time and post comments against a workspace — LogBase is something an agent can work *inside*, not just something humans click through. (I've used that myself while building it.)

## The mobile app: where the design fights happened

The web app came first; the mobile app is where I got opinionated.

**Navigation.** I ripped out the drawer-around-everything pattern. Mobile navigation is now a floating bottom bar: **Home · My tasks · Channels**, with an expand button revealing **Calendar** and **Roadmap**, plus a separate round search button in the iOS 26 style. It collapses to a pill when you scroll down. The workspace switcher became a pill at the top-left of Home. Everything else lives in the avatar menu.

**The Activity terminal.** The dashboard has an Activity tab — a live feed of what's happening in the workspace. I redesigned it three times. The first version was a fullscreen takeover. The second was a boxed "terminal widget" with traffic-light dots. Both were wrong. The final version has no card, no border, no chrome: monospace log lines laid directly on the page, so *the screen itself is the terminal*. It paginates with cursor-based loading, fresh entries get a quick left-to-right "typing" reveal, and a single pulsing glyph says "watching for activity."

The lesson I keep relearning: **every effect should carry information.** I'd copied the web version's rotating status phrases and blinking cursor, and they were just repeating themselves. Cut them and the screen got calmer and more trustworthy.

**Instant everything.** Archive, restore, remove an attachment, change a status — all optimistic. Waiting on a spinner for a checkbox is a tiny insult repeated a hundred times a day.

## Shipping to the Play Store (the unglamorous part)

Nobody warns you that "the app works" and "the app is on the Play Store" are separated by a small bureaucratic country.

What I set up:

- An **EAS Workflow** that triggers on every push to `main` touching the mobile app or shared contracts: build a production AAB, then submit it to Google Play automatically.
- A service account with scoped Play Console permissions for automated submission.
- Firebase Cloud Messaging for push, and Google Sign-In with separate OAuth clients for the dev key, the Play app-signing key and the EAS upload key.

And what bit me:

- **`DEVELOPER_ERROR` on Google Sign-In, but only on Play installs.** The Play-signed build uses a *different* signing certificate than the one I tested with, so Google rejected it until I registered that key's SHA-1 as its own Android OAuth client. Three keys, three clients.
- **A submit that failed because the service account existed in Google Cloud but had never actually been invited in Play Console.** Two separate permission systems; both must agree.
- **Draft-only releases.** While an app is unpublished, Google only accepts *draft* releases on non-internal tracks, so every automated build lands as a draft I have to roll out by hand.
- **The 14-day rule.** Personal developer accounts must run a closed test with at least 12 opted-in testers for 14 days before applying for production.
- **Free-plan build queues.** My EAS builds sometimes sat in the queue for close to an hour.

As I write this, LogBase's closed test is submitted and waiting on Google's review. After that: testers opt in, the 14 days run, and then production.

## Building it with an AI pair programmer

I built most of this with Claude Code in the loop, and I want to be specific about what that does and doesn't mean.

What it's genuinely great at: the long tail. Wiring pagination end to end (API cursor, query hook, scroll-edge trigger) in one pass. Chasing a signing-certificate mismatch across Google Cloud, Firebase and Play Console. Keeping `tsc` and lint clean across three apps after a sweeping change. Writing the changelog entry while the change is still fresh.

What it isn't: a replacement for taste. Every one of those terminal redesigns came from me looking at the screen and saying "no — less." The AI is fast at producing the next version; deciding *which* version is right is still the job. I also keep small notes in a memory file — "this user prefers minimal, non-decorative UI," "never take full-desktop screenshots" — so those preferences carry from one session to the next instead of being re-explained.

## What's next

An honest list, because I keep a running log of known issues:

- **Adding team members from the mobile app** isn't possible yet (web only).
- **Task cards** got review feedback that they read as bland — I'm going to push on the visual design without losing the density that makes them scannable.
- A **Redis-backed presence layer** for multi-instance deployments.
- **Production on Google Play**, then iOS (Liquid Glass tab bar and all).

## The takeaway

Software that tracks work shouldn't create more work. The best version of a tool like this fades into the background: you open it, you see what matters, you act, you leave.

LogBase isn't finished — nothing worth building ever is. But it's real, it runs on the web and on Android, and a team can live in it. If you're a solo builder wondering whether you can ship a multi-platform product on your own in 2026: you can. Keep the model simple, share your types, make everything feel instant, and be ruthless about removing effects that don't say anything.

*If you'd like to try LogBase or join the Android closed test, reach out — I'd love your feedback.*

---

*Tags: Software Development · React Native · Next.js · NestJS · Indie Hacking · Productivity*
