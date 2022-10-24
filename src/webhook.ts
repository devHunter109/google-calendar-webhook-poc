import crypto from "node:crypto"
import type { getCalendarClient } from "./auth"
import { getConfig } from "./config"
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

  logger.info(tunnel.url, "localtunnel URL")

  const webhookId = crypto.randomUUID()

  await calendar.events.watch({
    calendarId: "primary",
    requestBody: {
      id: webhookId,
      type: "web_hook",
      address: `${tunnel.url}/webhook`,
      token: WEBHOOK_TOKEN,
    },
  })

  WEBHOOKS_REGISTERED.push(webhookId)
}
