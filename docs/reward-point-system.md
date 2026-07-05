# BOND Rewards and Points System

# 1. Why a Separate Points System

Activity points and reward levels are two different things, and keeping them separate makes the whole system easier to tune. Activity points measure how much real effort a family puts in. Reward levels are the payoff tiers built on top of those points. Splitting them lets us adjust one without breaking the other, for example changing how many points a walk in the park earns without having to redesign the reward tiers themselves.

---

## 2. Activity Points

Not all activities are worth the same. Free, casual activities are effortless and can happen every day, so they earn few points. Marketplace activities already generate real commission for BOND, so they can earn more points without being a giveaway.

| Activity type | Examples | Points | Condition |
| --- | --- | --- | --- |
| Casual / free | Walking in the park, baking cookies, stargazing, casual football | 3 pts | Minimum 30 minutes, selected via a duration dropdown when uploading photo proof |
| Dedicated / intentional | Board game night, cooking project together, bike outing | 6 pts | None |
| Marketplace (paid) | Pottery, sports class, museum | 15 pts | None |
| Community challenge bonus | Any featured monthly activity | +5 pts extra | Stacks on top of the base activity points |

**Why the 30-minute gate exists**: without it, a two-minute activity earns the same points as a real one, which lets families farm free points with almost no effort. The gate is enforced simply, through a duration selector at the moment of photo upload, no extra verification burden.

**Verification**: photo proof, validated by AI, no children's faces shown to protect privacy, processed on EU servers for GDPR compliance.

---

## 3. Reward Levels

Points accumulate toward four reward levels. Each level unlocks a specific, real reward, not just more points.

| Level | Points | Reward |
| --- | --- | --- |
| 1 | 50 pts | Free BOND marketplace activity credit |
| 2 | 100 pts | Cinema tickets |
| 3 | 150 pts | Choice of supermarket voucher or Disney+/Netflix month |
| 4 | 250 pts | LEGO set or music/ceramics class |

**Level 3 offers a choice** rather than a fixed reward, which mirrors how real loyalty programs work and makes the reward feel earned rather than assigned.

**Level 4 is capped at 3 redemptions per family per year.** Without this cap, the most engaged families could redeem the top reward every quarter, which breaks the reward budget (see Section 5). The cap keeps the top tier meaningfully aspirational while protecting the economics.

---

## 4. Quarterly Reset

Points reset every quarter. Nothing carries over from one quarter to the next.

**Why**: without a reset, points accumulate indefinitely, and the reward budget becomes impossible to predict or plan for. A quarterly reset keeps engagement fresh (families have a reason to stay active every quarter, not just once) and keeps the cost of rewards spread evenly across the year rather than concentrated at unpredictable moments.

---

## 5. Budget Modeling: Why the Numbers Above Are Set Where They Are

Not every family engages at the same level. To size the rewards budget correctly, families are modeled in three engagement segments. This is a working assumption, to be validated against real pilot data, not a guarantee.

**Modeled for a Kita of 20 children:**

| Segment | Share of families | # families | Level reached | Real cost per family, per year |
| --- | --- | --- | --- | --- |
| Super-active | 30% | 6 | Level 4 (capped at 3x/year) | ~162 EUR |
| Moderate | 30% | 6 | Level 2 (cinema) | ~24 EUR |
| Low / occasional | 40% | 8 | Level 1 or below | ~4 EUR |

**Total modeled reward cost: ~1,150 EUR per year for a 20-child Kita.**

This number reflects two corrections applied after the first draft of this model:

- The 3x/year cap on Level 4 redemptions (down from an uncapped scenario of ~220 EUR per super-active family per year).
- An assumed 15 percent improvement in bulk-buy margin on the higher-tier rewards, achieved through better volume negotiation with suppliers.

**Why this matters for institutional pricing**: this cost model is the direct reason the rewards budget needs to sit at roughly 35 percent of the annual license fee, not the 20 percent originally assumed before real usage patterns were modeled. This is what pushed the Kita package from an earlier 2,000 EUR estimate up to 3,200 EUR (public tier). See the main Business Model document for full institutional pricing.

**The model only holds if the 30 percent super-active assumption holds.** If a pilot shows a higher share of families reaching Level 4, either the reserved rewards percentage needs to increase further, or the point thresholds need to be recalibrated upward so fewer families reach the top tier within a single quarter.

---

## 6. The 5 Rewards

| Reward | For | Why it fits |
| --- | --- | --- |
| Cinema tickets (2, family pair) | Parent and child together | Classic bulk-buy, easiest to explain |
| Free BOND marketplace activity credit (1 session, e.g. pottery or sports) | Parent and child together | Reinforces BOND's own product loop, already negotiated with marketplace partners, no extra procurement needed |
| Disney+ or Netflix, 1-month voucher | Parent and child together | Simple bulk-buy, appeals to the household. Parents and children can watch movies together |
| Supermarket voucher (REWE, 20 to 30 EUR) | Parent | Practical, eases daily mental load |
| LEGO set or single music/ceramics class | Child | Directly motivates the child to want the shared activity. PArent + Child can build the Lego |

**Babysitting** was considered and dropped from this list. Munich market rates run 15.50 to 20 EUR per hour, the highest in Germany, and babysitting is a personal service, not inventory, so it cannot be bulk-negotiated the way tickets or vouchers can. Sitly and Babysits are both active and well used in Germany, but run on a subscription model (parents pay to message sitters), not per-booking, which means a future partnership would mean bulk-buying subscriptions rather than negotiating hourly rates. Worth revisiting as a phase 2 partnership.

---

## 7. Open Questions to Validate

- Confirm the 30 percent super-active family assumption against real pilot data. This single number drives the entire reward budget.
- Confirm the 15 percent bulk-buy margin improvement is realistically achievable once supplier negotiations start.
- Test whether 3 redemptions per year feels fair to families at Level 4, or whether it needs adjusting once real usage data comes in.
- Explore the Sitly/Babysits B2B bulk-subscription partnership as a phase 2 reward.

# **Rewards and Points System -** TLDR Version

**How points are earned:**

- 3 pts: casual/free activity (walk, baking, stargazing) — needs 30+ min to count
- 6 pts: dedicated activity (board games, cooking, biking)
- 15 pts: paid marketplace activity (pottery, sports class)
- +5 pts: community challenge bonus

**Reward levels (reset every quarter, nothing carries over):**

- 50 pts → free BOND marketplace activity credit
- 100 pts → cinema tickets
- 150 pts → choice of supermarket voucher or Disney+/Netflix month
- 250 pts → LEGO set or music/ceramics class (capped at 3x per family per year)

**Why the cap and gate exist:** the 30-min minimum stops people farming points from 2-minute activities. The 3x/year cap on the top reward stops the most active families from breaking the budget every quarter.

**Budget reality check:** modeled on a 20-child Kita assuming 30% super-active families, 30% moderate, 40% low. Real cost comes out to ~1,150 EUR/year, which is why ~35% of the license fee needs to be reserved for rewards, not the original 20%.

**The 5 rewards:** cinema tickets, free BOND activity credit, Disney+/Netflix month, supermarket voucher, LEGO or music class. Babysitting was considered and dropped, since it can't be bulk-negotiated like the others.