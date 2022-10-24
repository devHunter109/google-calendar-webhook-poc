import crypto from "node:crypto"
import { getConfig } from "./config"
import { google } from "googleapis"

const config = getConfig()

const oAuthState = crypto.randomBytes(32).toString("hex")

const redirectUri = "http://localhost:3031/callback"
const oAuth2Client = new google.auth.OAuth2(
  config.google.clientId,
  config.google.secret,
  redirectUri,
)

export const generateAuthUrl = (): string =>
  oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: "https://www.googleapis.com/auth/calendar.events",
    redirect_uri: redirectUri,
    state: oAuthState,
    client_id: config.google.clientId,
  })

// @ts-ignore
export const isOAuthStateMatch = (state: string): boolean => true //state === oAuthState

export const authorizeClient = async (code: string): Promise<void> => {
  const {
    tokens: { access_token },
  } = await oAuth2Client.getToken(code)

  oAuth2Client.setCredentials({ access_token })
  google.options({ auth: oAuth2Client })
}

export const getCalendarClient = (): ReturnType<typeof google.calendar> => {
  return google.calendar({ version: "v3" })
}
