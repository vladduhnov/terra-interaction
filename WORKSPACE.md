# Connected property story prototype

Run `python3 -m http.server 8000 --bind 127.0.0.1` from this directory and open `http://localhost:8000`. No build or backend is needed.

## Demo walkthrough

1. Start on Home. The original Home / History / Watchlist sidebar and resizable panel remain in place.
2. Type **101 Market Street, San Francisco** in the composer and press Enter. You can also select the address from the composer’s suggestions.
3. The map flies to the property and highlights a building footprint. The conversation shows a fictional property record.
4. Ask **Give me more information about this building**. The property remains the shared context and roof observation zones appear on the map.
5. Ask **Add it to monitoring**. The chat confirms a sample monthly schedule, the map marker turns purple, and the property joins Home and Watchlist.
6. Ask **What will happen to the roof in five years?** Rain, scan effects, loading stages, and roof exposure zones run on the map as matching status appears in chat.
7. After roughly six seconds, the chat shows baseline and projected roof illustrations, condition scores, and suggested next steps.
8. Drag the image reveal divider to compare the baseline roof with projected affected areas, or move either timeline. Chat and map share the same year and score. Ask **Explain the changes** to continue the conversation.
9. Home returns to your properties. Clicking a property opens its overview and the chats within that group. Suggested questions or **New chat** start a separate conversation; saved chats reopen in the same property. History groups conversations by property. Watchlist opens monitored properties.
10. **Recenter** lives below the map’s location control; **Monitoring settings** stays at the top right of property and chat screens. Settings control the sample schedule, alert threshold, and monitoring toggle, saved in this browser.

## Monitoring cards

Home shows monitored properties in a horizontal carousel of equal-height, text-only cream cards. Each card includes the address, asset type, location, check frequency, next run, and three latest parameter updates. Healthy parameters use check icons; findings use red warning icons. Card and row backgrounds stay neutral, with no timestamps or new-count badges. Reviewing findings does not resolve them or remove them from the latest parameter status. Clicking a finding opens its detail in the property group.

## Other interactions

- The three compact PNG shortcuts support Pick a spot, Ask anything, and Draw an area on Home. They are hidden within property groups and chats.
- Hovering a property row previews its marker and footprint. Clicking a row or map marker opens its property overview and saved chats.
- Property selection highlights the building without map labels, conversation cards, or suggested questions. Ask in the left composer or press **C** to place a map comment.
- Pick mode uses the original map comment input and attaches the nearest sample property to the question.
- Drawing a closed loop lists sample properties inside it, ready to open in conversation.
- Local address suggestions support mouse selection and Arrow Up / Arrow Down / Enter.
- Other sample properties: 580 Howard Street, 245 Mission Street, 400 Spear Street, and 680 Folsom Street.
- Ask to stop monitoring a building to remove it from Watchlist.
- A simulation can be cancelled, replayed, or run for 1–10 years. Switching context cancels any pending simulation.
- Monitoring and conversation history persist in local browser storage. Camera, panel, and home screen remain temporary presentation state.

## Prototype boundaries

AI responses are scripted demo intents; there is no live LLM connection. Property attributes, monitoring schedules, roof imagery, condition scores, and forecasts are fictional. No email, real assessment, or physical simulation is executed.

The map loads external Mapbox imagery. Where available, a nearby building polygon from the basemap replaces the initial demo footprint; the mock address does not establish ownership or a verified address-to-parcel match. Roof impact patches are clipped to that geometry. The simulation comparison uses matching satellite crops of the selected map footprint, with illustrative affected-area overlays on the projected image. Imagery dates are not established by the 2026–2031 prototype timeline.

## Files

- `index.html`: original map, sidebar, composer, draw/comment tools, and panel resizer. Map selections emit events to the story experience.
- `workspace.js`: shared property context, scripted conversation, monitoring, history, geographic overlays, and simulation lifecycle.
- `workspace.css`: compact home, chat, map effects, and responsive layouts using the original visual style.
- `geolava-assets/roof-current.svg` and `roof-projected.svg`: paired illustrative roof images.

## Recent chats

