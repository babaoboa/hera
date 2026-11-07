# hera

your home insurance, except it actually works for you

okay so basically: insurance companies have a whole army of ai doing underwriting, fraud scoring, claim triage, all of it. you, the person literally paying them, get a 30 page pdf you've never read. hera fixes ts.

you give hera your policy pdf once and it does the three things nobody wants to do:

1. **"i just got into a flood"**: walks you through the whole claim, step by step
2. **"negotiate a lower rate"**: finds the discounts you're missing and writes the email to your insurer
3. **"find me better insurance"**: checks your home's actual risk and compares quotes

built in one day at **cortex by redshifted** (ottawa) for "ai for humanity"

team: pj, ___, ___, ___

![negotiate flow: drafted email, you approve, simulated reply from the (fake) insurer](docs/negotiate.png)

---

## why this matters (not just vibes)

- **1 in 3 canadian homeowners think their normal policy covers floods when it doesn't** ([ratesdotca / bnn bloomberg, 2022](https://insurancebusinessmag.com/ca/news/flood/one-in-three-canadians-think-their-home-insurance-policies-cover-water-damage-428755.aspx))
- flood coverage is available to ~94% of canadian homes now, and take-up went from 26% in 2017 to 71% in 2023 ([ibc, 2026](https://www.insurancebusinessmag.com/ca/news/catastrophe/94-of-canadian-homes-can-now-access-overland-flood-insurance-ibc-finds-583572.aspx)). so more people HAVE it than ever, they just don't know their limits, deductibles or deadlines until the basement is already full
- ottawa flooded in 2017 AND 2019. a claim hits you at literally your worst moment: 30 page policy, 90 day proof-of-loss deadline, and you have to list everything you owned from memory. very cooked
- renewals go up every year and most people never ask for the discounts they already qualify for

hera reads the fine print, does the paperwork, and asks before it does anything for you.

---

## what it does

everything runs off **one household file** (your policy + your home) saved in a local sqlite db. hera collects it once and every feature reuses it, so it never asks you the same thing twice.

### 1. "i just got into a flood"

- opens a claim tracker with your policy’s relevant coverage, limits, deductible and deadline dates, plus a “before you clean up” checklist
- prepares the first notice of loss and waits for approval
- **camera-roll inventory**: choose photos from before or after the loss, even everyday photos with belongings in the background. hera identifies visible items and suggests replacement estimates in CAD
- review each belonging, edit its details or value, confirm it was lost or damaged, and remove duplicates. add anything the photos missed without preset claim amounts
- **receipt reading**: attach a receipt image to a belonging. hera extracts its purchase amount, merchant and date, keeping the original purchase price separate from today’s replacement estimate
- explains policy limits and settlement terms, then offers an optional hotel + extra living-expenses step
- shows a final claim review and waits for approval of the proof of loss. unconfirmed belongings cannot be submitted

submissions are simulated and saved locally; the presentation UI has no demo labels. failed photo analysis never inserts fabricated belongings. [full walkthrough, research sources and presentation notes](docs/claim-flow.md).

### 2. negotiate a lower rate

- looks at your premium, renewal history, the discounts you already get, and the ones your file says you SHOULD get (monitored alarm, leak sensors, sump pump, claims-free years...)
- builds a case card with the $$ at stake
- types the email into a compose window and waits for you to hit approve

### 3. find me better insurance

- geocodes your address with openstreetmap and measures the distance to the nearest fire hall, hydrant and river/lake (these literally change your price irl)
- builds a risk profile and finds gaps in your current coverage
- fills out each insurer's quote form with your file, compares them side by side, and drafts a quote request for the one you pick

---

