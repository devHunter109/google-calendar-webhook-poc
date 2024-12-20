import "dotenv/config"

import {
  WEBHOOK_TOKEN,
  getCalendarClient,
  registerWebhook,
  unsubscribeAllWebhooks,
} from "./calendar"
import { addEvents, clearEvents, getEvents, updateEvents } from "./storage"
import { authorizeClient, generateAuthUrl, isOAuthStateMatch } from "./auth"

import fastify from "fastify"
import { logger } from "./logger"
import pino from "pino"
import { setServerAddress } from "./config"
import subSeconds from "date-fns/subSeconds"

const server = fastify({
  logger: pino({
    level: "error",
    transport: {
      target: "pino-pretty",
    },
  }),
})

server.get("/", (_, reply) => {
  const authUrl = generateAuthUrl()
  return reply
    .type("text/html")
    .send(`Authorize your application by\n<a href=${authUrl}>${authUrl}</a>`)
})

server.get("/redirect", (_, reply) => reply.redirect(generateAuthUrl()))

server.get<{
  Querystring: { code: string; state: string }
}>("/callback", async (request, reply) => {
  const { code, state } = request.query

  if (!isOAuthStateMatch(state)) {
    return reply.status(403).send("Invalid state")
  }

  await authorizeClient(code)
  await registerWebhook(getCalendarClient())

  // return reply.send(200)
  reply.redirect('/events')
})

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
  const {
    "x-goog-channel-token": channelToken,
    "x-goog-resource-state": resourceState,
    "x-goog-channel-expiration": expirationDateString,
  } = request.headers

  if (channelToken !== WEBHOOK_TOKEN) {
    return reply.status(403).send("Invalid webhook token")
  }

  logger.debug(
    { resourceState, webhookExpiration: new Date(expirationDateString || "") },
    "Headers from webhook request",
  )
  if (resourceState === "sync") {
    logger.debug({ resourceState, channelToken }, "Webhook was synced")
    return reply.status(200).send()
  }

  // get all events updated <= seconds ago
  const BUFFER_IN_SECONDS = 10
  const updatedMinDate = subSeconds(new Date(), BUFFER_IN_SECONDS)

  const calendar = getCalendarClient()
  const updatedEventsResult = await calendar.events.list({
    // calendarId: "primary",
    calendarId: process.env["CALENDAR_ID"],
    updatedMin: updatedMinDate.toISOString(),
    maxResults: 10,
    singleEvents: false,
  })

  const updatedEvents = updatedEventsResult.data.items || []
  updateEvents(updatedEvents)

  logger.debug(
    {
      length: updatedEvents.length,
      updatedMin: updatedMinDate.toString(),
      bufferInSeconds: BUFFER_IN_SECONDS,
    },
    "Updated events",
  )

  return reply.status(200)
})

server.get("/events", () => getEvents())
server.delete("/events", { logLevel: "info" }, () => clearEvents())

server.listen({ port: 3000 }, (error, address) => {
  if (error) {
    console.error("Server initialization failed.", error)
    process.exit(1)
  }

  setServerAddress(address)
  logger.info(`Server listening at ${address}`)
})

server.addHook("onClose", async () => {
  await unsubscribeAllWebhooks(getCalendarClient())
})
