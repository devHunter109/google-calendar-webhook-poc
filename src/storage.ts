type Event = unknown

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
