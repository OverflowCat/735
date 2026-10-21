You are implementing an industrial monitoring web application.

First inspect the existing repository and preserve useful existing structure and conventions.

Also read:

`../protocol.typ`

Treat that file as the source of truth for device communication protocol and data structures. Do not duplicate or redefine the protocol unless necessary for frontend types or mock data.

## Product

Build a factory monitoring frontend using:

* Svelte / SvelteKit
* TypeScript
* Simplified Chinese UI
* Apache ECharts
* Three.js for simple 3D visualization

The application monitors devices such as gamma dose-rate monitors and radon monitors.

The main interface is the factory map.

## Phase 1 scope

Phase 1 is frontend-only.

Do NOT implement:

* backend
* database
* SQLite
* Turso
* migrations
* protocol ingestion server
* authentication/signature verification
* production realtime infrastructure

Use mock data and a small frontend data/service abstraction so a real backend can replace it later.

The future backend will generally be implemented in Rust.

Do not introduce a TypeScript backend unless explicitly requested later.

## Main views

Create two primary views:

* `/map`
* `/overview`

The map should be the default/main interface.

## Factory map

Support both:

* 2D factory map
* simple 3D factory view

2D should use SVG or another lightweight approach suitable for editing.

3D should use Three.js and simple geometry such as cuboids. Do not build a BIM/CAD system.

2D and 3D must use the same scene/device coordinate model.

The map should display:

* factory areas
* simple walls/machines/objects
* device locations
* device name
* current measurement
* unit
* device status
* alarm state

Use different visual states/colors for measurement values and alarms.

Do not rely on color alone; important alarm/status information should also have text or icons.

## Device interaction

Clicking a device should open a side drawer without leaving the map.

Show:

* device name and code
* device type
* status
* latest measurements
* alarm information
* last update time
* ECharts historical trend

Provide mock time ranges such as:

* 15 minutes
* 1 hour
* 24 hours
* 7 days

Mock data should follow the concepts and fields defined by `../protocol.typ`.

Do not add remote device-control functionality.

## Map editing

Provide a clearly separated edit mode.

In edit mode allow the user to:

* add/select a device
* place a device on the map
* drag device positions
* edit placement
* remove placement
* create/edit simple factory objects when practical

Normal monitoring mode must not accidentally move devices.

For Phase 1, changes may remain in frontend state or lightweight local mock persistence. No database is required.

### Map editing implementation (2D)

Edit mode is **2D-only**; switching to 3D auto-exits edit mode. State lives in `app-state.svelte.ts` (`AppState` class + exported mutators); components must not mutate placements directly.

| Piece | Where | Notes |
|-------|-------|-------|
| `editMode` / `editSelectionId` / `placingDeviceId` | `appState` | selection for inspector vs. device drawer (`selectedDeviceId`) is separate |
| `snapToGrid` / `gridSize` | `appState` | default on, 10px; `snapValue()` used on place/drag |
| undo/redo | `undoPlacement` / `redoPlacement` | stack of **device placements only** (building geometry is mock-authored); max 50; drag = one step via `beginPlacementChange()` |
| persistence | `localStorage` key `cabcal-factory-scene-v1` | always written on change; `saveScene()` also POSTs to backend, falls back to "已存本地" |
| label style | `DevicePlacement.labelStyle` | `'badge' \| 'text' \| 'compact'`, default `'badge'` |
| UI | `map/EditPanel.svelte` + `map/FactoryMap.svelte` | panel shows 未保存/已同步, place list, inspector (x/y, label style) |

Keyboard (ignored while focus is in input/textarea/select):

* `Esc` — cancel placing / clear edit selection
* `Delete` / `Backspace` — remove selected placement
* `Ctrl+Z` / `Ctrl+Shift+Z` or `Ctrl+Y` — undo / redo
* Arrow keys — nudge by `gridSize` (Shift = 1px)

Monitoring mode: devices are click-to-select only (opens drawer); drag/pan must not move placements. Middle-drag or Shift+drag pans the map in any mode.

Do not add object/geometry editing in Phase 1 beyond what mock scene already provides — placements only.

## 3D

Provide a simple Three.js view using the same map data as the 2D view.

Support:

* orbit
* zoom
* pan
* simple cuboid factory objects
* device markers/labels
* current measurement display
* clicking a device to open the same device drawer

3D can be read-only in Phase 1.

Map editing should primarily happen in 2D.

## Overview

Create an overview page showing mock monitoring statistics such as:

* total devices
* online/offline/fault devices
* active alarms
* latest measurements

Include a searchable device table.

Provide an ECharts comparison section where the user can:

* choose a metric
* choose a time range
* select several compatible devices
* compare historical trends

Avoid showing dozens of lines at once.

## Frontend architecture

Keep protocol/domain types separate from UI components.

Create a small service layer such as:

`DeviceDataSource`

or equivalent.

Components should consume this abstraction rather than importing mock data directly.

For Phase 1 implement:

`MockDeviceDataSource`

This should make it straightforward to later replace mock data with a Rust backend API and realtime connection.

Keep scene/map state similarly separated from rendering components.

A reasonable structure is:

```text
src/
  routes/
    map/
    overview/

  lib/
    components/
      map/
      device/
      charts/
      overview/

    data/
      mock/

    services/
    state/
    types/
```

Adapt this to the existing repository rather than forcing the structure if the project already has good conventions.

## UI

The UI should be Simplified Chinese.

Code identifiers and technical comments should remain English.

The design should feel like an industrial monitoring application rather than a marketing dashboard.

Prioritize:

* large map area
* readable measurements
* clear alarm hierarchy
* clear device status
* fast device inspection
* low accidental-edit risk
* restrained industrial visual style

## Mock scenarios

Provide enough mock data to demonstrate:

* gamma device
* radon device
* normal measurement
* level-1 alarm
* level-2 alarm
* online device
* offline device
* fault device
* historical chart data
* several devices for comparison

Use `../protocol.typ` to keep terminology and mock data compatible with the actual protocol.

## Phase 1 definition of done

Phase 1 is complete when:

1. The Svelte application runs locally.
2. `/map` is the main monitoring interface.
3. Devices are visible on a 2D factory map.
4. Current mock measurements and alarm states are visible beside devices.
5. Clicking a device opens a drawer with ECharts historical data.
6. Device positions can be edited in 2D edit mode.
7. The application can switch to a simple Three.js 3D view using the same scene data.
8. `/overview` shows device status and measurement summaries.
9. Multiple devices can be compared with ECharts.
10. All functionality works without a backend or database.
11. Frontend data access is abstracted so mock data can later be replaced by the Rust backend.

Run formatting, type checking, tests where appropriate, and the production frontend build before finishing.

## Future phases

Do not implement these during Phase 1 unless explicitly requested.

Future work will include:

* Rust backend
* SQLite or Turso/libSQL persistence
* implementation of the protocol in `../protocol.typ`
* realtime frontend updates
* historical storage/querying
* production device registration and configuration

Design Phase 1 so these can be added without rewriting the main UI or map components.

When something is ambiguous, prefer a simple maintainable frontend implementation rather than inventing backend or protocol behavior.



