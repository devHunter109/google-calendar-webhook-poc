import assert from "assert"
import { google } from "googleapis"

export const getPeopleClient = (): ReturnType<typeof google.people> => {
  assert(google._options.auth !== undefined, new Error("Google client not authorized"))
  return google.people({ version: "v1" })
}