Home lists the five most recently active conversations by question title, with the address as secondary context. Each row opens that chat directly. This includes one-off questions about properties that are not monitored; asking or reopening a question does not enable monitoring. Monitored property cards continue to open property groups containing multiple chats.

## Monitoring overview layout

A property opens with its address, an assistant summary of the latest check, and three key findings or status observations. Suggested questions are visual cards that start a chat. Property details and saved conversations follow below; the overview has no large image. Baseline/projected satellite comparisons remain available in simulation chat results.

## Visual rules

Do not introduce interface shadows unless the user explicitly requests them. Monitoring status hover layers use 6px corners and no shadow.

The reading area and composer share equal 32px gutters after the 76px navigation rail, with content capped at 620px. Property overviews use a 52px assistant avatar and a 32px summary (8px smaller than Home). Exploration cards use the same borderless lift-and-spring motion as monitoring cards. NEW CHAT is a text-only, semibold DM Sans pill.

Chat rows on Home, property overviews, and History share a square-cornered cream hover surface with an 8px content inset. Standard action buttons use pill corners; cards and icon containers retain their own corner radii.

Each flagged overview issue offers an assistant-icon “What can I do?” pill. It creates a separate property chat with that finding as the opening question and a scripted next-step response; healthy baseline observations do not show the issue action. Exploration-card titles use 18px type, reduced to 16px in panels narrower than 700px.

## 3D property selection

Property overviews and chats show Mapbox building extrusions at native building heights, with a tilted camera aimed at the selected roof. The roof has a purple outline and 32 inward contour bands fading from 30% opacity to a clear center, including courtyard cutouts. The selected marker is hidden in property views and restored on Home. Surrounding 3D buildings are hidden on Home. If building geometry or height is unavailable, the prototype uses its sample footprint and an 18m height. Simulation patches are placed on the same elevated roof plane.

Building volumes use 10% opacity to preserve the satellite imagery beneath the 3D view. The roof outline and inward purple fade retain their separate opacity settings.

The Recenter map control uses the original pin icon and dark glass map-control styling. It appears in property overviews and chats, restores the selected property camera, and is hidden on Home.

## Future-event timeline

Completed simulations show a map timeline with monthly scrubbing, annual labels, and sample future events. Red circles indicate roof/drainage, blue squares development, green diamonds greenery, and amber triangles sidewalk/parking access. Hover or keyboard focus previews a compact event explanation; clicking pins it and synchronizes the map and chat to that month. Close or Escape dismisses it. These events are fictional scenarios, including the April 2027 storm and nearby retail project. The lower/higher exposure gradient lives in the simulation chat rather than the map.

Chat headers show the original bookmark and Share controls; monitoring settings appear only on property overviews. Bookmarks persist on conversations. In this prototype, Share copies the conversation text for sharing. The map timeline shows a centered selected date, markers, and annual ticks without a legend or instruction text. The simulation chat groups linked potential changes under roof/drainage, development, greenery, and sidewalk/parking.

Simulation maps also show sample context zones around the selected roof: green canopy, blue nearby development, and yellow sidewalk/parking areas. They are placed relative to the sample building footprint, clear of the roof, and build up in the months before their matching timeline event. Clicking a visible zone selects the event date and opens the same details used by the timeline and chat. Returning to the baseline or leaving the simulation clears the effects. These zones do not represent verified parcels or planned developments.

The property/chat top bar spans the full panel after the navigation rail, independently of the 620px reading column. It remains fixed above the scrolling content and preserves the original 28px control gutters and inset divider.

Simulation comparison cards load matching plan-view satellite images through Mapbox Static Images. Both cards share one crop, derived from the selected footprint in Web Mercator coordinates; SVG overlays retain the roof outline and projected affected zones. Cards refresh if the resolved building footprint changes. Satellite images retain Mapbox attribution and show an explicit unavailable state on load failure. No new map mode is added.

The roof comparison is one satellite image with an overlaid projected layer and a draggable reveal divider. Drag left to reveal more projected impact and right for the baseline image. The slider supports keyboard arrows and Home/End, and is independent of the projection-date timeline.

Property highlighting now uses flat 2D fill layers on the satellite map, including the purple contour fade and simulated roof patches. Building extrusions and the height-adjusted camera target were removed to prevent a floating highlight. The map keeps its tilted perspective, and surrounding simulation zones remain flat as before.

