import bot from "./bot";
import htmlPage from "./htmlPage"

export interface Env {
	DB: D1Database;
  AI: Ai;
  WEBHOOK_SECRET: string;
  DASHBOARD_SECRET: string;
  BOT_TOKEN: string;
  DEV_SERVER_URL: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  DEFAULT_AI_MODEL?: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: any) {
    if (request.method == 'POST') {
      console.log(request.headers.get('authorization'))
      if (request.url.endsWith("ebhook") && request.headers.get('authorization')?.substring(7) == env.DASHBOARD_SECRET) {
        const url = new URL(request.url)
        if (url.pathname.startsWith("/set")) return registerWebhook(env.BOT_TOKEN, url, env.WEBHOOK_SECRET, env.DEV_SERVER_URL)
        return removeWebhook(env.BOT_TOKEN)
      }
      if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) return new Response("unauthorized", { status: 401 })
      return await bot(await request.json(), env).catch(() => Response.json({}))
    }
    // if (request.url.endsWith('commands')) {
    //   if (request.headers.get('authorization')?.substring(7) != env.DASHBOARD_SECRET) return new Response("unauthorized", { status: 401 })
    //   return getModels(env).then((res) => res.map((llm) => `llm_${llm.name.replaceAll('-', '_').replaceAll('.', '').replaceAll('@', '').replaceAll('/', '_')} - ${llm.description.replaceAll('-', '')}`)).then((res) => new Response(res.join('\n')))
    // }
    
    return new Response(htmlPage(), {
      headers: {
        "content-type": "text/html;charset=UTF-8",
      }
    })
	}
}


function removeWebhook (token: string) {
  return request(apiURL(token, 'setWebhook'), { url: '' })
}

function registerWebhook (token: string, url: URL, secret: string, devURL: string | undefined) {
  const webhookUrl = url.port == '8787' ? devURL : `https://${url.hostname}/`
  return request(apiURL(token, 'setWebhook'), { url: webhookUrl, secret_token: secret })
}

export const request = (url: string, body: any) => fetch(url, { 
  method: "POST", 
  body: JSON.stringify(body), 
  headers: {
    "content-type": "application/json;charset=UTF-8"
  }
})
export const apiURL = (botToken: string, method: string) => `https://api.telegram.org/bot${botToken}/${method}`