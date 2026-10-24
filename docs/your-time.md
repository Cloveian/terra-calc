# Your time

*Plan for the "Your time" part of [feature-ideas.md](feature-ideas.md) (drafted with Claude, 23 Oct): the plan starts from the hours you actually have, not the hours it would like you to have. Steps 1 to 5 are in (the route, the site's week boxes, the per-day model, the userscript, the calendar boxes), step 6's started (the hours log and predict.js, waiting on data). The calendar boxes haven't been tried in the real game yet. Per day and the calendar got decided 23 Oct, the rest of the Decision lines are open.*

## Why

Right now the route finds the lowest *flat* h/week that reaches the goal, `hoursNeeded` tries cap 10, 11, ... 45 and every week gets the same one. That's fine for "how hard is this goal", but nobody's weeks look like that. Finals week is 10 h, a long weekend is 40, and the card asking for 31 h when you've got 20 is just a sad number. The plan should take the hours you'll give and say what they get you.

## What you set

| Decision | What it does |
| --- | --- |
| Per week or per day | **Decided (23 Oct):** per day from the start, projected but overrideable. Each day shows what it's projected at, faded, and typing a number fixes that day. See "Days" below for how a week adds up |
| Blank weeks | A week you didn't set is "whatever it takes", the search fills those in with the lowest flat cap that still reaches the goal, like now. So setting nothing gives exactly today's plan |
| All set | Nothing left to search, the route just runs your hours and says where you end up ("What can I get", below) |
| Under 10 h | A main week under 10 h can't pay rent and the route already stops there (`out: true`). The box warns instead of letting you type 6 and quietly ending the plan in Week 5 |

## Days

What i'd build for "projected but overrideable" (my default, not decided yet):

- a day i type is fixed, the days i didn't touch are open, and each open day gets its share of the flat cap (1/7 till it knows my weeks), so a week = fixed hours + open days \* cap / 7
- none set = 7 open = exactly the cap, same as now. All 7 set = a fully fixed week, the cap doesn't touch it
- this week: days already gone count what i actually coded (the hours log), the open ones are the days left at their share of the cap. That's *not* the card's "h a day": the card splits what's still needed for this week's target over the days left, so falling behind pushes its h a day up, while the route's open days just run at the pace it's searching for. Different questions, both fine. With today typed in the calendar the card just says that
- the site's week boxes are the same thing with all 7 fixed at once, so the route only knows one shape: `given = { week: { fixed, open } }`, hours = round(fixed + open \* cap / 7)
- open days follow how my weeks actually go (no school on saturday, whatever): each weekday gets its share of the week, its typical hours over the whole week's (`weekShape`), off Hackatime with a key or the hours log without one. Even split till every weekday has 3 clean days. `open` counts days in those shares, 7 \* share each, so even is the plain day count and the math in `weekHours` didn't have to change at all. The faded number on a day is cap \* its share. A weekday i never code on gets 0 and stays 0 till i type something (my default too, not decided)

## Where you set it

- **Site:** a box per week in the week table's hours column, saved in the link like everything else (feature-ideas, last item)
- **Userscript:** Terra's own calendar. Its week page has 7 day boxes (`._dayBox_` with `._dayName_`, `._dayNumber_`, and `._dayNote_` for "rent due" / "week ends"), so per-week goes under the week title and per-day, once it's in, goes in each box

| Decision | What it does |
| --- | --- |
| Userscript home | **Decided (23 Oct):** Terra's calendar, a box in each of the week page's 7 day boxes |
| Keys | The box `stopPropagation`s keys like the tree tag's priority box does, or typing 2 walks you somewhere |

## What the plan does with it

- ~~`simulateRoute(state, t, cap, m, thisWeek)` takes `cap` as a number or `{ week: hours }`~~ `simulateRoute(state, t, cap, m, thisWeek, given)` takes `given = ~~{ week: hours }~~ { week: { fixed, open } }` (week index `t`) for the weeks you set, falling back to the flat `cap` for the rest. A separate argument, so `cap` stays one thing. One loop, the per-week lookup is the only change. **Done 23 Oct**
- `hoursNeeded` searches the flat cap over the blank weeks only. With every week set it's one route run and `cap` comes back `null` (the site can't print "null h/week", so it says something else). **Done 23 Oct**
- **What can I get:** when your hours don't reach the goal, plan at your hours and walk `milestones` down your priority list, everything that's covered by Week 12 is in, the bottom falls off. Same "bottom falls off" rule as [this-week.md](this-week.md), it just finally has a reason to happen
- **Both numbers when it doesn't fit:** "needs 31 h a week, you've got 20", on the card's goal line and the site's result
- **The tags:** picks that don't fit get marked on the tree tags and in the site's milestone list (greyed, "not with your hours")
- **The code step** never asks for more than you set for this week. If the plan needs more it says so on the goal line, not by quietly bumping the step

## History

