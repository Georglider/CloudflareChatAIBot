import { Update } from 'node-telegram-bot-api/index'
import { apiURL, Env, request } from '.'
import { getModels, findModel } from './models'
import { getCooldown, getInitialCooldown, isStreaming, isUserWhitelisted } from './settings'

type Conversation = {
  id: number,
  user_id: number,
  last_accessed: string,
  messages: number
}
type Message = {
  id: number,
  content: string,
  telegram_msg_id: number,
  bot_message: number,
  timestamp: string
}

const process = async (update: Update, env: Env) => {
  const message = update.message
  const text = message?.text
  if (message && text) {
    if (!isUserWhitelisted(message.chat.id, env)) return Response.json({
      "chat_id": message.chat.id,
      "text": '<b>You are not allowed to use this bot!</b>',
      "method": "sendmessage",
      "parse_mode": "html"
    })
    if (text.startsWith("/")) return Response.json({
      "chat_id": message.chat.id,
      "text": await processCommand(text.substring(1), update, env),
      "method": "sendmessage"
    })
    
    const { messages: context, model: aiModel, conversationId } = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
      .bind(message.from?.id)
      .first()
      .then(async (user) => {
        const conversationId = user?.conversation_id
        if (conversationId) return env.DB.prepare("SELECT * FROM conversations WHERE id = ?").bind(conversationId).first<Conversation>().then((res) => { return { conversation: res, model: user.ai_model }})
        const { last_row_id: conversation_id } = (await env.DB.prepare("INSERT INTO conversations (user_id) VALUES (?)").bind(message.from?.id).run()).meta
        const defaultModel = env.DEFAULT_AI_MODEL ? env.DEFAULT_AI_MODEL : (await getModels(env)).at(0)?.name
        if (conversation_id) {
          if (user) {
            await env.DB.prepare("UPDATE users SET conversation_id = ?1 WHERE id = ?2").bind(conversation_id, message.from?.id).run()
          } else {
            await env.DB.prepare("INSERT INTO users (id, conversation_id, ai_model) VALUES (?1, ?2, ?3)").bind(message.from?.id, conversation_id, defaultModel).run()
          }
        }
        return { conversation: { id: conversation_id, user_id: message.from!!.id, last_accessed: '0', messages: 1 }, model: defaultModel }
      }).then(async (obj: { conversation: Conversation | null, model?: any } | null) => {
        await env.DB.prepare("INSERT INTO messages (telegram_msg_id, content, conversation_id) VALUES (?1, ?2, ?3)").bind(message.message_id, message.text, obj?.conversation?.id).run()
        return {
          messages: (await env.DB.prepare("SELECT * FROM messages WHERE conversation_id = ?").bind(obj?.conversation?.id).all<Message>()).results,
          conversationId: obj?.conversation?.id,
          model: obj?.model
        }
      })

    await sendChatAction(env.BOT_TOKEN, message.chat.id)
    return await processAI(context, aiModel, env).then(async i => {
      if (i instanceof ReadableStream) {
        return await streamMessage(i, env.BOT_TOKEN, message.chat.id, conversationId!!, env)
      }
      if (i.response) {
        const response = formatMessage(i.response.substring(0, 4096))
        await env.DB.prepare("INSERT INTO messages (content, conversation_id, bot_message) VALUES (?1, ?2, 1)").bind(response, conversationId).run()
        return Response.json({
          "chat_id": message.chat.id,
          "text": response,
          "method": "sendmessage",
          "parse_mode": "MarkdownV2"
        })
      }
      return Response.json({
        "chat_id": message.chat.id,
        "text": '*No message available*',
        "method": "sendmessage",
        "parse_mode": "MarkdownV2"
      })
    })
  }
  return Response.json({})
}

const userQueryUpdater = async (env: Env, userId: number, updateQuery: Promise<any>, createQuery: Promise<any>) => {
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first()
  if (user) return await updateQuery
  return await createQuery
}

