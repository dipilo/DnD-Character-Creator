import interactionPlugin from '@fullcalendar/react/interaction';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import classicTheme from '@fullcalendar/react/themes/classic';
import type { PluginInput } from '@fullcalendar/react';
import './fullcalendar.css';

/**
 * The FullCalendar 7 plugin set both scheduler calendars share.
 *
 * The theme is **two halves that must both be present**: this plugin, which is what emits the
 * `fc-classic-*` class names onto the rendered elements, and `fullcalendar.css`, which is what
 * gives those class names any meaning. Importing one without the other produces a calendar that
 * looks broken rather than one that errors — which is the trap v7's opt-in styling sets, since v6
 * shipped its stylesheet implicitly and needed no theme plugin at all.
 *
 * Plugins also stopped being separate packages in v7 (`@fullcalendar/timegrid` has no 7.x
 * release); they are subpath exports of the connector. MERGE_PLAN.md §5.1 recorded this upgrade as
 * a peer-dependency bump, which understated it.
 */
export const timeGridPlugins: PluginInput[] = [classicTheme, timeGridPlugin];

/** The above plus drag, resize and range selection, for the editable calendar. */
export const editableTimeGridPlugins: PluginInput[] = [classicTheme, timeGridPlugin, interactionPlugin];