Terra already keeps it. The calendar loads `GET /ysws/week-track` every time it opens, and this is what the 9 Oct game JS reads off it:

```js
{ rows: [{ startsAt, endsAt, state, hoursSeconds, projectTitle, shipped, approved, rentDueAt, ... }], onTrack, debtOut }
```

- `state` is one of `done`, `missed`, `excused`, `skipped`, `review`, `prejoin`, `active` (the month grid's `state_*` classes), `onTrack` / `debtOut` are the "off track for the laptop" notice
- `hoursSeconds` is the week page's "39h 33m logged", so that's the history. No real numbers yet tho, none of my captures have the calendar open (todo, open it with the HAR running). The 22 Oct GameCanvas still loads `week-track` and reads `rows`, `onTrack` and `debtOut` the same way (that dump's base64, decode it before grepping)
- this week's credited time is already in `hours.update` (`week.creditedSeconds`, and `goalSeconds` is Terra's own 10 h)
- Hackatime, with my API key (from hackatime.hackclub.com/api-key): `GET https://hackatime.hackclub.com/api/hackatime/v1/users/current/summaries?start=&end=&timezone=America/New_York` with `Authorization: Bearer <key>`, one row per day (`range.date`, `grand_total.total_seconds`), empty days in too. CORS lets the Authorization header through, a fake key from another site gets a clean 401. AI time isn't split per day there (Terra counts it a third), `/api/v1/users/my/stats?...&filter_by_category=ai coding` gives it per range, so per day would be a call a day. Doesn't matter for the week's shape, that's only ratios (all from the hackatime repo, read 23 Oct)

| Decision | What it does |
| --- | --- |
| Suggested hours | **Decision:** what goes in a blank box as the suggestion, the last 4 weeks' median, the average, or nothing till you've done 3 weeks? Default: median of the last 4 (one dead week doesn't drag it), shown faded so it's clearly a guess and doesn't count as set |
| Hackatime key | **Decided (24 Oct):** in Terra's localStorage like the rest of ours, its own per-account entry, never in the settings object (that goes to the debug log). Nobody loses money if it gets stolen and most people have it in plaintext in their wakatime config anyway. `GM_setValue` would've needed a `@grant`, a sandbox and `unsafeWindow` for the socket hook |
| AI time | Terra's number already counts AI time at a third, so history's in Terra hours, same as water. Nothing to convert, as long as `hoursSeconds` is the credited number (the capture'll say) |

## Data

- userscript, saved per account like the goal: ~~`hours: { "2026-W44": 20 }`, keyed by `weekKey`~~ `days: { "2026-10-26": 4 }`, only the days i typed, Eastern days like Terra's. Each week's `{ fixed, open }` comes from those
- site: one more hash key, ~~the 12 weeks in order with blanks~~ only the weeks you set as week index:hours (`hours=5:20,6:10`), so a link with no hours is the same link as today

## Order to build it

1. `given` weeks in `simulateRoute` and the blank-weeks search in `hoursNeeded`, tests (old ones pass unchanged, that's the point of blank = flat). **Done**
2. site: the box per week in the table, the hash key, "needs X, you've got Y". **Done**. "A flat 27 h/week would get there" when my weeks come up short, all set or some, and the milestone list's red group says "not with your hours"
3. `given` as `{ fixed, open }` in the route (the "Days" model), the site's week boxes moved onto it. **Done** (`weekHours` in route.js)
4. userscript: saved days, each week's `{ fixed, open }`, the goal line, the code step capped, What can I get on the tags. **Done** minus a way to type days, that was `terraCalc.day("2026-10-26", 4)` in the console till the calendar boxes. This week only goes by days once i typed one in it, so nothing typed = the old card. The goal line says "not on my days, a flat 31 h/week would do it", the code step follows this week's days, and the tags say "doesn't fit" like before
5. the day boxes on Terra's calendar. **Done**, untested in the real game: `calendar.js` finds the week page by its css module, gets monday off the range text ("Oct 12 - Oct 18"), and puts a box in each `._dayBox_` from today on
6. history: the hours log (running since 23 Oct), `week-track` (needs that capture first), the optional Hackatime key, then the per-day predictions. **Mostly done:** `dayHours` (a day = its snapshot minus the day before, gaps flagged `lumped`), `typicalDays` (median of the clean ones per weekday, needs 3 of a weekday) and `weekShape` in predict.js, the Hackatime key in our settings (`hackatime.js`, 8 weeks of days, fetched at most once an hour), and the open days + faded calendar numbers following the shape. Gone days on the calendar say what i coded ("3h 12m"). Off the log that's as of the last time Terra Calc saw that day, so coding after i closed Terra lands on the next day (Hackatime doesn't have that problem), and days after a gap stay blank. Not tried with a real key yet, a fake one gets a clean 401 so CORS is fine. `week-track` still waits on the capture

The risk stuff in "Buying with risk" and "Waiting for a better seed" comes after all that, it wants real hours to stand on.
