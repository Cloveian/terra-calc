# Terra's requests

What the game sends and gets back, for the userscript. From the HAR captures (9 and 14 Oct) and the game's JS saved on 9 Oct (build `9ba8a7125ac0f415`), so check it against a fresh capture before relying on it. Nothing here is a public API: it can change with any update.

The 19 Oct capture only has inline images in it, and Firefox doesn't save websocket messages in HARs, so everything about the websocket comes from reading the JS.

## Two ways in

| | REST | Game websocket |
|-|-|-|
| Host | `https://api.terra.hackclub.com` | `wss://game.terra.hackclub.com` (Colyseus) |
| Used for | device tree, upgrade buying, week, projects, hours, mail, friends | coins, inventory, seed shop, plots, farm, selling crops, rent |
| Auth | `Authorization: Bearer <token>` | token in the matchmake body |

The token is in `localStorage.terra_auth_token` on `terra.hackclub.com`. The game's own fetch helper (`api-*.js`) is just:

```js
fetch("https://api.terra.hackclub.com" + path, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("terra_auth_token")}` },
});
// not ok -> throws with the body's `error` field as the message
```

So a userscript running on `terra.hackclub.com` can make the same calls with the same token, and CORS already allows that origin.

`GET https://terra.hackclub.com/version.json` -> `{ "buildId": "9ba8a7125ac0f415" }`. The game polls it. It's the cheapest way to notice a Terra update ("Terra changed, Terra Calc might need an update").

## REST

### Device upgrades

**`GET /device-upgrades`**: every device tree, what you own, your coins.

```jsonc
{
  "devices": [{
    "id": "framework_12", "title": "Framework 12", "description": "...", "category": "Laptop",
    "root": { "x": -20, "y": 180 },
    "nodes": [{
      "id": "ram_12", "title": "+8GB RAM", "description": "...",
      "price": 750,                      // first tier's price when there are tiers
      "direction": "right-1",            // how the tree draws the link, not needed
      "requires": ["framework_12_diy"],  // missing = hangs off the device
      "maxPurchases": null,              // only on some nodes; null = no limit
      "dynamicMaxPurchases": { "baseNodeId": "expansion_card_12", "plus": 4 }, // limit = plus + owned(base)
      "tiers": [                         // only on tiered nodes; one entry per buy
        { "title": "+8GB RAM",  "description": "... (16GB total)", "price": 750 },
        { "title": "+16GB RAM", "description": "... (32GB total)", "price": 1300 },
        { "title": "+16GB RAM", "description": "... (48GB total)", "price": 2100 }
      ],
      "x": -315, "y": -170
    }]
  }],
  "mainDevice": "framework_12",
  "owned": {},        // { nodeId: count }
  "purchases": [],    // { id, nodeId, nodeTitle, status: "purchased" | ..., ... }, needed for refunds
  "coins": 4,
  "address": { "linked": true, "country": "US", "supportedRegion": true }
}
```

This has everything `TREES` in `data.js` holds (ids, names, prices, tiers, requires, limits, x/y), so the userscript can build the trees from it rather than having them hardcoded. The `limit: { base, per }` in `data.js` is `dynamicMaxPurchases`, and the `(16GB total)` part of each tier description is where `totals` comes from.

**`POST /device-upgrades/purchase`** `{ "nodeId": "ram_12" }` -> the same shape as `GET /device-upgrades`, updated. Buys the next tier of that node.

**`POST /device-upgrades/purchases/{purchaseId}/refund`** (no body) -> same shape plus `"refunded": <coins>`. `purchaseId` is the `id` of the entry in `purchases`.

**`POST /device-upgrades/select-device`** `{ "deviceId": "ipad_mini" }` -> same shape plus `"refunded": <coins>`. Switching device refunds what you bought on the old one.

### Week

**`GET /ysws/current-week`**

```json
{ "number": 7, "label": "Prep Week 2", "rentRequired": false,
  "startDate": "2026-10-05T04:00:00.000Z", "endDate": "2026-10-12T03:59:59.999Z" }
```

`number` is Terra's own count (Prep 2 = 7. If they're numbered in order, Prep 3 = 8 and Week 1 = 9, not checked). `rentRequired` says if it's a main week. Better than working the week out from the date in `week.js`.

