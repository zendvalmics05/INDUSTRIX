INDUSTRIX — Game Balancing Reference

**INDUSTRIX**

**Game Balancing Reference**

*Every variable, formula, and configurable value in the game*

Production Engineering Department — Jadavpur University  |  Srijan 2026


# **1. How to use this document**
This document lists every number that affects how the game plays. Nothing is hardcoded in hidden places — every value described here lives in one central configuration file that the technical team can change before or between cycles. Your job is to decide whether the current numbers produce interesting, balanced gameplay and to propose adjustments where they do not.

The document is organised by game system, in the order a team experiences them each cycle:

- Procurement — buying raw materials
- Production — converting raw materials into finished components
- Sales & Market — assembling drones and selling them
- Labour — workforce management
- R&D — research and development
- Brand — reputation
- Leaderboard — how the winner is decided
- Backroom deals — corruption and government favours
- Market factions — who buys drones and at what price

|**KEY**|Numbers shown in bold inside formula boxes are the current values. Everything can be changed. Suggested ranges are guidelines, not hard limits.|
| :-: | :- |



|<p>**System 1: Procurement**</p><p>*Buying raw materials from suppliers*</p>|
| :-: |

Each cycle, teams order raw materials for each of the six drone components from a supplier. The quality of what arrives and how much it costs depends on the supplier's quality parameters, the chosen transport mode, and the distance to the supplier.

## **2.1 Quality grades**
Every raw material unit has a quality grade from 1 to 100. Grade 0 is the scrap bucket — unusable material. When the game simulates a shipment arriving, it draws grades from a bell curve (Normal distribution) centred on the supplier's quality mean, with spread determined by the supplier's sigma plus the transport mode's sigma addition.

|**Quality draw**|Each unit's grade ~ Normal(mean, sigma)   →   clipped to [0, 100]|
| :- | :- |

Grades below 1 are moved to the scrap bucket and cannot be used in production.

## **2.2 Supplier parameters**
These are set per supplier in the seed data before the game. Each supplier has:

|**Parameter**|**What it does**|**Current example**|**Suggested range**|
| :- | :- | :- | :- |
|quality\_mean|The average grade of material from this supplier. Higher = better quality arriving on average.|62\.0|40–80|
|quality\_sigma|How variable the quality is. Low sigma = very consistent. High sigma = wide spread of grades.|12\.0|5–20|
|base\_cost\_per\_unit|Material cost per unit ordered, before transport is added.|38\.0 CU|20–100 CU|
|distance\_km|Distance from the factory. Determines how much transport costs on top of material cost.|800 km|100–5000 km|
|min\_order|Minimum number of units per order.|10|1–100|
|max\_order|Maximum units per order.|5000|500–10000|

## **2.3 Transport modes**
Teams choose a transport mode for each order. The mode affects cost, quality variance, damage risk, and vulnerability to sabotage deals. The final transport cost uses a fixed booking fee plus a variable charge that scales with both distance and quantity.

|**Transport cost**|cost = base\_cost + (var\_cost × distance\_km × quantity)   ← then × event multiplier if active|
| :- | :- |
|**Total order cost**|total = (quantity × base\_cost\_per\_unit) + transport\_cost|

Current transport mode parameters:

|**Mode**|**Booking fee (base\_cost)**|**Per unit per km (var\_cost)**|**Quality sigma add**|**Mean reduction**|**Damage chance**|**Sabotage vulnerability**|
| :- | :- | :- | :- | :- | :- | :- |
|Air|20,000 CU|160 CU|+0.0|-0.00|0%|0\.00 (immune)|
|Rail|4,000 CU|60 CU|+3.5|-0.50|7%|0\.80|
|Road|1,000 CU|100 CU|+6.0|-1.50|14%|1\.00 (full)|
|Water|8,000 CU|20 CU|+7.0|-2.5.00|18%|0\.50|

|**BALANCE NOTE**|Air is currently immune to both damage and sabotage and adds zero quality variance, making it a pure security premium. The booking fee of 30,000 CU makes it prohibitive for small orders. Water has the lowest variable cost per km but adds the most quality variance and quality mean reduction — best for large distant orders where quality consistency is sacrificed for cost.|
| :-: | :- |

