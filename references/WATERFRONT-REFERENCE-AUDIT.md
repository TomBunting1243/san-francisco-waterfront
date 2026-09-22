# Waterfront reference audit

Reference pass: September 21, 2026. This is a stylized architectural model, not a surveyed reconstruction. The entries below distinguish observed features from interpretation. Reference photographs were studied, not bundled into the site or used as textures.

## Map and landscape evidence

`public/data/sf-waterfront.json` supplies mapped footprints and available building heights. Heights marked unmeasured remain estimates. `public/data/waterfront-landscape.json` adds an OpenStreetMap snapshot captured on September 21: 58 landscape areas, 800 path segments and 332 mapped tree nodes. These are input counts, not counts of rendered objects. The model filters underground routes, collisions and areas outside its parks.

Source: [OpenStreetMap map API](https://api.openstreetmap.org/api/0.6/map.json?bbox=-122.402,37.79,-122.387,37.807). Both derived datasets are © OpenStreetMap contributors under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). No editor names or account metadata are exported.

| Place | References studied | Implemented features and limits |
| --- | --- | --- |
| Sue Bierman Park | Mapped eastern and western parcels `175516006`, `585983823`, service-area exclusion `941854099`; existing park photographs in the [SF Recreation and Parks project material](https://sfrecpark.org/1819/Embarcadero-Plaza-and-Sue-Bierman-Park-R) | Curving mapped paths, lawns, east canopy and narrow western grove. The proposed future combined plaza design is **not** treated as built. Supplemental tree placement and canopy dimensions are interpreted. |
| Sidney G. Walton Square and Maritime Plaza | [Peter Walker project account](https://www.pwpla.com/projects/golden-gateway-center-alcoa-plaza-and-sidney-g-walton-square), mapped park edges and paths | Lawns, perimeter groves and Maritime Plaza's raised garden over the garage. Individual tree species, exact crown sizes and all sculptures are not surveyed. |
| Embarcadero Center 1–4 | Owner's [building history](https://embarcaderocenter.com/about/) and [arts and gardens](https://embarcaderocenter.com/arts-and-gardens/), building and terrace photographs | Four distinct tower envelopes, close vertical ribs, fourth tower's stepped crown, three-level pedestrian podiums, planters, paths and bridges. The four mapped podiums are `32612628`, `32612692`, `32612700`, `32612730`. Planter arrangements are simplified; this is not a tenancy or public-art inventory. |
| Golden Gateway Commons | Architect Robert Geering's [interview and photographs](https://arccadigest.org/robert-j-geering-faia-an-arcca-digest-interview/) | Brick podiums, upper houses, projecting bays, steel canopies, park-facing arches, exterior stairs and courtyard planting. Main IDs `941869554`, `941869555`, `941869556`, plus their mapped upper parts. The architect describes the rooftop decks as unbuilt; the model retains the arches without inventing occupied decks. |
| Bay Club / Gateway recreation courts | Mapped pool and pitch polygons and their surrounding paths | Pools, tennis court surfaces, lines and nets follow mapped areas. Furniture and net dimensions are simplified. |

The importer is reproducible with Python's standard library:

```sh
python3 scripts/import-waterfront-landscape.py --input /path/to/cached-osm-map.json --captured 2026-09-21
```

Omit `--input` to fetch the public map API. The script fits the existing scene projection against four mapped footprints and rejects a maximum alignment error above 0.003 scene units. This snapshot's maximum is approximately 0.001. Negative IDs in the garden module identify interpreted supplemental planting, not surveyed OSM nodes.

## Architecture added or corrected in this pass

The IDs below refer to the existing map dataset. Window counts, cornice depths and colors are approximate even where a façade photograph was inspected. Hidden rear and side elevations are not independently verified unless stated.

| Building / mapped ID | Reference | Features represented |
| --- | --- | --- |
| Gateway towers `32859152`, `32947577`, `260930240`, `32612241` | Geering's neighborhood photographs and mapped tower footprints/heights | Recessed balcony rhythm and pale grids, distinct from the Commons below. |
| Maritime Plaza `28240176` | PWP's plaza material and existing tower imagery | Dark glazing, light external cross-bracing and wider structural bands. |
| Gap headquarters / Two Folsom `93817368` | [Project engineer](https://www.cbengineers.com/project/gap/), [landscape architect](https://www.toocb.com/gap-urban-headquarters), [existing exterior photograph](https://s.hdnux.com/photos/11/37/30/2487820/6/1920x0.jpg) | Brick six-level base, pale central portico and stepped upper tower massing. |
| One Harrison `32862740` | [Exterior listing photograph](https://images1.loopnet.com/i2/lDrLiX3w8a7jMfKrOFZStOswbRpcXqZIEVGPM9MJDMY/112/image.jpg) | Five visible glazed façade rows, pale grid and deep cornices. Future redevelopment renderings were excluded. |
| One Steuart Lane `667097308` | [SOM project description](https://www.som.com/projects/one-steuart-lane/) | Twenty-level stone grid and grouped projecting terraces. Source-supported design description; no new full façade photo verification in this pass. |
| Bayside Plaza / 188 Embarcadero `32862467` | [Thewub's July 2023 exterior photograph](https://commons.wikimedia.org/wiki/File:188_Embarcadero,_San_Francisco_2023-07-18.jpg) | Retained rounded mapped corner, taupe horizontal bands, blue glazing, upper setbacks and circular ornaments. Aurora fountain is not individually reconstructed. |
| 121 Steuart `193054135` | [Exterior photograph](https://www.skydb.net/file/844571436/121-steuart-street-san-francisco/) | Five upper window rows above a tall storefront, warm brickwork and layered projecting cornice. Mapped roof height retained. |
| Commonwealth Club `256969674` | [Tipping Structural project account and photographs](https://tippingstructural.com/projects/commonwealth-club/) | Three-level glass frontage, white upper fins, entry canopy and retained historic rear-window rhythm. Rear details are simplified. |
| 900 Front broadcast building `288481830` | [Existing exterior photograph](https://images1.loopnet.com/i2/8n4sUmMYP8wApc3_s_BEcvSqxnAMwaQ92L9r_ft3vrY/112/900-Front-St-San-Francisco-CA-Building-Photo-1-HighDefinition.jpg) | Broad cream spandrels, dark ribbon windows, brick base and roof dishes. |
| 2 Bryant `105026993` | [Existing exterior photograph](https://images1.loopnet.com/i2/NjruMNTmyJrht0FWWncSJ1aJ9F_kcpoH2pdKpwF215k/112/image.jpg) | White three-level industrial grid with large steel-framed window bays. |
| 444–470 Spear `192328863` | [Property listing and exterior photograph](https://www.loopnet.com/Listing/444-470-Spear-St-San-Francisco-CA/18714904/) | Ochre painted warehouse, two levels, steel glazing and parapet. Corrected an earlier generic brick treatment. |
| 753 Davis `288481832` | [SF Planning historic-district packet](https://commissions.sfplanning.org/hpcpackets/2016-007850COA.pdf), existing-condition photo sheets 326–331 | Two-level brick warehouse with pale cornice, floor bands and steel windows. Identity follows the packet's photo key. |
| Waterfront Restaurant building `32016321` | [Owner's exterior photograph](https://www.waterfrontsf.com/) | Cream two-level shell, large glazing and dark awnings/canopy. Architectural representation does not imply the restaurant is operating. |
| Piers 1½–3 bulkhead `25489470` | [National Register documentation](https://npgallery.nps.gov/GetAsset/4c08c6fe-82b7-40e7-9e96-bf164957208f) | Continuous waterfront bulkhead, pilasters and arched entry markers. |
| Piers 9, 15, 17, 19, 24, 26, 28 | [Port of San Francisco historic piers RFI](https://www.sfport.com/sites/default/files/Planning/082018_SFPort-HistoricPiersRFI.pdf); [Exploratorium campus account](https://annex.exploratorium.edu/piers/creatingcampus.html) and building photography | Cargo bays, roof monitors, pier labels, classical fronts; curved Mission parapets at 26/28 and solar rows at 15. Photo sheets for 26/28 and exterior photos of 9/15 were inspected. Others use the documentary pier family, not an individually measured façade. IDs: `25478417`, `25478444`, `25489458`, `91913152`, `186071977`, `104599978`, `104599994`. |
| Exploratorium Bay Observatory `738027034` | [Architect-submitted project photographs](https://www.architectmagazine.com/project-gallery/exploratorium-at-pier-15_o), [owner's gallery description](https://www.exploratorium.edu/rentals/bay-observatory-gallery-terrace) | Two glazed levels, narrow mullions, high transom and thin pale floor edges. |
| Ferry Plaza East and entry `123559872`, `123559869` | [Port's 2023 site brochure](https://sfport.com/files/2023-03/1_ferry_plaza_east_-2023_flyer.pdf), photographs and plan/elevation sheets | Dark lower ventilation louvers, upper glass, hipped glazed roof and adjoining skewed pyramid entry. Existing BART structure, not the demolished Sinbad's building. |
| Santa Rosa and San Francisco Belle `281243360`, `281243626` | [Pier 3 operator](https://www.cityexperiences.com/san-francisco/city-cruises/our-fleet/pier3-hornblower-landing/), [Santa Rosa exterior](https://upload.wikimedia.org/wikipedia/commons/0/0f/Ferryboat_mv_santa_rosa.jpg), [Belle operator photograph](https://assets.cityexperiences.com/wp-content/uploads/2021/04/IMG_5628.jpeg) | Replaced plain map extrusions with hulls, stepped passenger decks, rails, windows, wheelhouses, vents and funnels; Belle has a stern paddlewheel. Mooring locations follow the map, not live fleet tracking. |

## Previously detailed landmarks retained

The Ferry Building, Bay Bridge, Hills Bros, One Market, Audiffred, Pier 1, Hotel Griffon, Harbor Court / Army and Navy YMCA, Steuart Place, 1 Hotel, Pier 5, Ferry Station Post Office and Station 35 retain their earlier authored geometry. Sources include the [Hills Plaza gallery](https://www.hillsplazasf.com/main.cfm?pid=pgallery&sid=introduction), [One Market owner](https://www.tmgpartners.com/portfolio/landmark-one-market), [Audiffred National Register record](https://npgallery.nps.gov/GetAsset/3aa06aad-5c07-4dd2-8e26-752c546519a8/), [Hotel Griffon](https://www.hotelgriffon.com/), [Harbor Court](https://www.harborcourthotel.com/), [1 Hotel gallery](https://www.1hotels.com/san-francisco/gallery), and [Station 35 architect](https://skarc.com/projects/san-francisco-fireboat-station-35/). Retained geometry is not newly certified by this audit.

## Remaining fidelity limits

- This does **not** establish that every visible building matches every real elevation. Unnamed inland/backdrop blocks still use mapped extrusions and generic window grids. 139 Steuart and the far northern Battery/Green background need additional building-specific reference work.
- Façades repeated around a footprint, colors, roof equipment, tree crowns and many street furnishings are artistic interpretations. Exact masonry courses, tenancy signs and hidden façades have not been surveyed.
- Park geometry combines mapped paths/planting and photographed landscape character. It is not a complete current tree or sculpture census. Dates differ across the references; proposed future landscaping is excluded.
- The added geometry stays batched and glazing instanced. Automated checks establish geometry, placement and animation invariants, not device FPS, GPU memory, thermals or exhaustive flicker-free operation on every camera path.

For future work, identify the exact mapped building first, inspect an existing-condition exterior photo or plan, record its distinctive features here, and then update its geometry. Do not turn an anonymous block into a plausible but unsupported landmark.
