import { Env } from "."

var globalModels: {
    name: string;
    description: string;
}[] = []
var globalModelsToSearch: string[] = []
// , ua: BaseAiTextGenerationModels
export const getModels = async (env: Env) => {
    if (globalModels.length == 0) {
        globalModels = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/models/search?task=Text Generation`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`
            }
        }).then((response) => response.json()).then((body: any) => {
            return body.result.map((r: any) => { return { name: r.name, description: r.description }})
        })
        globalModelsToSearch = globalModels.map((val) => val.name.toLowerCase().replaceAll(' ', '').split('/')[2])
    }
    return globalModels
}
export const findModel = async (query: string, env: Env) => {
    return fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/models/search?task=Text Generation&per_page=1&page=1&search=${query}`, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`
        }
    }).then((response) => response.json()).then((body: any) => {
        return body.result[0]?.name
    })
}