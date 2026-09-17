# AI Estimator teaching pattern

The platform administrator teaches the estimator through `/admin/knowledge` and the learning queue. The estimator should produce a complete first-pass insurance-style repair estimate, not a short checklist.

## Expected first-pass structure

1. Vehicle and damage summary
2. Remove & Refit — one component/operation per line
3. Square & Align
4. Cut & Weld when supported
5. Repair — one repair action per line
6. Paint & Blend — one panel per line; blend is separate
7. Parts — each replacement part separately; supplier/PartsTrader pricing remains TBC until a real price exists
8. Mechanical / Electrical / Diagnostics / ADAS / SRS when supported
9. Outwork / Sublet — decals, towing, specialist work, calibration, etc.
10. Panel materials / Paint materials / Consumables / Grooming / Miscellaneous
11. Check-after-strip / inspection notes for plausible but unconfirmed hidden damage
12. Totals and estimator notes

## Estimating rules

- Use estimator notes together with image evidence.
- Every R&R component gets a separate line.
- Every repaired component gets a separate repair line.
- Every refinished component gets a separate paint line.
- Blends are separate lines.
- Do not invent supplier prices. Parts remain TBC until a real supplier/API price is available.
- Chargeable hourly operations must have realistic non-zero hours.
- Use workshop configured labour, paint, blend and miscellaneous rates rather than AI-invented rates.
- Add inspection/check-after-strip notes instead of charging for unsupported hidden damage.
- Consider decals/livery, badges, clips, retainers, liners, grilles, lamps, sensors, looms and trim items that must be removed/refitted to perform the repair.
- For EVs, high-voltage or ADAS/SRS work should only be added when supported by evidence/context; otherwise add an inspection recommendation.
- Never issue the AI estimate automatically. It remains a human-reviewable draft.

## Example admin lesson

Title: Rear impact — complete insurance estimate checklist

Content:
When the visible damage is at the right rear, do not stop at the damaged panel. Review the whole repair path: bumper cover, bumper retainers/side guides, lower garnish/moulding, lamps, parking sensors/loom, wheel-arch interfaces, boot/inner trim, tailgate fittings/badges, adjacent blend panels, decals/livery, gap/alignment checks and check-after-strip items such as lamp mounting panel, rear body panel, bumper reinforcement, absorber and sensor/radar equipment. Create one estimate line per operation. Replacement parts stay TBC until supplier pricing is available.

Publish this as global knowledge only after admin review. Workshop users cannot edit global estimator knowledge.