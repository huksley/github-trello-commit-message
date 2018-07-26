# Serverless Github comment to Trello card comment

This service will listen to github webhooks fired by a given repository.
Upon Push event (https://developer.github.com/v3/activity/events/types/#pushevent)
it will try to find card ID in comment and add comment to that card.

Only one card can be referenced in commit message.

Supported commit formats:

```
[prefix-NUM] My nice commment
[prefix#NUM] Better comment
prefix-NUM: Even better comment
prefix#NUM: Pretty self-explanatory
```

## Links

https://github.com/serverless/examples/tree/master/aws-node-github-webhook-listener
https://github.com/norberteder/trello/blob/master/main.js
https://developer.github.com/v3/activity/events/types/#commitcommentevent

## How it works

This project is build using serverless framework (https://serverless.com)

```
┌───────────────┐               ┌───────────┐
│               │               │           │
│  Github repo  │               │   Github  │
│   activity    │────Trigger───▶│  Webhook  │
│               │               │           │
└───────────────┘               └───────────┘
                                      │
                     ┌────POST────────┘
                     │
          ┌──────────▼─────────┐
          │ ┌────────────────┐ │
          │ │  API Gateway   │ │
          │ │    Endpoint    │ │
          │ └────────────────┘ │
          └─────────┬──────────┘
                    │
                    │
         ┌──────────▼──────────┐
         │ ┌────────────────┐  │
         │ │                │  │
         │ │     Lambda     │  │
         │ │    Function    │  │
         │ │                │  │
         │ └────────────────┘  │
         └─────────────────────┘
                    │
                    │
                    ▼
         ┌────────────────────┐
         │                    │
         │ Trello - find card │
         │   and add comment  │
         │                    │
         └────────────────────┘
```

## Setup

1. Copy file deploy-env-template to deploy-env and populate it with following values:

  * Generate WebHook secret (for example using pwgen 16)
  * Obtain Trello key
  * Obtain Trello token (personal)
  * Find out board ID (it is not a slug, see XHR requests when you are visit Trello Board)
  * Define prefix you will use
  
2. Continue setting up 
  
  * Enable Card Number powerup in Trello
  * Set __same__ prefix in Card Number powerup settings

3. Deploy the service

  ```bash
  yarn run deploy
  ```

  After the deploy has finished you should see something like:
  ```bash
  Service Information
  service: github-webhook-listener
  stage: dev
  region: us-east-1
  api keys:
    None
  endpoints:
    POST - https://abcdefg.execute-api.us-east-1.amazonaws.com/dev/webhook
  functions:
    github-webhook-.....github-webhook-listener-dev-githubWebhookListener
  ```

3. Configure your webhook in your github repository settings. [Setting up a Webhook](https://developer.github.com/webhooks/creating/#setting-up-a-webhook)

  **(1.)** Plugin your API POST endpoint. (`https://abcdefg.execute-api.us-east-1.amazonaws.com/dev/webhook` in this example). Run `sls info` to grab your endpoint if you don't have it handy.

  **(2.)** Plugin your secret from `GITHUB_WEBHOOK_SECRET` environment variable

  **(3.)** Choose the Push event for the github webhook to listen to

  ![webhook-steps](https://cloud.githubusercontent.com/assets/532272/21461773/db7cecd2-c922-11e6-9362-6bbf4661fe14.jpg)

4. Watch for logs 

  You can tail the logs of the lambda function with the below command to see it running.
  
  ```bash
  yarn run logs
  ```

  You should see the event from github in the lambda functions logs.

5. Start developing, mentioning trello cards and will automagically appear on comments in cards.