const processCommand = async (command: string, update: Update, env: Env) => {
  if (command.startsWith('new')) {
    if (!update.message?.chat.id) return 'Account not found!'
    return await env.DB.prepare("UPDATE users SET conversation_id = NULL WHERE id = ?1").bind(update.message?.chat.id).run().then(() => 'New conversation started!')
  } else if (command.startsWith('llm')) {
    const foundModel = await findModel(command.substring(4).replaceAll('_', '-'), env)
    if (!update.message?.chat.id) return formatMessage('Account not found!')
    if (foundModel) return userQueryUpdater(env, 
      update.message?.chat.id, 
      env.DB.prepare("UPDATE users SET ai_model = ?1 WHERE id = ?2").bind(foundModel, update.message?.chat.id).run().then(() => `LLM Switched to ${foundModel}!`),
      env.DB.prepare("INSERT INTO users (id, ai_model) VALUES (?1, ?2)").bind(update.message?.from?.id, foundModel ? foundModel : env.DEFAULT_AI_MODEL ? env.DEFAULT_AI_MODEL : (await getModels(env)).at(0)?.name).run().then(() => `LLM Switched to ${foundModel}!`)
    )
    return "LLM not found"
  }
  return "Command not found!"
}

const sendMessage = async (botToken: string, chatId: number, message: string) => {
  return await request(apiURL(botToken, 'sendMessage'), {
    "chat_id": chatId,
    "text": message.substring(0, 4096),
    "parse_mode": "MarkdownV2",
  })
}

const updateMessage = async (botToken: string, chatId: number, messageId: number, message: string) => {
  return await request(apiURL(botToken, 'editMessageText'), {
    "chat_id": chatId,
    "message_id": messageId,
    "text": message.substring(0, 4096),
    "parse_mode": "MarkdownV2",
  })
}

const sendChatAction = async (botToken: string, chatId: number) => {
  await request(apiURL(botToken, 'sendChatAction'), {
    "chat_id": chatId,
    "action": "typing"
  })
}

const processAI = (context: Message[], aiModel: BaseAiImageToTextModels, env: Env) => {
  const messages = context.map((msg) => {
    return {
      role: msg.bot_message == 1 ? 'assistant' : 'user',
      content: msg.content
    }
  })

  return env.AI.run(aiModel, {
    messages,
    stream: isStreaming(env)
  })
}

export async function streamMessage(stream: ReadableStream<Uint8Array>, botToken: string, chatId: number, conversationId: number, env: Env): Promise<Response> {
  var nextCheckTime = new Date().getTime() + getInitialCooldown(env)
  const cooldown = getCooldown(env)
  let result = '';
  let msgId: number | undefined = undefined;
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    } else if (new Date().getTime() > nextCheckTime) {
      const data = result.split("\n")
      const update = formatMessage(data.filter(e => e.length > 19).map(i => i.substring(19)).map(i => i.substring(0, i.indexOf('"'))).join(''))
      if (msgId) {
        await updateMessage(botToken, chatId, msgId, update)
      } else {
        msgId = await sendMessage(botToken, chatId, update)
          .then((resp) => resp.json())
          .catch((err) => console.error(err))
          .then((resp: any) => resp['result']['message_id'])
          .catch((err) => console.error(err))
      }
      nextCheckTime = new Date().getTime() + cooldown
    }
    result += value;
  }
  const data = result.split("\n")
  const update = formatMessage(data.filter(e => e.length > 19).map(i => i.substring(19)).map(i => i.substring(0, i.indexOf('"'))).join(''))
  if (msgId) {
    await updateMessage(botToken, chatId, msgId, update)
    await env.DB.prepare("INSERT INTO messages (telegram_msg_id, content, conversation_id, bot_message) VALUES (?1, ?2, ?3, 1)").bind(msgId, update, conversationId).run()
    return Response.json({})
  } else {
    await env.DB.prepare("INSERT INTO messages (content, conversation_id, bot_message) VALUES (?1, ?2, 1)").bind(update, conversationId).run()
    return Response.json({
      "chat_id": chatId,
      "text": update.substring(0, 4096),
      "parse_mode": "MarkdownV2",
      "method": "sendmessage"
    })
  }
}

const formatMessage = (msg: string) => {
  var t = msg.replaceAll('\\n', '\n').replaceAll('**', '*')
  t = t.replace(/([|{\[\]~}+)(#>!=\-.])/gm, '\\$1')
  return t
}

export default process