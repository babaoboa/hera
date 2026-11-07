# Hera presentation kit

All four receipts are fictional purchases created for this hackathon scenario. Photo credits and licensing are in SOURCES.md. The app UI and receipt faces have no demo labels.

## The story

“My basement flooded today. My living area and home office were damaged. I don’t have a list of everything I owned, but I have older photos and a few receipts.”

These are BEFORE-loss images. They do not show flood damage; the presenter confirms which belongings were lost as part of the fictional scenario.

## Live walkthrough

1. Open Hera and start a claim with: **“My basement flooded on November 7, 2026 from overland water. The home is not livable. Help me build a claim using my older photos and receipts.”**
2. If no policy is on file, upload `00-birchwood-policy.pdf`. It is the existing fictional Birchwood policy from the project. Finish any missing contact fields and approve the initial report.
3. In the belongings card, select **Living room** and **Before the loss**. Choose `photos/01-living-room-before.jpg`. Let Hera identify the room’s belongings.
4. Point out the sofa, table, rug and lamp. Say: **“These were hiding in an ordinary photo. Hera has done the first pass for me.”**
5. Attach `receipts/01-sofa-receipt.jpg` to the sofa and `receipts/02-coffee-table-receipt.jpg` to the coffee table. Show the original purchase amount beside the separate replacement estimate.
6. Add another batch: select **Other**, name the room **Home office**, keep **Before the loss**, and upload `photos/02-home-office-before.jpg`.
7. Attach `receipts/03-monitor-receipt.jpg` to the computer monitor (not the light bar or monitor arm), and `receipts/04-desktop-pc-receipt.jpg` to the desktop computer tower.
8. Confirm the lost or damaged belongings after checking them. If an item needs correcting, choose **Edit details**; remove duplicates or anything outside the scenario. Receipts reopen confirmation so their extracted details can be reviewed.
9. Continue to expenses. For a short presentation, choose **No extra costs — review my claim**. Approve the prepared proof of loss.

## 90-second version

Use only the living-room photo. Attach just the sofa receipt. Show the extracted purchase amount, edit one estimate, confirm the belongings, skip expenses and open final review. The office photo and other receipts are available for a longer run or questions.

## Receipt matching card

| Image | Attach to | Purchase amount before HST | Fictional purchase date |
| --- | --- | ---: | --- |
| 01-sofa-receipt.jpg | Green sofa / couch | CA$1,699.00 | 2024-06-15 |
| 02-coffee-table-receipt.jpg | Wood coffee table | CA$249.00 | 2024-08-03 |
| 03-monitor-receipt.jpg | Computer monitor | CA$349.99 | 2025-01-18 |
| 04-desktop-pc-receipt.jpg | Desktop computer tower | CA$1,899.00 | 2024-11-22 |

Upload the individual JPEGs, not the four-page PDF or the receipt contact sheet. The receipt reader is an image uploader. Receipts include 13% HST, but the extraction is intended to show the item’s price before tax, not the entire transaction total.

## What has been verified

The real photo and receipt API routes ran successfully with these assets in an isolated temporary household. The rehearsal produced **22 belongings and CA$11,280 in replacement estimates**, and all four receipt matches returned the expected purchase amounts. `CATALOGUE.md` and `verified-catalogue.json` contain the recorded results. Item wording, counts and estimates may vary on a new model run; do not memorize the total as a guaranteed result.

The demo policy lists CA$80,000 in contents coverage and a CA$50,000 overland-water endorsement with a CA$2,500 deductible. These policy figures are context; the inventory total is not an approved payout.

The analysis uses the project’s NVIDIA vision provider. Run the app with its configured credentials and working internet. To repeat the isolated rehearsal from the repository root:

    node --env-file=.env.local scripts/verify-claim-demo.cjs

The kit includes the raw JSON verification output, not a prerecorded replacement for the app’s live photo analysis. Submission remains simulated and local.

## Closing line

“After a tragedy, people shouldn’t have to rebuild their entire home from memory. Hera turns the photos and receipts they already have into an organized claim they can understand and approve.”
