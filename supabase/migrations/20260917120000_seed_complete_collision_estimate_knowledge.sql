insert into public.knowledge_sources (
  scope,
  source_type,
  title,
  content_text,
  status
)
select
  'global',
  'admin',
  'Complete collision estimate — dependency and completeness standard',
  $knowledge$
PURPOSE
Create a complete first-pass collision repair estimate from all supplied photos plus the estimator's written notes. Do not stop at the visibly damaged outer panel. Expand the repair into the legitimate access, remove/refit, repair, refinish, replacement-part, electrical/diagnostic, outwork, materials and inspection operations that are normally required to complete the stated repair. Every item remains a preliminary estimator suggestion until human review.

CORE ESTIMATE STRUCTURE
1. Damage / impact understanding: identify the primary impact area and every visibly supported damaged component.
2. Remove & Refit: add each access or refit operation as its own line. Never combine several physical components into one sentence.
3. Square & Align: add gap/alignment checks where impact or panel fit makes this reasonable.
4. Repair: separate repair labour for each repairable component.
5. Paint & Blend: separate full refinish lines from blend lines. A repaired or replaced painted panel normally requires its own paint line. Blend only adjacent panels where colour matching reasonably requires it; do not add a blend between panels that are already receiving full refinish.
6. Parts: add every reasonably required replacement part as an individual REPLACE / PartsTrader-or-supplier TBC line. Never invent a part price.
7. Graphics / badges / decals: if visible or likely affected by refinishing, include removal/reinstatement or outwork as a separate line and leave external price TBC unless a configured workshop rule provides a value.
8. Check after strip: hidden structure, mounts, brackets, wiring, absorbers, reinforcements, sensor brackets and related items that cannot be confirmed from photos belong in inspection/check-after-strip notes, not as confirmed replacement damage.
9. Materials / misc / outwork: keep panel materials, paint materials, consumables, scans, calibrations, towing, specialist work and environmental/disposal charges separate from labour. Only price them when workshop configuration or approved knowledge supports the amount.
10. Final estimator note: summarise primary repair, replacement parts, paint/blend, inspections and TBC items clearly.

DEPENDENCY CHECKLIST — APPLY ONLY WHEN RELEVANT TO THE PHOTOS/REPAIR
BUMPER REPAIR OR REPLACEMENT
- bumper cover / complete bumper assembly
- upper/lower grilles
- lower spoiler/valance/mouldings/garnishes
- absorber/energy foam
- reinforcement/bar: inspect after strip unless visibly damaged
- side retainers/guides and mounting brackets
- wheel-arch liner interfaces and lower shields
- parking sensors, sensor brackets, loom and fittings
- radar/BSM/ADAS equipment if fitted: inspect and determine scan/calibration requirement if disturbed
- lamps/reflectors/DRL/fog lamps mounted in or adjacent to bumper
- badges/emblems
- clips/fasteners
- trial fit and panel-gap check when replacement or mounting damage is involved

TAIL LAMP / HEADLAMP AREA
- damaged lamp assembly as individual replacement part
- adjacent lamp assemblies may require R&R for panel repair/refinish access
- lamp brackets, tabs and mounting panel: inspect after strip if not visibly confirmed
- wiring/connectors: inspect; add electrical labour only when there is evidence or a legitimate functional check

QUARTER PANEL REPAIR
- adjacent tail lamp R&R when needed for repair/paint access
- bumper corner/retainer interfaces
- wheel-arch liner, moulding or flare where applicable
- inner boot/quarter trim for repair access where applicable
- adjacent door handle/moulding R&R if required for blend
- fuel door/filler components where applicable
- check quarter inner structure and apertures after strip when impact severity warrants it

TAILGATE / BOOT LID REPAIR
- interior tailgate trim where required
- badges/emblems
- handle/camera/number-plate lamp and fittings where required for refinish
- latch and aperture alignment check where impact is near the closing edge
- visible decals/company graphics/signwriting: remove/reinstate or replace after paint as separate TBC outwork unless reusable

DOOR / GUARD / BONNET REPAIR
- handles, mirrors, mouldings, liners, lamps, badges, seals or trims that must be removed for repair/refinish should be separate R&R lines when relevant
- blend access operations are separate from the blend paint line

ELECTRIC / HYBRID VEHICLES
- recognise EV/hybrid context but do not invent high-voltage damage
- where impact is near HV components, charging hardware or underbody battery structure, recommend inspection only unless visible evidence supports an operation

REPAIR VS REPLACE
Use photos plus estimator notes. Repair when deformation/scratching can reasonably be restored. Replace when the component is visibly cracked, torn, severely distorted, has compromised mounting geometry, or the estimator note explicitly says replace. Do not replace intact adjacent components solely because they are nearby.

LABOUR AND PRICING
- one operation/component per line
- chargeable hourly operations need realistic non-zero labour time
- use the workshop's configured hourly rate; do not invent another labour rate
- use configured fixed paint and blend rates
- replacement part price stays TBC until actual supplier/PartsTrader pricing is available
- an inspection/check-after-strip note is not automatically a charged replacement part

COMPLETENESS AUDIT BEFORE RETURNING THE DRAFT
Before returning the estimate, internally review each damaged/repaired/replaced component and ask:
A. What must be removed to access it?
B. What attached trims, lamps, sensors, retainers, brackets, liners or clips are affected?
C. Does the repair require a separate paint line?
D. Is an adjacent blend reasonably needed?
E. Are decals/badges/signwriting affected?
F. Are trial-fit/gap/alignment checks warranted?
G. Is there a scan/calibration/electrical function check that is reasonably triggered by disturbed equipment?
H. What possible hidden items should be check-after-strip rather than falsely claimed as damaged?
I. Are materials/outwork separate rather than hidden inside labour?
J. Are all replacement parts individually listed as TBC?

Never pad an estimate. Only add operations that are reasonably connected to the supplied evidence and stated repair. When uncertain, lower confidence and use an inspection/TBC note rather than asserting hidden damage.
$knowledge$,
  'active'
where not exists (
  select 1
  from public.knowledge_sources
  where scope = 'global'
    and title = 'Complete collision estimate — dependency and completeness standard'
    and status = 'active'
);