### Projects and hours

**`GET /ysws/projects`** -> a list of your projects:

```jsonc
[{
  "id": "<uuid>", "title": "Terra Calc", "description": "...",
  "parentProjectId": null, "isUpdate": false,  // a continued project points at last week's
  "hackatimeProjectName": "terra-calc",
  "weekNumber": 7,
  "programWeek": { "weekKey": "2026-W41", "weekNumber": 7, "label": "Prep Week 2",
                   "startDate": "2026-10-05", "endDate": "2026-10-11" },
  "devlogCount": 0,
  "codeUrl": null, "demoUrl": null, "repoFullName": null, "screenshotUrl": "...",
  "madeWith": [], "createdAt": "...", "updatedAt": "...", "deletedAt": null
}]
```

**`GET /ysws/projects/{id}/reward-estimate`**: how much water this project's time is worth right now:

```json
{ "water": 3.833,
  "time": { "totalSeconds": 13818, "aiSeconds": 28, "aiCreditedSeconds": 9, "creditedSeconds": 13799 },
  "totals": { "water": 0 } }
```

`water` = `creditedSeconds / 3600` here. AI time only partly counts (28 s of AI time credited as 9 s).

**`GET /ysws/projects/{id}/time`** -> `{ "totalSeconds": 13799, "time": { ...same as above... }, "linked": true }`. The JS can add a query string here, not captured.

**`GET /ysws/hackatime/projects`** -> `[{ "name": "terra-calc", "totalSeconds": 13818, "aiSeconds": 28, "languages": ["CSS", ...] }]`

Others the JS calls, shapes not captured: `GET|POST /ysws/projects/{id}/devlogs`, `GET /ysws/projects/{id}/shipments`, `/ship`, `/ship-check`, `/commits`, `/suggest-hackatime`, `GET /ysws/week-track`.

### Everything else seen

| Request | Response |
|-|-|
| `GET /auth/me` | `{ user: { id, username, displayName, roles, yswsEligible, verificationStatus, githubLinked, hackatimeLinked, addressLinked, ... } }` |
| `GET /ysws/services/status` | `{ github: { linked, login }, hackatime: { linked, username, hasApiKey } }` |
| `GET /ysws/rent-debt-notice` | `{ notice: null }` (a notice when you owe rent, shape unknown) |
| `GET /ysws/vote/quota` | `{ owed, cast, remaining }` |
| `GET /mail/unread` | `{ count }` |
| `GET /friends` | `{ accepted: [{ friendshipId, userId, username, displayName }], pendingIncoming, pendingOutgoing }` |
| `GET /referrals/me` | `{ referralCode, shareUrl, counts, milestones: [{ type, threshold, coins, accessory..., achieved, claimed }], referred }` |

`/auth/me` and `/auth/address` return personal data (email, home address). The userscript has no reason to call them.

## Game websocket

Colyseus. The game joins with:

**`POST https://game.terra.hackclub.com/matchmake/joinOrCreate/world`**

```jsonc
// request
{ "token": "<auth token>", "levelId": "town-square", "fromSessionId": "<last session>", "protocol": 1,
  // also, when used: spawnTag, spawnPosition, farmOwnerId, roomId + friendJoin
}
// response
{ "name": "world", "sessionId": "...", "roomId": "MiwHp3ezL", "processId": "tWfQfjPgj" }
```

then opens `wss://game.terra.hackclub.com/{processId}/{roomId}?sessionId=...` (plus `reconnectionToken` when reconnecting). Messages are `room.send(type, payload)` out and `room.onMessage(type, handler)` in.

**Only one session at a time.** The game handles `sessionConflict`, `sessionKicked`, `forceTakeover` and `cancelTakeover`, so a second connection from the userscript would most likely kick the game's own one. The userscript should use the game's connection (wrap `WebSocket` at `document-start` to read what comes in), not open its own.

### Coins, water, inventory

| In | Payload (fields the game reads) |
|-|-|
| `player.currency` | `{ coins, weekWater` (or `water`)`, graceWater, graceEndsAt }` |
| `inventory.sync` | `{ items: [{ id, itemId, name, flavorText, type, subtype, rarity, quantity, stackable, sprite, weekNumber, weekLabel, usableUntil }], usableWeeks: [weekNumber...], grantedItemIds }` |
| `hours.update` | not read yet |

