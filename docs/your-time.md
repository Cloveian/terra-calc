# Your time

*Plan for the "Your time" part of [feature-ideas.md](feature-ideas.md) (drafted with Claude, 23 Oct): the plan starts from the hours you actually have, not the hours it would like you to have. The route side's in (step 1), nothing on screen yet, the Decision lines are open.*

## Why

Right now the route finds the lowest *flat* h/week that reaches the goal, `hoursNeeded` tries cap 10, 11, ... 45 and every week gets the same one. That's fine for "how hard is this goal", but nobody's weeks look like that. Finals week is 10 h, a long weekend is 40, and the card asking for 31 h when you've got 20 is just a sad number. The plan should take the hours you'll give and say what they get you.

## What you set

| Decision | What it does |
| --- | --- |
| Per week or per day | **Decision:** a number per week first, days later, or per day from the start? Default: per week first. The week's the unit everything plans in (seeds die Monday, rent's weekly), days only change the card's "h a day", which splits evenly over the days left for now |
| Blank weeks | A week you didn't set is "whatever it takes", the search fills those in with the lowest flat cap that still reaches the goal, like now. So setting nothing gives exactly today's plan |
| All set | Nothing left to search, the route just runs your hours and says where you end up ("What can I get", below) |
| Under 10 h | A main week under 10 h can't pay rent and the route already stops there (`out: true`). The box warns instead of letting you type 6 and quietly ending the plan in Week 5 |

## Where you set it

- **Site:** a box per week in the week table's hours column, saved in the link like everything else (feature-ideas, last item)
- **Userscript:** Terra's own calendar. Its week page has 7 day boxes (`._dayBox_` with `._dayName_`, `._dayNumber_`, and `._dayNote_` for "rent due" / "week ends"), so per-week goes under the week title and per-day, once it's in, goes in each box

| Decision | What it does |
| --- | --- |
| Userscript home | **Decision:** the calendar's week page, or a row of boxes in our settings section? Default: the calendar, it's where Terra already shows your weeks, and the settings one would be 12 boxes in a tiny tab |
| Keys | The box `stopPropagation`s keys like the tree tag's priority box does, or typing 2 walks you somewhere |

## What the plan does with it

- ~~`simulateRoute(state, t, cap, m, thisWeek)` takes `cap` as a number or `{ week: hours }`~~ `simulateRoute(state, t, cap, m, thisWeek, given)` takes `given = { week: hours }` (week index `t`) for the weeks you set, falling back to the flat `cap` for the rest. A separate argument, so `cap` stays one thing. One loop, the per-week lookup is the only change. **Done 23 Oct**
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

| Decision | What it does |
| --- | --- |
| Suggested hours | **Decision:** what goes in a blank box as the suggestion, the last 4 weeks' median, the average, or nothing till you've done 3 weeks? Default: median of the last 4 (one dead week doesn't drag it), shown faded so it's clearly a guess and doesn't count as set |
| AI time | Terra's number already counts AI time at a third, so history's in Terra hours, same as water. Nothing to convert, as long as `hoursSeconds` is the credited number (the capture'll say) |

## Data

- userscript, saved per account like the goal: `hours: { "2026-W44": 20, "2026-W45": 10 }`, keyed by the same `weekKey` `hours.update` sends. Days later as `days: { "2026-10-26": 4 }`, and a week with days set is just their sum
- site: one more hash key, the 12 weeks in order with blanks, so a link with no hours is the same link as today

## Order to build it

1. `given` weeks in `simulateRoute` and the blank-weeks search in `hoursNeeded`, tests (old ones pass unchanged, that's the point of blank = flat). **Done**
2. site: the box per week in the table, the hash key, "needs X, you've got Y"
3. userscript: saved hours, the goal line, the code step capped, What can I get on the tags
4. the boxes on Terra's calendar
5. history from `week-track` (needs that capture first), then the suggestions

Days and the risk stuff in "Buying with risk" come after all that, they both want real hours to stand on.
