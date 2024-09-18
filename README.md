# Template: CloudflareChatAIBot

[![Deploy with Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Georglider/CloudflareChatAIBot)

## Overview

This project is a telegram bot which provides interaction with various text generation models supported by [Cloudflare Workers AI](https://ai.cloudflare.com)

## Features

* Select the text generation model to interact with
* Toggle LLM response streaming on/off
* Handle streaming and non-streaming LLM responses for Telegram chat
* Parse and display markdown in LLM responses
* Create and switch between the conversations with AI

## Prerequisites

* [Telegram Bot's API Token](https://t.me/botfather)
* [Cloudflare Account](https://cloudflare.com): Required for using Workers AI models and D1 and deploying the project on Cloudflare Workers

## Variables

* [WEBHOOK_SECRET](https://core.telegram.org/bots/api#:~:text=all%20pending%20updates-,secret_token,-String)
* DASHBOARD_SECRET: Password in order for you to control the bot via dashboard
* BOT_TOKEN: Bot API token from [BotFather](https://t.me/botfather)
* [CLOUDFLARE_ACCOUNT_ID](https://developers.cloudflare.com/fundamentals/setup/find-account-and-zone-ids/#find-account-id-workers-and-pages): Required for getting LLM model list
* [CLOUDFLARE_API_TOKEN](https://developers.cloudflare.com/cloudflare-one/api-terraform/scoped-api-tokens/#creating-a-scoped-api-token): (required permission: **Workers AI:Read**) Required for getting LLM model list
* [DEFAULT_AI_MODEL](https://developers.cloudflare.com/workers-ai/models/#text-generation): (format: @cf/meta/llama-3-8b-instruct)
* DEV_SERVER_URL: (format: "https://example.com/"); Can be used for local development

## Enabling the bot
> Assuming that you have deployed this project using Cloudflare Workers and configured variables from the previous step
1. Go to your Cloudflare Worker's link
2. Click "Admin panel" button on the top right of the page
3. Paste in WEBHOOK_SECRET's content
4. Click on "Set webhook" button
5. You can now use the bot in Telegram