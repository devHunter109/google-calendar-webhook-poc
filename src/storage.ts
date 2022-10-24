type Event = unknown

/**
 * Status of the event. Optional. Possible values are:
 * - "confirmed" - The event is confirmed. This is the default status.
 * - "tentative" - The event is tentatively confirmed.
 * - "cancelled" - The event is cancelled (deleted). The list method returns cancelled events only on incremental sync (when syncToken or updatedMin are specified) or if the showDeleted flag is set to true. The get method always returns them.
 * A cancelled status represents two different states depending on the event type:
 * - Cancelled exceptions of an uncancelled recurring event indicate that this instance should no longer be presented to the user. Clients should store these events for the lifetime of the parent recurring event.
 * Cancelled exceptions are only guaranteed to have values for the id, recurringEventId and originalStartTime fields populated. The other fields might be empty.
 * - All other cancelled events represent deleted events. Clients should remove their locally synced copies. Such cancelled events will eventually disappear, so do not rely on them being available indefinitely.
 * Deleted events are only guaranteed to have the id field populated.   On the organizer's calendar, cancelled events continue to expose event details (summary, location, etc.) so that they can be restored (undeleted). Similarly, the events to which the user was invited and that they manually removed continue to provide details. However, incremental sync requests with showDeleted set to false will not return these details.
 * If an event changes its organizer (for example via the move operation) and the original organizer is not on the attendee list, it will leave behind a cancelled event where only the id field is guaranteed to be populated.
 */
const EVENTS: Event[] = []

export const addEvents = (events: Event[]): Promise<void> => {
  EVENTS.push(events)
  return Promise.resolve()
}

export const getEvents = (): Promise<Event[]> => Promise.resolve(EVENTS)

export const clearEvents = (): Promise<void> => {
  EVENTS.length = 0
  return Promise.resolve()
}
