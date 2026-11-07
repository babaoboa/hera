# Hera: rebuild a claim from the photos someone already has

Hera helps someone recovering from a loss turn everyday camera-roll photos and receipts into a reviewed belongings claim, using their insurance policy to put the numbers in context.

## Walkthrough

1. **Tell Hera what happened.** Start with “I just got into a flood.” Hera checks the policy and the household details it needs, opens a claim tracker, and shows the immediate documentation tasks.
2. **Review the first report.** A prefilled insurer form shows the incident and policy information. The person approves it before the initial report is recorded. This reports the incident; it is separate from the later detailed contents statement.
3. **Choose existing photos.** Pick a room and say whether the photos were taken before or after the loss. Choose up to four images per batch, with more batches available. A birthday photo or living-room snapshot can help reconstruct belongings without requiring a new visit to the damaged home. Only selected files are analyzed; the app does not browse the entire camera roll.
4. **Let Hera do the first pass.** Vision identifies visible movable belongings, associates each item with its source photo, and suggests a rough CAD replacement estimate. These are model estimates, not live retailer comparisons. An unavailable model produces a retry message rather than invented inventory.
5. **Review the belongings.** Each item has a name, room, replacement estimate and source. Confirm that it was lost or damaged, edit details and value, or remove it. Optional notes can record brand, approximate age and damage. Room filters actually filter the list. Check for duplicates across upload batches; the model is prompted to avoid duplicates, but this is not a guaranteed identity-matching system.
6. **Attach receipts.** Select an item and attach a receipt photo or screenshot. Hera reads the matching CAD line-item amount, merchant and date where legible. It keeps this historical purchase price separate from the replacement estimate. An attached receipt reopens confirmation so the person checks the extraction. PDFs are not supported by this receipt uploader.
7. **Fill gaps.** A secondary manual form lets the person add missing belongings with their own values. Room-specific reminders have no preset claim amounts and never add items automatically.
8. **Continue to optional expenses.** Log hotel, extra meal and other costs, or continue without extra costs. The claim review follows an explicit button rather than requiring a guessed chat instruction.
9. **Review and approve.** Hera summarizes confirmed belongings, photo and receipt counts, expenses, and the total before deductible. The prepared proof-of-loss form waits for approval. Both UI and server prevent an unreviewed belongings inventory from being submitted.

## Research behind the experience

- [Government of Canada: Overland flood insurance](https://www.canada.ca/en/services/policing/emergencies/preparedness/get-prepared/hazards-emergencies/floods/flood-risk/overland-flood-insurance.html) recommends keeping a policy, inventory, ownership evidence, receipts and photos. It also distinguishes types of flooding and their coverage. This supports collecting evidence and displaying relevant policy wording rather than assuming all water damage has identical coverage.
- [Insurance Bureau of Canada: How to file a claim](https://www.ibc.ca/insurance-basics/how-insurance-works/how-to-file-a-claim) describes documenting the incident and damaged items, reviewing exclusions, deductibles, limits and deadlines, and providing documentation for adjuster review. This supports separate initial reporting, inventory building and final approval.
- [Insurance Bureau of Canada: Actual Cash Value vs. Replacement Cost](https://www.ibc.ca/news-insights/in-focus/actual-cash-value-vs-replacement-cost) explains depreciation versus replacing with a similar item. This supports separate purchase-price evidence, replacement estimates and policy settlement context. Hera does not treat a receipt amount or a contents limit as a guaranteed payout.

These are Canadian sources, chosen for the app's CAD values and Canadian policy context. The design conclusions above are product inferences, not a prescribed insurer workflow. Policy terms and insurer requirements vary.

## Presentation boundaries

The hackathon scenario is entirely simulated. Submission tools save local claim state and generate reference numbers; they do not contact insurers. The interface omits demo/simulation labels at the presenter's request. Photo and receipt analysis still uses the configured vision provider, so use the supplied demonstration images. The presentation kit in `output/claim-demo-kit` has since been verified against the real photo and receipt routes in an isolated temporary household: 22 belongings, CAD 11,280 in replacement estimates, and four correct receipt matches. Live model results may vary.

The current prototype saves compressed photo/receipt previews and extracted details, not a full-resolution original evidence archive. Retail price lookup, reliable cross-batch identity matching, general PDF receipt extraction, complete incident intake and insurer-specific coverage adjudication remain future work. The initial incident form currently inherits the existing date/cause/livability defaults when those facts are missing; choose the scripted incident details explicitly for the presentation.

## Presentation line

“After a flood, people shouldn’t have to reconstruct their home from memory. Hera finds belongings in the photos they already have, reads their receipts, and turns that evidence into a claim they can understand and approve.”
