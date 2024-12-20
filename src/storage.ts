import { calendar_v3 as googleCalendarApi } from "googleapis"
import { getCalendarClient } from "./calendar"

type Event = googleCalendarApi.Schema$Events

type EventAction = {
  timestamp: string
  events: []
}

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
const EVENTS: EventAction[] = []

export async function getGoogleBookingDetails(eventId: string) {
  try {
    const calendar = getCalendarClient()
    const response = await calendar.events.get({
      // calendarId: "primary",
      calendarId: process.env["CALENDAR_ID"],
      eventId: eventId,
    });

    const event = response.data;

    return event;
  } catch (error) {
    console.error('Error fetching Google booking details:', error);
    throw error;
  }
}

export const updateEvents = async (events: Event[]): Promise<void> => {
  if (events.length === 0) {
    return Promise.resolve()
  }

  const eventDetails = await Promise.all(
    events.map(async (event: googleCalendarApi.Schema$Event) => {
      return await getGoogleBookingDetails(event.id as string);
    })
  )

  const now = new Date()
  const processedEvents = eventDetails.map((event: googleCalendarApi.Schema$Event) => {
    const description = event.description || '';
    const matches = description.match(/<b>Booked by<\/b>\s*(.*?)\s*([\w.-]+@[\w.-]+\.\w+)/s);
    
    return {
      bookedBy: matches ? {
        name: matches[1],
        email: matches[2]
      } : null
    };
  });

  EVENTS.push({
    timestamp: `${now.toTimeString()} | ${now.toDateString()}`,
    events: processedEvents as []
  });

  return Promise.resolve()
}

export const getEvents = (): Promise<EventAction[]> => Promise.resolve(EVENTS)

export const clearEvents = (): Promise<void> => {
  EVENTS.length = 0
  return Promise.resolve()
}