Ask for them again with `currency.request {}`, `inventory.request {}` and `hud.request {}`.

The game hides `inventory.sync` items whose `weekNumber` isn't in `usableWeeks`. That's how seeds expire. Seeds, plots and crops should all be in `items`, but the `type`/`subtype` values for each aren't known yet. A capture with the inventory open would show them.

### Heidi's shop (seeds, water, plots)

1. `npc.openShop { npcId, nodeId }` (from Heidi's dialogue)
2. In: `shop.stock`:
   ```jsonc
   { "status": "available",           // anything else = "Heidi's shop isn't available right now"
     "dateKey": "...",                   // stock refreshes every night at 00:00 EDT
     "entries": [{ "id": "<stock entry id>", "name": "Apple Seed", "category": "bonus_seeds",
                   "priceCoins": 5, "quantity": 1, "description": "...", "note": "...", "sprite": "..." }] }
   ```
   `category` is one of `bonus_seeds`, `water`, `dirt_plots`, `decorations`, `prizes` (the three tabs: Seeds / Water and plots / Decor and prizes).
3. `shop.purchase { stockEntryId, requestId: crypto.randomUUID(), expectedPriceCoins }`. The game resends the same `requestId` every 5 s until it gets an answer, so reusing an id can't buy twice.
4. In: `shop.purchaseResult { requestId, status, entry, priceCoins }`. `status` is one of:
   - `purchased`
   - `already_purchased` (that `requestId` already went through)
   - `insufficient_funds`
   - `inventory_full`
   - `price_changed` (comes with the new `priceCoins`, and stock is refreshed)
5. `shop.requestStock {}` refreshes (the game sends it every 30 s while the shop is open), `shop.close {}` closes it.

Stock entry ids off the 22 Oct Chrome HARs (decoded with our own `decodeFrame`): the regulars have plain ones that stayed put from 19 to 22 Oct, `apple` (5), `water` (50), `dirt` (10, the next plot's price), `sapling` (10). Bonus seeds and prizes are `admin-<uuid>` ones, eggplant `admin-341c3621-b2e5-4d90-8a2b-ae9dd9f1486d` (15), bok choy `admin-93b925df-8503-4761-94c7-f1abaa82ce76` (10), blahaj `admin-3d7070bc-5ecd-43aa-bff0-c56546d558b5` (400), drawing tablet `admin-072036ad-e7fd-4bae-be7c-2a8a85908ef8` (575). The egplant HAR has a real buy, `purchased` for the eggplant entry. The game's own `shop.purchase` goes out in msgpackr's records encoding (our decoder sees extension type 114, not a map), but the server reads plain msgpack fine, a `terraCalc.buy` from the console (24 Oct) got a `shop.purchaseResult` back. That one was the eggplant id on a cabbage-only day, so an id that isn't in today's stock gets a status the shop doesn't name, and it shows "I couldn't complete that purchase. Please try again." (its catch-all past the 5 above). The status itself is in the debug log's `in shop.purchaseResult` line next time.

Before a purchase the game asks first with its ConfirmDialog, titled "Buy this?", with the message "Buy {name} for {priceCoins} coins? You'll have N left." and the buttons "Not yet" / "Buy". It skips asking when your coins are under the price, sends `shop.purchase` anyway and gets `insufficient_funds`. Going by the code that also leaves its "buying right now" flag stuck (it only resets after the dialog), so every Buy after that does nothing till you reopen the shop. Not seen in the game yet.

`shop.purchase` buys **one** entry. Buying 25 seeds means 25 purchases, one after another, each with its own `requestId`. `expectedPriceCoins` matters for plots: they get dearer with each one, so a stale price comes back as `price_changed` rather than charging more.

The shop is opened from Heidi's dialogue (`npcId` + `nodeId`), so the server might only take `shop.purchase` while you're talking to her. Not tested.

On the client the shop window only opens one way: the dialogue's `seed_menu` choice sets a plain closure flag and sends `npc.openShop`, and the `shop.stock` that comes back opens it. No window event or hook gets to that flag, so a script can't open Heidi's window, sending `npc.openShop` itself doesn't either. A `shop.stock` that comes in while the shop's closed and no `seed_menu` is pending is ignored completely (no window, no "isn't available" toast), so a script can send `shop.requestStock {}` and read the reply quietly, if the server answers it away from Heidi (untested). `room.onMessage` stacks handlers, so ours can sit next to the game's.

Heidi's in `town-square`, about x -2.9, z -7.2 (off `state.npcs`). My island has no NPCs at all, the SHOP sign there is just scenery. Her dialogue only opens off the engine's own "nearest NPC in range", worked out every frame from where i'm standing, so the honest way to her shop from anywhere is walking me there (fake held keys, see Getting to the hub) and F to talk.

### Window events the game listens for

`window.dispatchEvent(new CustomEvent(name, { detail }))` from anywhere:

| Event | What it does |
|-|-|
| `open_device_upgrades` | the device tree |
| `open_projects_panel` | the side panel, on the inventory tab (despite the name) |
| `open_devlog_terminal` | the devlog terminal |
| `open_battle_dome` | the battle dome |
| `open_referrals` | the referrals panel |
| `visit_farm` | travels to `detail.userId`'s farm, your own with no `userId`. Closes whatever's open first (dialogue, panels, the shop) |
| `join_friend` | sends `friend.join { userId }` with `detail.userId` |

The `open_*` ones close any dialogue first. `open_encyclopedia` gets fired by the game but nothing listens for it.

### Getting to the hub

The hub is the level `town-square` (the room's still called `world`). Nothing sends you there from outside the game. Each level's JSON has `exitZones`, and the farm island's is `{"id":"farm_exit_town","x":-7.4042,"z":0.8543,"width":2,"depth":2,"targetLevelId":"town-square","targetSpawnTag":"Island return"}`, by the dock. The renderer checks your position against them every frame and walking into one does `transitionToLevel(level, spawnTag)`, which is a fresh matchmake (`joinOrCreate("world", { token, levelId, spawnTag, farmOwnerId, fromSessionId })`) and then leaving the old room, no `room.send` at all. `visit_farm` is the same join with `farm-island`, `dock` and a `farmOwnerId`. The renderer and network client aren't on `window` anywhere.

On load the game joins `localStorage.lastLevelId || "town-square"`, and nothing at unload overwrites it, but setting it to `town-square` and reloading still puts you back on your island. Prolly the server keeps your level and redirects you, the client's error text for that is "Failed to join saved world".

What does work from outside: the server's `redirectToLevel { levelId, spawnTag, spawnPosition?, farmOwnerId? }` message. The game's handler loads the level's assets, sets `lastLevelId`, and does the same `joinLevel` as the dock, inside its travel transition. It also gives up if it gets sent to one level more than 5 times in 10 s ("loop detected"). A frame dispatched on the game's own socket (`ws.dispatchEvent(new MessageEvent("message", { data }))`) reaches Colyseus's `onmessage` like a real one, so `redirectToLevel { levelId: "town-square", spawnTag: "Island return" }` ~~is the dock trip without walking there~~ sits on the loading screen forever in the real game. That handler uses `playRevealTransition`, which covers the screen straight away and then waits on the join, and it calls `Ha(room, assets, false)` where the dock's `afterLevelTransition` passes `true` for the 4th arg. My guess is it only really works on first load ("Joining saved world..."), when there's no level up yet.

The friends one gets further: `friend.joinRoom { roomId, levelId }` goes to `Na(roomId, levelId)`, which is the same `playTravelTransition` + `joinLevel` shape as `visit_farm`. With no `roomId` the join has no `friendJoin`, so it's a plain matchmake into any room of that level, with no spawn tag. In the real game (23 Oct) the join goes through, `joined room: q7yuxQp-z, level: town-square` and the hub's state arrives, and then the server sends `redirectToLevel { levelId: "farm-island", farmOwnerId: <mine> }` straight back, no error. The game shows that as "Couldn't join your friend, their room may be full" and you're home again.

So the server's the one deciding, not the client. ~~It's either the missing `spawnTag: "Island return"` or it checks where you were standing in the old room (`fromSessionId` points it there). Asked the dev, waiting on that.~~ The dev says it's the spawn tag: a join without one is taken as a reload / rejoin and goes to your last saved spot, the only time it isn't needed is standing on the exit zone. None of the client paths we can reach send it (`friend.joinRoom`'s `ha` passes `undefined`, `visit_farm` is always `farm-island` + `dock`, the dock's own `transitionToLevel` is on the renderer). But `joinLevel` is a Colyseus matchmake, an HTTP `POST /matchmake/joinOrCreate/world` with a JSON body, and the client grabs `globalThis.fetch` on its first request and keeps it. So the Hub button wraps `fetch` at document-start, arms itself, fires the fake `friend.joinRoom`, and adds `spawnTag: "Island return"` to that one matchmake (`travel.js`). Works in the real game, you stay in town. The way left if it had bounced was walking you onto the exit zone, and Heidi's shop still needs that, fake held keys: `this.keys` is a set of `e.code` from keydown / keyup, `moveLeft` / `moveRight` are x -1 / +1 and `moveUp` / `moveDown` z -1 / +1, plain world axes. Where you're standing is already in the room state we decode: `state.players` is a Map by session id (the socket url's `sessionId`), each with `x`, `z`, `velX`, `velZ`, `lastInputSeq`, `lastProcessedSeq` (checked on the 22 Oct HAR's town join). The seq pair means the server replays your inputs and corrects you, so faking `posX` / `posZ` in a `move` (`{ x, z, seq, posX, posZ, sprinting }`, the network client's `sendMove`) wouldn't stick anyway, walking it is.

### Selling crops (market)

1. Talking to the market NPC -> `market.request {}`
2. In: `market.items { items: [{ itemId, itemName, quantity, unitPriceCoins, baseUnitCoins, expiresAt, sprite }], locked: [{ quantity, itemName, weekLabel }] }`.
   - `unitPriceCoins` is after your multiplier, `baseUnitCoins` before it, so `unitPriceCoins / baseUnitCoins` is your multiplier for that crop.
   - `locked` lists crops held back for rent.
3. `npc.sellCrops { npcId, nodeId, selections: [{ itemId, quantity }] }`
4. In: `market.saleResult { totalCoins }`, or `market.notice { status }` with `status` one of `no_crops_to_sell`, `invalid_action`, `server_error`

### Farm, Ratticus and the rest

| Out | Payload |
|-|-|
| `farm.place` | `{ inventoryItemId }` (put a plot or decoration down) |
| `farm.interact` | `{ farmItemId }` (plant, water or harvest, depending on the plot) |
| `farm.pickup` | `{ farmItemId }` |
| `npc.claimWeeklySeeds` | `{ npcId, nodeId }` (Ratticus's 10 carrots) |
| `npc.turnInRent` | `{ npcId, nodeId }` |

| In | Payload |
|-|-|
| `farm.notice` | `{ message }` |
| `ratticus.seedResult` | `{ status: "claimed" \| "already_claimed", seedName, seedSprite, quantity, message }` |
| `ratticus.rentResult` | the rent receipt |
| `ratticus.notice` | `{ status }`: `already_paid`, `no_rent_due`, `awaiting_approval`, `insufficient_crops`, ... |
| `rentDebt.check` | no payload, makes the game call `GET /ysws/rent-debt-notice` |

`farm.interact` on a crop waters it all the way in one go, an eggplant takes both its water at once. `farm.place` puts the item down where i'm standing, seeds included, so planting stays by hand. The game only ever sends `farm.interact` for the crop i'm standing next to, whether the server takes one from across the farm is untested.

Plot and farm item shapes (what `farmItemId` points at, growth state) come through the room's synced state, not a message. They aren't in this file.

## Still to capture

- A HAR from Chrome or Edge with **Network -> WS -> messages** (Firefox doesn't save them), while opening the shop, buying a seed and a plot, selling crops and planting. That would show ~~the real `shop.stock` entries,~~ the seed and plot item `type`/`subtype`, and what `hours.update` and `farm.notice` send.
- Whether `shop.purchase` works without Heidi's dialogue being open.
- Fresh JS, since the files here are from 9 Oct.
