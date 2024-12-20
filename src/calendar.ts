import assert from "node:assert"
import crypto from "node:crypto"
import { getConfig } from "./config"
import { google } from "googleapis"
import localtunnel from "localtunnel"
import { logger } from "./logger"

export const WEBHOOK_TOKEN = "channel=all_events" as const
export const WEBHOOKS_REGISTERED: string[] = []

export const registerWebhook = async (
  calendar: ReturnType<typeof getCalendarClient>,
): Promise<void> => {
  // expose localhost at port to the world, url generated on the fly
  const tunnel = await localtunnel({
    port: getConfig().port,
  })

  logger.debug(tunnel.url, "localtunnel URL")

  const webhookId = crypto.randomUUID()

  // POST "https://www.googleapis.com/calendar/v3/calendars/primary/events/watch"
  const response = await calendar.events.watch({
    // calendarId: "primary",
    calendarId: getConfig().calendarId,
    requestBody: {
      id: webhookId,
      type: "web_hook",
      address: `${getConfig().ngrokUrl}/webhook`,
      token: WEBHOOK_TOKEN,
    },
  })

  logger.debug(
    { data: response.data, headers: response.headers, status: response.status },
    "Register calendar events webhook response",
  )

  WEBHOOKS_REGISTERED.push(webhookId)
}

export const unsubscribeAllWebhooks = async (calendar: ReturnType<typeof getCalendarClient>) => {
  console.log("!!!!!!!!!!!!!")
  const stopChannels = WEBHOOKS_REGISTERED.map((webhookId) =>
    calendar.channels.stop({
      requestBody: {
        resourceId: webhookId,
        token: WEBHOOK_TOKEN,
      },
    }),
  )

  await Promise.all(stopChannels)
}

export const getCalendarClient = (): ReturnType<typeof google.calendar> => {
  assert(google._options.auth !== undefined, new Error("Google client not authorized"))
  return google.calendar({ version: "v3" })
}
