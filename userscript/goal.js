// my goal (site state fields) checked against live trees from /device-upgrades
import { clean, formatSelection } from "../src/state.js";
import { goalCost, buyOrder, prioFrom } from "../src/tree.js";

// null till trees are in. nodes terra renamed or dropped get cut n turn into problems
export function cleanGoal(saved, trees, owned) {
    if (!trees || !owned) return null;
    const problems = [];
    let device = saved?.device ?? owned.device;
    if (!(device in trees)) {
        problems.push(`there's no ${device} in Terra anymore, so your goal's gone`);
        device = owned.device;
        saved = null;
    }
    if (!(device in trees)) return null;
    // other device = nothing owned there, switching refunds it all
    // todo: refund coins in plan (select-device sends them back)
    const own = device === owned.device ? owned.own : {};
    const raw = {
        device,
        own: formatSelection(own),
        want: formatSelection(saved?.want ?? {}),
        first: (saved?.first ?? []).join(","),
    };
    if (saved?.goal != null) raw.goal = String(saved.goal);
    const { state, problems: cleaned } = clean(raw, null, trees);
    return {
        goal: { device, want: state.want, goal: state.goal, first: state.first },
        own: state.own,
        problems: [...problems, ...cleaned],
    };
}

// coins still needed past what i own, null = rent week
export function goalCoins(goal, trees, own) {
    if (!goal) return null;
    if (goal.goal !== null) return goal.goal;
    const total = goalCost(trees[goal.device], goal.want, own);
    return total > 0 ? total : null;
}

// picks in buy order for milestones, none with a custom coin goal
export function goalItems(goal, trees, own) {
    if (!goal || goal.goal !== null) return [];
    return buyOrder(trees[goal.device], goal.want, own, prioFrom(goal.first));
}
