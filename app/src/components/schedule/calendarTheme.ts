import interactionPlugin from '@fullcalendar/react/interaction';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import classicTheme from '@fullcalendar/react/themes/classic';
import type { PluginInput } from '@fullcalendar/react';
import './fullcalendar.css';

/** The plugin and `fullcalendar.css` are both required; one alone looks broken, not errors. */
export const timeGridPlugins: PluginInput[] = [classicTheme, timeGridPlugin];

/** The aggregate needs it for `dateClick`: a background event receives no pointer. */
export const interactiveTimeGridPlugins: PluginInput[] = [classicTheme, timeGridPlugin, interactionPlugin];
