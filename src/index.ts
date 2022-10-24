import "dotenv/config"

import { addEvents, getEvents } from "./storage"
import { authorizeClient, generateAuthUrl, getCalendarClient, isOAuthStateMatch } from "./auth"
import { getConfig, setServerAddress } from "./config"

import crypto from "node:crypto"
import fastify from "fastify"
import localtunnel from "localtunnel"
import { logger } from "./logger"
import pino from "pino"
import subSeconds from "date-fns/subSeconds"

const server = fastify({
  logger: pino({
    level: "info",
    messageKey: "message",
    transport: {
      target: "pino-pretty",
    },
  }),
})

server.get("/", { logLevel: "error" }, (_, reply) => {
  const authUrl = generateAuthUrl()
  return reply
    .type("text/html")
    .send(`Authorize your application by\n<a href=${authUrl}>${authUrl}</a>`)
})

server.get("/redirect", { logLevel: "error" }, (_, reply) => {
  const authUrl = generateAuthUrl()
  return reply.redirect(authUrl)
})

const webhookToken = "channel=all_events"
const webhookId = crypto.randomUUID()

server.get<{
  Querystring: { code: string; state: string }
}>("/callback", { logLevel: "error" }, async (request, reply) => {
  const { code, state } = request.query

  if (!isOAuthStateMatch(state)) {
    return reply.status(403).send("Invalid state")
  }

  await authorizeClient(code)
  const calendar = getCalendarClient()

  const tunnel = await localtunnel({
    port: getConfig().port,
  })

  await calendar.events.watch({
    calendarId: "primary",
    requestBody: {
      id: webhookId,
      type: "web_hook",
      address: `${tunnel.url}/webhook`,
      token: webhookToken,
    },
  })

  return reply.send(200)
})

// https://developers.google.com/calendar/api/guides/push#receiving-notifications
server.post<{
  Headers: {
    "x-goog-channel-id": string
    "x-goog-message-number": number
    "x-goog-resource-id": string
    "x-goog-resource-state": "sync" | "exists" | "not_exists"
    "x-goog-resource-uri": string
    "x-goog-channel-expiration"?: string
    "x-goog-channel-token": string
  }
}>("/webhook", async (request, reply) => {
  const { "x-goog-channel-token": channelToken, "x-goog-resource-state": resourceState } =
    request.headers

  if (channelToken !== webhookToken) {
    return reply.status(403).send("Invalid webhook token")
  }

  if (resourceState === "sync") {
    return reply.status(200).send()
  }

  console.log("🚀 ~ file: index.ts ~ line 92 ~ request.body", request.body)

  const calendar = getCalendarClient()
  const result = await calendar.events.list({
    calendarId: "primary",
    updatedMin: subSeconds(new Date(), 5).toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: "startTime",
  })

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
  addEvents(result.data.items || [])

  return reply.status(200).send("Webhook received")
})

server.get("/events", { logLevel: "error" }, () => getEvents())
server.delete("/events", { logLevel: "error" }, () => getEvents())

server.listen({ port: 3031 }, (error, address) => {
  if (error) {
    console.error("Server initialization failed.", error)
    process.exit(1)
  }

  setServerAddress(address)
  logger.info("Server listening at ", address)
})

server.addHook("onClose", async () => {
  getCalendarClient().channels.stop({
    requestBody: {
      resourceId: webhookId,
      token: webhookToken,
    },
  })
})
