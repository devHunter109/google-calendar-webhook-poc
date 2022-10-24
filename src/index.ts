import "dotenv/config"

import { WEBHOOKS_REGISTERED, WEBHOOK_TOKEN, registerWebhook } from "./webhook"
import { addEvents, getEvents } from "./storage"
import { authorizeClient, generateAuthUrl, getCalendarClient, isOAuthStateMatch } from "./auth"

import fastify from "fastify"
import { logger } from "./logger"
import pino from "pino"
import { setServerAddress } from "./config"
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

server.get("/redirect", { logLevel: "error" }, (_, reply) => reply.redirect(generateAuthUrl()))

server.get<{
  Querystring: { code: string; state: string }
}>("/callback", { logLevel: "debug" }, async (request, reply) => {
  const { code, state } = request.query

  if (!isOAuthStateMatch(state)) {
    return reply.status(403).send("Invalid state")
  }

  await authorizeClient(code)
  await registerWebhook(getCalendarClient())

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
}>("/webhook", { logLevel: "debug" }, async (request, reply) => {
  const { "x-goog-channel-token": channelToken, "x-goog-resource-state": resourceState } =
    request.headers

  if (channelToken !== WEBHOOK_TOKEN) {
    return reply.status(403).send("Invalid webhook token")
  }

  if (resourceState === "sync") {
    return reply.status(200).send()
  }

  logger.debug({ resourceState, channelToken }, "Webhook was called")

  const BUFFER_IN_SECONDS = 5
  const updatedMin = subSeconds(new Date(), BUFFER_IN_SECONDS).toISOString()

  const calendar = getCalendarClient()
  const updatedEventsResult = await calendar.events.list({
    calendarId: "primary",
    updatedMin,
    maxResults: 10,
    singleEvents: true,
    orderBy: "startTime",
  })

  const updatedEvents = updatedEventsResult.data.items || []
  addEvents(updatedEvents)

  logger.debug(
    {
      length: updatedEvents.length,
      updatedMin,
      bufferInSeconds: BUFFER_IN_SECONDS,
    },
    "Updated events",
  )

  return reply.status(200)
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
  const stopChannels = WEBHOOKS_REGISTERED.map((webhookId) =>
    getCalendarClient().channels.stop({
      requestBody: {
        resourceId: webhookId,
        token: WEBHOOK_TOKEN,
      },
    }),
  )

  await Promise.all(stopChannels)
})
