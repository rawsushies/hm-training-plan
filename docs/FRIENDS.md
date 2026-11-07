# Friends (v4, replaces groups)

Groups are retired: creating a group is denied by the rules. Existing group documents are **kept and not deleted**,
and nothing reads them any more.

## Flow

1. Search: each signed-in user who opens Teman publishes an opt-in `profiles/{uid}` (name, photo, SHA-256 of the lowercase email; never the address). Others find them by name prefix or exact email (max 10 results per query). The toggle "Orang lain bisa menemukanku" removes the profile. Legacy invite links still work.
2. *Tambah* creates `requests/{pair}`; the rules require the receiver to have a public profile and not to have blocked the sender.
3. A accepts → `friendships/{pair}` (`pair` = the two UIDs sorted and joined with `_`). Either side can remove or block.
4. Blocking writes `users/{uid}/blocks/{other}` and deletes the friendship, request and own share. The rules refuse new
   requests between blocked users.

## What is shared

**Nothing by default.** Each person picks per friend (`S.shareWith[friendUid]`, synced as private records):
weekly distance and total, sessions completed this week, personal bests, 7-day plan, HR-at-pace points, and specific activities (max 10).

`shares/{owner}_{viewer}` may contain only these fields (rules whitelist): `owner, viewer, name, photo, weekKm, weekDone,
weekPlanned, totalKm, pbs, activities, plan, hrPace, updatedAt`. Notes, check-ins, pain, reviews, routes/locations, settings
and sample data never leave the device (unit + e2e tests check the server document's exact keys).

- Only the viewer can read a share, and only while they are friends. After unfriending, the doc is unreadable even if it still exists.
  Each side also deletes its own share when the friendship disappears.
- A viewer may listen to a share doc before the owner first writes it; a missing doc addressed to them reads as "not found".

## Shared goals

`goals/{id}` = `{name, targetKm, targetDate, participants:[a,b], createdBy, status}`. Each participant writes only their own
`goals/{id}/contrib/{uid}` = `{km, runs}` counted from real (non-sample) runs since the goal was created.

## Pace check ("Cek pace bareng")

Uses each person's own logged runs with average HR at a similar pace (±20 s/km). It shows % of HRmax only when a measured HRmax
is set in the profile, and says so honestly when there is no data. It is effort guidance, not a medical judgement.

## Tests

- Rules: `test/rules/rules.test.js` (invites, requests, friendships, blocks, shares, goals).
- e2e: `test/e2e/app.test.js` *friends*: invite → request → accept, private by default, per-friend permissions with exact server keys,
  one-time link reuse refused, shared goal, revoke, block, share cleanup.

Remote push for new requests (FCM) is not implemented (needs the Blaze plan).
