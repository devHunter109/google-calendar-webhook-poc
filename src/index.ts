import "dotenv/config"

import crypto from "node:crypto"
import fastify from "fastify"
import { google } from "googleapis"
import { logger } from "./logger"
import pino from "pino"

const googleCredentials = {
  clientId: process.env["GOOGLE_CLIENT_ID"],
  secret: process.env["GOOGLE_CLIENT_SECRET"],
}

const server = fastify({
  logger: pino({
    level: "info",
    messageKey: "message",
    transport: {
      target: "pino-pretty",
    },
  }),
})

const oAuthState = crypto.randomBytes(32).toString("hex")
const redirectUri = "http://localhost:3031/callback"
const oAuth2Client = new google.auth.OAuth2(
  googleCredentials.clientId,
  googleCredentials.secret,
  redirectUri,
)

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  scope: "https://www.googleapis.com/auth/calendar.events",
  redirect_uri: redirectUri,
  state: oAuthState,
  client_id: googleCredentials.clientId,
})

server.get("/", () => `Authorize your application by\n<a href=${authUrl}>${authUrl}</a>`)
server.get("/callback", (request) => `Redirected from provider. Raw request\n${request.body}`)

server.listen({ port: 3031 }, (error, address) => {
  if (error) {
    console.error("Server initialization failed.", error)
    process.exit(1)
  }

  logger.info("Server listening at ", address)
})