## **2.4 Partial damage event**
When a partial damage event fires (determined by the transport mode's damage chance), a fraction of the shipment is degraded:

|**Units damaged**|damaged\_units = total\_units × PARTIAL\_DAMAGE\_FRACTION   (currently 0.25 = 25%)|
| :- | :- |
|**Grade reduction**|Each damaged unit loses PARTIAL\_DAMAGE\_PENALTY grades   (currently 20 grades)|

Units that fall below grade 1 after the penalty are moved to the scrap bucket.

|**Parameter**|**Current value**|**Effect**|**Suggested range**|
| :- | :- | :- | :- |
|PARTIAL\_DAMAGE\_FRACTION|0\.20|25% of units are affected when damage fires|0\.10 – 0.40|
|PARTIAL\_DAMAGE\_PENALTY|15 grades|How many grades each damaged unit loses|10 – 30|



|<p>**System 2: Production**</p><p>*Converting raw materials into finished components*</p>|
| :-: |

In the production phase, teams decide how many raw material units to convert into finished components using their machines. Finished components are stored and carried between cycles. No drone assembly happens here — assembly is a sales phase decision.

## **3.1 Machines**
Teams can own any number of machines per component. Each machine has a tier that determines its base output quality grade and throughput. Total throughput for a component is the sum of all active machines for that component.

|**Tier**|**Base output grade**|**Throughput (units/cycle)**|**Workers required**|**Degrades per cycle**|**Purchase cost**|**Scrap value**|
| :- | :- | :- | :- | :- | :- | :- |
|Basic|40|200|4|5\.0 pts|12,000 CU|1,000 CU|
|Standard|60|400|8|3\.0 pts|35,000 CU|3,000 CU|
|Industrial|75|700|10|2\.0 pts|70,000 CU|8,000 CU|
|Precision|90|1000|20|1\.2 pts|150,000 CU|20,000 CU|

|**BALANCE NOTE**|Precision machines require 20 workers — five times more than Basic. With full automation, this drops to 5 workers. The labour cost of running precision machines is the main hidden cost teams may overlook. Consider whether the grade jump (75→90) justifies the 2.25× cost jump from Industrial.|
| :-: | :- |

## **3.2 Machine condition and degradation**
Every machine starts at condition 100 and loses condition each cycle based on its tier and maintenance level. When condition hits 0 the machine is destroyed.

|**Effective output grade**|eff\_grade = base\_grade × (condition / 100) ^ CONDITION\_GRADE\_EXPONENT|
| :- | :- |

The exponent controls how quickly quality drops as condition falls. At exponent 0.6, a machine at 50% condition still produces at 66% of its base grade (not 50%), so degradation is gentler than linear.

|**Parameter**|**Current value**|**Effect**|**Suggested range**|
| :- | :- | :- | :- |
|MACHINE\_MAX\_CONDITION|100\.0|Starting condition of every new machine|Fixed at 100|
|CONDITION\_GRADE\_EXPONENT|0\.5|Controls the curve of quality loss vs condition. Lower = gentler drop.|0\.4 – 1.0|
|MACHINE\_DEGRADED\_AT|45\.0|Below this condition the machine is flagged as degraded (visual only currently)|25 – 60|
|OVERHAUL\_RECOVERY\_CAP|20\.0|Max condition points recovered by an overhaul in one cycle|10 – 30|

## **3.3 Maintenance**
One maintenance level applies to all machines of a component equally. Maintenance slows degradation and costs money.

|**Degradation per cycle**|actual\_degrade = tier\_degrade\_rate × MAINTENANCE\_DEGRADE\_MULT[level]|
| :- | :- |

|**Level**|**Cost per machine per cycle**|**Degradation multiplier**|**Condition change**|
| :- | :- | :- | :- |
|None|0 CU|1\.0× (full degrade)|Loses full tier rate|
|Basic|400 CU|0\.6× (40% slower)|Loses 60% of tier rate|
|Full|1,200 CU|0\.3× (70% slower)|Loses 30% of tier rate|
|Overhaul|5,000 CU|0\.1× (90% slower)|Loses 10% AND recovers up to 20 pts|

|**BALANCE NOTE**|Cost is per machine. A team with 3 Standard machines doing Full maintenance pays 4,500 CU per cycle just for that component. With 6 components all on Full maintenance and multiple machines, maintenance can easily exceed 30,000–50,000 CU per cycle. Verify this is intended.|
| :-: | :- |

## **3.4 Component output quality formula**
The quality of finished components produced each cycle is determined by blending the raw material grade with the machine's effective output grade, then drawing from a Normal distribution centred on that blend.

|**Blended mean**|output\_mean = (RM\_WEIGHT × rm\_grade\_avg) + ((1 − RM\_WEIGHT) × eff\_machine\_grade)|
| :- | :- |
|**Current split**|output\_mean = (0.40 × raw\_material\_avg) + (0.60 × machine\_effective\_grade)|

Each component unit's grade is then drawn from:

|**Grade draw**|unit\_grade ~ Normal(output\_mean, sigma)   →   clipped to [0, 100]|
| :- | :- |

|**Parameter**|**Current value**|**Effect**|**Suggested range**|
| :- | :- | :- | :- |
|RM\_WEIGHT|0\.35|How much raw material grade contributes. Higher = material matters more than machine.|0\.25 – 0.60|
|BASE\_SIGMA|12\.0|Base spread (variance) of output grades before skill/automation adjustments.|8 – 25|

## **3.5 Automation**
The factory-wide automation level reduces how many workers each machine needs and tightens output variance. There are three levels, upgraded sequentially at one-time cost.

|**Effective sigma**|sigma = BASE\_SIGMA × AUTOMATION\_SIGMA\_MULT × (1 − skill\_factor × SKILL\_SIGMA\_REDUCTION) − (rnd\_consistency × RND\_CONSISTENCY\_BONUS)|
| :- | :- |
|**Workers needed**|workers\_per\_machine = tier\_labour\_requirement × AUTOMATION\_LABOUR\_MULT|

|**Level**|**Upgrade cost**|**Workers multiplier**|**Sigma multiplier**|
| :- | :- | :- | :- |
|Manual|0 CU (default)|1\.00× (full labour)|1\.00× (full variance)|
|Semi-auto|200,000 CU|0\.60× (40% fewer)|0\.65× (35% tighter)|
|Full-auto|600,000 CU|0\.25× (75% fewer)|0\.35× (65% tighter)|

|**BALANCE NOTE**|At 600,000 CU for full automation, this is one of the largest single expenditures in the game. With starting funds of 100,000 CU per team it is unreachable in early cycles. Consider whether the prices are appropriate for the expected game length. Also note that full automation on a precision machine drops required workers from 20 to 5.|
| :-: | :- |



|<p>**System 3: Labour**</p><p>*Workforce skill, morale, and wages*</p>|
| :-: |

Labour affects production quality (through skill) and production volume (through headcount). Morale determines whether skill grows or decays, and triggers catastrophic events if it falls too low.

## **4.1 Starting values**

|**Parameter**|**Current value**|**What it means**|**Suggested range**|
| :- | :- | :- | :- |
|STARTING\_SKILL|35\.0|Skill level all teams begin with (0–100 scale)|30 – 60|
|STARTING\_MORALE|62\.0|Morale level all teams begin with (0–100 scale)|50 – 75|

## **4.2 How skill affects output quality**
Higher skill tightens the spread (sigma) of output quality — skilled workers produce more consistent components.

|**Skill factor**|skill\_factor = clamp(skill / 100,  min=0.1,  max=1.0)|
| :- | :- |
|**Sigma reduction**|sigma\_after\_skill = sigma\_before × (1 − skill\_factor × SKILL\_SIGMA\_REDUCTION)|
|**At SKILL\_SIGMA\_REDUCTION = 0.50**|Max possible sigma reduction is 50% (at skill = 100, full automation)|

## **4.3 Morale thresholds and skill change**

|**Each cycle skill change**|if morale ≥ MORALE\_HIGH (70):  skill += SKILL\_GAIN\_HIGH\_MORALE (+2.0)|
| :- | :- |
||if morale ≤ MORALE\_LOW  (35):  skill += SKILL\_GAIN\_LOW\_MORALE  (−5.0)|
||if 35 < morale < 70:  skill unchanged|

|**Parameter**|**Current value**|**Effect**|**Suggested range**|
| :- | :- | :- | :- |
|MORALE\_HIGH|68\.0|Morale above this → skill grows by 2 per cycle|60 – 80|
|MORALE\_LOW|35\.0|Morale below this → skill drops by 5 per cycle|25 – 45|
|MORALE\_RIOT|15\.0|Morale below this → riot fires (0% production this cycle)|10 – 25|
|SKILL\_GAIN\_HIGH\_MORALE|+3.5|Skill points gained per cycle with high morale|1\.0 – 4.0|
|SKILL\_GAIN\_LOW\_MORALE|−7.0|Skill points lost per cycle with low morale|−2.0 – −8.0|
|SKILL\_SIGMA\_REDUCTION|0\.50|Maximum fraction sigma can be reduced by skill alone|0\.30 – 0.70|

## **4.4 Wages and morale**

|**Morale change from wages**|morale += WAGE\_MORALE\_DELTA[wage\_level]   (applied each cycle)|
| :- | :- |

|**Wage level**|**Cost per worker per cycle**|**Morale change per cycle**|
| :- | :- | :- |
|Below market|300 CU|−7 morale|
|Market|500 CU|±0 morale|
|Above market|750 CU|+10 morale|

With starting morale of 60, a team paying below-market wages will reach the low morale threshold (35) in approximately 2-3 cycles, and the riot threshold (15) in 4-5 cycles — faster if also understaffed.

## **4.5 Understaffing penalty**

|**Understaffed %**|understaffed\_pct = (required\_workers − actual\_workers) / required\_workers × 100|
| :- | :- |
|**Morale penalty**|morale -= understaffed\_pct × UNDERSTAFFING\_MORALE\_PENALTY   (per cycle)|
|**Throughput penalty**|effective\_throughput = max\_throughput × (actual / required)|

|**Parameter**|**Current value**|**Effect**|**Suggested range**|
| :- | :- | :- | :- |
|UNDERSTAFFING\_MORALE\_PENALTY|0\.15|Morale lost per 1% understaffing. At 50% understaffed: −10 morale per cycle.|0\.10 – 0.40|

## **4.6 Labour events**

|**Event**|**Effect on production**|**Trigger**|
| :- | :- | :- |
|Riot|0% of units produced this cycle (total halt)|Morale falls below MORALE\_RIOT (15)|
|Strike|50% of units produced this cycle (STRIKE\_SURVIVAL)|Backroom deal from rival|
|Poach|Target loses POACH\_SKILL\_HIT (15) skill points immediately|Backroom deal from rival|

|**Parameter**|**Current value**|**Suggested range**|
| :- | :- | :- |
|RIOT\_SURVIVAL|0\.0 (0%)|0\.0 – 0.20|
|STRIKE\_SURVIVAL|0\.5 (50%)|0\.30 – 0.70|
|POACH\_SKILL\_HIT|12\.0 points|8\.0 – 25.0|



|<p>**System 4: Research & Development**</p><p>*Long-term quality, consistency, and efficiency improvements*</p>|
| :-: |

Teams invest in R&D for each component independently. There are three focus areas. R&D takes two cycles to arrive. Levels cap at 5. Neglecting R&D risks level decay.

## **5.1 R&D focus areas and bonuses**

|**Focus area**|**Effect per level**|**Formula impact**|
| :- | :- | :- |
|Quality|+3.0 to machine effective output grade per level|eff\_grade += rnd\_quality × RND\_QUALITY\_BONUS|
|Consistency|−2.0 from output sigma per level (floor: 2.0)|sigma -= rnd\_consistency × RND\_CONSISTENCY\_BONUS|
|Yield|−4% raw material consumed per level|consumed = requested × (1 − rnd\_yield × RND\_YIELD\_BONUS)|

|**Parameter**|**Current value**|**Effect**|**Suggested range**|
| :- | :- | :- | :- |
|MAX\_RND\_LEVEL|5|Maximum levels per focus area per component|3 – 7|
|RND\_COST\_PER\_LEVEL|35,000 CU|Cost to invest one level. Deducted immediately.|50,000 – 150,000 CU|
|RND\_CYCLES\_PER\_LEVEL|2|Cycles before the level arrives and takes effect|1 – 3|
|RND\_QUALITY\_BONUS|4\.0|Grade points added per quality R&D level|2\.0 – 5.0|
|RND\_CONSISTENCY\_BONUS|2\.5|Sigma points removed per consistency R&D level|1\.0 – 4.0|
|RND\_YIELD\_BONUS|0\.05 (5%)|Fraction of raw material saved per yield R&D level|0\.02 – 0.08|

Maximum possible R&D effect at level 5 across all three focuses:

- Quality: +15 grades to output mean (5 × 3.0)
- Consistency: −10 sigma, floored at 2.0 minimum
- Yield: −20% raw material consumption (5 × 4%)

|**BALANCE NOTE**|At 100,000 CU per level, fully maxing one focus area costs 500,000 CU — five times starting funds. R&D is clearly a late-game investment. Consider whether 100,000 CU is appropriate for a game with expected 5–8 cycles, or whether it should be cheaper to create more mid-game R&D competition.|
| :-: | :- |

## **5.2 R&D decay**
Each cycle, each active R&D level has a small probability of decaying by 1. This represents knowledge becoming obsolete or staff leaving.

|**Per level, per cycle**|P(decay) = RND\_DECAY\_PROBABILITY = 0.03   (3% chance per level)|
| :- | :- |

|**BALANCE NOTE**|At 5% per level per cycle, a team with 5 levels in quality has an expected 0.25 levels lost per cycle. Over 6 cycles this is 1.5 levels lost on average just to decay, without any rival interference. Consider whether this passively punishes teams who invested heavily in R&D.|
| :-: | :- |



|<p>**System 5: Assembly & Sales**</p><p>*Building drones and selling them to market factions*</p>|
| :-: |

In the sales phase, teams first choose how many drones to assemble from their finished component stockpiles, then decide what to do with each quality tier in their drone stock.

## **6.1 Drone assembly — the weakest link formula**
Assembling one drone draws one component from each of the six component finished stocks. The assembled drone's grade is a blend of the simple average of the six component grades and a 'weakest link' calculation that penalises having one very weak component.

|**Simple average**|avg = (grade\_airframe + grade\_propulsion + ... + grade\_battery) / 6|
| :- | :- |
|**Weakest link weight**|weight\_i = exp(−ASSEMBLY\_BETA × (grade\_i − min\_grade))|
|**Weakest link average**|wl\_avg = Σ(weight\_i × grade\_i) / Σ(weight\_i)|
|**Drone grade**|drone\_grade = (1 − ASSEMBLY\_LAMBDA) × avg  +  ASSEMBLY\_LAMBDA × wl\_avg|
|**Current values**|drone\_grade = 0.40 × avg  +  0.60 × wl\_avg|

ASSEMBLY\_BETA controls how sharply the weakest link is penalised. Higher BETA = the worst component dominates more strongly.

|**Parameter**|**Current value**|**Effect**|**Suggested range**|
| :- | :- | :- | :- |
|ASSEMBLY\_LAMBDA|0\.55|How much the weakest-link average dominates vs simple average. 0 = pure average, 1 = pure weakest-link.|0\.40 – 0.80|
|ASSEMBLY\_BETA|0\.28|How sharply the weakest component pulls the grade down. Higher = harsher penalty for imbalanced components.|0\.15 – 0.60|

|**EXAMPLE**|6 components all at grade 70: avg = 70, wl\_avg ≈ 70. Drone grade ≈ 70. Now replace one component with grade 30 (all others still 70): avg = 63.3, wl\_avg ≈ 37. Drone grade ≈ 63.3 × 0.4 + 37 × 0.6 = 47.5. A single bad component drops the drone from grade 70 to grade 47 — below the standard threshold. This is the weakest-link effect.|
| :-: | :- |

## **6.2 Quality thresholds**
These three thresholds sort assembled drones into the four commercial tiers. They are set per game and can be changed between cycles. All three are stored on the Cycle record so historical cycles always show the thresholds that were active at the time.

|**Threshold**|**Default value**|**Drone grade range it creates**|**Tier name**|
| :- | :- | :- | :- |
|qr\_hard|28|Grade < 30|REJECT (cannot sell in regulated market)|
|qr\_soft|48|30 ≤ grade < 50|SUBSTANDARD|
|qr\_premium|78|50 ≤ grade < 75|STANDARD|
|—|—|75 ≤ grade ≤ 100|PREMIUM|

## **6.3 Selling prices**
Teams choose an action for each quality tier. Prices shown are the defaults. Teams can set custom price overrides.

|**Tier**|**Action**|**Price (CU/unit)**|**Configurable?**|
| :- | :- | :- | :- |
|Any|Scrap|150 CU  (PRICE\_REJECT\_SCRAP)|Yes|
|Reject only|Black market (illegal)|600 CU  (PRICE\_REJECT\_BLACK\_MKT)|Yes|
|Substandard|Sell discounted|1,100 CU (PRICE\_SUBSTANDARD)|Yes|
|Standard|Sell at market|3,000 CU (PRICE\_STANDARD)|Yes|
|Premium|Sell at standard price|3,000 CU (PRICE\_PREMIUM\_NORMAL)|Yes|
|Premium|Sell at premium price|5,800 CU (PRICE\_PREMIUM\_SELL)|Yes|

|**BALANCE NOTE**|Standard and Premium sell for the same price (3,000 CU) unless teams choose the sell\_premium action for premium drones (4,800 CU). This means teams only gain a price advantage from premium if they actively choose to sell at premium — a strategic decision. Consider whether the 60% premium price uplift (3,000 → 4,800) is large enough to incentivise quality investment.|
| :-: | :- |

## **6.4 Holding costs**
Drones not sold this cycle remain in inventory and cost a holding fee per unit per cycle.

|**Holding cost**|cost = units\_held × HOLDING\_COST\_PER\_UNIT   (currently 40 CU/unit/cycle)|
| :- | :- |

|**Parameter**|**Current value**|**Suggested range**|
| :- | :- | :- |
|HOLDING\_COST\_PER\_UNIT|65 CU per drone per cycle|20 – 100 CU|

## **6.5 Black market**
Teams can sell reject-grade drones illegally. This is discovered probabilistically based on the volume sold.

|**Discovery chance**|P(discovery) = BLACK\_MKT\_DISCOVERY\_BASE × (black\_mkt\_units / total\_produced)|
| :- | :- |
|**Fine if caught**|fine = black\_market\_revenue × BLACK\_MKT\_FINE\_MULTIPLIER|

|**Parameter**|**Current value**|**Effect**|**Suggested range**|
| :- | :- | :- | :- |
|BLACK\_MKT\_DISCOVERY\_BASE|0\.45|Base probability coefficient. At 10% of production sold illegally: 5.5% chance of discovery.|0\.30 – 0.80|
|BLACK\_MKT\_FINE\_MULTIPLIER|3\.0|Fine = 3× the revenue earned from black market sales.|2\.0 – 5.0|



|<p>**System 6: Market Factions**</p><p>*Independent buyers who purchase drones each cycle*</p>|
| :-: |

The market is not a single pool of buyers. Instead, there are six distinct buyer factions, each with their own preferences, price limits, and quality requirements. Teams compete to win sales from each faction.

## **7.1 How factions work**
Each faction operates independently:

- They have a preferred quality tier (premium, standard, substandard).
- They will not pay above their price ceiling, no matter how good the drone.
- They buy from the cheapest eligible team first, using brand score as a tiebreaker.
- If supply in their preferred tier runs out, they may step down to the next tier, but only buy a fraction of their remaining appetite (determined by flexibility).
- They stop — they never raise their ceiling or go below the step-down tier.

|**Step-down appetite**|remaining\_appetite = remaining\_volume × faction.flexibility|
| :- | :- |
|**Effective volume**|effective\_volume = faction.volume × cycle.market\_demand\_multiplier|

## **7.2 Default faction configuration**
These are the six buyer factions seeded at game creation. All can be changed between cycles via the admin API.

|**Faction**|**Preferred tier**|**Price ceiling**|**Volume**|**Flexibility**|**Brand min**|
| :- | :- | :- | :- | :- | :- |
|Government Procurement|Premium|5,800 CU|200 units|0\.0 (none)|55 (GOOD+)|
|Industrial Operators|Standard|3,200 CU|700 units|0\.5|0 (any)|
|Municipal Services|Standard|3,000 CU|500 units|0\.3|25 (FAIR+)|
|NGO / Aid Sector|Substandard|1,600 CU|400 units|0\.8|0 (any)|
|Budget Resellers|Substandard|1,200 CU|500 units|0\.6|0 (any)|
|Private Collectors|Premium|5,800 CU|100 units|0\.1 (almost none)|0 (any)|

Total market capacity at default settings:

- Premium demand: 150 (Government) + 80 (Collectors) = 230 units baseline
- Standard demand: 400 (Industrial) + 300 (Municipal) = 700 units baseline
- Substandard demand: 250 (NGO) + 350 (Resellers) = 600 units baseline
- Total: 1,530 units across all tiers (before flexibility step-downs)

|**BALANCE NOTE**|With 5–20 teams each assembling hundreds of drones, the market can become supply-constrained quickly for premium tiers (only 230 units demanded). Teams producing high-quality drones may be forced to sell at standard prices or hold. Consider increasing premium faction volumes if you want quality investment to be clearly rewarded.|
| :-: | :- |

## **7.3 Market demand multiplier**
The organiser can apply a global multiplier to all faction volumes between cycles. This is how global market events are implemented.

|**Adjusted volume**|effective\_volume = faction.volume × market\_demand\_multiplier|
| :- | :- |

Default multiplier is 1.0. A global event might set this to 0.7 (30% market contraction) or 1.3 (30% boom).



|<p>**System 7: Brand**</p><p>*Reputation score affecting market access and faction priority*</p>|
| :-: |

Brand score (0–100) determines which buyer factions will deal with a team, and acts as a tiebreaker when multiple teams are competing for the same faction's budget at the same price. Brand decays naturally each cycle and is affected by what teams sell and how they behave.

## **8.1 Brand decay**

|**Each cycle**|new\_brand = brand × BRAND\_DECAY   (before adding deltas)|
| :- | :- |

At BRAND\_DECAY = 0.94, a brand score of 80 becomes 75.2 after one cycle with no other changes. Over 6 cycles without any sales, it falls to 80 × 0.94^6 ≈ 55.

|**Parameter**|**Current value**|**Effect**|**Suggested range**|
| :- | :- | :- | :- |
|BRAND\_DECAY|0\.92|Fraction of brand retained each cycle. Lower = faster decay.|0\.88 – 0.98|

## **8.2 Brand deltas from actions**

|**Event**|**Brand change**|**Notes**|
| :- | :- | :- |
|Selling premium drones at premium price|+8.0|Strongest positive signal|
|Selling standard drones|+2.5|Normal positive|
|Selling substandard drones|−8.0|Quality signal harms brand|
|Black market discovered|−25.0|Severe — public scandal|
|Black market undiscovered|−3.0|Small signal leak|
|Government loan taken|−8.0|Financial distress signal|
|Backroom deal discovered|−20.0|Major scandal|

## **8.3 Brand tiers**
Brand score maps to a tier used by market factions to filter buyers.

|**Tier**|**Minimum score**|**Access restriction**|
| :- | :- | :- |
|Poor|0|Cannot sell to Government Procurement or Municipal Services|
|Fair|25|Meets most faction minimums except Government (needs 55)|
|Good|55|Meets Government Procurement minimum|
|Excellent|80|No restrictions|



|<p>**System 8: Leaderboard**</p><p>*How the winner is determined*</p>|
| :-: |

The leaderboard uses a composite score combining five metrics. Each metric is normalised to a 0–1 scale before weighting so they are comparable despite having different units.

|**Normalised value**|norm\_X = raw\_X / LEADERBOARD\_NORMALISE[X]|
| :- | :- |
|**Composite score**|score = Σ (norm\_X × LEADERBOARD\_WEIGHTS[X])   (inventory\_penalty weight is negative — it subtracts)|

## **9.1 Weights and normalisation references**

|**Metric**|**Weight**|**Normalisation ref**|**Meaning**|
| :- | :- | :- | :- |
|Cumulative profit|+30%|1,800,000 CU|Total net profit earned across all cycles|
|Closing funds|+25%|700,000 CU|Cash on hand at game end|
|Brand score|+20%|100 points|Final brand score|
|Quality average|+15%|100 points|Sales-weighted mean drone grade of all drones in stock|
|Inventory penalty|−10%|5,000 units|Unsold drones sitting in stock (penalised)|

|**BALANCE NOTE**|Cumulative profit (30%) and closing funds (25%) together account for 55% of the score, making financial performance the dominant factor. Brand (20%) and quality (15%) are meaningful but secondary. If you want to incentivise quality manufacturing more strongly, consider shifting weight from closing\_funds to quality\_avg.|
| :-: | :- |

At the normalisation reference values, a perfect score of 1.0 requires: 300,000 CU cumulative profit, 500,000 CU closing funds, brand 100, quality 100, zero unsold drones. Adjust the normalisation references to reflect what you expect the best team to realistically achieve — if you set them too high, scores will be bunched near zero; too low and they bunch near 1.



|<p>**System 9: Backroom Deals**</p><p>*Government favours, discovery risk, and deal pricing*</p>|
| :-: |

During the backroom phase, teams can bribe the government for advantages or attacks on rivals. Every deal has a minimum bribe (floor), a discovery risk, and an effect that scales logarithmically with bribe size.

## **10.1 Effect scaling**
A larger bribe buys a stronger effect, but with diminishing returns:

|**Effect scale**|scale = min(DEAL\_EFFECT\_CAP,  1.0 + log(bribe / floor) / DEAL\_LOG\_SCALE\_DIVISOR)|
| :- | :- |

At the floor price, scale = 1.0 (base effect). Doubling the bribe gives scale ≈ 1.14. Paying 10× the floor gives scale ≈ 1.46. Maximum scale is 2.0 (capped).

|**Parameter**|**Current value**|**Effect**|**Suggested range**|
| :- | :- | :- | :- |
|DEAL\_LOG\_SCALE\_DIVISOR|4\.0|Lower = faster scaling (more power per extra CU). Higher = flatter curve.|3\.0 – 8.0|
|DEAL\_EFFECT\_CAP|2\.5|Maximum multiplier on any deal's base effect.|1\.5 – 3.0|

## **10.2 Discovery probability**

|**Discovery chance**|P = base\_rate + log(bribe/floor) × SIZE\_RATE + (repeat\_count − 1) × STACK\_RATE|
| :- | :- |
|**Decays over time**|effective\_P = P × DEAL\_DISCOVERY\_DECAY ^ cycles\_since\_deal|

|**Parameter**|**Current value**|**Effect**|**Suggested range**|
| :- | :- | :- | :- |
|DEAL\_DISCOVERY\_DECAY|0\.75|Each cycle the deal survives undiscovered, risk drops by 20%|0\.70 – 0.90|
|DEAL\_SIZE\_DISCOVERY\_RATE|0\.03|How much extra bribe size adds to discovery risk|0\.01 – 0.05|
|DEAL\_REPEAT\_STACK\_RATE|0\.12|Extra discovery risk per repeat of the same deal type|0\.05 – 0.15|
|DEAL\_FINE\_MULTIPLIER|3\.0|Fine = 2.5× the original bribe if discovered|1\.5 – 4.0|

## **10.3 Bribe floors (minimum bribe per deal type)**
Teams must pay at least the floor to execute a deal. Below the floor the system rejects the request.

|**Category**|**Deal type**|**Floor (CU)**|**Base discovery rate**|
| :- | :- | :- | :- |
|Procurement|Supply sabotage (rival)|5,000|12%|
|Procurement|Price inflation (rival)|4,000|8%|
|Procurement|Priority supply (self)|4,000|6%|
|Procurement|Subsidised inputs (self)|3,000|7%|
|Infrastructure|Machine sabotage (rival)|10,000|18%|
|Infrastructure|Infra delay (rival)|6,000|10%|
|Infrastructure|Fast-track infra (self)|5,000|8%|
|Labour & R&D|Labour strike (rival)|7,000|14%|
|Labour & R&D|Labour poach (rival)|6,000|13%|
|Labour & R&D|R&D sabotage (rival)|8,000|15%|
|Labour & R&D|Skilled labour (self)|4,000|6%|
|Labour & R&D|Research grant (self)|8,000|10%|
|Sales|Market access limit (rival)|7,000|20%|
|Sales|Demand suppression (rival)|6,000|18%|
|Sales|Price pressure (rival)|5,000|16%|
|Sales|Demand boost (self)|6,000|12%|
|Sales|Gov purchase (self)|10,000|9%|
|Legal|Targeted audit (rival)|4,000|5%|
|Legal|Arbitrary fine (rival)|5,000|7%|
|Legal|Audit immunity (self)|8,000|8%|
|Legal|Quality waiver (self)|6,000|9%|
|Legal|Tax evasion (self)|5,000|11%|

|**BALANCE NOTE**|The highest discovery risk deals are the sales interference deals (20%, 18%, 16%) — these are the most visible since rivals immediately notice demand/price changes. Infrastructure sabotage (18%) is also high. Legal deals have low discovery risk (5–11%) — government covering its own tracks. Consider whether the 12,000 CU research grant floor (the highest) is appropriate given R&D costs 100,000 CU per level normally.|
| :-: | :- |



|<p>**System 10: Loans**</p><p>*Government and inter-team lending*</p>|
| :-: |

|**Parameter**|**Current value**|**Effect**|**Suggested range**|
| :- | :- | :- | :- |
|GOV\_LOAN\_INTEREST\_RATE|18% per cycle|Government loans are expensive and signal distress (−8 brand)|10% – 25%|
|INTER\_LOAN\_MIN\_RATE|2% per cycle|Minimum interest teams can charge each other|1% – 5%|
|INTER\_LOAN\_MAX\_RATE|12% per cycle|Maximum interest teams can charge each other|8% – 20%|
|GOV\_LOAN\_MIN\_QUALITY\_FLOOR|35\.0|Teams with gov loans that produce below this average drone grade may be penalised|15 – 40|

|**BALANCE NOTE**|At 15% per cycle, a 100,000 CU government loan costs 15,000 CU in interest each cycle — equivalent to 30 workers at market wages, or one full maintenance cycle of a Standard machine. This is intentionally punishing. Teams should see it as an emergency measure only.|
| :-: | :- |



|<p>**System 11: Starting Conditions**</p><p>*What each team begins with*</p>|
| :-: |

These values are set in the game seed data before the event starts. They define the baseline state every team begins from.

## **12.1 Financial starting state**

|**Item**|**Default value**|**Notes**|**Suggested range**|
| :- | :- | :- | :- |
|Starting funds|150,000 CU|Cash available to each team at the start of cycle 1|50,000 – 200,000 CU|
|Starting brand score|52\.0|Teams start in the middle of the FAIR tier|40 – 65|
|Starting skill level|40\.0|Labour skill. Affects output consistency.|25 – 55|
|Starting morale|60\.0|Slightly above the neutral wage band. Teams start stable.|50 – 70|
|Starting workforce|55 workers|Default headcount. Teams can adjust each cycle.|30 – 80|

## **12.2 Starting machines**
Every team begins with one Standard machine per component (six machines total). This is seeded automatically when the team is created.

- Standard machine: grade 60, throughput 400 units/cycle, 8 workers, degrades 3 pts/cycle
- All machines start at condition 100.0
- Total starting throughput: 400 units per component (with full headcount)

## **12.3 Quality thresholds (set per game)**
The three quality thresholds are set when the game is created and can be changed between cycles. They determine what tier each drone falls into.

|**Threshold**|**Default**|**Notes**|**Suggested range**|
| :- | :- | :- | :- |
|qr\_hard (reject ceiling)|30|Drones below this cannot be sold legally|20 – 45|
|qr\_soft (substandard ceiling)|50|Drones between hard and soft are substandard|40 – 65|
|qr\_premium (premium floor)|75|Drones above this are premium|65 – 85|

|**BALANCE NOTE**|With Standard machines starting at grade 60 and R&D at zero, teams producing at full throughput from day one will produce most components centred around grade 60 with sigma ~15. This means roughly 68% of output will fall between grades 45 and 75 — straddling the substandard/standard boundary. Teams need to improve their machines, materials, or R&D to reliably produce standard-tier output. This seems intentional — balancing team should verify the first-cycle experience.|
| :-: | :- |


# **13. Quick Reference — All Variables**
Complete flat list for rapid lookup. All values are in the central configuration file.

## **Transport**

|**Variable**|**Air**|**Rail**|**Road**|**Water**|
| :- | :- | :- | :- | :- |
|base\_cost (CU)|30,000|4,000|1,000|8,000|
|var\_cost (CU/unit/km)|200|60|100|20|
|sigma\_add|0\.0|3\.5|6\.0|9\.0|
|mean\_reduce|0\.00|0\.50|1\.50|4\.00|
|p\_damage|0%|7%|14%|18%|
|vulnerability|0\.00|0\.80|1\.00|0\.50|

|**Variable**|**Value**|
| :- | :- |
|PARTIAL\_DAMAGE\_FRACTION|0\.25|
|PARTIAL\_DAMAGE\_PENALTY|20 grades|

## **Machines**

|**Variable**|**Basic**|**Standard**|**Industrial**|**Precision**|
| :- | :- | :- | :- | :- |
|grade|40|60|75|90|
|throughput|200|400|700|1000|
|labour|4|8|10|20|
|degrade|4\.0|3\.0|2\.0|1\.2|
|buy cost|15,000|35,000|80,000|180,000|
|scrap value|1,000|3,000|8,000|25,000|

|**Variable**|**Value**|
| :- | :- |
|MACHINE\_MAX\_CONDITION|100\.0|
|MACHINE\_DEGRADED\_AT|40\.0|
|CONDITION\_GRADE\_EXPONENT|0\.6|
|OVERHAUL\_RECOVERY\_CAP|20\.0 pts|

|**Maintenance level**|**Cost/machine**|**Degrade multiplier**|
| :- | :- | :- |
|None|0 CU|1\.0×|
|Basic|500 CU|0\.6×|
|Full|1,500 CU|0\.3×|
|Overhaul|5,000 CU|0\.1× + recover up to 20 pts|

## **Automation**

|**Level**|**Upgrade cost**|**Labour mult**|**Sigma mult**|
| :- | :- | :- | :- |
|Manual|0|1\.00×|1\.00×|
|Semi-auto|200,000 CU|0\.60×|0\.65×|
|Full-auto|600,000 CU|0\.25×|0\.35×|

## **Production formula**

|**Variable**|**Value**|
| :- | :- |
|RM\_WEIGHT|0\.40 (40% raw material, 60% machine)|
|BASE\_SIGMA|15\.0|
|SKILL\_SIGMA\_REDUCTION|0\.50 (max 50% reduction)|
|ASSEMBLY\_LAMBDA|0\.60 (60% weakest-link)|
|ASSEMBLY\_BETA|0\.30|

## **Labour**

|**Variable**|**Value**|
| :- | :- |
|STARTING\_SKILL|40\.0|
|STARTING\_MORALE|60\.0|
|MORALE\_HIGH|70\.0|
|MORALE\_LOW|35\.0|
|MORALE\_RIOT|15\.0|
|SKILL\_GAIN\_HIGH\_MORALE|+2.0/cycle|
|SKILL\_GAIN\_LOW\_MORALE|−5.0/cycle|
|UNDERSTAFFING\_MORALE\_PENALTY|0\.20/1% understaffed|
|RIOT\_SURVIVAL|0% production|
|STRIKE\_SURVIVAL|50% production|
|POACH\_SKILL\_HIT|−15 skill points|
|Wage: below market|300 CU/worker, −10 morale/cycle|
|Wage: market|500 CU/worker, ±0 morale/cycle|
|Wage: above market|750 CU/worker, +8 morale/cycle|

## **R&D**

|**Variable**|**Value**|
| :- | :- |
|MAX\_RND\_LEVEL|5 per focus area|
|RND\_COST\_PER\_LEVEL|100,000 CU|
|RND\_CYCLES\_PER\_LEVEL|2 cycles|
|RND\_DECAY\_PROBABILITY|5% per level per cycle|
|RND\_QUALITY\_BONUS|+3.0 grade per level|
|RND\_CONSISTENCY\_BONUS|−2.0 sigma per level|
|RND\_YIELD\_BONUS|−4% material per level|

## **Sales & Brand**

|**Variable**|**Value**|
| :- | :- |
|PRICE\_REJECT\_SCRAP|200 CU|
|PRICE\_REJECT\_BLACK\_MKT|600 CU|
|PRICE\_SUBSTANDARD|1,400 CU|
|PRICE\_STANDARD|3,000 CU|
|PRICE\_PREMIUM\_NORMAL|3,000 CU|
|PRICE\_PREMIUM\_SELL|4,800 CU|
|HOLDING\_COST\_PER\_UNIT|40 CU/drone/cycle|
|BLACK\_MKT\_DISCOVERY\_BASE|0\.55|
|BLACK\_MKT\_FINE\_MULTIPLIER|3\.0×|
|BRAND\_DECAY|0\.94×/cycle|
|Brand delta: premium sell|+6.0|
|Brand delta: standard sell|+1.5|
|Brand delta: substandard|−5.0|
|Brand delta: black mkt found|−25.0|
|Brand delta: gov loan|−8.0|
|Brand delta: deal found|−20.0|

## **Leaderboard weights**

|**Metric**|**Weight**|**Normalisation ref**|
| :- | :- | :- |
|Cumulative profit|+30%|300,000 CU|
|Closing funds|+25%|500,000 CU|
|Brand score|+20%|100|
|Quality average|+15%|100|
|Inventory penalty|−10%|5,000 drones|

## **Loans**

|**Variable**|**Value**|
| :- | :- |
|GOV\_LOAN\_INTEREST\_RATE|15%/cycle|
|INTER\_LOAN\_MIN\_RATE|2%/cycle|
|INTER\_LOAN\_MAX\_RATE|12%/cycle|

## **Deal mechanics**

|**Variable**|**Value**|
| :- | :- |
|DEAL\_LOG\_SCALE\_DIVISOR|5\.0|
|DEAL\_EFFECT\_CAP|2\.0×|
|DEAL\_DISCOVERY\_DECAY|0\.80×/cycle|
|DEAL\_SIZE\_DISCOVERY\_RATE|0\.02|
|DEAL\_REPEAT\_STACK\_RATE|0\.08|
|DEAL\_FINE\_MULTIPLIER|2\.5×|

Page 26