## Action buttons

Primary and secondary action styles follow Figma node 238:564: 44px height, 37px pill radius, 20px horizontal padding, 12px gaps, and uppercase bold 12px DM Sans with 16px line height and 1.32px tracking. Primary uses #6266E6 / #FEFEFB; secondary uses #EDECE7 / #282823. Width follows the label instead of fixing every action to the sample’s 240px. Circular utility controls retain their existing geometry.

## Layout presets

Hover the panel resize handle to open three visual presets: Map first uses the existing minimum panel width, 50 / 50 splits the window equally, and Panel first uses the maximum panel width. Selected presets adapt on window resize; dragging the handle returns to custom sizing. The popover shows the current width and active preset, opens with Enter or Space from the handle, and closes with Escape or an outside click. Balanced layout is disabled when half the window would violate the existing panel width limits. No shadows are used.

The resize control now uses the side-mounted Figma tab (239:581): 27×44px, gradient surface, rounded right corners, and the locally stored original 14px handle SVG. The interface no-shadow rule takes precedence over the design’s shadow. Hover or click opens layout presets; dragging retains custom sizing without jumping to the pointer’s offset inside the tab.

Preset resizing uses a single interruptible 450ms width animation through the same update path as dragging. Independent panel/map CSS transitions are disabled. Mapbox rendering stays scheduled after each frame’s width update, preventing a cleared canvas from being presented between resize frames. Dragging or selecting another preset cancels the previous animation; reduced-motion preferences apply the target immediately.

Each future-event prediction shows its own sample confidence percentage in the chat and matching timeline popover. Scores are fixed prototype values, independent of the event date and not measured forecast probabilities.


Home now includes an inline “Assess the property” section after monitored properties. Address autocomplete uses the five sample properties and opens an assessment dashboard without creating a conversation. Pick a spot and Draw an area also open assessments from Home; Scan anything focuses address search. Dashboard categories cover roof, sidewalks, roads/access, drainage, and greenery with fictional condition scores. Each category’s “How can I improve it?” action explicitly starts a property chat with relevant guidance. The fixed composer is hidden on Home and assessment results; existing property chats retain it.

Assessment results now show avatar-first summary and assessment date, full-width category cards with condition meters and confidence scores, and three recommended steps for categories needing work. Healthy categories offer a category-specific future-risk chat. Five flat colored map regions and labels correspond to roof, sidewalks, road access, drainage, and greenery; Locate on map controls and map clicks connect the two views. Region geometry and assessment data remain illustrative.


First-time experience: a full-map sign-in screen accepts made-up email/password details locally, clears the form on submit, and never persists or transmits credentials. A 3.2-second map sweep transitions into a sage-green address search with seven prompt cards fanning into a half-radial arrangement. Cards fill address suggestions; selecting an address opens the assessment dashboard. Skip is available in all three stages and opens Home. Completion is stored separately in `geolava-welcome-complete-v1`; use `/?onboarding=1` to replay without clearing saved conversations. Reduced-motion preferences bypass decorative animation and shorten the scan. Background sidebar is inert and keyboard focus stays inside the flow.

Onboarding visual revision: the header retains only the Geolava symbol, and the address screen uses a cream background. Prompt cards animate in an arc above the central address area; “Your next perspective” and card footer labels have been removed.

Assessment cards support right-click and Shift+F10 to open a contextual assistant chat at the pointer, using the map-comment input style. Replies are scripted from the selected category’s assessment, recommendations, confidence, and risks. These small threads remain in memory per property/category while the page stays open. Escape, close, outside click, scrolling, and navigation dismiss the popover; no full chat navigation is required.

The Home section is now titled “Monitoring”. A City portfolio card groups 100 deterministic mock buildings without adding 100 cards to Home. Its overview has 100/12/88 building totals, searchable rows, condition filters, and 100 flat map dots that filter with the list. Clicking a row or map dot opens the building overview; a back control returns to the portfolio. Mock coordinates are a layout grid, not verified address locations.

The portfolio building list shows 10 rows per page with numbered pagination, previous/next controls, and a visible range count. Search and condition changes reset to page 1; map dots continue to show all matching buildings across pages.
